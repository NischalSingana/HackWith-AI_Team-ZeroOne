"""
Neo4j Connection Manager for CrimeGraph AI.

Provides a singleton-style connection pool to the Neo4j graph database.
Handles connection lifecycle, health checks, and query execution helpers.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from neo4j import GraphDatabase, Driver, Session, ManagedTransaction
from neo4j.exceptions import ServiceUnavailable, AuthError

logger = logging.getLogger(__name__)

# ==================== Configuration ====================

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "crimegraph_password")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


class Neo4jConnection:
    """
    Manages the Neo4j driver connection with automatic lifecycle management.
    
    Usage:
        neo4j_conn = Neo4jConnection()
        neo4j_conn.connect()
        
        # Run a query
        result = neo4j_conn.execute_read("MATCH (n:FIR) RETURN count(n) AS count")
        
        # Cleanup
        neo4j_conn.close()
    """

    _instance: Optional["Neo4jConnection"] = None
    _driver: Optional[Driver] = None

    def __new__(cls):
        """Singleton pattern — only one connection pool per process."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def connect(self) -> bool:
        """
        Establish connection to Neo4j.
        Returns True if successful, False otherwise.
        """
        if self._driver is not None:
            return True

        try:
            # Use neo4j:// for Aura or bolt:// for direct
            # Protocol sync failed often occurs with Bolt protocol mismatch or network instability
            # Explicitly setting resolver or using neo4j:// usually helps
            self._driver = GraphDatabase.driver(
                NEO4J_URI,
                auth=(NEO4J_USER, NEO4J_PASSWORD),
                max_connection_lifetime=3600,
                max_connection_pool_size=50,
                connection_acquisition_timeout=60, # Increased timeout
            )
            # Verify connectivity with a retry
            try:
                self._driver.verify_connectivity()
            except Exception as e:
                logger.warning(f"⚠️ Initial connectivity check failed, retrying once: {e}")
                self._driver.verify_connectivity()
                
            logger.info(f"✅ Connected to Neo4j at {NEO4J_URI}")
            return True

        except AuthError as e:
            logger.error(f"❌ Neo4j authentication failed: {e}")
            self._driver = None
            return False
        except ServiceUnavailable as e:
            logger.error(f"❌ Neo4j service unavailable at {NEO4J_URI}: {e}")
            self._driver = None
            return False
        except Exception as e:
            logger.error(f"❌ Neo4j connection error: {e}")
            self._driver = None
            return False

    def close(self):
        """Close the Neo4j driver connection."""
        if self._driver:
            self._driver.close()
            self._driver = None
            logger.info("🔌 Neo4j connection closed")

    @property
    def is_connected(self) -> bool:
        """Check if the driver is connected."""
        if self._driver is None:
            return False
        try:
            self._driver.verify_connectivity()
            return True
        except Exception:
            return False

    def health_check(self) -> Dict[str, Any]:
        """
        Perform a health check on the Neo4j connection.
        Returns a dict with status info.
        """
        if not self.is_connected:
            return {
                "status": "disconnected",
                "uri": NEO4J_URI,
                "error": "Driver not connected"
            }

        try:
            result = self.execute_read(
                "CALL dbms.components() YIELD name, versions, edition "
                "RETURN name, versions[0] AS version, edition"
            )
            if result:
                info = result[0]
                node_count = self.execute_read(
                    "MATCH (n) RETURN count(n) AS count"
                )
                rel_count = self.execute_read(
                    "MATCH ()-[r]->() RETURN count(r) AS count"
                )
                return {
                    "status": "connected",
                    "uri": NEO4J_URI,
                    "version": info.get("version", "unknown"),
                    "edition": info.get("edition", "unknown"),
                    "node_count": node_count[0]["count"] if node_count else 0,
                    "relationship_count": rel_count[0]["count"] if rel_count else 0,
                }
            return {"status": "connected", "uri": NEO4J_URI}
        except Exception as e:
            return {
                "status": "error",
                "uri": NEO4J_URI,
                "error": str(e)
            }

    @contextmanager
    def get_session(self, database: Optional[str] = None):
        """
        Context manager that yields a Neo4j session.
        
        Usage:
            with neo4j_conn.get_session() as session:
                result = session.run("MATCH (n) RETURN n LIMIT 10")
        """
        if not self._driver:
            raise ConnectionError("Neo4j driver not initialized. Call connect() first.")
        
        db = database or NEO4J_DATABASE
        session = self._driver.session(database=db)
        try:
            yield session
        finally:
            session.close()

    def execute_read(
        self, query: str, parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a read transaction and return results as a list of dicts.
        """
        if not self._driver:
            raise ConnectionError("Neo4j driver not initialized. Call connect() first.")

        def _read_tx(tx: ManagedTransaction):
            result = tx.run(query, parameters or {})
            return [record.data() for record in result]

        try:
            with self.get_session() as session:
                return session.execute_read(_read_tx)
        except (ServiceUnavailable, ConnectionError) as e:
            logger.warning(f"⚠️ Neo4j transaction failed ({e}), attempting to reconnect and retry...")
            self.close()
            if self.connect():
                with self.get_session() as session:
                    return session.execute_read(_read_tx)
            raise e

    def execute_write(
        self, query: str, parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a write transaction and return results as a list of dicts.
        """
        if not self._driver:
            raise ConnectionError("Neo4j driver not initialized. Call connect() first.")

        def _write_tx(tx: ManagedTransaction):
            result = tx.run(query, parameters or {})
            return [record.data() for record in result]

        try:
            with self.get_session() as session:
                return session.execute_write(_write_tx)
        except (ServiceUnavailable, ConnectionError) as e:
            logger.warning(f"⚠️ Neo4j write transaction failed ({e}), attempting to reconnect and retry...")
            self.close()
            if self.connect():
                with self.get_session() as session:
                    return session.execute_write(_write_tx)
            raise e

    def execute_write_batch(
        self, queries: List[Dict[str, Any]]
    ) -> int:
        """
        Execute multiple write queries in a single transaction.
        Each item in queries should be {"query": "...", "parameters": {...}}.
        Returns the number of queries executed.
        """
        if not self._driver:
            raise ConnectionError("Neo4j driver not initialized. Call connect() first.")

        def _batch_tx(tx: ManagedTransaction):
            count = 0
            for q in queries:
                tx.run(q["query"], q.get("parameters", {}))
                count += 1
            return count

        with self.get_session() as session:
            return session.execute_write(_batch_tx)


# ==================== Module-level singleton ====================

_neo4j_conn: Optional[Neo4jConnection] = None


def get_neo4j() -> Neo4jConnection:
    """Get the global Neo4j connection singleton."""
    global _neo4j_conn
    if _neo4j_conn is None:
        _neo4j_conn = Neo4jConnection()
    return _neo4j_conn


def init_neo4j() -> bool:
    """
    Initialize and connect the global Neo4j instance.
    Returns True if connected successfully.
    """
    conn = get_neo4j()
    success = conn.connect()
    if success:
        logger.info("✅ Neo4j initialized successfully")
    else:
        logger.warning("⚠️ Neo4j unavailable — falling back to 'Neural Prototype Mode' (NetworkX Synthetic Data).")
        logger.info("💡 TIP: Run 'docker-compose up -d neo4j' to activate the full Neo4j Graph Database.")
    return success


def close_neo4j():
    """Close the global Neo4j connection."""
    global _neo4j_conn
    if _neo4j_conn:
        _neo4j_conn.close()
        _neo4j_conn = None

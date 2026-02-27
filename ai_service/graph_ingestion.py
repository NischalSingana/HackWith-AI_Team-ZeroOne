"""
Graph Ingestion Pipeline for CrimeGraph AI.

Transforms relational FIR data (from PostgreSQL) into a connected graph
in Neo4j. Handles node creation, relationship linking, and batch operations.
"""

import logging
import hashlib
from typing import Dict, Any, List, Optional
from neo4j_connection import get_neo4j

logger = logging.getLogger(__name__)


# ==================== Node Creation Queries ====================

CREATE_FIR_NODE = """
MERGE (f:FIR {fir_number: $fir_number})
SET f.incident_date   = $incident_date,
    f.reported_date   = $reported_date,
    f.cause           = $cause,
    f.severity        = $severity,
    f.confidence_score = $confidence_score,
    f.status          = $status,
    f.postgres_id     = $postgres_id,
    f.raw_text        = $raw_text
RETURN f
"""

CREATE_LOCATION_NODE = """
MERGE (l:Location {location_id: $location_id})
SET l.address   = $address,
    l.area      = $area,
    l.city      = $city,
    l.latitude  = $latitude,
    l.longitude = $longitude
RETURN l
"""

CREATE_PERSON_NODE = """
MERGE (p:Person {person_id: $person_id})
SET p.name   = $name,
    p.age    = $age,
    p.gender = $gender,
    p.role   = $role
RETURN p
"""

CREATE_VEHICLE_NODE = """
MERGE (v:Vehicle {vehicle_id: $vehicle_id})
SET v.vehicle_number = $vehicle_number,
    v.vehicle_type   = $vehicle_type,
    v.driver_name    = $driver_name
RETURN v
"""

# ==================== Relationship Creation Queries ====================

LINK_FIR_LOCATION = """
MATCH (f:FIR {fir_number: $fir_number})
MATCH (l:Location {location_id: $location_id})
MERGE (f)-[r:OCCURRED_AT]->(l)
SET r.primary = true
RETURN r
"""

LINK_FIR_PERSON = """
MATCH (f:FIR {fir_number: $fir_number})
MATCH (p:Person {person_id: $person_id})
MERGE (f)-[r:INVOLVES_PERSON]->(p)
SET r.role = $role
RETURN r
"""

LINK_FIR_VEHICLE = """
MATCH (f:FIR {fir_number: $fir_number})
MATCH (v:Vehicle {vehicle_id: $vehicle_id})
MERGE (f)-[r:INVOLVES_VEHICLE]->(v)
RETURN r
"""

LINK_PERSON_INJURED = """
MATCH (p:Person {person_id: $person_id})
MATCH (f:FIR {fir_number: $fir_number})
MERGE (p)-[r:INJURED_IN]->(f)
SET r.injury_severity = $injury_severity,
    r.is_fatality     = $is_fatality
RETURN r
"""

LINK_FIR_CRIMETYPE = """
MATCH (f:FIR {fir_number: $fir_number})
MERGE (ct:CrimeType {name: $crime_type})
MERGE (f)-[r:CLASSIFIED_AS]->(ct)
RETURN r
"""

LINK_NEARBY_LOCATIONS = """
MATCH (l1:Location {location_id: $loc_id_1})
MATCH (l2:Location {location_id: $loc_id_2})
WHERE l1 <> l2
MERGE (l1)-[r:NEAR]->(l2)
SET r.distance_km = $distance_km
RETURN r
"""

LINK_RELATED_FIRS = """
MATCH (f1:FIR {fir_number: $fir_number_1})
MATCH (f2:FIR {fir_number: $fir_number_2})
WHERE f1 <> f2
MERGE (f1)-[r:RELATED_TO]->(f2)
SET r.relation_type    = $relation_type,
    r.similarity_score = $similarity_score
RETURN r
"""


# ==================== Helper Functions ====================

def generate_id(*parts) -> str:
    """Generate a deterministic unique ID from input parts."""
    raw = "_".join(str(p) for p in parts if p)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def classify_crime_type(cause: str) -> str:
    """Map a cause string to a CrimeType label."""
    if not cause:
        return "Unknown"
    cause_lower = cause.lower()
    mapping = {
        "drunk": "Drunk Driving",
        "rash": "Rash Driving",
        "over speed": "Over Speeding",
        "overspe": "Over Speeding",
        "signal": "Signal Violation",
        "wrong side": "Wrong Side Driving",
        "negligent": "Negligent Driving",
        "hit and run": "Hit and Run",
        "hit & run": "Hit and Run",
    }
    for keyword, crime_type in mapping.items():
        if keyword in cause_lower:
            return crime_type
    return "Road Accident"


# ==================== Core Ingestion Functions ====================

def ingest_fir_to_graph(fir_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ingest a single FIR record into the Neo4j graph.
    
    Expected fir_data structure (from PostgreSQL join):
    {
        "id": 1,
        "fir_number": "123/2024",
        "incident_date": "2024-01-15",
        "cause": "Over Speeding",
        "severity": "Grievous",
        "confidence_score": 0.85,
        "status": "Processed",
        "raw_text": "...",
        "location": {"address": "...", "area": "...", "city": "...", "lat": ..., "lng": ...},
        "victims": [{"name": "...", "age": 25, "gender": "Male", "injury": "..."}],
        "vehicles": [{"type": "Car", "number": "AP21AB1234", "driver_name": "..."}]
    }
    """
    neo4j = get_neo4j()
    if not neo4j.is_connected:
        logger.warning("⚠️ Neo4j not connected — skipping graph ingestion")
        return {"status": "skipped", "reason": "Neo4j not connected"}

    fir_number = fir_data.get("fir_number", "UNKNOWN")
    stats = {"nodes_created": 0, "relationships_created": 0}

    try:
        # 1. Create FIR node
        neo4j.execute_write(CREATE_FIR_NODE, {
            "fir_number": fir_number,
            "incident_date": fir_data.get("incident_date"),
            "reported_date": fir_data.get("reported_date"),
            "cause": fir_data.get("cause", "Under Investigation"),
            "severity": fir_data.get("severity", "Unknown"),
            "confidence_score": fir_data.get("confidence_score", 0.0),
            "status": fir_data.get("status", "Processed"),
            "postgres_id": fir_data.get("id"),
            "raw_text": fir_data.get("raw_text", "")[:1000],  # Truncate raw text
        })
        stats["nodes_created"] += 1

        # 2. Create Location node + link
        loc = fir_data.get("location", {})
        if loc:
            loc_id = generate_id(
                loc.get("address", ""), 
                loc.get("area", ""), 
                loc.get("city", "Vijayawada")
            )
            neo4j.execute_write(CREATE_LOCATION_NODE, {
                "location_id": loc_id,
                "address": loc.get("address", "Unknown"),
                "area": loc.get("area", "Unknown"),
                "city": loc.get("city", "Vijayawada"),
                "latitude": loc.get("lat") or loc.get("latitude"),
                "longitude": loc.get("lng") or loc.get("longitude"),
            })
            stats["nodes_created"] += 1

            neo4j.execute_write(LINK_FIR_LOCATION, {
                "fir_number": fir_number,
                "location_id": loc_id,
            })
            stats["relationships_created"] += 1

        # 3. Create Person nodes (victims) + links
        for i, victim in enumerate(fir_data.get("victims", [])):
            person_id = generate_id(
                fir_number, "victim", i, 
                victim.get("name", ""), 
                victim.get("age", "")
            )
            neo4j.execute_write(CREATE_PERSON_NODE, {
                "person_id": person_id,
                "name": victim.get("name", "Unknown"),
                "age": victim.get("age"),
                "gender": victim.get("gender"),
                "role": "Victim",
            })
            stats["nodes_created"] += 1

            neo4j.execute_write(LINK_FIR_PERSON, {
                "fir_number": fir_number,
                "person_id": person_id,
                "role": "victim",
            })
            stats["relationships_created"] += 1

            # Injury relationship
            is_fatal = fir_data.get("severity") == "Fatal"
            neo4j.execute_write(LINK_PERSON_INJURED, {
                "person_id": person_id,
                "fir_number": fir_number,
                "injury_severity": victim.get("injury", "Unknown"),
                "is_fatality": is_fatal,
            })
            stats["relationships_created"] += 1

        # 4. Create Vehicle nodes + links
        for i, vehicle in enumerate(fir_data.get("vehicles", [])):
            veh_id = generate_id(
                vehicle.get("number", ""),
                vehicle.get("type", ""),
                fir_number, i
            )
            neo4j.execute_write(CREATE_VEHICLE_NODE, {
                "vehicle_id": veh_id,
                "vehicle_number": vehicle.get("number"),
                "vehicle_type": vehicle.get("type", "Unknown"),
                "driver_name": vehicle.get("driver_name", "Unknown"),
            })
            stats["nodes_created"] += 1

            neo4j.execute_write(LINK_FIR_VEHICLE, {
                "fir_number": fir_number,
                "vehicle_id": veh_id,
            })
            stats["relationships_created"] += 1

        # 5. Classify and link crime type
        crime_type = classify_crime_type(fir_data.get("cause", ""))
        neo4j.execute_write(LINK_FIR_CRIMETYPE, {
            "fir_number": fir_number,
            "crime_type": crime_type,
        })
        stats["relationships_created"] += 1

        logger.info(
            f"✅ Ingested FIR {fir_number} → "
            f"{stats['nodes_created']} nodes, {stats['relationships_created']} relationships"
        )
        return {"status": "success", "fir_number": fir_number, **stats}

    except Exception as e:
        logger.error(f"❌ Error ingesting FIR {fir_number}: {e}")
        return {"status": "error", "fir_number": fir_number, "error": str(e)}


def ingest_batch(fir_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Ingest a batch of FIR records into the Neo4j graph.
    Returns summary statistics.
    """
    results = {
        "total": len(fir_records),
        "success": 0,
        "skipped": 0,
        "errors": 0,
        "total_nodes": 0,
        "total_relationships": 0,
        "error_details": [],
    }

    for record in fir_records:
        result = ingest_fir_to_graph(record)
        if result["status"] == "success":
            results["success"] += 1
            results["total_nodes"] += result.get("nodes_created", 0)
            results["total_relationships"] += result.get("relationships_created", 0)
        elif result["status"] == "skipped":
            results["skipped"] += 1
        else:
            results["errors"] += 1
            results["error_details"].append({
                "fir_number": result.get("fir_number"),
                "error": result.get("error"),
            })

    logger.info(
        f"📊 Batch ingestion complete: "
        f"{results['success']}/{results['total']} success, "
        f"{results['errors']} errors, "
        f"{results['total_nodes']} nodes, "
        f"{results['total_relationships']} relationships"
    )
    return results


def get_graph_stats() -> Dict[str, Any]:
    """Get summary statistics about the current graph."""
    neo4j = get_neo4j()
    if not neo4j.is_connected:
        return {"status": "disconnected"}

    try:
        labels_result = neo4j.execute_read(
            "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count "
            "ORDER BY count DESC"
        )
        rel_result = neo4j.execute_read(
            "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count "
            "ORDER BY count DESC"
        )
        return {
            "status": "connected",
            "node_counts": {r["label"]: r["count"] for r in labels_result},
            "relationship_counts": {r["type"]: r["count"] for r in rel_result},
            "total_nodes": sum(r["count"] for r in labels_result),
            "total_relationships": sum(r["count"] for r in rel_result),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def clear_graph() -> Dict[str, Any]:
    """
    Delete all nodes and relationships from the graph.
    ⚠️ Use with caution — this is destructive!
    """
    neo4j = get_neo4j()
    if not neo4j.is_connected:
        return {"status": "disconnected"}

    try:
        neo4j.execute_write("MATCH (n) DETACH DELETE n")
        logger.warning("🗑️ Graph cleared — all nodes and relationships deleted")
        return {"status": "cleared"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

"""
Graph Analysis Engine for CrimeGraph AI using NetworkX.

Pulls graph data from Neo4j into NetworkX for in-memory analysis.
Implements centrality, community detection, path analysis, and
hotspot identification algorithms for crime pattern discovery.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

import networkx as nx

from neo4j_connection import get_neo4j

logger = logging.getLogger(__name__)


# ============================================================
# Mock Graph Generator — Prototype Fallback
# ============================================================

def generate_mock_graph() -> nx.MultiDiGraph:
    """
    Build a graph from the PostgreSQL database when Neo4j is unavailable.
    Pulls real FIR data that was uploaded and analyzed, creating a full
    graph with FIR, Location, Person, Vehicle, and CrimeType nodes.
    Falls back to a small synthetic graph only if PostgreSQL also fails.
    """
    import os
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    if DATABASE_URL:
        try:
            import psycopg2
            import psycopg2.extras
            
            logger.info("Neo4j unavailable — building graph from PostgreSQL data...")
            conn = psycopg2.connect(DATABASE_URL, sslmode='require')
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            G = nx.MultiDiGraph()
            
            # 1. Load all accidents as FIR nodes
            cur.execute("""
                SELECT id, fir_number, incident_date, cause, severity, confidence_score, status
                FROM accidents ORDER BY id
            """)
            accidents = cur.fetchall()
            
            if accidents:
                for acc in accidents:
                    fir_id = acc['fir_number'] or f"FIR_{acc['id']}"
                    G.add_node(fir_id, 
                        node_type="FIR", 
                        severity=acc.get('severity') or 'Unknown',
                        cause=acc.get('cause'),
                        confidence=float(acc.get('confidence_score') or 0),
                        incident_date=str(acc.get('incident_date') or ''),
                        postgres_id=acc['id']
                    )
                
                # 2. Load locations
                cur.execute("""
                    SELECT l.id, l.accident_id, l.address, l.area, l.city, l.latitude, l.longitude,
                           a.fir_number
                    FROM locations l
                    JOIN accidents a ON a.id = l.accident_id
                """)
                locations = cur.fetchall()
                
                seen_locations = {}
                for loc in locations:
                    area = loc.get('area') or loc.get('address') or 'Unknown Area'
                    loc_key = area.strip().upper()
                    if loc_key not in seen_locations:
                        loc_id = f"LOC_{loc['id']}"
                        seen_locations[loc_key] = loc_id
                        G.add_node(loc_id,
                            node_type="Location",
                            area=area,
                            city=loc.get('city') or 'Vijayawada',
                            lat=float(loc['latitude']) if loc.get('latitude') else None,
                            lng=float(loc['longitude']) if loc.get('longitude') else None,
                        )
                    else:
                        loc_id = seen_locations[loc_key]
                    
                    fir_id = loc.get('fir_number') or f"FIR_{loc['accident_id']}"
                    if fir_id in G and loc_id in G:
                        G.add_edge(fir_id, loc_id, rel_type="OCCURRED_AT", weight=1.0)
                
                # 3. Load victims as Person nodes
                cur.execute("""
                    SELECT v.id, v.accident_id, v.victim_name, v.age, v.gender, v.injury_severity,
                           a.fir_number
                    FROM victims v
                    JOIN accidents a ON a.id = v.accident_id
                """)
                victims = cur.fetchall()
                
                for vic in victims:
                    person_id = f"P_{vic['id']}"
                    name = vic.get('victim_name') or f"Person {vic['id']}"
                    G.add_node(person_id,
                        node_type="Person",
                        name=name,
                        age=vic.get('age'),
                        gender=vic.get('gender'),
                        role="Victim",
                    )
                    fir_id = vic.get('fir_number') or f"FIR_{vic['accident_id']}"
                    if fir_id in G:
                        G.add_edge(fir_id, person_id, rel_type="INVOLVES_PERSON", role="Victim", weight=1.0)
                
                # 4. Load vehicles
                cur.execute("""
                    SELECT veh.id, veh.accident_id, veh.vehicle_type, veh.vehicle_number, veh.driver_name,
                           a.fir_number
                    FROM vehicles veh
                    JOIN accidents a ON a.id = veh.accident_id
                """)
                vehicles = cur.fetchall()
                
                for veh in vehicles:
                    veh_id = f"V_{veh['id']}"
                    G.add_node(veh_id,
                        node_type="Vehicle",
                        vehicle_type=veh.get('vehicle_type'),
                        vehicle_number=veh.get('vehicle_number'),
                    )
                    fir_id = veh.get('fir_number') or f"FIR_{veh['accident_id']}"
                    if fir_id in G:
                        G.add_edge(fir_id, veh_id, rel_type="INVOLVES_VEHICLE", weight=1.0)
                    
                    if veh.get('driver_name') and veh['driver_name'] != 'Unknown':
                        driver_id = f"P_DRV_{veh['id']}"
                        G.add_node(driver_id,
                            node_type="Person",
                            name=veh['driver_name'],
                            role="Driver",
                        )
                        if fir_id in G:
                            G.add_edge(fir_id, driver_id, rel_type="INVOLVES_PERSON", role="Driver", weight=1.0)
                
                # 5. Create CrimeType nodes from causes
                cause_map = {}
                for acc in accidents:
                    cause = acc.get('cause')
                    if cause and cause != 'Under Investigation':
                        cause_key = cause.strip().upper()[:60]
                        if cause_key not in cause_map:
                            crime_id = cause_key.replace(' ', '_')
                            cause_map[cause_key] = crime_id
                            G.add_node(crime_id, node_type="CrimeType")
                        
                        fir_id = acc['fir_number'] or f"FIR_{acc['id']}"
                        if fir_id in G and cause_map[cause_key] in G:
                            G.add_edge(fir_id, cause_map[cause_key], rel_type="CLASSIFIED_AS", weight=1.0)
                
                cur.close()
                conn.close()
                
                logger.info(
                    f"Built graph from PostgreSQL: {G.number_of_nodes()} nodes, "
                    f"{G.number_of_edges()} edges "
                    f"({len(accidents)} FIRs, {len(locations)} locations, "
                    f"{len(victims)} victims, {len(vehicles)} vehicles)"
                )
                return G
                
        except ImportError:
            logger.warning("psycopg2 not installed — falling back to synthetic mock data")
        except Exception as e:
            logger.warning(f"PostgreSQL fallback failed: {e} — using synthetic mock data")
    
    # Static fallback (last resort)
    logger.info("Using static synthetic mock graph")
    G = nx.MultiDiGraph()
    
    firs = [
        {"id": "FIR/2024/001", "sev": "Fatal", "cause": "Overspeeding", "date": "2024-05-12 14:30"},
        {"id": "FIR/2024/002", "sev": "Grievous", "cause": "Drunken Driving", "date": "2024-05-13 22:15"},
        {"id": "FIR/2024/003", "sev": "Non-Fatal", "cause": "Brake Failure", "date": "2024-05-14 09:45"},
        {"id": "FIR/2024/004", "sev": "Fatal", "cause": "Wrong Side", "date": "2024-05-15 18:20"},
        {"id": "FIR/2024/005", "sev": "Grievous", "cause": "Overspeeding", "date": "2024-05-16 11:10"},
    ]
    for fir in firs:
        G.add_node(fir["id"], node_type="FIR", severity=fir["sev"], cause=fir["cause"], incident_date=fir["date"])
    locations = [
        {"id": "LOC_BENZ_CIRCLE", "area": "Benz Circle", "lat": 16.502, "lng": 80.647},
        {"id": "LOC_PNBS", "area": "PNBS", "lat": 16.518, "lng": 80.620},
        {"id": "LOC_RAMAVARAPPADU", "area": "Ramavarappadu", "lat": 16.512, "lng": 80.672},
    ]
    for loc in locations:
        G.add_node(loc["id"], node_type="Location", area=loc["area"], lat=loc["lat"], lng=loc["lng"])
    persons = [
        {"id": "P_001", "name": "Ravi Kumar", "role": "Driver"},
        {"id": "P_002", "name": "Suresh Raina", "role": "Victim"},
        {"id": "P_003", "name": "Venkatesh Babu", "role": "Witness"},
    ]
    for p in persons:
        G.add_node(p["id"], node_type="Person", name=p["name"], role=p["role"])
    crime_types = ["OVERSPEEDING", "DRUNKEN_DRIVING", "MECHANICAL_FAILURE", "TRAFFIC_VIOLATION"]
    for ct in crime_types:
        G.add_node(ct, node_type="CrimeType")
    G.add_edge("FIR/2024/001", "LOC_BENZ_CIRCLE", rel_type="OCCURRED_AT")
    G.add_edge("FIR/2024/002", "LOC_PNBS", rel_type="OCCURRED_AT")
    G.add_edge("FIR/2024/003", "LOC_RAMAVARAPPADU", rel_type="OCCURRED_AT")
    G.add_edge("FIR/2024/004", "LOC_BENZ_CIRCLE", rel_type="OCCURRED_AT")
    G.add_edge("FIR/2024/005", "LOC_PNBS", rel_type="OCCURRED_AT")
    G.add_edge("FIR/2024/001", "P_001", rel_type="INVOLVES_PERSON", role="Driver")
    G.add_edge("FIR/2024/001", "P_002", rel_type="INVOLVES_PERSON", role="Victim")
    G.add_edge("FIR/2024/002", "P_003", rel_type="INVOLVES_PERSON", role="Witness")
    G.add_edge("FIR/2024/001", "OVERSPEEDING", rel_type="CLASSIFIED_AS")
    G.add_edge("FIR/2024/002", "DRUNKEN_DRIVING", rel_type="CLASSIFIED_AS")
    G.add_edge("FIR/2024/003", "MECHANICAL_FAILURE", rel_type="CLASSIFIED_AS")
    G.add_edge("FIR/2024/004", "TRAFFIC_VIOLATION", rel_type="CLASSIFIED_AS")
    G.add_edge("FIR/2024/005", "OVERSPEEDING", rel_type="CLASSIFIED_AS")
    return G

# ============================================================
# Graph Builder — Load from Neo4j into NetworkX
# ============================================================

def build_networkx_graph(
    include_persons: bool = True,
    include_vehicles: bool = True,
    include_locations: bool = True,
    limit: Optional[int] = None,
) -> nx.MultiDiGraph:
    """
    Pull node and relationship data from Neo4j and build an in-memory
    NetworkX MultiDiGraph for analysis.

    Node types represented:
      - FIR       (fir_number as ID)
      - Location  (location_id as ID)
      - Person    (person_id as ID)
      - Vehicle   (vehicle_id as ID)
      - CrimeType (name as ID)

    Returns an empty graph if Neo4j is unavailable.
    """
    neo4j = get_neo4j()
    if not neo4j.is_connected:
        logger.warning("⚠️ Neo4j not connected — generating intelligent prototype mock graph")
        return generate_mock_graph()

    G = nx.MultiDiGraph()

    # ── 1. Load FIR nodes ──────────────────────────────────
    fir_limit = f"LIMIT {limit}" if limit else ""
    fir_rows = neo4j.execute_read(
        f"""
        MATCH (f:FIR)
        RETURN f.fir_number AS id, f.severity AS severity,
               f.cause AS cause, f.confidence_score AS confidence,
               f.incident_date AS incident_date, f.postgres_id AS postgres_id
        {fir_limit}
        """
    )
    for row in fir_rows:
        G.add_node(
            row["id"],
            node_type="FIR",
            severity=row.get("severity", "Unknown"),
            cause=row.get("cause"),
            confidence=row.get("confidence", 0.0),
            incident_date=str(row.get("incident_date", "")),
            postgres_id=row.get("postgres_id"),
        )

    # ── 2. Load Location nodes ─────────────────────────────
    if include_locations:
        loc_rows = neo4j.execute_read(
            """
            MATCH (l:Location)
            RETURN l.location_id AS id, l.area AS area,
                   l.city AS city, l.latitude AS lat, l.longitude AS lng
            """
        )
        for row in loc_rows:
            G.add_node(
                row["id"],
                node_type="Location",
                area=row.get("area"),
                city=row.get("city"),
                lat=row.get("lat"),
                lng=row.get("lng"),
            )

        # FIR → Location edges
        oc_rows = neo4j.execute_read(
            """
            MATCH (f:FIR)-[r:OCCURRED_AT]->(l:Location)
            RETURN f.fir_number AS fir, l.location_id AS loc
            """
        )
        for row in oc_rows:
            if row["fir"] in G and row["loc"] in G:
                G.add_edge(row["fir"], row["loc"], rel_type="OCCURRED_AT", weight=1.0)

    # ── 3. Load Person nodes ───────────────────────────────
    if include_persons:
        person_rows = neo4j.execute_read(
            """
            MATCH (p:Person)
            RETURN p.person_id AS id, p.name AS name,
                   p.age AS age, p.gender AS gender, p.role AS role
            """
        )
        for row in person_rows:
            G.add_node(
                row["id"],
                node_type="Person",
                name=row.get("name"),
                age=row.get("age"),
                gender=row.get("gender"),
                role=row.get("role"),
            )

        # FIR → Person edges
        ip_rows = neo4j.execute_read(
            """
            MATCH (f:FIR)-[r:INVOLVES_PERSON]->(p:Person)
            RETURN f.fir_number AS fir, p.person_id AS person, r.role AS role
            """
        )
        for row in ip_rows:
            if row["fir"] in G and row["person"] in G:
                G.add_edge(
                    row["fir"], row["person"],
                    rel_type="INVOLVES_PERSON", role=row.get("role"), weight=1.0
                )

    # ── 4. Load Vehicle nodes ──────────────────────────────
    if include_vehicles:
        veh_rows = neo4j.execute_read(
            """
            MATCH (v:Vehicle)
            RETURN v.vehicle_id AS id, v.vehicle_number AS number,
                   v.vehicle_type AS vtype
            """
        )
        for row in veh_rows:
            G.add_node(
                row["id"],
                node_type="Vehicle",
                vehicle_number=row.get("number"),
                vehicle_type=row.get("vtype"),
            )

        # FIR → Vehicle edges
        iv_rows = neo4j.execute_read(
            """
            MATCH (f:FIR)-[r:INVOLVES_VEHICLE]->(v:Vehicle)
            RETURN f.fir_number AS fir, v.vehicle_id AS vehicle
            """
        )
        for row in iv_rows:
            if row["fir"] in G and row["vehicle"] in G:
                G.add_edge(row["fir"], row["vehicle"], rel_type="INVOLVES_VEHICLE", weight=1.0)

    # ── 5. Load CrimeType nodes + edges ───────────────────
    ct_nodes = neo4j.execute_read(
        "MATCH (ct:CrimeType) RETURN ct.name AS id"
    )
    for row in ct_nodes:
        G.add_node(row["id"], node_type="CrimeType")

    ct_edges = neo4j.execute_read(
        """
        MATCH (f:FIR)-[r:CLASSIFIED_AS]->(ct:CrimeType)
        RETURN f.fir_number AS fir, ct.name AS crime_type
        """
    )
    for row in ct_edges:
        if row["fir"] in G and row["crime_type"] in G:
            G.add_edge(row["fir"], row["crime_type"], rel_type="CLASSIFIED_AS", weight=1.0)

    logger.info(
        f"📊 Built NetworkX graph: {G.number_of_nodes()} nodes, "
        f"{G.number_of_edges()} edges"
    )
    return G


# ============================================================
# Centrality Analysis
# ============================================================

def compute_centrality(G: nx.MultiDiGraph, top_n: int = 10) -> Dict[str, Any]:
    """
    Compute multiple centrality measures on the graph.
    Returns top-N nodes by each measure.

    Centrality measures:
      - degree_centrality       : How many direct connections a node has
      - in_degree_centrality    : How many nodes point TO this node
      - betweenness_centrality  : How often this node is on shortest paths
      - pagerank                : Google-style importance score
    """
    if G.number_of_nodes() == 0:
        return {"error": "Graph is empty"}

    # Work on undirected view for betweenness (more meaningful for crime networks)
    UG = G.to_undirected()

    degree_c = nx.degree_centrality(G)
    in_degree_c = nx.in_degree_centrality(G)
    betweenness_c = nx.betweenness_centrality(UG)
    pagerank_c = nx.pagerank(G, alpha=0.85, max_iter=200)

    def top_n_nodes(scores: dict, n: int) -> List[Dict[str, Any]]:
        if not scores:
            return []
        max_score = max(scores.values()) if scores.values() else 1.0
        sorted_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:n]
        return [
            {
                "node": node_id,
                "score": round(score, 4),
                "percent": round((score / max_score) * 100, 1) if max_score > 0 else 0,
                "node_type": G.nodes[node_id].get("node_type", "Unknown"),
                **{k: v for k, v in G.nodes[node_id].items() if k != "node_type" and v is not None},
            }
            for node_id, score in sorted_items
            if node_id in G.nodes
        ]

    return {
        "degree_centrality": top_n_nodes(degree_c, top_n),
        "in_degree_centrality": top_n_nodes(in_degree_c, top_n),
        "betweenness_centrality": top_n_nodes(betweenness_c, top_n),
        "pagerank": top_n_nodes(pagerank_c, top_n),
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
    }


# ============================================================
# Community Detection
# ============================================================

def detect_communities(G: nx.MultiDiGraph) -> Dict[str, Any]:
    """
    Detect crime clusters/communities using the Louvain method
    (via greedy modularity optimization) on the undirected graph.

    Communities represent groups of FIRs that are tightly connected —
    e.g., same area, same vehicle types, same crime patterns.
    """
    if G.number_of_nodes() < 2:
        return {
            "num_communities": 0,
            "modularity_score": 0.0,
            "communities": [],
            "error": "Not enough nodes for community detection"
        }

    UG = G.to_undirected()
    # Remove self-loops for community detection
    UG.remove_edges_from(nx.selfloop_edges(UG))

    try:
        communities = list(nx.community.greedy_modularity_communities(UG))
        modularity = nx.community.modularity(
            UG,
            communities,
            weight="weight"
        )
    except Exception as e:
        logger.error(f"Community detection error: {e}")
        return {
            "num_communities": 0,
            "modularity_score": 0.0,
            "communities": [],
            "error": str(e)
        }

    community_details = []
    for i, community in enumerate(communities):
        nodes_in_comm = list(community)
        type_counter: Dict[str, int] = defaultdict(int)
        fir_nodes = []
        location_nodes = []

        for node in nodes_in_comm:
            attrs = G.nodes.get(node, {})
            ntype = attrs.get("node_type", "Unknown")
            type_counter[ntype] += 1
            if ntype == "FIR":
                fir_nodes.append({
                    "fir_number": node,
                    "severity": attrs.get("severity"),
                    "cause": attrs.get("cause"),
                })
            elif ntype == "Location":
                location_nodes.append({
                    "location_id": node,
                    "area": attrs.get("area"),
                    "city": attrs.get("city"),
                })

        community_details.append({
            "community_id": i + 1,
            "size": len(nodes_in_comm),
            "node_type_breakdown": dict(type_counter),
            "fir_count": type_counter.get("FIR", 0),
            "firs": fir_nodes[:20],          # cap at 20 for response size
            "key_locations": location_nodes[:10],
        })

    # Sort by number of FIRs (most significant crime clusters first)
    community_details.sort(key=lambda c: c["fir_count"], reverse=True)

    return {
        "num_communities": len(communities),
        "modularity_score": round(modularity, 4),
        "communities": community_details,
    }


# ============================================================
# Connection / Path Analysis
# ============================================================

def find_connections(
    node_a: str,
    node_b: str,
    G: Optional[nx.MultiDiGraph] = None,
) -> Dict[str, Any]:
    """
    Find shortest paths and all simple paths between two nodes in the
    crime graph. Useful for discovering hidden links between FIRs,
    locations, or persons that appear unrelated on the surface.
    """
    if G is None:
        G = build_networkx_graph()

    if G.number_of_nodes() == 0:
        return {"error": "Graph is empty"}

    UG = G.to_undirected()

    if node_a not in UG:
        return {"error": f"Node '{node_a}' not found in graph"}
    if node_b not in UG:
        return {"error": f"Node '{node_b}' not found in graph"}

    if not nx.has_path(UG, node_a, node_b):
        return {
            "connected": False,
            "node_a": node_a,
            "node_b": node_b,
            "message": "No path exists between these nodes",
        }

    shortest = nx.shortest_path(UG, node_a, node_b)
    shortest_length = nx.shortest_path_length(UG, node_a, node_b)

    # All simple paths up to length shortest+2 (to avoid combinatorial explosion)
    try:
        all_paths = list(nx.all_simple_paths(UG, node_a, node_b, cutoff=shortest_length + 2))
        all_paths = all_paths[:10]  # cap at 10
    except Exception:
        all_paths = [shortest]

    def enrich_path(path: List[str]) -> List[Dict[str, Any]]:
        return [
            {
                "node": n,
                "node_type": G.nodes[n].get("node_type", "Unknown"),
                **{k: v for k, v in G.nodes[n].items() if k != "node_type" and v is not None},
            }
            for n in path if n in G.nodes
        ]

    return {
        "connected": True,
        "node_a": node_a,
        "node_b": node_b,
        "node_a_type": G.nodes.get(node_a, {}).get("node_type"),
        "node_b_type": G.nodes.get(node_b, {}).get("node_type"),
        "shortest_path_length": shortest_length,
        "shortest_path": enrich_path(shortest),
        "alternative_paths_count": len(all_paths),
        "all_paths": [enrich_path(p) for p in all_paths],
    }


# ============================================================
# Location Hotspot Analysis
# ============================================================

def analyze_hotspots(G: Optional[nx.MultiDiGraph] = None, top_n: int = 10) -> Dict[str, Any]:
    """
    Rank locations by how many FIRs are connected to them.
    Also computes a 'danger score' factoring in severity weights.
    """
    if G is None:
        G = build_networkx_graph()

    if G.number_of_nodes() == 0:
        return {"error": "Graph is empty", "hotspots": []}

    SEVERITY_WEIGHTS = {"Fatal": 3.0, "Grievous": 2.0, "Non-Fatal": 1.0, "Unknown": 0.5}

    hotspot_scores: Dict[str, Dict[str, Any]] = {}

    for loc_id, attrs in G.nodes(data=True):
        if attrs.get("node_type") != "Location":
            continue

        # Get all FIR neighbours (predecessors in directed graph = FIRs that occurred here)
        connected_firs = [
            n for n in G.predecessors(loc_id)
            if G.nodes[n].get("node_type") == "FIR"
        ]

        fir_count = len(connected_firs)
        if fir_count == 0:
            continue

        danger_score = sum(
            SEVERITY_WEIGHTS.get(G.nodes[fir].get("severity", "Unknown"), 0.5)
            for fir in connected_firs
        )

        severity_breakdown: Dict[str, int] = defaultdict(int)
        for fir in connected_firs:
            severity_breakdown[G.nodes[fir].get("severity", "Unknown")] += 1

        hotspot_scores[loc_id] = {
            "location_id": loc_id,
            "area": attrs.get("area"),
            "city": attrs.get("city"),
            "lat": attrs.get("lat"),
            "lng": attrs.get("lng"),
            "fir_count": fir_count,
            "danger_score": round(danger_score, 2),
            "severity_breakdown": dict(severity_breakdown),
        }

    ranked = sorted(
        hotspot_scores.values(),
        key=lambda x: (x["danger_score"], x["fir_count"]),
        reverse=True,
    )

    return {
        "total_locations_analyzed": len(hotspot_scores),
        "hotspots": ranked[:top_n],
    }


# ============================================================
# Graph Summary Stats
# ============================================================

def graph_summary(G: Optional[nx.MultiDiGraph] = None) -> Dict[str, Any]:
    """
    Return high-level structural summary of the crime graph.
    """
    if G is None:
        G = build_networkx_graph()

    if G.number_of_nodes() == 0:
        return {"error": "Graph is empty"}

    UG = G.to_undirected()

    # Node type counts
    type_counts: Dict[str, int] = defaultdict(int)
    for _, attrs in G.nodes(data=True):
        type_counts[attrs.get("node_type", "Unknown")] += 1

    # Relationship type counts
    rel_counts: Dict[str, int] = defaultdict(int)
    for _, _, attrs in G.edges(data=True):
        rel_counts[attrs.get("rel_type", "Unknown")] += 1

    # Graph structural properties (on undirected)
    is_connected = nx.is_connected(UG)
    num_components = nx.number_connected_components(UG)

    # Degree stats
    degrees = [d for _, d in G.degree()]
    avg_degree = round(sum(degrees) / len(degrees), 2) if degrees else 0
    max_degree = max(degrees) if degrees else 0

    return {
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "node_type_counts": dict(type_counts),
        "relationship_type_counts": dict(rel_counts),
        "is_connected": is_connected,
        "num_connected_components": num_components,
        "avg_node_degree": avg_degree,
        "max_node_degree": max_degree,
        "density": round(nx.density(G), 6),
    }

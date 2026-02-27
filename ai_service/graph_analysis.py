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
        logger.warning("⚠️ Neo4j not connected — returning empty graph")
        return nx.MultiDiGraph()

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
        sorted_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:n]
        return [
            {
                "node": node_id,
                "score": round(score, 4),
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
        return {"error": "Not enough nodes for community detection", "communities": []}

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
        return {"error": str(e), "communities": []}

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

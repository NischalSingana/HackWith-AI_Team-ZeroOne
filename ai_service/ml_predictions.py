"""
Machine Learning Predictions Engine for CrimeGraph AI.

Extracts graph-based features (centrality, degree, temporal patterns)
from NetworkX and trains lightweight sklearn models for:
  1. Severity Prediction     — predict Fatal / Grievous / Non-Fatal
  2. Hotspot Prediction      — rank/predict next likely accident zones
  3. Anomaly Detection       — flag unusual FIR patterns (Isolation Forest)

Models are trained on-demand from live graph data and cached in memory.
No persistent model storage is required for the demo — re-training is fast.
"""

import logging
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

import networkx as nx
import numpy as np

# scikit-learn — all lightweight
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

from graph_analysis import build_networkx_graph, compute_centrality, analyze_hotspots

logger = logging.getLogger(__name__)


# ============================================================
# In-memory model cache
# ============================================================

_model_cache: Dict[str, Any] = {}


# ============================================================
# Feature Engineering
# ============================================================

SEVERITY_MAP = {"Fatal": 2, "Grievous": 1, "Non-Fatal": 0, "Unknown": 0}
SEVERITY_REVERSE = {2: "Fatal", 1: "Grievous", 0: "Non-Fatal"}


def _parse_date_features(date_str: Optional[str]) -> Dict[str, int]:
    """Extract temporal features from a date string."""
    defaults = {"hour": 12, "day_of_week": 0, "month": 1, "is_weekend": 0, "is_night": 0}
    if not date_str:
        return defaults
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            dt = datetime.strptime(str(date_str)[:19], fmt)
            return {
                "hour": dt.hour,
                "day_of_week": dt.weekday(),
                "month": dt.month,
                "is_weekend": int(dt.weekday() >= 5),
                "is_night": int(dt.hour < 6 or dt.hour >= 22),
            }
        except ValueError:
            continue
    return defaults


def _encode_cause(cause: Optional[str]) -> int:
    """Encode cause string to an integer category."""
    if not cause:
        return 0
    cause_lower = cause.lower()
    cause_map = {
        "over speed": 1, "overspe": 1,
        "rash": 2,
        "drunk": 3,
        "signal": 4,
        "wrong side": 5,
        "negligent": 6,
        "hit and run": 7,
        "hit & run": 7,
    }
    for key, val in cause_map.items():
        if key in cause_lower:
            return val
    return 0


def extract_fir_features(
    G: nx.MultiDiGraph,
    degree_centrality: Dict[str, float],
    pagerank: Dict[str, float],
    betweenness: Dict[str, float],
) -> Tuple[List[List[float]], List[str], List[int]]:
    """
    For each FIR node, extract a feature vector + label for ML training.

    Features per FIR:
      - degree_centrality       (graph topology)
      - pagerank                (graph topology)
      - betweenness_centrality  (graph topology)
      - num_victims             (entity count)
      - num_vehicles            (entity count)
      - cause_code              (crime type integer)
      - hour                    (temporal)
      - day_of_week             (temporal)
      - month                   (temporal)
      - is_weekend              (temporal flag)
      - is_night                (temporal flag)

    Returns: (X features, fir_ids, y labels)
    """
    X, fir_ids, y = [], [], []

    for node_id, attrs in G.nodes(data=True):
        if attrs.get("node_type") != "FIR":
            continue

        # Graph-based features
        deg = degree_centrality.get(node_id, 0.0)
        pr = pagerank.get(node_id, 0.0)
        bw = betweenness.get(node_id, 0.0)

        # Entity counts via successors
        num_victims = sum(
            1 for n in G.successors(node_id)
            if G.nodes[n].get("node_type") == "Person"
        )
        num_vehicles = sum(
            1 for n in G.successors(node_id)
            if G.nodes[n].get("node_type") == "Vehicle"
        )

        # Temporal features
        date_feats = _parse_date_features(attrs.get("incident_date"))
        cause_code = _encode_cause(attrs.get("cause"))

        feature_vector = [
            deg, pr, bw,
            num_victims, num_vehicles,
            cause_code,
            date_feats["hour"],
            date_feats["day_of_week"],
            date_feats["month"],
            date_feats["is_weekend"],
            date_feats["is_night"],
        ]

        label = SEVERITY_MAP.get(attrs.get("severity", "Unknown"), 0)

        X.append(feature_vector)
        fir_ids.append(node_id)
        y.append(label)

    return X, fir_ids, y


# ============================================================
# 1. Severity Prediction Model
# ============================================================

def train_severity_model(G: nx.MultiDiGraph) -> Dict[str, Any]:
    """
    Train a Random Forest classifier to predict FIR severity.
    Returns model, scaler, metrics, and feature importances.
    """
    # Compute centrality scores needed for features
    UG = G.to_undirected()
    degree_c = nx.degree_centrality(G)
    pagerank_c = nx.pagerank(G, alpha=0.85, max_iter=200)
    betweenness_c = nx.betweenness_centrality(UG)

    X, fir_ids, y = extract_fir_features(G, degree_c, pagerank_c, betweenness_c)

    if len(X) < 5:
        return {"error": "Not enough FIR data for training (need at least 5 records)"}

    X_arr = np.array(X, dtype=float)
    y_arr = np.array(y)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_arr)

    # Train/test split (if enough data)
    if len(X) >= 10:
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_arr, test_size=0.2, random_state=42, stratify=None
        )
    else:
        X_train, X_test, y_train, y_test = X_scaled, X_scaled, y_arr, y_arr

    model = RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced")
    model.fit(X_train, y_train)

    accuracy = accuracy_score(y_test, model.predict(X_test))

    feature_names = [
        "degree_centrality", "pagerank", "betweenness",
        "num_victims", "num_vehicles", "cause_code",
        "hour", "day_of_week", "month", "is_weekend", "is_night",
    ]
    importance = dict(zip(feature_names, model.feature_importances_.tolist()))

    _model_cache["severity"] = {"model": model, "scaler": scaler, "fir_ids": fir_ids}

    logger.info(f"✅ Severity model trained — accuracy: {accuracy:.2%}")
    return {
        "status": "trained",
        "accuracy": round(accuracy, 4),
        "training_samples": len(X_train),
        "feature_importance": {k: round(v, 4) for k, v in sorted(importance.items(), key=lambda x: -x[1])},
    }


def predict_severity(fir_data: Dict[str, Any], G: Optional[nx.MultiDiGraph] = None) -> Dict[str, Any]:
    """
    Predict severity for a new or unseen FIR using the trained severity model.
    If model is not trained, trains it first.
    """
    if G is None:
        G = build_networkx_graph()

    if "severity" not in _model_cache:
        train_result = train_severity_model(G)
        if "error" in train_result:
            return train_result

    cache = _model_cache["severity"]
    model: RandomForestClassifier = cache["model"]
    scaler: StandardScaler = cache["scaler"]

    # Build feature vector for the new FIR
    date_feats = _parse_date_features(fir_data.get("incident_date") or fir_data.get("date_time"))
    cause_code = _encode_cause(fir_data.get("cause"))
    num_victims = len(fir_data.get("victims", []))
    num_vehicles = len(fir_data.get("vehicles", []))

    feature_vector = np.array([[
        0.0, 0.0, 0.0,          # centrality defaults (new node, not in graph yet)
        num_victims, num_vehicles,
        cause_code,
        date_feats["hour"],
        date_feats["day_of_week"],
        date_feats["month"],
        date_feats["is_weekend"],
        date_feats["is_night"],
    ]])

    feature_vector_scaled = scaler.transform(feature_vector)
    prediction = model.predict(feature_vector_scaled)[0]
    probabilities = model.predict_proba(feature_vector_scaled)[0]

    # Map probabilities to available classes
    class_probs = {}
    for cls, prob in zip(model.classes_, probabilities):
        class_probs[SEVERITY_REVERSE.get(cls, str(cls))] = round(float(prob), 3)

    return {
        "predicted_severity": SEVERITY_REVERSE.get(int(prediction), "Unknown"),
        "confidence": round(float(max(probabilities)), 3),
        "class_probabilities": class_probs,
    }


# ============================================================
# 2. Hotspot Prediction Model
# ============================================================

def predict_hotspots(G: Optional[nx.MultiDiGraph] = None, top_n: int = 10) -> Dict[str, Any]:
    """
    Predict next likely accident hotspot locations using a scoring model
    that combines historical FIR density, severity weighting, temporal
    recency, and graph centrality of the location node.

    Returns a ranked list of locations with danger forecasts.
    """
    if G is None:
        G = build_networkx_graph()

    if G.number_of_nodes() == 0:
        return {"error": "Graph is empty", "predictions": []}

    # Base hotspot analysis
    hotspot_data = analyze_hotspots(G, top_n=top_n * 2)
    hotspots = hotspot_data.get("hotspots", [])

    if not hotspots:
        return {"error": "No location data found in graph", "predictions": []}

    # Compute location centrality
    degree_c = nx.degree_centrality(G)
    pagerank_c = nx.pagerank(G, alpha=0.85, max_iter=200)

    predictions = []
    for hs in hotspots:
        loc_id = hs["location_id"]
        fir_count = hs["fir_count"]
        danger_score = hs["danger_score"]
        severity_breakdown = hs.get("severity_breakdown", {})

        # Graph topology score for location
        loc_degree = degree_c.get(loc_id, 0.0)
        loc_pagerank = pagerank_c.get(loc_id, 0.0)

        # Compute fatality rate
        total = fir_count if fir_count > 0 else 1
        fatality_rate = severity_breakdown.get("Fatal", 0) / total

        # Composite risk score (normalized 0-100)
        risk_score = (
            (danger_score / (top_n * 3)) * 50 +     # severity-weighted FIR density (50%)
            loc_degree * 20 +                         # graph connectivity (20%)
            loc_pagerank * 100 * 15 +                 # pagerank importance (15%)
            fatality_rate * 15                        # fatality proportion (15%)
        )
        risk_score = min(round(risk_score, 2), 100.0)

        # Risk level classification
        if risk_score >= 70:
            risk_level = "🔴 Critical"
        elif risk_score >= 40:
            risk_level = "🟠 High"
        elif risk_score >= 20:
            risk_level = "🟡 Medium"
        else:
            risk_level = "🟢 Low"

        predictions.append({
            **hs,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "fatality_rate": round(fatality_rate, 3),
            "graph_centrality": round(loc_degree, 4),
            "graph_pagerank": round(loc_pagerank, 4),
        })

    predictions.sort(key=lambda x: x["risk_score"], reverse=True)

    return {
        "model": "Composite Risk Score (FIR Density + Severity + Graph Centrality)",
        "total_locations_scored": len(predictions),
        "predictions": predictions[:top_n],
    }


# ============================================================
# 3. Anomaly Detection Model
# ============================================================

def detect_anomalies(G: Optional[nx.MultiDiGraph] = None, contamination: float = 0.1) -> Dict[str, Any]:
    """
    Use Isolation Forest to flag FIRs with unusual feature combinations.
    Anomalies could represent:
      - Unusual time patterns (crimes at unexpected hours)
      - Exceptionally high number of victims or vehicles
      - FIRs in unexpected locations for their crime type
      - Very high or very low AI confidence scores

    contamination: expected proportion of anomalies (0.0 to 0.5)
    """
    if G is None:
        G = build_networkx_graph()

    if G.number_of_nodes() == 0:
        return {"error": "Graph is empty", "anomalies": []}

    UG = G.to_undirected()
    degree_c = nx.degree_centrality(G)
    pagerank_c = nx.pagerank(G, alpha=0.85, max_iter=200)
    betweenness_c = nx.betweenness_centrality(UG)

    X, fir_ids, y = extract_fir_features(G, degree_c, pagerank_c, betweenness_c)

    # Add confidence score as extra feature
    X_with_conf = []
    for i, node_id in enumerate(fir_ids):
        conf = G.nodes[node_id].get("confidence", 0.0) or 0.0
        X_with_conf.append(X[i] + [float(conf)])

    if len(X_with_conf) < 5:
        return {"error": "Not enough FIR data for anomaly detection (need at least 5 records)"}

    X_arr = np.array(X_with_conf, dtype=float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_arr)

    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42
    )
    predictions = iso_forest.fit_predict(X_scaled)    # -1 = anomaly, 1 = normal
    scores = iso_forest.score_samples(X_scaled)       # lower = more anomalous

    anomalies = []
    normal_count = 0

    for i, (node_id, pred, score) in enumerate(zip(fir_ids, predictions, scores)):
        if pred == -1:
            attrs = G.nodes[node_id]
            # Describe WHY this might be anomalous
            reasons = []
            if X[i][3] > 3:
                reasons.append(f"Unusually high victims ({int(X[i][3])})")
            if X[i][4] > 3:
                reasons.append(f"Unusually high vehicles ({int(X[i][4])})")
            date_feats = _parse_date_features(attrs.get("incident_date"))
            if date_feats["is_night"]:
                reasons.append("Occurred at night (00:00–06:00 or 22:00+)")
            if attrs.get("confidence", 1.0) < 0.3:
                reasons.append(f"Low AI confidence ({attrs.get('confidence', 0):.0%})")
            if degree_c.get(node_id, 0) > 0.1:
                reasons.append("Unusually high graph connectivity")

            anomalies.append({
                "fir_number": node_id,
                "severity": attrs.get("severity"),
                "cause": attrs.get("cause"),
                "anomaly_score": round(float(score), 4),
                "reasons": reasons if reasons else ["Unusual feature combination"],
            })
        else:
            normal_count += 1

    # Sort by most anomalous first
    anomalies.sort(key=lambda x: x["anomaly_score"])

    logger.info(f"🔍 Anomaly detection: {len(anomalies)} anomalies, {normal_count} normal FIRs")

    return {
        "model": "Isolation Forest",
        "contamination_rate": contamination,
        "total_firs_analyzed": len(fir_ids),
        "anomaly_count": len(anomalies),
        "normal_count": normal_count,
        "anomalies": anomalies,
    }

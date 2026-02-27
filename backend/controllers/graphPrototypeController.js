// ============================================================================
// PROTOTYPE GRAPH DATA CONTROLLER
// This returns static, rich demo data so the Graph Explorer works perfectly
// even if the database is empty.
// ============================================================================

exports.getSummary = async (req, res) => {
  return res.json({
    total_nodes: 142,
    total_edges: 286,
    node_type_counts: { FIR: 58, Location: 34, Person: 42, Vehicle: 8 },
    relationship_type_counts: {
      HAS_LOCATION: 58,
      HAS_VICTIM: 64,
      INVOLVES_VEHICLE: 164,
    },
    num_connected_components: 3,
    avg_node_degree: 4.02,
    density: 0.014,
    source: 'static-demo',
  });
};

exports.getGraphData = async (req, res) => {
  // Generate a realistic web of accidents
  const nodes = [];
  const edges = [];
  
  // 5 main hotspots
  const hotspots = ['Benz Circle', 'PNBS Bus Stand', 'Eluru Road', 'MG Road', 'Bhavanipuram'];
  hotspots.forEach((area, i) => {
    nodes.push({ id: `LOC-${i}`, node_type: 'Location', area });
  });

  // 15 FIRs distributed across hotspots
  for (let i = 1; i <= 15; i++) {
    const firId = `FIR-2026-${i * 10}`;
    const locId = `LOC-${i % 5}`;
    const severity = i % 4 === 0 ? 'Fatal' : i % 3 === 0 ? 'Grievous' : 'Non-Fatal';
    
    nodes.push({
      id: firId,
      node_type: 'FIR',
      severity,
      cause: 'Over speeding',
      area: hotspots[i % 5],
    });
    edges.push({ source: firId, target: locId, rel_type: 'HAS_LOCATION' });

    // Add 1-2 victims
    const vic1 = `PER-${i * 2}`;
    nodes.push({ id: vic1, node_type: 'Person', name: `Victim ${vic1}` });
    edges.push({ source: firId, target: vic1, rel_type: 'HAS_VICTIM' });
    
    if (i % 2 === 0) {
      const vic2 = `PER-${i * 2 + 1}`;
      nodes.push({ id: vic2, node_type: 'Person', name: `Victim ${vic2}` });
      edges.push({ source: firId, target: vic2, rel_type: 'HAS_VICTIM' });
    }

    // Add elements to connect FIRs (Shared vehicles)
    // E.g. A truck involved in multiple FIRs!
    if (i % 3 === 0) {
      const veh = `VEH-TRUCK-01`;
      if (!nodes.find(n => n.id === veh)) {
        nodes.push({ id: veh, node_type: 'Vehicle', vehicle_type: 'Truck' });
      }
      edges.push({ source: firId, target: veh, rel_type: 'INVOLVES_VEHICLE' });
    } else {
      const veh = `VEH-BIKE-${i}`;
      nodes.push({ id: veh, node_type: 'Vehicle', vehicle_type: 'Bike' });
      edges.push({ source: firId, target: veh, rel_type: 'INVOLVES_VEHICLE' });
    }
  }

  // Artificial cross-link for community detection demo (Person involved in multiple FIRs)
  edges.push({ source: 'FIR-2026-30', target: 'PER-4', rel_type: 'HAS_VICTIM' });

  return res.json({ nodes, edges, source: 'static-demo' });
};

exports.getCentrality = async (req, res) => {
  const nodes = [
    { node: 'LOC-0', node_type: 'Location', area: 'Benz Circle', score: 0.94 },
    { node: 'VEH-TRUCK-01', node_type: 'Vehicle', vehicle_type: 'Truck', score: 0.88 },
    { node: 'LOC-1', node_type: 'Location', area: 'PNBS Bus Stand', score: 0.72 },
    { node: 'FIR-2026-60', node_type: 'FIR', severity: 'Fatal', cause: 'Over speeding', score: 0.65 },
    { node: 'PER-4', node_type: 'Person', name: 'Victim PER-4', score: 0.55 },
  ];

  return res.json({
    pagerank: nodes,
    betweenness_centrality: [...nodes].sort(() => Math.random() - 0.5),
    degree_centrality: [...nodes].sort(() => Math.random() - 0.5),
    in_degree_centrality: [...nodes].sort(() => Math.random() - 0.5),
    source: 'static-demo',
  });
};

exports.getCommunities = async (req, res) => {
  return res.json({
    num_communities: 3,
    modularity_score: 0.42,
    communities: [
      {
        community_id: 1,
        size: 24,
        fir_count: 8,
        node_type_breakdown: { FIR: 8, Location: 2, Person: 12, Vehicle: 2 },
        key_locations: [{ area: 'Benz Circle', city: 'Vijayawada' }],
      },
      {
        community_id: 2,
        size: 15,
        fir_count: 4,
        node_type_breakdown: { FIR: 4, Location: 2, Person: 5, Vehicle: 4 },
        key_locations: [{ area: 'Eluru Road', city: 'Vijayawada' }],
      },
      {
        community_id: 3,
        size: 11,
        fir_count: 3,
        node_type_breakdown: { FIR: 3, Location: 1, Person: 6, Vehicle: 1 },
        key_locations: [{ area: 'PNBS Bus Stand', city: 'Vijayawada' }],
      }
    ],
    source: 'static-demo',
  });
};

exports.getHotspots = async (req, res) => {
  return res.json({
    predictions: [
      {
        location_id: 'LOC-0',
        area: 'Benz Circle',
        city: 'Vijayawada',
        fir_count: 45,
        danger_score: 92,
        risk_score: 88,
        risk_level: 'High',
        severity_breakdown: { 'Fatal': 12, 'Grievous': 18, 'Non-Fatal': 15 }
      },
      {
        location_id: 'LOC-1',
        area: 'PNBS Bus Stand',
        city: 'Vijayawada',
        fir_count: 32,
        danger_score: 65,
        risk_score: 74,
        risk_level: 'High',
        severity_breakdown: { 'Fatal': 5, 'Grievous': 15, 'Non-Fatal': 12 }
      },
      {
        location_id: 'LOC-2',
        area: 'Eluru Road',
        city: 'Vijayawada',
        fir_count: 28,
        danger_score: 42,
        risk_score: 55,
        risk_level: 'Medium',
        severity_breakdown: { 'Fatal': 2, 'Grievous': 10, 'Non-Fatal': 16 }
      },
      {
        location_id: 'LOC-3',
        area: 'MG Road',
        city: 'Vijayawada',
        fir_count: 15,
        danger_score: 20,
        risk_score: 35,
        risk_level: 'Low',
        severity_breakdown: { 'Fatal': 0, 'Grievous': 4, 'Non-Fatal': 11 }
      }
    ],
    source: 'static-demo',
  });
};

exports.getAnomalies = async (req, res) => {
  return res.json({
    anomaly_count: 3,
    normal_count: 139,
    anomalies: [
      {
        fir_number: 'FIR-2026-089',
        severity: 'Fatal',
        cause: 'Unknown signal jump',
        anomaly_score: 0.89,
        reasons: ['fatal_case', 'high_victim_count']
      },
      {
        fir_number: 'FIR-2026-142',
        severity: 'Grievous',
        cause: 'Over speeding',
        anomaly_score: 0.72,
        reasons: ['low_confidence_signal']
      },
      {
        fir_number: 'FIR-2026-211',
        severity: 'Fatal',
        cause: 'Rash driving',
        anomaly_score: 0.68,
        reasons: ['fatal_case']
      }
    ],
    source: 'static-demo',
  });
};

exports.trainMock = async (req, res) => {
  return res.json({
    success: true,
    mode: 'prototype-static-demo',
    trained_on_records: 142,
    accuracy: 0.945,
  });
};

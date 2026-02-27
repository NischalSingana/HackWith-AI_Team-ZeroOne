const DEFAULT_DATA = {
  metrics: [
    { title: 'Entities Mapped', value: '431', subtitle: 'FIRs, Locations, People, Vehicles' },
    { title: 'Relationships', value: '842', subtitle: 'Graph links' },
    { title: 'Communities', value: '3', subtitle: 'NetworkX Louvain clusters' },
    { title: 'Risk Hotspots', value: '5', subtitle: 'ML-ranked high-risk zones' },
  ],
  nodes: [
    { id: 'FIR-2026-10', label: 'FIR 10', type: 'FIR', x: 200, y: 150, risk: 'high' },
    { id: 'FIR-2026-20', label: 'FIR 20', type: 'FIR', x: 320, y: 100, risk: 'medium' },
    { id: 'LOC-1', label: 'Benz Circle', type: 'Location', x: 260, y: 200, risk: 'high' },
    { id: 'PER-4', label: 'Ravi Kumar', type: 'Person', x: 150, y: 80, risk: 'high' },
    { id: 'VEH-1', label: 'Truck AP07', type: 'Vehicle', x: 380, y: 180, risk: 'medium' },
  ],
  edges: [
    { source: 'FIR-2026-10', target: 'LOC-1', relation: 'HAS_LOCATION', strength: 0.92 },
    { source: 'FIR-2026-20', target: 'LOC-1', relation: 'HAS_LOCATION', strength: 0.92 },
    { source: 'FIR-2026-10', target: 'PER-4', relation: 'HAS_VICTIM', strength: 0.74 },
    { source: 'FIR-2026-20', target: 'VEH-1', relation: 'INVOLVES_VEHICLE', strength: 0.68 },
    { source: 'FIR-2026-20', target: 'PER-4', relation: 'HAS_VICTIM', strength: 0.81 },
  ],
  clusters: [
    { cluster: 'Cluster A', risk: 'High', composition: '8 FIRs, 2 Locations, 12 People, 2 Vehicles', action: 'Investigate Benz Circle accidents involving trucks.' },
    { cluster: 'Cluster B', risk: 'Medium', composition: '4 FIRs, 2 Locations, 5 People, 4 Vehicles', action: 'Monitor Eluru Road speeding incidents.' },
  ],
};

exports.getPrototypeData = async (req, res) => {
  try {
    res.json({ success: true, source: 'static', data: DEFAULT_DATA, updated_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: `Failed to load prototype data: ${error.message}` });
  }
};

exports.savePrototypeData = async (req, res) => {
  try {
    // In prototype mode we just echo back success without saving to DB
    res.json({ success: true, message: 'Prototype data accepted (mock mode).', data: req.body, updated_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: `Failed to save prototype data: ${error.message}` });
  }
};

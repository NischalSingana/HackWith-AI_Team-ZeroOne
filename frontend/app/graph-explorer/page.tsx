'use client';

import { useState, useEffect, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  node_type: string;
  severity?: string;
  cause?: string;
  area?: string;
  name?: string;
  vehicle_type?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface CentralityNode {
  node: string;
  score: number;
  node_type: string;
  severity?: string;
  cause?: string;
  area?: string;
}

interface Community {
  community_id: number;
  size: number;
  fir_count: number;
  node_type_breakdown: Record<string, number>;
  key_locations: { area?: string; city?: string }[];
}

interface Hotspot {
  location_id: string;
  area?: string;
  city?: string;
  fir_count: number;
  danger_score: number;
  risk_score: number;
  risk_level: string;
  severity_breakdown: Record<string, number>;
}

interface Anomaly {
  fir_number: string;
  severity?: string;
  cause?: string;
  anomaly_score: number;
  reasons: string[];
}

interface AnomalyResult {
  anomaly_count: number;
  normal_count: number;
  anomalies: Anomaly[];
}

interface CentralityResult {
  pagerank: CentralityNode[];
  betweenness_centrality: CentralityNode[];
  degree_centrality: CentralityNode[];
  in_degree_centrality: CentralityNode[];
}

interface GraphSummary {
  total_nodes: number;
  total_edges: number;
  node_type_counts: Record<string, number>;
  relationship_type_counts: Record<string, number>;
  num_connected_components: number;
  avg_node_degree: number;
  density: number;
}

// ── Colour map ─────────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  FIR: '#6366f1',
  Location: '#10b981',
  Person: '#f59e0b',
  Vehicle: '#3b82f6',
  CrimeType: '#ef4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  Fatal: '#ef4444',
  Grievous: '#f97316',
  'Non-Fatal': '#22c55e',
  Unknown: '#64748b',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// ── Helpers ────────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Force-directed mini-renderer (pure canvas, no external lib) ────────────
function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  nodes: GraphNode[],
  edges: { source: string; target: string; rel_type?: string }[]
) {
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    const W = canvas.width;
    const H = canvas.height;

    // Initialize positions
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      n.x = W / 2 + (W / 3) * Math.cos(angle) + (Math.random() - 0.5) * 50;
      n.y = H / 2 + (H / 3) * Math.sin(angle) + (Math.random() - 0.5) * 50;
      n.vx = 0;
      n.vy = 0;
      nodeMap.set(n.id, n);
    });

    const REPULSION = 2500;
    const SPRING = 0.05;
    const IDEAL_LEN = 120;
    const DAMPING = 0.85;

    function tick() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          a.vx! -= (force * dx) / dist;
          a.vy! -= (force * dy) / dist;
          b.vx! += (force * dx) / dist;
          b.vy! += (force * dy) / dist;
        }
      }
      edges.forEach(({ source, target }) => {
        const a = nodeMap.get(source), b = nodeMap.get(target);
        if (!a || !b) return;
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const stretch = dist - IDEAL_LEN;
        a.vx! += SPRING * stretch * dx / dist;
        a.vy! += SPRING * stretch * dy / dist;
        b.vx! -= SPRING * stretch * dx / dist;
        b.vy! -= SPRING * stretch * dy / dist;
      });
      nodes.forEach(n => {
        n.vx! *= DAMPING;
        n.vy! *= DAMPING;
        n.x! += n.vx!;
        n.y! += n.vy!;
        n.x = Math.max(20, Math.min(W - 20, n.x!));
        n.y = Math.max(20, Math.min(H - 20, n.y!));
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      edges.forEach(({ source, target }) => {
        const a = nodeMap.get(source), b = nodeMap.get(target);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x!, a.y!);
        ctx.lineTo(b.x!, b.y!);
        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      nodes.forEach(n => {
        const color = NODE_COLORS[n.node_type] || '#94a3b8';
        const r = n.node_type === 'FIR' ? 7 : 5;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (n.node_type === 'FIR') {
          ctx.fillStyle = 'rgba(248,250,252,0.7)';
          ctx.font = '8px system-ui';
          ctx.fillText(n.id.slice(-8), n.x! + 8, n.y! + 3);
        }
      });
    }

    function loop() {
      tick();
      draw();
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, canvasRef]);
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function GraphExplorerPage() {
  const [tab, setTab] = useState<'overview' | 'centrality' | 'communities' | 'hotspots' | 'anomalies'>('overview');
  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [centrality, setCentrality] = useState<CentralityResult | null>(null);
  const [communities, setCommunities] = useState<{ num_communities: number; modularity_score: number; communities: Community[] } | null>(null);
  const [hotspots, setHotspots] = useState<{ predictions: Hotspot[] } | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResult | null>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<{ source: string; target: string; rel_type?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useForceGraph(canvasRef, graphNodes, graphEdges);

  const load = async <T,>(path: string, setter: (d: T) => void) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(path);
      setter(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when tab changes — intentional lazy-load, deps kept minimal
  useEffect(() => {
    if (tab === 'overview' && !summary) {
      load('/graph/analysis/summary', setSummary);
      load('/graph/analysis/graph-data', (d: { nodes: GraphNode[]; edges: { source: string; target: string; rel_type?: string }[] }) => {
        setGraphNodes(d.nodes?.slice(0, 150) ?? []);
        setGraphEdges(d.edges?.slice(0, 300) ?? []);
      });
    }
    if (tab === 'centrality' && !centrality) load('/graph/analysis/centrality', setCentrality);
    if (tab === 'communities' && !communities) load('/graph/analysis/communities', setCommunities);
    if (tab === 'hotspots' && !hotspots) load('/graph/ml/predict-hotspots', setHotspots);
    if (tab === 'anomalies' && !anomalies) load('/graph/ml/detect-anomalies', setAnomalies);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleTrain = async () => {
    setTrainingStatus('Training…');
    try {
      const result = await apiFetch('/graph/ml/train', { method: 'POST' });
      setTrainingStatus(`✅ Trained — accuracy ${(result.accuracy * 100).toFixed(1)}%`);
    } catch (e) {
      setTrainingStatus(`❌ ${(e as Error).message}`);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'overview', label: '🗺 Graph Overview' },
    { key: 'centrality', label: '📊 Centrality' },
    { key: 'communities', label: '🔗 Communities' },
    { key: 'hotspots', label: '🔥 ML Hotspots' },
    { key: 'anomalies', label: '🚨 Anomalies' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-indigo-400">CrimeGraph Explorer</h1>
        <p className="text-slate-400 mt-1">
          Interactive Neo4j + NetworkX + ML analysis of FIR relationship networks
        </p>
        <div className="mt-3 flex gap-3 items-center flex-wrap">
          <button
            onClick={handleTrain}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
          >
            🤖 Train ML Models
          </button>
          {trainingStatus && (
            <span className="text-sm text-slate-300 bg-slate-800 px-3 py-2 rounded-lg">
              {trainingStatus}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
          <span className="animate-spin">⟳</span> Loading…
        </div>
      )}

      {/* ════════════════ OVERVIEW TAB ════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Nodes', value: summary.total_nodes },
                { label: 'Total Edges', value: summary.total_edges },
                { label: 'Components', value: summary.num_connected_components },
                { label: 'Avg Degree', value: summary.avg_node_degree },
              ].map(s => (
                <div key={s.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-indigo-300">{s.value ?? '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Node type breakdown */}
          {summary?.node_type_counts && (
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="text-slate-300 font-semibold mb-4">Node Types</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(summary.node_type_counts).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: NODE_COLORS[type] || '#94a3b8' }}
                    />
                    <span className="text-slate-300 text-sm">
                      {type}: <span className="font-bold text-white">{count}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graph canvas */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h2 className="text-slate-300 font-semibold mb-3">Live Graph (force-directed, up to 150 nodes)</h2>
            <div className="flex gap-3 flex-wrap mb-3">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {type}
                </div>
              ))}
            </div>
            <canvas
              ref={canvasRef}
              width={900}
              height={500}
              className="w-full rounded-lg bg-slate-900 border border-slate-700"
            />
          </div>
        </div>
      )}

      {/* ════════════════ CENTRALITY TAB ════════════════ */}
      {tab === 'centrality' && centrality && (
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { key: 'pagerank' as keyof CentralityResult, label: '🌐 PageRank (Most Influential)' },
            { key: 'betweenness_centrality' as keyof CentralityResult, label: '🔀 Betweenness (Bridge Nodes)' },
          ].map(({ key, label }) => {
            const items = centrality[key] as CentralityNode[];
            return (
              <div key={key} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h3 className="text-slate-200 font-semibold mb-4">{label}</h3>
                <div className="space-y-3">
                  {items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs w-5">{i + 1}.</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: NODE_COLORS[item.node_type] || '#94a3b8' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-medium truncate">{item.node}</p>
                        <p className="text-slate-500 text-xs">{item.node_type} {item.severity ? `• ${item.severity}` : ''}</p>
                      </div>
                      <span className="text-indigo-300 text-sm font-mono">{item.score.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════ COMMUNITIES TAB ════════════════ */}
      {tab === 'communities' && communities && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-slate-400 text-xs">Communities Found</p>
              <p className="text-2xl font-bold text-indigo-300">{communities.num_communities}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-slate-400 text-xs">Modularity Score</p>
              <p className="text-2xl font-bold text-indigo-300">{communities.modularity_score}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {communities.communities.slice(0, 12).map(c => (
              <div key={c.community_id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-slate-200 font-semibold text-sm">Cluster #{c.community_id}</h3>
                  <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">
                    {c.fir_count} FIRs
                  </span>
                </div>
                <p className="text-slate-400 text-xs mb-2">{c.size} total nodes</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(c.node_type_breakdown).map(([type, cnt]) => (
                    <span
                      key={type}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: `${NODE_COLORS[type]}22`, color: NODE_COLORS[type] }}
                    >
                      {type}:{cnt}
                    </span>
                  ))}
                </div>
                {c.key_locations.length > 0 && (
                  <p className="text-slate-500 text-xs">
                    📍 {c.key_locations.map(l => l.area || l.city || 'Unknown').join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════ HOTSPOTS TAB ════════════════ */}
      {tab === 'hotspots' && hotspots && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">
            Composite risk score: FIR density · severity weighting · graph centrality · fatality rate
          </p>
          {hotspots.predictions.map((h, i) => (
            <div key={h.location_id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-wrap gap-4 items-center">
              <span className="text-slate-500 text-lg font-bold w-8">#{i + 1}</span>
              <div className="flex-1 min-w-[180px]">
                <p className="text-slate-200 font-semibold">{h.area || 'Unknown Area'}</p>
                <p className="text-slate-400 text-xs">{h.city}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">Risk Score</p>
                <p className="text-2xl font-bold" style={{ color: h.risk_score >= 70 ? '#ef4444' : h.risk_score >= 40 ? '#f97316' : '#22c55e' }}>
                  {h.risk_score}
                </p>
              </div>
              <span className="text-sm">{h.risk_level}</span>
              <div className="flex gap-3 text-xs text-slate-400">
                <span>📋 {h.fir_count} FIRs</span>
                <span>⚡ {h.danger_score} danger</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(h.severity_breakdown || {}).map(([sev, cnt]) => (
                  <span
                    key={sev}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${SEVERITY_COLORS[sev] || '#64748b'}22`, color: SEVERITY_COLORS[sev] || '#94a3b8' }}
                  >
                    {sev}: {cnt}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ ANOMALIES TAB ════════════════ */}
      {tab === 'anomalies' && anomalies && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex gap-6">
            <div>
              <p className="text-slate-400 text-xs">Anomalies Detected</p>
              <p className="text-2xl font-bold text-red-400">{anomalies.anomaly_count}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Normal FIRs</p>
              <p className="text-2xl font-bold text-green-400">
                {anomalies.normal_count}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {anomalies.anomalies.map((a, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-4 border border-red-900/40">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-slate-200 font-semibold text-sm">{a.fir_number}</p>
                    <p className="text-slate-400 text-xs">{a.cause || 'Unknown cause'}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: `${SEVERITY_COLORS[a.severity || 'Unknown'] || '#64748b'}22`,
                        color: SEVERITY_COLORS[a.severity || 'Unknown'] || '#94a3b8',
                      }}
                    >
                      {a.severity}
                    </span>
                    <p className="text-slate-500 text-xs mt-1">score: {a.anomaly_score.toFixed(3)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.reasons.map((r, ri) => (
                    <span key={ri} className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded-full">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

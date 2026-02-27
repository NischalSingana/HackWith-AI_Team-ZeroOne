"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { 
  Network, 
  BarChart2, 
  Users, 
  Activity, 
  AlertOctagon, 
  Cpu, 
  Info, 
  RefreshCw,
  Zap,
  Layers,
  MapPin,
  TrendingUp,
  GitMerge,
  Box,
  BrainCircuit,
  Lock,
  ChevronRight,
  Filter,
  LucideIcon
} from 'lucide-react';

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
  percent?: number;
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

// ── Aesthetics ─────────────────────────────────────────────────────────────
const NODE_THEME: Record<string, { color: string, glow: string, icon: LucideIcon }> = {
  FIR: { color: '#818cf8', glow: 'rgba(129, 140, 248, 0.5)', icon: Box },
  Location: { color: '#34d399', glow: 'rgba(52, 211, 153, 0.5)', icon: MapPin },
  Person: { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.5)', icon: Users },
  Vehicle: { color: '#60a5fa', glow: 'rgba(96, 165, 250, 0.5)', icon: Activity },
  CrimeType: { color: '#f87171', glow: 'rgba(248, 113, 113, 0.5)', icon: AlertOctagon },
};

const SEVERITY_THEME: Record<string, { color: string, label: string }> = {
  Fatal: { color: '#f43f5e', label: 'CRITICAL' },
  Grievous: { color: '#f59e0b', label: 'HIGH' },
  'Non-Fatal': { color: '#10b981', label: 'LOW' },
  Unknown: { color: '#64748b', label: 'N/A' },
};

// ── Graph Engine ────────────────────────────────────────────────────────────
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

    // Initialize positions if not already set
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach((n, i) => {
      if (n.x === undefined) {
        const angle = (i / nodes.length) * 2 * Math.PI;
        n.x = W / 2 + (W / 4) * Math.cos(angle) + (Math.random() - 0.5) * 100;
        n.y = H / 2 + (H / 4) * Math.sin(angle) + (Math.random() - 0.5) * 100;
        n.vx = 0;
        n.vy = 0;
      }
      nodeMap.set(n.id, n);
    });

    const REPULSION = 4000;
    const SPRING = 0.05;
    const IDEAL_LEN = 160;
    const DAMPING = 0.85;

    // ── Cooling system: simulation starts hot and freezes over time ──
    let alpha = 1.0;              // Current "temperature" of simulation
    const ALPHA_DECAY = 0.95;     // Faster decay for better stability (settles in ~1.5s)
    const ALPHA_MIN = 0.005;      // Stop threshold
    let settled = false;          // Once settled, no more physics

    function drawGrid() {
      ctx.strokeStyle = 'rgba(79, 70, 229, 0.05)';
      ctx.lineWidth = 1;
      const step = 50;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    function tick() {
      if (settled) return;

      // Cool down the simulation
      alpha *= ALPHA_DECAY;
      if (alpha < ALPHA_MIN) {
        alpha = 0;
        settled = true;
        // Zero out all velocities
        nodes.forEach(n => { n.vx = 0; n.vy = 0; });
        return;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const distSq = dx * dx + dy * dy || 1;
          const force = (REPULSION / distSq) * alpha;  // Scale by alpha
          const dist = Math.sqrt(distSq);
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
        const springForce = SPRING * alpha;  // Scale by alpha
        a.vx! += springForce * stretch * dx / dist;
        a.vy! += springForce * stretch * dy / dist;
        b.vx! -= springForce * stretch * dx / dist;
        b.vy! -= springForce * stretch * dy / dist;
      });
      nodes.forEach(n => {
        n.vx! *= DAMPING;
        n.vy! *= DAMPING;
        n.vx! += (W / 2 - n.x!) * 0.001 * alpha;
        n.vy! += (H / 2 - n.y!) * 0.001 * alpha;
        
        n.x! += n.vx!;
        n.y! += n.vy!;
        n.x = Math.max(40, Math.min(W - 40, n.x!));
        n.y = Math.max(40, Math.min(H - 40, n.y!));
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawGrid();

      // Draw Edges with holographic effect
      edges.forEach(({ source, target }) => {
        const a = nodeMap.get(source), b = nodeMap.get(target);
        if (!a || !b) return;
        
        ctx.beginPath();
        ctx.moveTo(a.x!, a.y!);
        ctx.lineTo(b.x!, b.y!);
        
        const grad = ctx.createLinearGradient(a.x!, a.y!, b.x!, b.y!);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
        grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.2)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0.05)');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Draw Nodes with depth and glow
      nodes.forEach(n => {
        const theme = NODE_THEME[n.node_type] || { color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' };
        const r = n.node_type === 'FIR' ? 12 : 8;
        
        // Outer Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = theme.glow;
        
        // Base Circle
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
        ctx.fillStyle = theme.color;
        ctx.fill();
        
        // Glass Overlay
        ctx.shadowBlur = 0;
        const radialGrad = ctx.createRadialGradient(n.x! - r/3, n.y! - r/3, r/10, n.x!, n.y!, r);
        radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        radialGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = radialGrad;
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (n.node_type === 'FIR') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'black 9px "Roboto Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(n.id.slice(-6), n.x!, n.y! + r + 16);
        }
      });
    }

    function loop() {
      tick();
      draw();
      // Once settled, do one final draw and stop the loop
      if (settled) {
        draw();
        return; // Stop requestAnimationFrame — graph is frozen
      }
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, canvasRef]);
}

// ── Components ─────────────────────────────────────────────────────────────
function DashboardCard({ children, className = "", title, icon: Icon, sub }: { children: React.ReactNode; className?: string, title?: string, icon?: LucideIcon, sub?: string }) {
  return (
    <div className={`relative group overflow-hidden bg-slate-950 border border-slate-800 rounded-[2rem] p-6 transition-all duration-500 hover:border-indigo-500/30 hover:shadow-[0_0_40px_rgba(79,70,229,0.1)] ${className}`}>
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[80px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
      
      {(title || Icon) && (
        <div className="flex items-center gap-3 mb-6 relative">
          {Icon && (
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
              <Icon size={20} />
            </div>
          )}
          <div>
            {title && <h3 className="text-white font-black tracking-tighter uppercase text-sm">{title}</h3>}
            {sub && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{sub}</p>}
          </div>
        </div>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

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

  const load = useCallback(async <T,>(path: string, setter: (d: T) => void) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setter(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'overview' && !summary) {
      load('/graph/analysis/summary', setSummary);
      load('/graph/analysis/graph-data', (d: { nodes: GraphNode[]; edges: { source: string; target: string; rel_type?: string }[] }) => {
        setGraphNodes(d?.nodes?.slice(0, 150) ?? []);
        setGraphEdges(d?.edges?.slice(0, 300) ?? []);
      });
    }
    if (tab === 'centrality' && !centrality) load('/graph/analysis/centrality', setCentrality);
    if (tab === 'communities' && !communities) load('/graph/analysis/communities', setCommunities);
    if (tab === 'hotspots' && !hotspots) {
      // The hotspots endpoint returns { hotspots: [...] } from analysis
      // and { predictions: [...] } from ML predictions. Handle both.
      load<{ predictions?: Hotspot[]; hotspots?: Hotspot[] }>('/graph/analysis/hotspots', (d) => {
        const items = d?.predictions || d?.hotspots || [];
        // Normalize: ensure risk_score and risk_level exist
        const normalized = items.map((h) => ({
          ...h,
          risk_score: h.risk_score ?? h.danger_score ?? 0,
          risk_level: h.risk_level ?? (h.danger_score >= 5 ? 'Critical' : h.danger_score >= 3 ? 'High' : 'Medium'),
        }));
        setHotspots({ predictions: normalized });
      });
    }
    if (tab === 'anomalies' && !anomalies) load('/graph/ml/detect-anomalies', setAnomalies);
  }, [tab, summary, centrality, communities, hotspots, anomalies, load]);

  const handleTrain = async () => {
    setTrainingStatus('Initializing Hyper-parameters...');
    try {
      const res = await fetch(`${API_BASE_URL}/graph/ml/train`, { method: 'POST' });
      const result = await res.json();
      setTrainingStatus(`✅ Optimization Sync Complete: ${(result?.accuracy * 100 || 0).toFixed(1)}% Efficiency`);
    } catch {
      setTrainingStatus(`❌ Neural Incursion Error`);
    }
  };

  const tabs = [
    { key: 'overview', label: 'Matrix', icon: Network },
    { key: 'centrality', label: 'Flow', icon: BarChart2 },
    { key: 'communities', label: 'Clusters', icon: Users },
    { key: 'hotspots', label: 'Threats', icon: Activity },
    { key: 'anomalies', label: 'Bugs', icon: AlertOctagon },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4">
      {/* ── Neural Header ── */}
      <div className="relative group p-10 bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/5 blur-[100px] pointer-events-none" />
        
        <div className="relative space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-500/20 border border-indigo-500/30 rounded-3xl shadow-[0_0_30px_rgba(79,70,229,0.2)]">
              <Cpu className="text-indigo-400 animate-pulse" size={32} />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase leading-none">
                Graph <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Intelligence</span>
              </h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">Neo4j Neural Relationship Mapping • v2.8.0</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium max-w-xl leading-relaxed">
            High-fidelity multidimensional relationship engine for crime pattern detection. Utilizing spectral clustering and PageRank algorithms to identify non-linear escalation vectors.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 w-full md:w-64">
          <button
            onClick={handleTrain}
            className="group/btn relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase text-xs tracking-[0.2em] text-white flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:scale-105 active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite]" />
            <Zap size={16} className="text-indigo-200" />
            <span>Process Neural Models</span>
          </button>
          {trainingStatus && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono font-bold text-indigo-400 animate-in slide-in-from-right-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              {trainingStatus}
            </div>
          )}
        </div>
      </div>

      {/* ── Segmented Control ── */}
      <div className="flex justify-center">
        <div className="inline-flex p-2 bg-slate-950/50 border border-slate-800 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-3 px-8 py-4 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all relative z-10 ${
                  active
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {active && (
                  <div className="absolute inset-0 bg-indigo-600 rounded-[2rem] shadow-[0_0_30px_rgba(79,70,229,0.5)] animate-in fade-in zoom-in-95 -z-10" />
                )}
                <Icon size={18} className={active ? "text-white" : "text-slate-500"} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-4 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-400 text-sm font-bold animate-in bounce-in backdrop-blur-sm">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertOctagon size={24} />
          </div>
          <div>
            <p className="uppercase tracking-widest text-[10px] mb-1 font-black">Sync Collision</p>
            <p className="font-mono">{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-4 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] h-20">
          <RefreshCw className="animate-spin" size={16} />
          <span>Synchronizing Grid Matrix...</span>
        </div>
      )}

      {/* ════════════════ CONTENT AREA ════════════════ */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* TAB: OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Neural Nodes', value: summary.total_nodes, icon: Users, color: 'text-blue-400', sub: 'Total Entities' },
                  { label: 'Link Synapses', value: summary.total_edges, icon: Layers, color: 'text-indigo-400', sub: 'Total Relationships' },
                  { label: 'Grid Density', value: summary.density?.toFixed(4), icon: Activity, color: 'text-emerald-400', sub: 'Network Saturation' },
                  { label: 'Rel. Weight', value: summary.avg_node_degree?.toFixed(2), icon: BarChart2, color: 'text-amber-400', sub: 'Avg Connectivity' },
                ].map((s, i) => (
                  <DashboardCard key={i} className="group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                        <p className="text-3xl font-black text-white">{s.value ?? '—'}</p>
                      </div>
                      <div className={`p-2 bg-slate-900 rounded-xl border border-slate-800 ${s.color}`}>
                        <s.icon size={18} />
                      </div>
                    </div>
                    <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500/20 w-2/3" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter mt-2 italic">{s.sub}</p>
                  </DashboardCard>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Force Graph Panel */}
              <div className="lg:col-span-2 relative group">
                <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                <div className="relative h-[650px] bg-slate-950 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                    <div className="px-8 py-5 border-b border-slate-900 flex justify-between items-center bg-slate-950/50 backdrop-blur-xl z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      <div>
                        <h2 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Neural Relationship Matrix</h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Autonomous self-organizing entity network</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-6">
                      {Object.entries(NODE_THEME).map(([type, theme]) => (
                        <div key={type} className="flex items-center gap-2 group/legend cursor-help">
                          <div className="w-2 h-2 rounded-full transition-shadow duration-300 group-hover/legend:shadow-[0_0_8px_rgba(255,255,255,0.4)]" style={{ background: theme.color }} />
                          <span className="text-xs font-black text-slate-500 uppercase tracking-tighter group-hover/legend:text-slate-300 transition-colors">{type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#020617_100%)]">
                    <canvas ref={canvasRef} width={1000} height={600} className="w-full h-full cursor-grab active:cursor-grabbing" />
                    
                    <div className="absolute bottom-8 left-8 space-y-2 pointer-events-none">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg backdrop-blur-md">
                        <Lock size={10} className="text-indigo-400" />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest text-white/60">ENCRYPTION: ACTIVE</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg backdrop-blur-md">
                        <TrendingUp size={10} className="text-emerald-400" />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest text-white/60">SYNC: OPTIMIZED</span>
                      </div>
                    </div>
                    
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />
                  </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-8">
                <DashboardCard title="Entity Distribution" icon={Filter} sub="Class Breakdown">
                  <div className="space-y-6 mt-4">
                    {summary?.node_type_counts && Object.entries(summary.node_type_counts).map(([type, count]) => (
                      <div key={type} className="group/bar space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: NODE_THEME[type]?.color || '#94a3b8' }} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/bar:text-white transition-colors">{type}</span>
                          </div>
                          <span className="text-xs font-mono font-black text-indigo-400">{count}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                          <div 
                            className="h-full rounded-full transition-all duration-1000 group-hover:brightness-125"
                            style={{ 
                              width: `${(count / (summary?.total_nodes || 1)) * 100}%`,
                              backgroundColor: NODE_THEME[type]?.color || '#94a3b8',
                              boxShadow: `0 0 10px ${NODE_THEME[type]?.glow || 'transparent'}`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </DashboardCard>

                <DashboardCard title="System Diagnostics" icon={BrainCircuit} sub="Neural Health" className="bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/5">
                  <div className="space-y-6 mt-2">
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic uppercase tracking-tighter">
                      Relationship vectors are calculated across 14 dimensions of First Information Reports.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Components</p>
                        <p className="text-2xl font-black text-white tracking-tighter">{summary?.num_connected_components || 0}</p>
                      </div>
                      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Density</p>
                        <p className="text-lg font-black text-emerald-400 font-mono">{(summary?.density || 0).toFixed(5)}</p>
                      </div>
                    </div>
                  </div>
                </DashboardCard>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CENTRALITY */}
        {tab === 'centrality' && centrality && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in zoom-in-95 duration-700">
            {[
              { key: 'pagerank' as keyof CentralityResult, label: 'Influence Index', icon: Zap, sub: 'Network Stability impact' },
              { key: 'betweenness_centrality' as keyof CentralityResult, label: 'Bridge Centrality', icon: GitMerge, sub: 'Inter-cluster Connectivity' },
            ].map(({ key, label, icon: Icon, sub }) => {
              const items = centrality[key] as CentralityNode[];
              return (
                <div key={key} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-[2.5rem] blur opacity-50" />
                  <DashboardCard title={label} icon={Icon} sub={sub} className="h-fit !bg-slate-950/80 backdrop-blur-xl">
                    <div className="space-y-4 pt-2">
                      {items?.slice(0, 8).map((item, i) => (
                        <div key={i} className="group/item flex items-center gap-5 p-4 bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all duration-300">
                          <code className="text-slate-600 font-mono text-[10px] w-8 group-hover/item:text-indigo-400 transition-colors">0x{String(i + 1).padStart(2, '0')}</code>
                          <div 
                            className="w-1.5 h-6 rounded-full flex-shrink-0" 
                            style={{ background: NODE_THEME[item.node_type]?.color || '#94a3b8' }} 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-black tracking-tight truncate group-hover/item:text-indigo-200 transition-colors capitalize">
                              {item.node}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.node_type}</span>
                              {item.severity && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: SEVERITY_THEME[item.severity]?.color }}>
                                    {SEVERITY_THEME[item.severity]?.label || item.severity}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-indigo-400 text-lg font-black font-mono tracking-tighter leading-none">
                              {((item).percent || (item.score * 100)).toFixed(1)}%
                            </span>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Power Index</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DashboardCard>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: COMMUNITIES */}
        {tab === 'communities' && communities && (
          <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <DashboardCard className="bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/20">
                <p className="text-slate-500 text-[10px] font-black uppercase mb-2 tracking-[0.3em]">Discrete Neural Clusters</p>
                <div className="flex items-center gap-4">
                  <p className="text-6xl font-black text-white tracking-tighter">{communities?.num_communities ?? 0}</p>
                  <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                    <GitMerge size={32} />
                  </div>
                </div>
              </DashboardCard>
              <DashboardCard className="bg-gradient-to-br from-purple-500/5 to-transparent border-purple-500/20">
                <p className="text-slate-500 text-[10px] font-black uppercase mb-2 tracking-[0.3em]">Network Cohesion Index</p>
                <div className="flex items-center gap-4">
                  <p className="text-6xl font-black text-white tracking-tighter">{(communities?.modularity_score ?? 0).toFixed(3)}</p>
                  <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400">
                    <Activity size={32} />
                  </div>
                </div>
              </DashboardCard>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(communities.communities || []).slice(0, 12).map(c => (
                <div key={c.community_id} className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-slate-800 to-transparent rounded-[2.5rem] opacity-50 group-hover:from-indigo-500/20 transition-all duration-500" />
                  <div className="relative bg-slate-950 border border-slate-900 p-8 rounded-[2.5rem] space-y-8 overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/5 blur-3xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="text-white font-black text-2xl tracking-tighter uppercase leading-none">Sector <span className="text-indigo-500">{c.community_id}</span></h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Cluster Manifest</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Pop</p>
                        <p className="text-2xl font-black text-white leading-none font-mono">{c.size}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-900 pb-2 flex items-center gap-2">
                        <Filter size={10} className="text-indigo-500" /> Entity Distribution
                      </p>
                      <div className="flex flex-wrap gap-2">
                         {Object.entries(c.node_type_breakdown || {}).map(([type, cnt]) => (
                          <div key={type} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl transition-all hover:bg-slate-900">
                            <div className="w-1 h-1 rounded-full" style={{ background: NODE_THEME[type]?.color || '#94a3b8' }} />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-slate-200">{type}</span>
                            <span className="text-[9px] font-black text-indigo-400 font-mono">{cnt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-900 space-y-3">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={10} className="text-emerald-500" /> Geospatial influence
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-300 font-bold tracking-tight">
                          {(c.key_locations || []).slice(0, 2).map(l => l.area || 'Metro Sector').join(', ') || 'Global Distribution'}
                        </p>
                        <ChevronRight size={12} className="text-slate-700" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: HOTSPOTS */}
        {tab === 'hotspots' && hotspots && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <DashboardCard className="bg-gradient-to-br from-indigo-500/10 via-slate-950 to-transparent border-indigo-500/30 p-10">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="p-6 bg-indigo-500/20 rounded-3xl border border-indigo-500/40 shadow-[0_0_50px_rgba(79,70,229,0.3)]">
                  <Activity className="text-indigo-400" size={48} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Predictive Threat Intelligence</h3>
                  <p className="text-slate-400 text-sm max-w-2xl leading-relaxed font-medium">
                    Composite risk scoring engine integrating FIR spatial density, historical severity weighting, network centrality, and fatal velocity. Identifying emerging crisis zones with <span className="text-indigo-400 font-bold italic">Neural Precision</span>.
                  </p>
                </div>
              </div>
            </DashboardCard>

            <div className="grid grid-cols-1 gap-6">
              {(hotspots.predictions || []).map((h, i) => {
                const threatColor = h.risk_score >= 70 ? '#f43f5e' : h.risk_score >= 40 ? '#f59e0b' : '#10b981';
                return (
                  <div 
                    key={h.location_id} 
                    className="group relative bg-slate-950 border border-slate-900 hover:border-indigo-500/30 p-8 rounded-[2.5rem] transition-all duration-500 overflow-hidden flex flex-col lg:flex-row items-start lg:items-center gap-10"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full opacity-40 group-hover:opacity-100 transition-opacity" style={{ background: threatColor }} />
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-slate-900/40 rounded-full blur-[100px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                    
                    <div className="flex items-center gap-8 flex-1 min-w-0">
                      <span className="text-slate-900 text-7xl font-black italic tracking-tighter opacity-30 select-none group-hover:opacity-50 transition-opacity">#{i + 1}</span>
                      <div className="space-y-2 min-w-0">
                        <h4 className="text-3xl font-black text-white truncate uppercase tracking-tighter group-hover:text-indigo-200 transition-colors">{h.area || 'Unknown Sector'}</h4>
                        <div className="flex items-center gap-3">
                          <MapPin size={14} className="text-indigo-500" />
                          <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{h.city || 'Regional Sector'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-12 items-center relative z-10 w-full lg:w-auto">
                      <div className="space-y-2 p-5 bg-slate-900/50 rounded-3xl border border-slate-800/50 min-w-[140px] text-center lg:text-left transition-all group-hover:border-indigo-500/20">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Threat Index</p>
                        <p className="text-4xl font-black font-mono leading-none" style={{ color: threatColor }}>
                          {h.risk_score}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-900 pb-2">Cluster Metrics</p>
                        <div className="flex gap-8">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase">Case Count</p>
                            <p className="text-lg font-black text-white font-mono">{h.fir_count}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase">Risk Level</p>
                            <p className="text-lg font-black text-white font-mono italic capitalize">{h.risk_level}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-900 pb-2">Severity Spread</p>
                        <div className="flex gap-2">
                          {Object.entries(h.severity_breakdown || {}).map(([sev, cnt]) => (
                            <div 
                              key={sev} 
                              className="px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-tighter flex flex-col items-center gap-1 group/chip transition-all hover:scale-105" 
                              style={{ 
                                borderColor: `${SEVERITY_THEME[sev]?.color || '#64748b'}33`, 
                                background: `${SEVERITY_THEME[sev]?.color || '#64748b'}11`, 
                                color: SEVERITY_THEME[sev]?.color || '#94a3b8' 
                              }}
                            >
                              <span className="opacity-60">{SEVERITY_THEME[sev]?.label || sev}</span>
                              <span className="text-sm font-mono text-white brightness-125">{cnt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: ANOMALIES */}
        {tab === 'anomalies' && anomalies && (
          <div className="space-y-12 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <DashboardCard className="!border-red-500/30 !bg-red-500/[0.03]">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-2 bg-red-500/20 rounded-xl text-red-400">
                    <AlertOctagon size={24} />
                  </div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Statistical Anomalies</p>
                </div>
                <div className="flex items-baseline gap-4">
                  <p className="text-7xl font-black text-red-500 tracking-tighter">{anomalies.anomaly_count}</p>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-200 uppercase">Critical Outliers</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase italic">Awaiting Human Audit</p>
                  </div>
                </div>
              </DashboardCard>
              <DashboardCard className="!border-emerald-500/20 !bg-emerald-500/[0.02]">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                    <Activity size={24} />
                  </div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Standard Distribution</p>
                </div>
                <div className="flex items-baseline gap-4">
                  <p className="text-7xl font-black text-emerald-500 tracking-tighter">{anomalies.normal_count}</p>
                  <p className="text-xs font-black text-slate-400 uppercase">Baseline Pattern Match</p>
                </div>
              </DashboardCard>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {(anomalies.anomalies || []).map((a, i) => (
                <div key={i} className="group relative bg-slate-950 border border-red-900/40 hover:border-red-500/50 p-0 rounded-[2.5rem] transition-all duration-500 overflow-hidden flex">
                   <div className="w-2 bg-red-600/30 group-hover:bg-red-500/80 transition-all duration-700" />
                   <div className="flex-1 p-10 flex flex-col lg:flex-row justify-between gap-12 relative">
                      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/[0.02] blur-[120px] pointer-events-none" />
                      
                      <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-4">
                          <h5 className="text-3xl font-black text-white italic tracking-tighter uppercase group-hover:text-red-200 transition-colors">FIR_{a.fir_number}</h5>
                          <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-[9px] font-black text-red-400 uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)]">Neural Warning</div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-4 bg-slate-900/40 border border-slate-900 rounded-2xl group-hover:border-red-900/30 transition-colors">
                           <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                             <Info size={16} />
                           </div>
                           <div>
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Anomaly Vector</p>
                             <p className="text-sm font-bold text-slate-200 italic">&ldquo;{a.cause || 'Unknown Deviation'}&rdquo;</p>
                           </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                           {(a.reasons || []).map((r, ri) => (
                            <span key={ri} className="px-4 py-1.5 bg-red-900/20 border border-red-700/30 rounded-xl text-[9px] font-black text-red-300 uppercase tracking-widest transition-all hover:bg-red-900/40">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col justify-between items-end gap-8 relative z-10 min-w-[200px]">
                        <div 
                          className="px-6 py-3 rounded-2xl text-[10px] font-black border uppercase tracking-[0.2em] shadow-lg"
                          style={{ 
                            borderColor: `${SEVERITY_THEME[a.severity || 'Unknown']?.color || '#64748b'}44`, 
                            color: SEVERITY_THEME[a.severity || 'Unknown']?.color || '#94a3b8',
                            background: `${SEVERITY_THEME[a.severity || 'Unknown']?.color || '#64748b'}11`
                          }}
                        >
                          {SEVERITY_THEME[a.severity || 'Unknown']?.label || a.severity}
                        </div>
                        <div className="text-right space-y-1 bg-slate-900/50 p-5 rounded-3xl border border-slate-900 min-w-[180px]">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Divergence Coeff</p>
                          <p className="text-4xl font-black text-red-500 font-mono tracking-tighter leading-none">{a.anomaly_score.toFixed(4)}</p>
                        </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


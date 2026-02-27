"use client";

import { useEffect, useState, useMemo } from "react";
import { API_BASE_URL } from "@/lib/api";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { 
  MapPin, Search, Activity, RefreshCw, 
  Shield, AlertTriangle, BarChart2, Briefcase, ArrowUpDown
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  ResponsiveContainer, Tooltip as RechartsTooltip, Cell
} from 'recharts';

interface AccidentMarker {
  id: number;
  fir_number: string;
  severity: string;
  cause: string;
  incident_date: string;
  address: string;
  area: string;
  city: string;
  lat: number | null;
  lng: number | null;
  victim_count: number;
  fatality_count: number;
  confidence_score: number;
}

interface JurisdictionData {
  area_name: string;
  total_accidents: number;
  most_common_cause: string;
  high_risk_age_group: string;
  peak_time: string;
  fatality_percentage: number;
  most_risky_vehicle: string;
  summary: string;
  key_insights: string[];
  policy_recommendations: string[];
  public_awareness_suggestions: string[];
  age_distribution: { age_group: string; count: number }[];
  time_distribution: { time_slot: string; count: number }[];
  cause_distribution: { cause: string; count: number }[];
  vehicle_distribution: { vehicle_type: string; count: number }[];
}

const UNKNOWN_AREA_LABEL = "Unknown Area";

const SEVERITY_COLORS: Record<string, string> = {
  Fatal: "#ef4444",
  Grievous: "#f59e0b",
  "Simple": "#3b82f6",
  "Non-Injury": "#10b981",
  Unknown: "#6b7280",
};

type SortOption = 'accidents-high' | 'accidents-low' | 'fatality-high' | 'alphabetical';

// Component to update map center dynamically
function ReCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
      map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function AreaAnalysisPage() {
  const [allMarkers, setAllMarkers] = useState<AccidentMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('accidents-high');

  const [aiData, setAiData] = useState<JurisdictionData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/map/locations?all=true`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          setAllMarkers(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedStation) return;
    fetchInsights(selectedStation);
  }, [selectedStation]);

  const fetchInsights = async (station: string, forceRefresh = false) => {
    setLoadingData(true);
    setError(null);
    try {
      const url = forceRefresh 
          ? `${API_BASE_URL}/areas/${encodeURIComponent(station)}/insights?refresh=true` 
          : `${API_BASE_URL}/areas/${encodeURIComponent(station)}/insights`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setAiData({
          ...result.input_stats,
          summary: result.summary,
          key_insights: result.key_insights || [],
          policy_recommendations: result.policy_recommendations || [],
          public_awareness_suggestions: result.public_awareness_suggestions || []
        });
      } else {
        setError(result.error || result.message || 'Failed to generate insights');
        setAiData(null);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setAiData(null);
    } finally {
      setLoadingData(false);
    }
  };

  const getAreaLabel = (marker: AccidentMarker) => {
    const label = (marker.area || "").trim();
    return label.length > 0 ? label : UNKNOWN_AREA_LABEL;
  };

  const areaStats = useMemo(() => {
    const map = new Map<string, { total: number; fatal: number }>();
    allMarkers.forEach((marker) => {
      const area = getAreaLabel(marker);
      const current = map.get(area) || { total: 0, fatal: 0 };
      current.total += 1;
      if (marker.severity === 'Fatal') current.fatal += 1;
      map.set(area, current);
    });

    return [...map.entries()].map(([area, stats]) => ({
      area,
      total: stats.total,
      fatalityRate: stats.total > 0 ? (stats.fatal / stats.total) * 100 : 0
    }));
  }, [allMarkers]);

  useEffect(() => {
    if (!selectedStation && areaStats.length > 0) {
      const sorted = [...areaStats].sort((a, b) => b.total - a.total);
      setSelectedStation(sorted[0].area);
    }
  }, [areaStats, selectedStation]);

  const filteredStations = useMemo(() => {
    let result = [...areaStats];
    if (searchQuery) {
      result = result.filter(s => s.area.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    result.sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.area.localeCompare(b.area);
      } else if (sortBy === 'accidents-high') {
        if (b.total !== a.total) return b.total - a.total;
        return a.area.localeCompare(b.area);
      } else if (sortBy === 'accidents-low') {
        if (a.total !== b.total) return a.total - b.total;
        return a.area.localeCompare(b.area);
      } else if (sortBy === 'fatality-high') {
        if (b.fatalityRate !== a.fatalityRate) return b.fatalityRate - a.fatalityRate;
        return b.total - a.total;
      }
      return 0;
    });
    return result;
  }, [searchQuery, areaStats, sortBy]);

  const activeMarkers = useMemo(() => {
    if (!selectedStation) return [];
    return allMarkers.filter(m => getAreaLabel(m) === selectedStation);
  }, [selectedStation, allMarkers]);

  const mappableMarkers = useMemo(() => {
    return activeMarkers.filter(m => m.lat !== null && m.lng !== null);
  }, [activeMarkers]);

  const mapCenter: [number, number] = useMemo(() => {
    if (mappableMarkers.length === 0) return [16.5062, 80.6200];
    let latSum = 0;
    let lngSum = 0;
    mappableMarkers.forEach(m => {
      latSum += m.lat!;
      lngSum += m.lng!;
    });
    return [latSum / mappableMarkers.length, lngSum / mappableMarkers.length];
  }, [mappableMarkers]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[700px] overflow-hidden">
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-400 flex items-center gap-3">
              <MapPin className="text-teal-400" size={32} /> Area-Wise Map Analysis
            </h1>
            <p className="text-slate-400 mt-2">
              Select an area in NTR district to view map coordinates and local AI insights.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total FIRs</p>
            <p className="text-2xl font-bold text-teal-400 font-mono">{allMarkers.length}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-full lg:w-80 flex flex-col glass rounded-2xl border border-teal-500/20 overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-slate-700/50 bg-slate-900/50">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search areas..." 
                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="mt-3 relative">
              <ArrowUpDown className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 pl-10 pr-8 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none cursor-pointer"
              >
                <option value="accidents-high">Sort by: Accidents (High-Low)</option>
                <option value="accidents-low">Sort by: Accidents (Low-High)</option>
                <option value="fatality-high">Sort by: Fatality Rate</option>
                <option value="alphabetical">Sort by: Alphabetical</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            <div className="mt-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {filteredStations.length} Areas
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredStations.map(({ area, total, fatalityRate }) => (
              <button
                key={area}
                onClick={() => { setSelectedStation(area); }}
                className={`w-full text-left px-4 py-3 rounded-xl mb-1 transition-colors flex justify-between items-center ${
                  selectedStation === area 
                    ? "bg-teal-500/20 text-teal-300 font-medium border border-teal-500/30" 
                    : "text-slate-300 hover:bg-slate-800/80 border border-transparent"
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{area}</span>
                    <span className="text-[10px] opacity-70 mt-0.5" title={`${fatalityRate.toFixed(1)}% fatality rate`}>Fatality: {fatalityRate.toFixed(1)}%</span>
                </div>
                <div className="flex-shrink-0 bg-slate-800/80 px-2 py-0.5 rounded text-xs border border-slate-700 font-mono" title={`${total} accidents`}>
                    {total}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area (Map + Stats) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6">
          
          {/* Map Section */}
          <div className="h-[400px] flex-shrink-0 rounded-2xl border border-slate-700 overflow-hidden relative glass w-full z-0">
            <div className="absolute top-4 left-4 z-10 glass px-6 py-4 rounded-xl border border-slate-600 shadow-2xl flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Area</p>
                <p className="text-white font-semibold text-lg">{selectedStation}</p>
              </div>
              <div className="h-10 w-px bg-slate-700" />
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Records</p>
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-rose-400" />
                  <p className="text-white font-bold text-xl">{activeMarkers.length}</p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
              <div className="glass px-4 py-2 rounded-full border border-slate-600 shadow-xl flex items-center gap-4 text-sm">
                {Object.entries(SEVERITY_COLORS).map(([severity, color]) => (
                  <div key={severity} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-slate-300 font-medium">{severity}</span>
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="w-full h-full bg-slate-900/80 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-700 border-t-teal-500 rounded-full animate-spin" />
              </div>
            ) : (
              <MapContainer
                center={mapCenter}
                zoom={mappableMarkers.length === 0 ? 11 : 13}
                style={{ width: "100%", height: "100%", background: "#0f172a" }}
                zoomControl={false}
              >
                  <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  
                  <ReCenter center={mapCenter} />

                {mappableMarkers.map((marker) => (
                  <CircleMarker
                    key={marker.id}
                    center={[marker.lat!, marker.lng!]}
                    radius={marker.severity === "Fatal" ? 10 : 7}
                    pathOptions={{
                        fillColor: SEVERITY_COLORS[marker.severity] || SEVERITY_COLORS.Unknown,
                        fillOpacity: 0.9,
                        color: "#ffffff",
                        weight: 2,
                    }}
                  >
                      <Popup>
                        <div className="p-2 min-w-[200px] text-slate-900">
                          <h3 className="font-bold border-b pb-1 mb-2">FIR #{marker.fir_number}</h3>
                          <div className="space-y-1 text-sm">
                            <p><span className="font-medium">Severity:</span> {marker.severity}</p>
                            <p><span className="font-medium">Date:</span> {new Date(marker.incident_date).toLocaleDateString()}</p>
                            <p><span className="font-medium">Address:</span> {marker.address}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = `/accidents/${marker.id}`;
                            }}
                            className="mt-3 w-full bg-slate-900 text-white rounded py-1.5 text-xs font-bold hover:bg-slate-800 transition-colors"
                          >
                            View Report
                          </button>
                        </div>
                      </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </div>

          {/* AI Analysis Section */}
          <div className="w-full pb-12">
            {loadingData && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 glass rounded-2xl">
                    <RefreshCw className="animate-spin mb-4 text-teal-500" size={40} />
                    <p className="text-lg">Generating AI analysis report for <strong className="text-white">{selectedStation}</strong>...</p>
                </div>
            )}

            {error && !loadingData && (
                <div className="glass p-8 rounded-2xl text-center border-red-500/30 bg-red-900/10">
                    <p className="text-red-400 font-medium text-xl">{error}</p>
                </div>
            )}

            {!loadingData && aiData && !error && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                    
                    {/* Top Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total Accidents" value={aiData.total_accidents} sub="in this jurisdiction" color="blue" />
                        <StatCard label="Fatality Rate" value={`${aiData.fatality_percentage || 0}%`} sub="of total accidents" color="red" />
                        <StatCard label="Most Common Cause" value={aiData.most_common_cause || 'Unknown'} sub="primary risk factor" color="orange" />
                        <StatCard label="Vulnerable Age" value={aiData.high_risk_age_group || 'Unknown'} sub="highest risk group" color="purple" />
                    </div>

                    {/* AI Strategic Report */}
                    <div className="glass p-8 rounded-2xl border-l-4 border-l-teal-500 bg-teal-900/10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-teal-500/20 rounded-xl">
                                    <Briefcase className="text-teal-400" size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Strategic Report: {aiData.area_name}</h2>
                                    <p className="text-slate-400 mt-1">AI-generated operational intelligence for local authorities.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => fetchInsights(selectedStation, true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors border border-slate-700 whitespace-nowrap"
                            >
                                <RefreshCw size={16} />
                                Refresh Analysis
                            </button>
                        </div>

                        <div className="prose prose-invert max-w-none text-slate-300 text-lg leading-relaxed mb-8">
                            {aiData.summary}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Key Insights */}
                            <div>
                                <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2 mb-4">
                                    <AlertTriangle size={20} /> Local Risk Patterns
                                </h3>
                                <ul className="space-y-3">
                                    {aiData.key_insights.map((insight, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                            <span className="text-amber-500 font-bold">•</span>
                                            {insight}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Recommendations */}
                            <div>
                                <h3 className="text-lg font-semibold text-teal-400 flex items-center gap-2 mb-4">
                                    <Shield size={20} /> Targeted Interventions
                                </h3>
                                <ul className="space-y-3">
                                    {aiData.policy_recommendations.map((rec, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 bg-teal-900/10 p-3 rounded-lg border border-teal-500/20">
                                            <span className="text-teal-500 font-bold">•</span>
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Data Deep Dive Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Time Distribution */}
                        <div className="glass p-6 rounded-2xl">
                            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                                <BarChart2 size={20} className="text-blue-400" />
                                Temporal Distribution
                            </h3>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={(aiData?.time_distribution || []).slice(0, 6)} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="time_slot" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {(aiData?.time_distribution || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'][index % 6]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Cause Distribution */}
                        <div className="glass p-6 rounded-2xl">
                            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                                <AlertTriangle size={20} className="text-rose-400" />
                                Top Causes in {aiData?.area_name || 'Area'}
                            </h3>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={(aiData?.cause_distribution || []).slice(0, 6)} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="cause" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={120} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {(aiData?.cause_distribution || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1'][index % 6]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
    label: string;
    value?: number | string;
    sub: string;
    color: 'blue' | 'red' | 'orange' | 'purple';
}

function StatCard({ label, value, sub, color }: StatCardProps) {
    const colors: Record<StatCardProps['color'], string> = {
        blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
        red: 'text-red-400 border-red-500/30 bg-red-500/10',
        orange: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    };
    
    return (
        <div className={`p-6 rounded-2xl border ${colors[color]} glass transition-transform hover:-translate-y-1`}>
            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">{label}</p>
            <p className={`text-3xl font-bold ${colors[color].split(' ')[0]}`}>{value ?? 'N/A'}</p>
            <p className="text-slate-500 text-xs mt-2 font-medium">{sub}</p>
        </div>
    );
}

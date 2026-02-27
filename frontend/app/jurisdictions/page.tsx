"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { 
    RefreshCw, Shield, MapPin, AlertTriangle, 
    BarChart2, Briefcase, ChevronDown, Search, ArrowUpDown
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    ResponsiveContainer, Tooltip as RechartsTooltip, Cell
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { API_BASE_URL } from "@/lib/api";

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

interface ExclusiveSummaryItem {
    name: string;
    total: number;
    fatal: number;
    fatality_rate: number;
}

interface AccidentMarker {
    id: number;
    fir_number: string;
    severity: string;
    cause: string;
    incident_date: string;
    address: string;
    area: string;
    city: string;
    police_station: string | null;
    lat: number | null;
    lng: number | null;
}

const OTHER_STATIONS_LABEL = "OTHER STATIONS";
type SortOption = 'accidents-high' | 'accidents-low' | 'fatality-high' | 'alphabetical';
const SEVERITY_COLORS: Record<string, string> = {
    Fatal: "#ef4444",
    Grievous: "#f59e0b",
    "Simple": "#3b82f6",
    "Non-Injury": "#10b981",
    Unknown: "#6b7280",
    "Non-Fatal": "#3b82f6"
};

// Component to update map center dynamically
function ReCenter({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

export default function JurisdictionsPage() {
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [data, setData] = useState<JurisdictionData | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exclusiveSummary, setExclusiveSummary] = useState<ExclusiveSummaryItem[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('accidents-high');
    const [allMarkers, setAllMarkers] = useState<AccidentMarker[]>([]);
    const [mapLoading, setMapLoading] = useState(true);

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        Promise.all([
            fetch(`${API_BASE_URL}/jurisdictions/exclusive-summary`).then(res => res.json()),
            fetch(`${API_BASE_URL}/jurisdictions/hierarchy`).then(res => res.json())
        ])
        .then(([summaryResult]) => {
            if (summaryResult.success) {
                setExclusiveSummary(summaryResult.breakdown);
                setTotalRecords(summaryResult.total_records);
                const firstStation = summaryResult.breakdown.find((item: ExclusiveSummaryItem) => item.total > 0)?.name || OTHER_STATIONS_LABEL;
                const initialArea = firstStation;
                setSelectedArea(initialArea);
                fetchInsights(initialArea);
            }
            setLoadingList(false);
        })
        .catch(err => {
            console.error(err);
            setError("Failed to load jurisdictions list.");
            setLoadingList(false);
        });
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/map/locations?all=true`)
            .then(res => res.json())
            .then(result => {
                if (result.success) setAllMarkers(result.data || []);
                setMapLoading(false);
            })
            .catch(() => setMapLoading(false));
    }, []);

    const fetchInsights = async (area: string, forceRefresh = false) => {
        setLoadingData(true);
        setError(null);
        try {
            const url = forceRefresh
                ? `${API_BASE_URL}/jurisdictions/${encodeURIComponent(area)}/insights?refresh=true`
                : `${API_BASE_URL}/jurisdictions/${encodeURIComponent(area)}/insights`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) {
                setData({
                    ...result.input_stats,
                    summary: result.summary,
                    key_insights: result.key_insights || [],
                    policy_recommendations: result.policy_recommendations || [],
                    public_awareness_suggestions: result.public_awareness_suggestions || []
                });
            } else {
                setError(result.error || result.message || 'Failed to generate insights');
                setData(null);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(errorMessage);
            setData(null);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSelect = (area: string) => {
        setSelectedArea(area);
        setDropdownOpen(false);
        fetchInsights(area);
    };

    const getCountForStation = (name: string) => {
        return exclusiveSummary.find(s => s.name === name)?.total ?? 0;
    };

    const filteredStations = useMemo(() => {
        let result = [...exclusiveSummary];

        if (searchQuery.trim()) {
            result = result.filter((s) =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        result.sort((a, b) => {
            if (sortBy === 'accidents-high') return b.total - a.total;
            if (sortBy === 'accidents-low') return a.total - b.total;
            if (sortBy === 'fatality-high') return b.fatality_rate - a.fatality_rate;
            return a.name.localeCompare(b.name);
        });

        return result;
    }, [exclusiveSummary, searchQuery, sortBy]);

    const activeMarkers = useMemo(() => {
        if (!selectedArea) return [];
        return allMarkers.filter((marker) => marker.police_station === selectedArea);
    }, [allMarkers, selectedArea]);

    const mappableMarkers = useMemo(() => {
        return activeMarkers.filter((marker) => marker.lat !== null && marker.lng !== null);
    }, [activeMarkers]);

    const mapCenter: [number, number] = useMemo(() => {
        if (mappableMarkers.length === 0) return [16.5062, 80.6200];
        const latSum = mappableMarkers.reduce((sum, m) => sum + (m.lat || 0), 0);
        const lngSum = mappableMarkers.reduce((sum, m) => sum + (m.lng || 0), 0);
        return [latSum / mappableMarkers.length, lngSum / mappableMarkers.length];
    }, [mappableMarkers]);

    if (loadingList) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header / Top Control Bar */}
            <div className="relative z-[100] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass p-6 rounded-2xl border border-indigo-500/30">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-3">
                        <MapPin className="text-indigo-400" size={32} /> Jurisdiction Wise Analysis
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Police station-wise AI analysis using FIR P.S. field mapping.
                    </p>
                </div>
                
                <div className="relative w-full md:w-96 z-[60]" ref={dropdownRef}>
                    <div 
                        className="w-full bg-slate-800 border border-slate-600 text-slate-200 py-3 px-4 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 font-medium text-lg cursor-pointer flex items-center justify-between transition-colors hover:bg-slate-700"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        <span className="truncate">{selectedArea || "Select Police Station"}</span>
                        <ChevronDown size={20} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {dropdownOpen && (
                        <div className="absolute z-[100] w-full mt-2 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                            <div className="p-3 border-b border-slate-700/70 bg-slate-900/80">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search stations..."
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2.5 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="mt-2 relative">
                                    <ArrowUpDown className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 pl-9 pr-7 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                                    >
                                        <option value="accidents-high">Sort by: Accidents (High-Low)</option>
                                        <option value="accidents-low">Sort by: Accidents (Low-High)</option>
                                        <option value="fatality-high">Sort by: Fatality Rate</option>
                                        <option value="alphabetical">Sort by: Alphabetical</option>
                                    </select>
                                </div>
                                <div className="mt-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    {filteredStations.length} Jurisdictions
                                </div>
                            </div>

                            <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                                {filteredStations.map((station) => {
                                    const count = getCountForStation(station.name);
                                    return (
                                        <div 
                                            key={station.name}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors mb-1 ${
                                                selectedArea === station.name
                                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                                    : 'hover:bg-slate-800 text-slate-200 border border-transparent'
                                            }`}
                                            onClick={() => handleSelect(station.name)}
                                        >
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="truncate text-sm">{station.name}</span>
                                                <span className="text-[10px] opacity-70 mt-0.5">
                                                    Fatality: {station.fatality_rate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <span className="text-xs font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                                                {count}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Exclusive Summary Bar */}
            {exclusiveSummary.length > 0 && (
                <div className="glass p-4 rounded-2xl border border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Police Station Breakdown (P.S. Mapping)</p>
                        <p className="text-sm font-bold text-indigo-400">Total: {totalRecords} FIRs</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {exclusiveSummary.map(item => (
                            <button
                                key={item.name}
                                onClick={() => handleSelect(item.name)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                                    selectedArea === item.name
                                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                        : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <span>{item.name}</span>
                                <span className="ml-2 font-mono font-bold">{item.total}</span>
                                {item.fatal > 0 && (
                                    <span className="ml-1 text-red-400 text-xs">({item.fatal} fatal)</span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                            {exclusiveSummary.filter(i => i.total > 0).map((item, idx) => {
                                const pct = totalRecords > 0 ? (item.total / totalRecords) * 100 : 0;
                                const colors = ['#818cf8', '#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981', '#6b7280'];
                                return (
                                    <div
                                        key={item.name}
                                        className="h-full transition-all"
                                        style={{ width: `${pct}%`, backgroundColor: colors[idx % colors.length] }}
                                        title={`${item.name}: ${item.total} (${pct.toFixed(1)}%)`}
                                    />
                                );
                            })}
                        </div>
                        <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                            {exclusiveSummary.reduce((s, i) => s + i.total, 0)} / {totalRecords}
                        </span>
                    </div>
                </div>
            )}

            {/* Jurisdiction Map */}
            <div className="h-[380px] rounded-2xl border border-slate-700 overflow-hidden relative glass w-full z-0">
                <div className="absolute top-4 left-4 z-10 glass px-5 py-3 rounded-xl border border-slate-600 shadow-2xl flex items-center gap-6">
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Police Station</p>
                        <p className="text-white font-semibold text-lg">{selectedArea || 'N/A'}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-700" />
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Records</p>
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-rose-400" />
                            <p className="text-white font-bold text-xl">{activeMarkers.length}</p>
                        </div>
                    </div>
                </div>

                {mapLoading ? (
                    <div className="w-full h-full bg-slate-900/80 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
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
                                            <p><span className="font-medium">Area:</span> {marker.area || 'Unknown Area'}</p>
                                            <p><span className="font-medium">Address:</span> {marker.address || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                )}
            </div>

            {loadingData && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <RefreshCw className="animate-spin mb-4 text-indigo-500" size={40} />
                    <p className="text-lg">Generating AI analysis report for <strong className="text-white">{selectedArea}</strong>...</p>
                </div>
            )}

            {error && !loadingData && (
                <div className="glass p-8 rounded-2xl text-center border-red-500/30 bg-red-900/10">
                    <p className="text-red-400 font-medium text-xl">{error}</p>
                </div>
            )}

            {!loadingData && data && !error && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                    
                    {/* Top Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total Accidents" value={data.total_accidents} sub="in this police station" color="blue" />
                        <StatCard label="Fatality Rate" value={`${data.fatality_percentage || 0}%`} sub="of total accidents" color="red" />
                        <StatCard label="Most Common Cause" value={data.most_common_cause || 'Unknown'} sub="primary risk factor" color="orange" />
                        <StatCard label="Vulnerable Age" value={data.high_risk_age_group || 'Unknown'} sub="highest risk group" color="purple" />
                    </div>

                    {/* AI Strategic Report */}
                    <div className="glass p-8 rounded-2xl border-l-4 border-l-indigo-500 bg-indigo-900/10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-indigo-500/20 rounded-xl">
                                    <Briefcase className="text-indigo-400" size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Strategic Report: {data.area_name}</h2>
                                    <p className="text-slate-400 mt-1">AI-generated operational intelligence for local authorities.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => selectedArea && fetchInsights(selectedArea, true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors border border-slate-700 whitespace-nowrap"
                            >
                                <RefreshCw size={16} />
                                Refresh Analysis
                            </button>
                        </div>

                        <div className="prose prose-invert max-w-none text-slate-300 text-lg leading-relaxed mb-8">
                            {data.summary}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Key Insights */}
                            <div>
                                <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2 mb-4">
                                    <AlertTriangle size={20} /> Local Risk Patterns
                                </h3>
                                <ul className="space-y-3">
                                    {data.key_insights.map((insight, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                                            <span className="text-amber-500 font-bold">•</span>
                                            {insight}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Recommendations */}
                            <div>
                                <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2 mb-4">
                                    <Shield size={20} /> Targeted Interventions
                                </h3>
                                <ul className="space-y-3">
                                    {data.policy_recommendations.map((rec, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 bg-emerald-900/10 p-3 rounded-lg border border-emerald-500/20">
                                            <span className="text-emerald-500 font-bold">•</span>
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Data Deep Dive Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Time Distribution */}
                        <div className="glass p-6 rounded-2xl">
                            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                                <BarChart2 size={20} className="text-blue-400" />
                                Temporal Distribution
                            </h3>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={(data?.time_distribution || []).slice(0, 6)} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="time_slot" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {(data?.time_distribution || []).map((entry, index) => (
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
                                Top Causes in {data?.area_name || 'Area'}
                            </h3>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={(data?.cause_distribution || []).slice(0, 6)} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="cause" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={120} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {(data?.cause_distribution || []).map((entry, index) => (
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
    );
}

// Reuse the StatCard component styling
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

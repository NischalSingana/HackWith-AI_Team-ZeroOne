"use client";

import { useEffect, useState, useCallback } from 'react';
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    Legend,
    BarChart,
    Bar
} from 'recharts';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
    Shield, 
    FileText, 
    AlertTriangle, 
    Activity, 
    Map as MapIcon, 
    Clock,
    Users,
    ChevronRight,
    Zap,
    Box,
    Layers,
    Cpu,
    ArrowRight,
    MapPin,
    LucideIcon
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const AccidentMap = dynamic(() => import('@/components/AccidentMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[500px] bg-slate-950/50 rounded-3xl flex items-center justify-center border border-slate-800/50 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-slate-500 font-black uppercase tracking-widest text-xs">
                <div className="animate-spin w-5 h-5 border-2 border-slate-800 border-t-indigo-500 rounded-full" />
                Synchronizing Map Matrix...
            </div>
        </div>
    ),
});

interface StatsData {
    total_accidents: number;
    severity: { severity: string; count: number }[];
    time_analysis: { hour: number; count: number }[];
    top_causes: { cause: string; count: number }[];
    monthly_trend: { month: string; count: number }[];
    avg_confidence: number;
    recent_accidents: {
        id: number;
        fir_number: string;
        severity: string;
        cause: string;
        incident_date: string;
        created_at: string;
        area: string;
        city: string;
    }[];
    total_victims: number;
    fatality_rate: number;
    peak_hour: { hour: number; count: number } | null;
}

export default function Dashboard() {
    const [stats, setStats] = useState<StatsData | null>(null); 
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/stats`);
            if (!res.ok) throw new Error('Data Sync Failure');
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (!stats) {
        return loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 border-4 border-slate-900 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_30px_rgba(79,70,229,0.3)]" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Initializing Command Nexus</p>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <AlertTriangle size={48} className="text-red-500/50" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Protocol Sync Failed</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-black uppercase text-indigo-400 hover:text-white transition-colors">Re-Initialize</button>
            </div>
        );
    }

    const SEVERITY_COLORS = ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#64748b'];

    return (
        <div className="space-y-12 pb-20 animate-in fade-in duration-1000">
            {/* ── Header Area ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-900 pb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-indigo-400 mb-2">
                        <Box size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Integrated Intelligence</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase leading-none">
                        CRIME <span className="text-gradient hover:animate-pulse transition-all">NEXUS</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium tracking-tight">Advanced Relationship Intelligence & Neural Evidence Mapping.</p>
                </div>
                <div className="flex items-center gap-4">
                     <div className="hidden lg:flex items-center gap-6 px-8 py-3 bg-slate-950/50 border border-slate-900 rounded-2xl backdrop-blur-xl">
                        <div className="space-y-1">
                            <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Node Stability</p>
                            <p className="text-sm font-black text-emerald-400 uppercase">A1-OPTIMAL</p>
                        </div>
                        <div className="w-px h-6 bg-slate-900" />
                        <div className="space-y-1">
                            <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Neural Sync</p>
                            <p className="text-sm font-black text-indigo-400 uppercase">99.2% ACC</p>
                        </div>
                     </div>
                     <Link 
                        href="/insights" 
                        className="group relative px-6 py-4 bg-indigo-600 rounded-2xl shadow-[0_15px_30px_-10px_rgba(79,70,229,0.4)] transition-all hover:scale-105 active:scale-95 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                        <span className="flex items-center gap-3 text-xs font-black text-white uppercase tracking-widest relative z-10">
                            Neural Analysis <Shield size={16} />
                        </span>
                    </Link>
                </div>
            </div>

            {/* ── Metric HUD ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <StatCard 
                    label="Active Dossiers" 
                    value={stats.total_accidents} 
                    icon={FileText} 
                    color="text-slate-200"
                    bg="from-slate-800/10"
                />
                <StatCard 
                    label="Fatalities" 
                    value={stats.severity?.find(s => s.severity === 'Fatal')?.count || 0} 
                    icon={AlertTriangle} 
                    color="text-red-500"
                    bg="from-red-500/10"
                    trend={`${stats.fatality_rate}% CRITICAL`}
                    trendColor="text-red-400"
                />
                <StatCard 
                    label="Grievous Incursions" 
                    value={stats.severity?.find(s => s.severity === 'Grievous')?.count || 0} 
                    icon={Activity} 
                    color="text-amber-500"
                    bg="from-amber-500/10"
                />
                <StatCard 
                    label="Total Entities" 
                    value={stats.total_victims} 
                    icon={Users} 
                    color="text-indigo-400"
                    bg="from-indigo-500/10"
                />
                <StatCard 
                    label="Neural Confidence" 
                    value={`${Math.round(stats.avg_confidence * 100)}%`} 
                    icon={Cpu} 
                    color="text-emerald-500"
                    bg="from-emerald-500/10"
                    trend="SYNCHRONIZED"
                    trendColor="text-emerald-400"
                />
            </div>

            {/* ── System Alerts ── */}
            {stats.peak_hour && (
                <div className="relative group overflow-hidden p-6 bg-slate-950 border border-amber-500/20 rounded-[2.5rem] animate-in fade-in slide-in-from-left-4 duration-700">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/10 to-transparent blur opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                                <Zap size={24} className="fill-current" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Critical Exposure Window Identified</p>
                                <p className="text-xl font-black text-white tracking-tighter">
                                    Strategic Peak Violation Period Detected at <span className="text-amber-400">{stats.peak_hour.hour}:00 HRS</span>
                                </p>
                            </div>
                        </div>
                        <div className="hidden sm:block text-right">
                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Incident Volatility</p>
                            <p className="text-2xl font-black text-white font-mono">{stats.peak_hour.count} UNITS</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Analysis Matrix ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── Left Column ── */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Time Trend Matrix */}
                    <DashboardCard title="Incident Velocity" sub="Chronological distribution map">
                        <div className="h-[400px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.time_analysis?.map(t => ({ hour: `${t.hour}:00`, val: t.count })).sort((a,b) => parseInt(a.hour) - parseInt(b.hour))}>
                                    <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.2} />
                                    <XAxis dataKey="hour" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '1.5rem', padding: '15px' }}
                                        labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                                        itemStyle={{ color: '#818cf8', fontWeight: 'black', fontSize: '14px' }}
                                    />
                                    <Area type="monotone" dataKey="val" stroke="#818cf8" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" animationDuration={2000} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    {/* Geomatrix */}
                    <div className="group relative bg-slate-950 border border-slate-900 p-10 rounded-[3rem] overflow-hidden shadow-2xl">
                        <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-700" />
                        <div className="flex items-center justify-between mb-8">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Geospatial Distribution</h3>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Incident Density Overlays</p>
                            </div>
                            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                                <MapIcon size={20} className="text-slate-300" />
                            </div>
                        </div>
                        <div className="rounded-[2rem] overflow-hidden border border-slate-900 shadow-inner">
                            <AccidentMap />
                        </div>
                    </div>
                </div>

                {/* ── Right Column ── */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Severity Radar */}
                    <DashboardCard title="Severity Matrix" sub="Category distribution breakdown">
                        <div className="h-[320px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.severity?.map(s => ({ name: s.severity, value: s.count }))}
                                        innerRadius={65}
                                        outerRadius={95}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {stats.severity?.map((_e, i) => (
                                            <Cell key={`cell-${i}`} fill={SEVERITY_COLORS[i % SEVERITY_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#020617' }} />
                                    <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-[-20px] pointer-events-none pb-12">
                                <p className="text-4xl font-black text-white tabular-nums leading-none tracking-tighter">{stats.total_accidents}</p>
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Total Units</p>
                            </div>
                        </div>
                    </DashboardCard>

                    {/* Root Cause Matrix */}
                    <DashboardCard title="Primary Crime Causes" sub="Core Incident Factor Mapping">
                        <div className="h-[350px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.top_causes?.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} strokeOpacity={0.1} />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="cause" 
                                        type="category" 
                                        stroke="#94a3b8" 
                                        fontSize={11} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        width={160} 
                                        tick={{ fontWeight: 'bold' }}
                                    />
                                    <RechartsTooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#020617' }} />
                                    <Bar dataKey="count" fill="#818cf8" radius={[0, 8, 8, 0]} barSize={24}>
                                        {stats.top_causes?.slice(0, 5).map((_e, i) => (
                                            <Cell key={`cell-${i}`} fillOpacity={0.8 - i * 0.1} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    {/* Timeline Log */}
                    <div className="group relative bg-slate-950 border border-slate-900 p-8 rounded-[3rem] overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                             <div className="space-y-1">
                                <h3 className="text-xl font-black text-white tracking-tighter uppercase">Central Registry</h3>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Latest Ingested Activity</p>
                            </div>
                            <div className="p-3 bg-slate-800/30 rounded-xl">
                                <Clock size={16} className="text-slate-500" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            {stats.recent_accidents?.slice(0, 6).map(acc => (
                                <Link 
                                    key={acc.id} 
                                    href={`/accidents/${acc.id}`}
                                    className="group/item flex items-center gap-4 p-4 bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition-all duration-300"
                                >
                                    <div className={`w-1.5 h-6 rounded-full flex-shrink-0 transition-all group-hover/item:scale-y-110 ${
                                        acc.severity === 'Fatal' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                                        acc.severity === 'Grievous' ? 'bg-amber-500' : 'bg-indigo-500'
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-white uppercase truncate tracking-tight group-hover/item:text-indigo-400">
                                            FIR_{acc.fir_number}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <MapPin size={10} className="text-slate-600" />
                                            <p className="text-[9px] font-bold text-slate-500 uppercase truncate">
                                                {acc.area || acc.city || 'Sector Unknown'}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-700 group-hover/item:text-white transition-colors translate-x-1" />
                                </Link>
                            ))}
                        </div>
                        <Link href="/accidents" className="flex items-center justify-center gap-2 w-full mt-6 py-4 bg-slate-900/50 hover:bg-slate-900 rounded-2xl border border-slate-800 text-[10px] font-black uppercase text-slate-500 hover:text-indigo-400 transition-all">
                            Access Full Registry <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, trend, color, trendColor, bg }: { 
    label: string; 
    value: string | number; 
    icon: LucideIcon; 
    trend?: string; 
    color?: string; 
    trendColor?: string;
    bg?: string;
}) {
    return (
        <div className={`relative group p-8 rounded-[2.5rem] bg-slate-950/40 border border-slate-900/50 backdrop-blur-xl transition-all duration-500 hover:scale-[1.02] hover:bg-slate-900/40 active:scale-95 shadow-2xl overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${bg} to-transparent opacity-10`} />
            <div className="relative flex flex-col gap-6">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl w-fit group-hover:scale-110 group-hover:border-slate-600 transition-all">
                    <Icon size={24} className={`${color || 'text-slate-400'}`} />
                </div>
                <div>
                    <h3 className={`text-4xl font-black tabular-nums tracking-tighter ${color || 'text-white'}`}>{value}</h3>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">{label}</p>
                </div>
                {trend && (
                    <div className="flex items-center gap-2 pt-4 border-t border-slate-900">
                        <div className={`w-1 h-1 rounded-full animate-pulse ${trendColor || "bg-indigo-400"}`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${trendColor || "text-indigo-400"}`}>{trend}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function DashboardCard({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`group relative bg-slate-950/40 border border-slate-900/50 p-8 rounded-[3rem] backdrop-blur-xl overflow-hidden shadow-2xl ${className}`}>
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 blur-[80px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
            <div className="relative">
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">{title}</h3>
                        {sub && <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sub}</p>}
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                        <Layers size={16} className="text-slate-600" />
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

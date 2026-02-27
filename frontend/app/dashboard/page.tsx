"use client";

import { useEffect, useState } from 'react';
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
    CheckCircle, 
    BarChart2, 
    PieChart as PieChartIcon, 
    Map as MapIcon, 
    TrendingUp,
    Clock,
    Users,
    ChevronRight,
    Zap,
    Target
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const AccidentMap = dynamic(() => import('@/components/AccidentMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[500px] bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
            <div className="flex items-center gap-3 text-slate-400">
                <div className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-blue-500 rounded-full" />
                Loading map...
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

    useEffect(() => {
        fetch(`${API_BASE_URL}/stats`)
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (!stats) {
        return loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        ) : null;
    }

    // Summary Calculations
    const totalAccidents = stats.total_accidents;
    const fatalAccidents = stats.severity?.find(s => s.severity === 'Fatal')?.count || 0;
    const grievousAccidents = stats.severity?.find(s => s.severity === 'Grievous')?.count || 0;
    const avgConfidence = stats.avg_confidence ? Math.round(stats.avg_confidence * 100) : 0;
    
    // Prepare Chart Data
    const severityData = stats.severity?.map(s => ({ 
        name: s.severity, 
        value: s.count 
    })) || [];
    
    const timeData = stats.time_analysis?.map(t => ({
        hour: `${t.hour}:00`,
        accidents: t.count
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour)) || [];

    const causeData = stats.top_causes?.slice(0, 6).map(c => ({
        name: c.cause.length > 20 ? c.cause.substring(0, 20) + '...' : c.cause,
        fullName: c.cause,
        count: c.count
    })) || [];

    const SEVERITY_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#94a3b8'];

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        Command Center
                    </h1>
                    <p className="text-slate-400 mt-1">Real-time accident monitoring & analysis</p>
                </div>
                <Link 
                    href="/insights" 
                    className="group px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all hover:scale-105"
                >
                    <Shield size={18} className="group-hover:rotate-12 transition-transform" /> 
                    <span>Strategic AI Analysis</span>
                </Link>
            </div>

            {/* Stats Grid — 5 Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard 
                    label="Total Accidents" 
                    value={totalAccidents} 
                    icon={<FileText className="text-slate-400" size={20} />} 
                />
                <StatCard 
                    label="Fatalities" 
                    value={fatalAccidents} 
                    icon={<AlertTriangle className="text-red-400" size={20} />} 
                    color="text-red-500"
                    trend={`${stats.fatality_rate}% fatal rate`}
                    trendColor="text-red-400"
                />
                <StatCard 
                    label="Grievous" 
                    value={grievousAccidents} 
                    icon={<Activity className="text-orange-400" size={20} />} 
                    color="text-orange-500"
                />
                <StatCard 
                    label="Total Victims" 
                    value={stats.total_victims} 
                    icon={<Users className="text-purple-400" size={20} />} 
                    color="text-purple-500"
                />
                <StatCard 
                    label="AI Confidence" 
                    value={`${avgConfidence}%`} 
                    icon={<CheckCircle className="text-emerald-400" size={20} />} 
                    color="text-emerald-500"
                    trend="High Accuracy"
                    trendColor="text-emerald-400"
                />
            </div>

            {/* Peak Hour Alert */}
            {stats.peak_hour && (
                <div className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <div className="p-2.5 bg-amber-500/10 rounded-lg">
                        <Zap className="text-amber-400" size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-300">Peak Danger Hour</p>
                        <p className="text-xs text-slate-400">
                            Most accidents occur at <span className="text-white font-bold">{stats.peak_hour.hour}:00</span> ({stats.peak_hour.count} incidents recorded)
                        </p>
                    </div>
                </div>
            )}

            {/* Charts Row 1: Time Trend + Severity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Time Trend (Area Chart) */}
                <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200">Accident Frequency</h2>
                            <p className="text-sm text-slate-500">Hourly distribution of incidents</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-lg">
                            <BarChart2 size={18} className="text-slate-400" />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeData}>
                                <defs>
                                    <linearGradient id="colorAccidents" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Area type="monotone" dataKey="accidents" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAccidents)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Severity Breakdown (Donut) */}
                <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
                     <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200">Severity Impact</h2>
                            <p className="text-sm text-slate-500">Distribution by category</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-lg">
                            <PieChartIcon size={18} className="text-slate-400" />
                        </div>
                    </div>
                    <div className="h-[300px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={severityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {severityData.map((_entry, index: number) => (
                                        <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                     contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                     itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                           <div className="text-center">
                                <p className="text-3xl font-bold text-white">{totalAccidents}</p>
                                <p className="text-xs text-slate-500">Total</p>
                           </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Top Causes + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Causes Bar Chart */}
                <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200">Root Cause Analysis</h2>
                            <p className="text-sm text-slate-500">Top accident causes by frequency</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-lg">
                            <Target size={18} className="text-slate-400" />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={causeData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={150} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200">Recent Activity</h2>
                            <p className="text-sm text-slate-500">Latest processed FIRs</p>
                        </div>
                        <div className="p-2 bg-slate-800 rounded-lg">
                            <Clock size={18} className="text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {stats.recent_accidents && stats.recent_accidents.length > 0 ? (
                            stats.recent_accidents.map(acc => (
                                <Link 
                                    key={acc.id} 
                                    href={`/accidents/${acc.id}`}
                                    className="group flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 hover:border-indigo-500/30 transition-all"
                                >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        acc.severity === 'Fatal' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' :
                                        acc.severity === 'Grievous' ? 'bg-amber-500' : 'bg-blue-500'
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-200 truncate">
                                            FIR {acc.fir_number}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {acc.area || acc.city || 'Unknown'} • {acc.incident_date ? new Date(acc.incident_date).toLocaleDateString() : '—'}
                                        </p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                                </Link>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-8">No records yet. Upload FIRs to get started.</p>
                        )}
                    </div>
                    {stats.recent_accidents && stats.recent_accidents.length > 0 && (
                        <Link href="/accidents" className="block text-center text-xs text-indigo-400 hover:text-indigo-300 mt-4 font-medium">
                            View All Accidents →
                        </Link>
                    )}
                </div>
            </div>

            {/* Map Section */}
            <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <MapIcon className="text-indigo-400" size={20} />
                    </div>
                    <div>
                         <h2 className="text-lg font-semibold text-slate-200">Live Incident Map</h2>
                         <p className="text-sm text-slate-500">Geospatial analysis of recent FIRs</p>
                    </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-800/50">
                    <AccidentMap />
                </div>
            </div>
        </div>
    );
}

// Stats Card Component
function StatCard({ label, value, icon, trend, color, trendColor }: { 
    label: string; 
    value: string | number; 
    icon: React.ReactNode; 
    trend?: string; 
    color?: string; 
    trendColor?: string; 
}) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
                    <h3 className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</h3>
                </div>
                <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    {icon}
                </div>
            </div>
            {trend && (
                <div className="flex items-center gap-1">
                    <TrendingUp size={12} className={trendColor || "text-emerald-400"} />
                    <span className={`text-[11px] font-medium ${trendColor || "text-emerald-400"}`}>{trend}</span>
                </div>
            )}
        </div>
    );
}

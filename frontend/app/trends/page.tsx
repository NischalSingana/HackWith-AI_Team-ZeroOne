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
    BarChart, 
    Bar, 
    Cell,
    Legend
} from 'recharts';
import { 
    TrendingUp, 
    Calendar, 
    BarChart2, 
    Layers, 
    ArrowUp, 
    ArrowDown, 
    Minus,
    RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

interface TrendsData {
    monthly: { name: string; count: number }[];
    day_of_week: { name: string; count: number }[];
    severity_monthly: { 
        label: string; 
        Fatal: number; 
        Grievous: number; 
        Simple: number; 
    }[];
}

interface TrendAnalysisResponse {
    executive_summary?: string;
    seasonal_analysis?: string;
    day_of_week_analysis?: string;
    operational_recommendations?: string[];
}

export default function TrendsPage() {
    // State Definitions
    const [data, setData] = useState<TrendsData | null>(null);
    const [loading, setLoading] = useState(true);
    
    // AI Analysis State
    const [analysis, setAnalysis] = useState<TrendAnalysisResponse | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const fetchTrends = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/trends`);
            const result = await res.json();
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateAnalysis = async (forceRefresh = false) => {
        setAnalyzing(true);
        try {
            const url = forceRefresh ? `${API_BASE_URL}/trends/analysis?refresh=true` : `${API_BASE_URL}/trends/analysis`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) {
                setAnalysis(result.analysis);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    // Keep data fetching up-to-date
    useEffect(() => {
        fetchTrends();
        generateAnalysis();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
                <RefreshCw className="animate-spin mb-4" size={40} />
            </div>
        );
    }

    if (!data) return null;

    // Compute month-over-month trend
    const monthlyData = data.monthly || [];
    const currentMonth = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1]?.count : 0;
    const previousMonth = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2]?.count : 0;
    const trend = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth * 100).toFixed(1) : '0';
    const trendDirection = currentMonth > previousMonth ? 'up' : currentMonth < previousMonth ? 'down' : 'flat';

    // Find most dangerous day
    const dayData = data.day_of_week || [];
    const peakDay = dayData.length > 0 
        ? dayData.reduce((max, d) => d.count > max.count ? d : max, dayData[0]) 
        : null;

    // Find safest day
    const safestDay = dayData.length > 0
        ? dayData.reduce((min, d) => d.count < min.count ? d : min, dayData[0])
        : null;

    // Professional Monochromatic Color Palette (Slate/Blue/Red)
    const DAY_COLORS = ['#334155', '#334155', '#334155', '#334155', '#334155', '#334155', '#334155'];
    
    // Highlight Peak Day
    if (dayData.length > 0) {
        const peakIndex = dayData.findIndex(d => d.name.trim() === peakDay?.name.trim());
        if (peakIndex !== -1) DAY_COLORS[peakIndex] = '#ef4444'; // Red for danger
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300 flex items-center gap-3">
                        <TrendingUp className="text-indigo-400" /> Trend Analysis
                    </h1>
                    <p className="text-slate-400 mt-1">Deep temporal accident pattern recognition</p>
                </div>
                <button 
                    onClick={() => generateAnalysis(true)}
                    disabled={analyzing}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all ${analyzing ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {analyzing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <BarChart2 size={18} />
                            Generate Deep Analysis
                        </>
                    )}
                </button>
            </div>

            {/* AI ANALYSIS REPORT (Conditionally Rendered) */}
            {analysis && (
                <div className="glass p-8 rounded-2xl border border-indigo-500/30 bg-indigo-900/10 animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-xl font-bold text-indigo-300 mb-6 flex items-center gap-3">
                        <Layers size={24} /> Strategic Temporal Report
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Summary & Seasonality */}
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Executive Summary</h3>
                                <p className="text-slate-300 leading-relaxed">{analysis.executive_summary}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Seasonal Impact</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">{analysis.seasonal_analysis}</p>
                            </div>
                        </div>

                        {/* Weekly Pattern & Ops Recs */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Day-of-Week Pattern</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">{analysis.day_of_week_analysis}</p>
                            </div>
                            <div className="bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-xl">
                                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">Operational Recommendations</h3>
                                <ul className="space-y-3">
                                    {analysis.operational_recommendations?.map((rec: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-sm text-emerald-200">
                                            <span className="text-emerald-500 font-bold">•</span>
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Month-over-Month Trend */}
                <div className="glass p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Monthly Trend</p>
                        {trendDirection === 'up' ? (
                            <ArrowUp size={16} className="text-red-400" />
                        ) : trendDirection === 'down' ? (
                            <ArrowDown size={16} className="text-emerald-400" />
                        ) : (
                            <Minus size={16} className="text-slate-400" />
                        )}
                    </div>
                    <p className={`text-2xl font-bold ${
                        trendDirection === 'up' ? 'text-red-400' : 
                        trendDirection === 'down' ? 'text-emerald-400' : 'text-white'
                    }`}>
                        {parseFloat(trend) > 0 ? '+' : ''}{trend}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">vs previous month</p>
                </div>

                {/* Peak Day */}
                <div className="glass p-5 rounded-2xl">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Most Dangerous Day</p>
                    <p className="text-2xl font-bold text-red-400">{peakDay?.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">{peakDay?.count || 0} accidents recorded</p>
                </div>

                {/* Safest Day */}
                <div className="glass p-5 rounded-2xl">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Safest Day</p>
                    <p className="text-2xl font-bold text-emerald-400">{safestDay?.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">{safestDay?.count || 0} accidents recorded</p>
                </div>
            </div>

            {/* Monthly Trend Area Chart */}
            <div className="glass p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <Calendar size={18} className="text-indigo-400" />
                            Monthly Accident Trend
                        </h2>
                        <p className="text-sm text-slate-500">Incidents per month over time</p>
                    </div>
                </div>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData}>
                            <defs>
                                <linearGradient id="monthGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                stroke="#6366f1" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#monthGradient)" 
                                name="Accidents"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Row: Day of Week + Severity Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Day of Week */}
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                                <BarChart2 size={18} className="text-slate-400" />
                                Day of Week
                            </h2>
                            <p className="text-sm text-slate-500">Weekly accident distribution</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dayData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="count" name="Accidents" barSize={36} radius={[6, 6, 0, 0]}>
                                    {dayData.map((_entry, index) => (
                                        <Cell 
                                            key={`bar-${index}`}
                                            fill={DAY_COLORS[index]}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Severity Monthly Stacked */}
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                                <Layers size={18} className="text-amber-400" />
                                Severity Over Time
                            </h2>
                            <p className="text-sm text-slate-500">Monthly severity breakdown</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.severity_monthly || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Legend iconType="circle" />
                                <Bar dataKey="Fatal" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Grievous" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="Simple" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

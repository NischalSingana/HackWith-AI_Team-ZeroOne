"use client";

import { useEffect, useState } from 'react';
import { RefreshCw, Shield, AlertTriangle, Lightbulb, UserCheck, TrendingUp, X } from 'lucide-react';
import { API_BASE_URL } from "@/lib/api";

interface AnalysisData {
    total_accidents: number;
    most_common_cause: string;
    high_risk_age_group: string;
    peak_time: string;
    hotspot_location: string;
    fatality_percentage: number;
    summary: string;
    key_insights: string[];
    policy_recommendations: string[];
    public_awareness_suggestions: string[];
    // Deep Dive Data
    age_distribution: { age_group: string; count: number }[];
    time_distribution: { time_slot: string; count: number }[];
    cause_distribution: { cause: string; count: number }[];
    vehicle_distribution: { vehicle_type: string; count: number }[];
}

export default function InsightsPage() {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchInsights = async (forceRefresh = false) => {
        setRefreshing(true);
        if (!data) setLoading(true);
        try {
            const url = forceRefresh ? `${API_BASE_URL}/insights?refresh=true` : `${API_BASE_URL}/insights`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) {
                setData({
                    ...result.input_stats,
                    summary: result.summary,
                    key_insights: result.key_insights,
                    policy_recommendations: result.policy_recommendations,
                    public_awareness_suggestions: result.public_awareness_suggestions
                });
            } else {
                setError(result.error || 'Failed to generate insights');
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="animate-spin mb-4 text-blue-500" size={40} />
                <p>Analyzing accident patterns with Llama-3 AI...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-red-500 text-xl font-bold">Analysis Failed</p>
                    <p className="text-slate-400">{error}</p>
                    <button 
                        onClick={() => fetchInsights()}
                        className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-white"
                    >
                        Retry Analysis
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
                            <Shield className="text-blue-500" /> Strategic Safety Intelligence
                        </h1>
                        <p className="text-slate-400 mt-2">
                            AI-powered analysis of {data?.total_accidents} accidents to identify root causes and solutions.
                        </p>
                    </div>
                    <button 
                        onClick={() => fetchInsights(true)} 
                        disabled={refreshing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors shadow-lg ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Analyzing...' : 'Refresh Analysis'}
                    </button>
                </div>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard label="Total Accidents" value={data?.total_accidents} sub="analyzed" color="blue" />
                    <StatCard label="High Risk Location" value={data?.hotspot_location} sub="priority area" color="red" />
                    <StatCard label="Primary Cause" value={data?.most_common_cause} sub="leading factor" color="orange" />
                    <StatCard label="Fatality Rate" value={`${data?.fatality_percentage}%`} sub="severity index" color="purple" />
                </div>

                {/* Deep Dive Analytics Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data?.age_distribution && (
                        <SimpleBarChart 
                            title="Demographics (Age Impact)" 
                            data={data.age_distribution} 
                            labelKey="age_group" 
                            color="cyan"
                        />
                    )}
                    {data?.time_distribution && (
                        <SimpleBarChart 
                            title="Temporal Analysis (Time)" 
                            data={data.time_distribution} 
                            labelKey="time_slot" 
                            color="purple"
                        />
                    )}
                    {data?.cause_distribution && (
                        <SimpleBarChart 
                            title="Root Cause Analysis" 
                            data={data.cause_distribution} 
                            labelKey="cause" 
                            color="rose"
                        />
                    )}
                </div>

                {/* AI Analysis Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Executive Summary & Insights */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Summary */}
                        <div className="glass p-8 rounded-2xl">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-blue-400">
                                <TrendingUp size={24} /> Executive Summary
                            </h2>
                            <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-lg">
                                {data?.summary}
                            </div>
                        </div>

                        {/* Key Insights */}
                        <div className="glass p-8 rounded-2xl">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-amber-400">
                                <AlertTriangle size={24} /> Risk Patterns & Trends
                            </h2>
                            <ul className="space-y-4">
                                {data?.key_insights.map((insight, i) => (
                                    <li key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                                        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                                            {i + 1}
                                        </span>
                                        <span className="text-slate-300 mt-1">{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Action Plan Column */}
                    <div className="space-y-8">
                        
                        {/* Policy Recs */}
                        <div className="glass-card p-6 rounded-2xl border border-indigo-500/30">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-indigo-300">
                                <Shield size={24} /> Policy Recommendations
                            </h2>
                            <ul className="space-y-3">
                                {data?.policy_recommendations.map((rec, i) => (
                                    <li key={i} className="p-4 rounded-xl bg-indigo-900/20 border border-indigo-500/20 text-indigo-100 text-sm font-medium">
                                        {rec}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Public Awareness */}
                        <div className="glass p-6 rounded-2xl">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-emerald-400">
                                <UserCheck size={24} /> Public Awareness
                            </h2>
                            <div className="space-y-4">
                                {data?.public_awareness_suggestions.map((tip, i) => (
                                    <div key={i} className="flex gap-4 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                                        <Lightbulb size={20} className="text-emerald-500 flex-shrink-0 mt-1" />
                                        <span className="text-slate-300 text-sm leading-relaxed">{tip}</span>
                                    </div>
                                ))}
                            </div>
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
        <div className={`p-6 rounded-2xl border ${colors[color]} glass-card transition-transform hover:-translate-y-1`}>
            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">{label}</p>
            <p className={`text-3xl font-bold ${colors[color].split(' ')[0]}`}>{value ?? 'N/A'}</p>
            <p className="text-slate-500 text-xs mt-2 font-medium">{sub}</p>
        </div>
    );
}

// Simple CSS Bar Chart Component
function SimpleBarChart({ title, data, labelKey, color }: { title: string, data: { [key: string]: string | number; count: number }[], labelKey: string, color: 'cyan' | 'rose' | 'purple' }) {
    const [showModal, setShowModal] = useState(false);
    
    if (!data || data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count));
    const LIMIT = 8;
    const displayedData = data.slice(0, LIMIT);
    const hiddenCount = data.length - LIMIT;

    const colors = {
        cyan: 'bg-cyan-500',
        rose: 'bg-rose-500',
        purple: 'bg-purple-500'
    };

    return (
        <>
            <div className="glass p-6 rounded-2xl flex flex-col h-full transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">{data.length} items</span>
                </div>
                
                <div className="space-y-3 flex-1 overflow-hidden">
                    {displayedData.map((item, index) => {
                        const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                        return (
                            <div key={index} className="flex items-center gap-3 text-xs group">
                                <div className="w-28 text-slate-400 truncate text-right font-medium group-hover:text-slate-200 transition-colors" title={String(item[labelKey])}>
                                    {item[labelKey]}
                                </div>
                                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ${colors[color]}`} 
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <div className="w-8 text-white font-bold tabular-nums text-right">{item.count}</div>
                            </div>
                        );
                    })}
                </div>

                {data.length > LIMIT && (
                    <button 
                        onClick={() => setShowModal(true)}
                        className="mt-4 w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-700"
                    >
                        View All (+{hiddenCount} more)
                    </button>
                )}
            </div>

            {/* MODAL OVERLAY */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold text-white">{title}</h3>
                                <p className="text-sm text-slate-400 mt-1">Full detailed breakdown of all {data.length} categories</p>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {data.map((item, index) => {
                                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                                return (
                                    <div key={index} className="flex items-center gap-4 group hover:bg-slate-800/30 p-2 rounded-lg transition-colors">
                                        {/* Full Text Label */}
                                        <div className="w-1/3 text-sm text-slate-300 font-medium leading-tight">
                                            {item[labelKey]}
                                        </div>
                                        
                                        {/* Bar */}
                                        <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${colors[color]}`} 
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        
                                        {/* Count */}
                                        <div className="w-12 text-white font-bold text-lg tabular-nums text-right">
                                            {item.count}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

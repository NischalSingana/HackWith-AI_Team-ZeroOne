"use client";

import { useCallback, useEffect, useState, useRef } from 'react';
import { 
    RefreshCw, 
    Shield, 
    AlertTriangle, 
    Lightbulb, 
    UserCheck, 
    TrendingUp, 
    X,
    Cpu,
    Zap,
    Fingerprint,
    BrainCircuit,
    Activity,
    Lock,
    ExternalLink,
    Target
} from 'lucide-react';
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

interface MetaInfo {
    provider: string;
    model: string;
    latency_ms: number;
    generated_at: string;
}

export default function InsightsPage() {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingStage, setLoadingStage] = useState(0);
    const [meta, setMeta] = useState<MetaInfo | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const successTimeout = useRef<NodeJS.Timeout | null>(null);

    const STAGES = [
        "Syncing Accident Matrix...",
        "Querying Llama-3 Node...",
        "Synthesizing Strategic Patterns...",
        "Validating Policy Vectors...",
        "Optimizing Response Matrix..."
    ];

    useEffect(() => {
        if (loading || refreshing) {
            const interval = setInterval(() => {
                setLoadingStage(s => (s + 1) % STAGES.length);
            }, 3500);
            return () => clearInterval(interval);
        }
    }, [loading, refreshing, STAGES.length]);

    const fetchInsights = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) {
            setLoading(true);
        }
        setRefreshing(true);
        setLoadingStage(0);
        setError(null);
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
                if (result.meta) setMeta(result.meta);
                // Show success toast on regeneration
                if (forceRefresh) {
                    setShowSuccess(true);
                    if (successTimeout.current) clearTimeout(successTimeout.current);
                    successTimeout.current = setTimeout(() => setShowSuccess(false), 4000);
                }
            } else {
                setError(result.error || 'Failed to generate insights');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []); // No dependencies — stable reference, no infinite loop

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    if (loading && !data) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <div className="relative p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
                        <Cpu className="animate-spin text-indigo-500 mb-4 mx-auto" size={48} />
                        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 animate-[loading_2s_infinite]" />
                        </div>
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-white font-black uppercase tracking-[0.3em] text-sm mb-2">{STAGES[loadingStage]}</p>
                    <p className="text-slate-500 font-mono text-xs">Parsing FIR Relationship Matrix with Llama-3 AI...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-8">
                <div className="glass p-12 rounded-[2.5rem] border border-red-500/20 text-center space-y-6 max-w-md">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                        <AlertTriangle className="text-red-500" size={40} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Analysis Failure</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
                    </div>
                    <button 
                        onClick={() => fetchInsights()}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                    >
                        Retry Neural Diagnostic
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20 relative">
            {/* Regeneration Overlay */}
            {refreshing && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                        <div className="relative p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
                            <Cpu className="animate-spin text-indigo-500 mb-4 mx-auto" size={48} />
                            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-[loading_2s_infinite]" />
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-6">
                        <p className="text-white font-black uppercase tracking-[0.3em] text-sm mb-2">{STAGES[loadingStage]}</p>
                        <p className="text-slate-500 font-mono text-xs">Regenerating with Llama-3 AI — Fresh Analysis...</p>
                    </div>
                </div>
            )}

            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed top-6 right-6 z-50 animate-[slideIn_0.3s_ease-out] flex items-center gap-3 px-6 py-4 bg-emerald-600/90 backdrop-blur-md border border-emerald-400/30 rounded-2xl shadow-2xl shadow-emerald-500/20">
                    <Zap size={20} className="text-emerald-200" />
                    <div>
                        <p className="text-white font-bold text-sm">Analysis Regenerated</p>
                        <p className="text-emerald-200 text-xs">
                            via {meta?.model || 'AI'} • {meta?.latency_ms ? `${(meta.latency_ms / 1000).toFixed(1)}s` : ''}
                        </p>
                    </div>
                    <button onClick={() => setShowSuccess(false)} className="ml-2 text-emerald-300 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
            )}
            {/* Tactical Header */}
            <div className="relative group p-8 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BrainCircuit size={140} className="text-indigo-500" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
                            <Lock size={14} className="text-indigo-400" />
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Clearance Level: Alpha</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                            Strategic <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Intelligence</span>
                        </h1>
                        <p className="text-slate-400 text-sm max-w-2xl font-medium leading-relaxed">
                            AI-driven synthesis of {data?.total_accidents} processed incidents. Our neural engine identifies non-obvious patterns to power precision policy decisions.
                        </p>
                        {meta?.generated_at && (
                            <p className="text-slate-600 text-[11px] font-mono">Last generated: {new Date(meta.generated_at).toLocaleString()}</p>
                        )}
                    </div>

                    <button 
                        onClick={() => fetchInsights(true)} 
                        disabled={refreshing}
                        className={`group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs transition-all hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] disabled:opacity-50 ${refreshing ? 'cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                        {refreshing ? STAGES[loadingStage] : 'Regenerate Analysis'}
                    </button>
                </div>
            </div>

            {/* Neural KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Incidents" value={data?.total_accidents} sub="Verified Records" icon={Fingerprint} color="blue" />
                <StatCard label="Core Hotspot" value={data?.hotspot_location} sub="Neural Mapping Hit" icon={Target} color="red" />
                <StatCard label="Primary Cause" value={data?.most_common_cause} sub="Kinetic Trigger" icon={Activity} color="orange" />
                <StatCard label="Fatality Rate" value={`${data?.fatality_percentage}%`} sub="Fatal Outcome Rate" icon={Zap} color="purple" />
            </div>

            {/* Matrix Data Deep Dive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {data?.age_distribution && (
                    <SimpleBarChart title="Age Group Distribution" data={data.age_distribution} labelKey="age_group" color="cyan" />
                )}
                {data?.time_distribution && (
                    <SimpleBarChart title="Timing Analysis" data={data.time_distribution} labelKey="time_slot" color="purple" />
                )}
                {data?.cause_distribution && (
                    <SimpleBarChart title="Root Cause Breakdown" data={data.cause_distribution} labelKey="cause" color="rose" />
                )}
            </div>

            {/* Intelligence Briefing */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Executive Summary */}
                    <div className="glass p-10 rounded-[2.5rem] border border-slate-800 relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full" />
                        <h2 className="text-lg font-black mb-8 flex items-center gap-3 text-white uppercase tracking-widest">
                            <TrendingUp size={24} className="text-indigo-400" /> Executive Intelligence Summary
                        </h2>
                        <div className="prose prose-invert max-w-none">
                            <p className="text-slate-300 leading-relaxed text-lg font-medium selection:bg-indigo-500/30">
                                {data?.summary}
                            </p>
                        </div>
                        <div className="mt-8 pt-8 border-t border-slate-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                <Shield size={12} className="text-indigo-500" /> 
                                AI Authenticated Narrative
                            </div>
                            <span className="text-[10px] font-mono text-slate-600">Ref: IQ-2024-X9</span>
                        </div>
                    </div>

                    {/* Risk Patterns */}
                    <div className="glass p-10 rounded-[2.5rem] border border-slate-800">
                        <h2 className="text-lg font-black mb-8 flex items-center gap-3 text-white uppercase tracking-widest">
                            <AlertTriangle size={24} className="text-amber-400" /> Core Vulnerability Patterns
                        </h2>
                        <div className="grid grid-cols-1 gap-4">
                            {data?.key_insights.map((insight, i) => (
                                <div key={i} className="group flex items-start gap-6 p-6 rounded-3xl bg-slate-950/50 border border-slate-800/50 hover:border-amber-500/30 transition-all duration-300">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-lg border border-amber-500/20 shadow-lg shadow-amber-500/5 group-hover:scale-110 transition-transform">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-slate-200 font-bold leading-relaxed">{insight}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Policy Recs */}
                    <div className="relative group overflow-hidden">
                        <div className="absolute -inset-0.5 bg-gradient-to-b from-indigo-500/20 to-purple-600/20 rounded-[2.5rem] blur opacity-50 transition duration-1000 group-hover:opacity-100" />
                        <div className="relative glass p-8 rounded-[2.5rem] border border-indigo-500/20 bg-slate-950/80">
                            <h2 className="text-sm font-black mb-8 flex items-center gap-3 text-white uppercase tracking-widest">
                                <Shield size={20} className="text-indigo-400" /> Counter-Measures
                            </h2>
                            <div className="space-y-4">
                                {data?.policy_recommendations.map((rec, i) => (
                                    <div key={i} className="relative p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all group/item">
                                        <div className="absolute top-4 left-0 w-1 h-2 bg-indigo-500 rounded-r-full" />
                                        <p className="text-indigo-100 text-xs font-bold leading-relaxed">{rec}</p>
                                    </div>
                                ))}
                            </div>
                            <button className="w-full mt-6 py-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2">
                                <ExternalLink size={12} /> Export JSON Log
                            </button>
                        </div>
                    </div>

                    {/* Awareness */}
                    <div className="glass p-8 rounded-[2.5rem] border border-slate-800">
                        <h2 className="text-sm font-black mb-8 flex items-center gap-3 text-white uppercase tracking-widest">
                            <UserCheck size={20} className="text-emerald-400" /> Behavioral Nudges
                        </h2>
                        <div className="space-y-6">
                            {data?.public_awareness_suggestions.map((tip, i) => (
                                <div key={i} className="flex gap-4 group/tip">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover/tip:rotate-12 transition-transform">
                                        <Lightbulb size={20} />
                                    </div>
                                    <p className="text-slate-400 text-xs font-medium leading-relaxed group-hover/tip:text-slate-200 transition-colors">{tip}</p>
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
    icon: React.ElementType;
    color: 'blue' | 'red' | 'orange' | 'purple';
}

function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
    const colors = {
        blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40',
        red: 'text-red-400 border-red-500/20 bg-red-500/5 hover:border-red-500/40',
        orange: 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40',
        purple: 'text-purple-400 border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40',
    };
    
    return (
        <div className={`group p-6 rounded-3xl border transition-all duration-300 ${colors[color]} backdrop-blur-md`}>
            <div className="flex justify-between items-start mb-4">
                <p className="text-slate-500 text-xs uppercase font-black tracking-widest leading-none">{label}</p>
                <Icon size={16} className="opacity-50 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-black text-white tracking-tighter mb-1 truncate">{value ?? '---'}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{sub}</p>
        </div>
    );
}

function SimpleBarChart({ title, data, labelKey, color }: { title: string, data: { [key: string]: string | number; count: number }[], labelKey: string, color: 'cyan' | 'rose' | 'purple' }) {
    const [showModal, setShowModal] = useState(false);
    if (!data || data.length === 0) return null;

    const maxCount = Math.max(...data.map(d => d.count));
    const LIMIT = 6;
    const displayedData = data.slice(0, LIMIT);

    const barColors = {
        cyan: 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
        rose: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
        purple: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
    };

    return (
        <div className="glass p-8 rounded-[2rem] border border-slate-800 flex flex-col h-full group">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">{title}</h3>
                <div className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-slate-500">
                    n={data.length}
                </div>
            </div>
            
            <div className="space-y-4 flex-1">
                {displayedData.map((item, index) => {
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                        <div key={index} className="space-y-1.5 group/item">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                                <span className="text-slate-400 group-hover/item:text-white transition-colors truncate pr-4">{item[labelKey]}</span>
                                <span className="text-white tabular-nums">{item.count}</span>
                            </div>
                            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/30">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${barColors[color]}`} 
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {data.length > LIMIT && (
                <button 
                    onClick={() => setShowModal(true)}
                    className="mt-6 w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
                >
                    Expand Visualizer (+{data.length - LIMIT})
                </button>
            )}

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-950 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between p-8 border-b border-slate-900">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{title}</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase mt-1">Symmetry Analysis - Complete Cluster</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 bg-slate-900 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-8 space-y-6 custom-scrollbar">
                            {data.map((item, index) => {
                                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                                return (
                                    <div key={index} className="space-y-2 group/modal-item">
                                        <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                                            <span className="text-slate-400 group-hover/modal-item:text-white transition-colors">{item[labelKey]}</span>
                                            <span className="text-white">{item.count}</span>
                                        </div>
                                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                            <div className={`h-full rounded-full ${barColors[color]}`} style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

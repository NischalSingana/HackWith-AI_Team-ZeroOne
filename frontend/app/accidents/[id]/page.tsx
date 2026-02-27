"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { 
    ArrowLeft, 
    Clock, 
    MapPin, 
    AlertTriangle, 
    FileText, 
    User, 
    Car, 
    Shield, 
    CheckCircle 
} from 'lucide-react';
import { API_BASE_URL } from "@/lib/api";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { 
    ssr: false,
    loading: () => <div className="h-48 w-full bg-slate-800 animate-pulse rounded-xl" />
});

interface AccidentDetail {
    id: number;
    fir_number: string;
    police_station?: string | null;
    incident_date: string;
    reported_date: string;
    cause: string;
    severity: string;
    pdf_url: string;
    status: string;
    confidence_score: number;
    raw_text: string | null;
    location: {
        address: string;
        area: string;
        city: string;
        landmark: string;
        latitude: string;
        longitude: string;
    } | null;
    victims: {
        id: number;
        victim_name: string;
        age: number;
        gender: string;
        injury_severity: string;
        is_fatality: boolean;
    }[];
    vehicles: {
        id: number;
        vehicle_type: string;
        vehicle_number: string;
        driver_name: string;
    }[];
    ai_analysis?: {
        accident_reconstruction?: string;
        contributing_factors?: string[];
        road_conditions?: string;
        visibility?: string;
        weather_conditions?: string;
        helmet_seatbelt?: string;
        alcohol_drugs?: string;
        speed_analysis?: string;
        legal_analysis?: string | {
            applicable_sections?: string;
            charges_explanation?: string;
            penalty_range?: string;
        };
        recommendations?: {
            engineering?: string;
            enforcement?: string;
            education?: string;
        };
        emergency_response?: string;
        blackspot_prediction?: string;
        risk_score?: number;
        similar_case_pattern?: string;
        // Legacy fields
        preventative_measure?: string;
        severity_justification?: string;
    };
}

export default function AccidentDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [accident, setAccident] = useState<AccidentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        fetch(`${API_BASE_URL}/accidents/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Accident not found");
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    setAccident(data.data);
                } else {
                    setError("Failed to load accident data");
                }
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <AlertTriangle size={48} className="text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error Loading Data</h2>
            <p className="text-slate-400">{error}</p>
        </div>
    );
    
    if (!accident) return null;

    const severityConfigs: Record<string, string> = {
        'Fatal': 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
        'Grievous': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        'Simple': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        'Non-Injury': 'bg-green-500/10 text-green-400 border-green-500/30',
        'Non-Fatal': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        'Unknown': 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    };

    const analysis = accident.ai_analysis;
    const legalAnalysis = analysis?.legal_analysis;
    const isStructuredLegal = legalAnalysis && typeof legalAnalysis === 'object';

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-6">
                <button 
                    onClick={() => router.back()} 
                    className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors w-fit border border-slate-700"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4 mb-2">
                        <h1 className="text-3xl md:text-4xl font-bold text-white">FIR #{accident.fir_number}</h1>
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-2 ${severityConfigs[accident.severity] || severityConfigs['Unknown']}`}>
                           {accident.severity === 'Fatal' && <AlertTriangle size={16} />}
                           {accident.severity} Incident
                        </span>
                        {analysis?.risk_score && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                analysis.risk_score >= 7 ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                analysis.risk_score >= 4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-green-500/10 text-green-400 border-green-500/30'
                            }`}>
                                Risk Score: {analysis.risk_score}/10
                            </span>
                        )}
                        {analysis?.blackspot_prediction && (
                            <span className="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-full text-xs font-semibold">
                                Blackspot: {analysis.blackspot_prediction.split(' ')[0]}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 text-sm">
                        <span className="flex items-center gap-1.5">
                            <Clock size={16} /> 
                            {accident.incident_date ? new Date(accident.incident_date).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }) : 'Unknown Date'}
                        </span>
                        <span className="px-2">•</span>
                        <span>Logged: {new Date(accident.reported_date).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Key Details */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Incident Details Card */}
                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white border-b border-slate-700/50 pb-4">
                            <FileText className="text-indigo-400" size={24} /> Incident Overview
                        </h2>
                        
                        <div className="space-y-6">
                            {/* Accident Reconstruction - Prominent */}
                            {analysis?.accident_reconstruction && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">What Happened</h3>
                                    <p className="text-base text-slate-200 leading-relaxed bg-indigo-500/5 border-l-4 border-indigo-500 p-4 rounded-r-xl">
                                        {analysis.accident_reconstruction}
                                    </p>
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Primary Cause</h3>
                                <p className="text-lg text-slate-200 font-medium leading-relaxed bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    {accident.cause}
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Location Details</h3>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    <p className="text-slate-300 text-sm mb-3">
                                        <span className="font-semibold text-slate-400">Police Station :- </span>
                                        {accident.police_station || 'Not available'}
                                    </p>
                                    <p className="text-slate-200 font-medium flex items-center gap-2 mb-4">
                                        <MapPin size={18} className="text-rose-400" />
                                        {accident.location ? 
                                            `${accident.location.address}, ${accident.location.area}, ${accident.location.city}` 
                                            : 'Location details unavailable'
                                        }
                                    </p>
                                    
                                    {accident.location && accident.location.latitude && (
                                        <div className="rounded-lg overflow-hidden border border-slate-700 shadow-lg">
                                            <MiniMap 
                                                lat={parseFloat(accident.location.latitude)} 
                                                lng={parseFloat(accident.location.longitude)} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Victims & Vehicles Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Victims Card */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-300">
                                <User size={20} /> Victims ({accident.victims.length})
                            </h2>
                            {accident.victims.length > 0 ? (
                                <div className="space-y-3">
                                    {accident.victims.map((victim) => (
                                        <div key={victim.id} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-1">
                                            <div className="flex justify-between items-start">
                                                <span className="font-semibold text-slate-200">{victim.victim_name || 'Name Redacted'}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${victim.is_fatality ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {victim.injury_severity}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400 flex gap-2">
                                                <span>{victim.age} Years</span>
                                                <span>•</span>
                                                <span>{victim.gender}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm italic">No victim record derived.</p>
                            )}
                        </div>

                        {/* Vehicles Card */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-300">
                                <Car size={20} /> Vehicles ({accident.vehicles.length})
                            </h2>
                            {accident.vehicles.length > 0 ? (
                                <div className="space-y-3">
                                    {accident.vehicles.map((vehicle) => (
                                        <div key={vehicle.id} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-1">
                                            <div className="flex justify-between items-start">
                                                <span className="font-semibold text-slate-200">{vehicle.vehicle_type}</span>
                                                <span className="text-xs font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                                                    {vehicle.vehicle_number}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">Driver: {vehicle.driver_name || 'Unknown'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm italic">No vehicle record derived.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Quick Stats & Source */}
                <div className="space-y-8">
                    
                     {/* AI Confidence */}
                     <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
                        
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Confidence Score</h2>
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-4xl font-extrabold text-white">{Math.round(accident.confidence_score * 100)}%</span>
                            <span className="text-sm text-emerald-400 flex items-center gap-1 font-medium">
                                <CheckCircle size={14} /> High Accuracy
                            </span>
                        </div>
                        <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${accident.confidence_score > 0.8 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-yellow-500'}`} 
                                style={{ width: `${accident.confidence_score * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Situation Assessment - Quick Badges */}
                    {analysis && (
                        <div className="glass p-6 rounded-2xl">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Situation Assessment</h2>
                            <div className="space-y-3">
                                {analysis.road_conditions && (
                                    <InfoRow icon="🛣️" label="Road" value={analysis.road_conditions} />
                                )}
                                {analysis.visibility && (
                                    <InfoRow icon="👁️" label="Visibility" value={analysis.visibility} />
                                )}
                                {analysis.weather_conditions && (
                                    <InfoRow icon="🌤️" label="Weather" value={analysis.weather_conditions} />
                                )}
                                {analysis.speed_analysis && (
                                    <InfoRow icon="⚡" label="Speed" value={analysis.speed_analysis} />
                                )}
                                {analysis.helmet_seatbelt && (
                                    <InfoRow icon="🪖" label="Safety Gear" value={analysis.helmet_seatbelt} />
                                )}
                                {analysis.alcohol_drugs && (
                                    <InfoRow icon="🍺" label="Intoxication" value={analysis.alcohol_drugs} />
                                )}
                                {analysis.emergency_response && (
                                    <InfoRow icon="🚑" label="Response" value={analysis.emergency_response} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* PDF Download */}
                    <div className="glass p-6 rounded-2xl">
                        <h2 className="text-lg font-bold mb-4 text-white">Source Document</h2>
                        {accident.pdf_url ? (
                            <a 
                                href={`${API_BASE_URL}/accidents/${accident.id}/pdf`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="group flex items-center justify-center gap-3 w-full py-4 bg-slate-800 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all duration-300"
                            >
                                <div className="p-2 bg-slate-900 rounded-lg group-hover:scale-110 transition-transform">
                                    <FileText className="text-blue-400" size={20} /> 
                                </div>
                                <span className="font-semibold text-slate-300 group-hover:text-white">View Original FIR</span>
                            </a>
                        ) : (
                            <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-center">
                                <p className="text-slate-500 text-sm">No PDF attached to this record.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============ FULL-WIDTH STRATEGIC ANALYSIS REPORT ============ */}
            {analysis && (
                <div className="bg-gradient-to-b from-slate-900 to-indigo-950/30 border border-slate-700 p-8 rounded-2xl shadow-xl">
                    <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-indigo-300 tracking-wide uppercase border-b border-slate-700/50 pb-4">
                        <Shield className="fill-indigo-500/20" size={24} /> Strategic Analysis Report
                    </h2>

                    <div className="space-y-8">

                        {/* Contributing Factors */}
                        {analysis.contributing_factors && analysis.contributing_factors.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Contributing Factors</h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.contributing_factors.map((factor: string, i: number) => (
                                        <span key={i} className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-300 font-medium">
                                            {factor}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Legal Analysis */}
                        {legalAnalysis && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Legal Assessment</h3>
                                {isStructuredLegal ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                                            <span className="block text-xs font-bold text-amber-400 mb-2">APPLICABLE SECTIONS</span>
                                            <p className="text-sm text-amber-100 font-mono leading-relaxed">
                                                {(legalAnalysis as { applicable_sections?: string }).applicable_sections}
                                            </p>
                                        </div>
                                        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                                            <span className="block text-xs font-bold text-amber-400 mb-2">WHY APPLICABLE</span>
                                            <p className="text-sm text-amber-100 leading-relaxed">
                                                {(legalAnalysis as { charges_explanation?: string }).charges_explanation}
                                            </p>
                                        </div>
                                        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                                            <span className="block text-xs font-bold text-amber-400 mb-2">PENALTY RANGE</span>
                                            <p className="text-sm text-amber-100 leading-relaxed">
                                                {(legalAnalysis as { penalty_range?: string }).penalty_range}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                                        <p className="text-sm text-amber-100 font-mono">{String(legalAnalysis)}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3E Recommendations */}
                        {analysis.recommendations && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Strategic Recommendations (3Es)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {analysis.recommendations.engineering && (
                                        <div className="bg-blue-500/5 p-5 rounded-xl border border-blue-500/20">
                                            <span className="block text-xs font-bold text-blue-400 mb-3 flex items-center gap-2">
                                                🔧 ENGINEERING
                                            </span>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{analysis.recommendations.engineering}</p>
                                        </div>
                                    )}
                                    {analysis.recommendations.enforcement && (
                                        <div className="bg-rose-500/5 p-5 rounded-xl border border-rose-500/20">
                                            <span className="block text-xs font-bold text-rose-400 mb-3 flex items-center gap-2">
                                                🚔 ENFORCEMENT
                                            </span>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{analysis.recommendations.enforcement}</p>
                                        </div>
                                    )}
                                    {analysis.recommendations.education && (
                                        <div className="bg-emerald-500/5 p-5 rounded-xl border border-emerald-500/20">
                                            <span className="block text-xs font-bold text-emerald-400 mb-3 flex items-center gap-2">
                                                📚 EDUCATION
                                            </span>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{analysis.recommendations.education}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Bottom Row: Blackspot + Case Pattern + Risk */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
                            
                            {/* Risk Score Gauge */}
                            {analysis.risk_score !== undefined && (
                                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 text-center">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Risk Score</h4>
                                    <div className="text-5xl font-extrabold mb-2" style={{ 
                                        color: analysis.risk_score >= 7 ? '#ef4444' : analysis.risk_score >= 4 ? '#f59e0b' : '#22c55e' 
                                    }}>
                                        {analysis.risk_score}<span className="text-xl text-slate-500">/10</span>
                                    </div>
                                    <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{ 
                                                width: `${analysis.risk_score * 10}%`,
                                                backgroundColor: analysis.risk_score >= 7 ? '#ef4444' : analysis.risk_score >= 4 ? '#f59e0b' : '#22c55e'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Blackspot Prediction */}
                            {analysis.blackspot_prediction && (
                                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Blackspot Prediction</h4>
                                    <p className="text-sm text-purple-300 leading-relaxed">{analysis.blackspot_prediction}</p>
                                </div>
                            )}

                            {/* Similar Case Pattern */}
                            {analysis.similar_case_pattern && (
                                <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Pattern Match</h4>
                                    <p className="text-sm text-cyan-300 leading-relaxed">{analysis.similar_case_pattern}</p>
                                </div>
                            )}
                        </div>

                        {/* Fallback for Legacy Data */}
                        {!analysis.recommendations && analysis.preventative_measure && (
                             <div>
                                 <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Recommendation</h3>
                                 <p className="text-sm text-slate-300 italic">{analysis.preventative_measure}</p>
                             </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for situation assessment rows
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
            <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
            <div className="min-w-0">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">{label}</span>
                <span className="text-xs text-slate-300 leading-relaxed">{value}</span>
            </div>
        </div>
    );
}


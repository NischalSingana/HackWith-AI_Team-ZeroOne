"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  MapPin, 
  BarChart2, 
  Brain, 
  Users,
  ChevronRight,
  Database,
  Cpu,
  Activity,
  Network,
  LucideIcon
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (target === 0) return;
        const duration = 2000;
        const steps = 60;
        const stepTime = duration / steps;
        const increment = target / steps;
        let current = 0;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current += increment;
            if (step >= steps) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.round(current));
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [target]);

    return <span>{count.toLocaleString()}{suffix}</span>;
}

export default function Home() {
    const [stats, setStats] = useState<{ total_accidents: number; total_victims: number; avg_confidence: number } | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/stats`)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(() => {});
    }, []);

    return (
        <div className="flex-grow flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center relative overflow-hidden py-24 select-none">
            {/* ── Neural Background Core ── */}
            <div className="absolute top-0 -left-64 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-0 -right-64 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse-slow" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(2,6,23,0.8)_100%)] pointer-events-none" />

            <div className="relative z-10 max-w-6xl w-full px-6 space-y-20">
                
                {/* ── Hero Section ── */}
                <div className="space-y-12">
                    <div className="flex justify-center">
                        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 shadow-[0_0_30px_rgba(79,70,229,0.2)] animate-in slide-in-from-top-4 duration-1000">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                           System Protocol v2.9.4-STABLE
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-[0.8] mb-4">
                            CRIMEGRAPH <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 italic drop-shadow-[0_10px_10px_rgba(79,70,229,0.3)]">
                                INTELLIGENCE
                            </span>
                        </h1>
                        
                        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed font-medium">
                            The ultimate FIR Relationship Mapping System. <br />
                            Transforming unstructured archives into a <span className="text-slate-200 font-bold">Neural Knowledge Graph</span> for predictive public safety and strategic intervention.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center">
                        <Link 
                            href="/dashboard" 
                            className="group relative px-10 py-5 bg-indigo-600 rounded-[2rem] font-black uppercase tracking-widest text-xs text-white overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_-15px_rgba(79,70,229,0.5)]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                            <span className="flex items-center gap-3 relative z-10">
                                Initialize Command Dashboard <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                        <Link 
                            href="/upload" 
                            className="px-10 py-5 bg-slate-900 border border-slate-800 rounded-[2rem] font-black uppercase tracking-widest text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <Database size={16} />
                            Ingest Raw Evidence
                        </Link>
                    </div>
                </div>

                {/* ── Real-time Statistics HUD ── */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 px-1 bg-slate-800/10 border border-slate-800/50 rounded-[3rem] backdrop-blur-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-1000 delay-300">
                        {[
                            { label: 'Evidence Processed', value: stats.total_accidents, icon: FileText, color: 'text-indigo-400' },
                            { label: 'Subjects Identified', value: stats.total_victims, icon: Users, color: 'text-purple-400' },
                            { label: 'Extracted Confidence', value: Math.round(stats.avg_confidence * 100), icon: Cpu, color: 'text-emerald-400', suffix: '%' },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-6 p-8 bg-slate-950/40 hover:bg-slate-900/40 transition-colors border-x border-slate-800/20 first:border-l-0 last:border-r-0">
                                <div className={`p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner ${s.color}`}>
                                    <s.icon size={24} />
                                </div>
                                <div className="text-left space-y-1">
                                    <p className="text-4xl font-black text-white tracking-tighter tabular-nums">
                                        <AnimatedCounter target={s.value} suffix={s.suffix} />
                                    </p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Feature Grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-7xl mx-auto">
                    {[
                        { href: '/upload', icon: FileText, title: 'AI Extraction', desc: 'Neural OCR parsing bilingual FIRs with 98.4% data integrity.', color: 'hover:border-indigo-500/50 shadow-indigo-500/10' },
                        { href: '/dashboard', icon: BarChart2, title: 'Flow Analytics', desc: 'Real-time incident velocity and casualty distribution mapping.', color: 'hover:border-emerald-500/50 shadow-emerald-500/10' },
                        { href: '/hotspots', icon: MapPin, title: 'Threat Map', desc: 'AI trajectory mapping to identify recurring high-risk cordons.', color: 'hover:border-amber-500/50 shadow-amber-500/10' },
                        { href: '/graph-explorer', icon: Network, title: 'Neural Graph', desc: 'Discovering hidden links between FIRs across multiple stations.', color: 'hover:border-purple-500/50 shadow-purple-500/10' },
                    ].map((f, i) => (
                        <Link 
                            key={i}
                            href={f.href} 
                            className={`group p-8 rounded-[2.5rem] border border-slate-800 bg-slate-950/50 backdrop-blur-md transition-all duration-500 hover:scale-105 hover:bg-slate-900 active:scale-95 text-left relative overflow-hidden shadow-2xl ${f.color}`}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                            <div className="mb-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 w-fit group-hover:scale-110 group-hover:border-slate-600 transition-all">
                                <f.icon size={24} className="text-slate-200" />
                            </div>
                            <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tighter">{f.title}</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed group-hover:text-slate-400 transition-colors italic">
                                {f.desc}
                            </p>
                        </Link>
                    ))}
                </div>

                {/* ── Problem & Solution Dossier ── */}
                <div className="py-24 border-t border-slate-800/50 space-y-32">
                    
                    {/* The Strategic Challenge */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                        <div className="text-left space-y-10 order-2 lg:order-1">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase">Operational Bottlenecks</p>
                                <h2 className="text-5xl font-black text-white tracking-tighter leading-none">THE STRATEGIC <br /> <span className="text-amber-500">GAP</span></h2>
                            </div>
                            <div className="space-y-8">
                                <ChallengeItem 
                                    title="Evidence Fragmentation" 
                                    desc="FIRs are trapped in disconnected PDF silos, making complex relationship mapping across jurisdictions impossible for traditional teams." 
                                />
                                <ChallengeItem 
                                    title="Bilingual Inefficiency" 
                                    desc="The labor-intensive manual translation of Telugu/English documents results in critical pattern-blindness during investigations." 
                                />
                                <ChallengeItem 
                                    title="Static Reporting" 
                                    desc="Legacy systems provide post-mortem data, failing to generate predictive risk assessments for real-time safety interventions." 
                                />
                            </div>
                        </div>
                        <div className="relative order-1 lg:order-2">
                            <div className="absolute inset-0 bg-indigo-600/10 blur-[120px] rounded-full" />
                            <div className="relative p-1 bg-gradient-to-br from-slate-700 to-slate-900 rounded-[3rem] shadow-2xl">
                                <div className="bg-slate-950 p-10 rounded-[2.8rem] border border-slate-800">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Buffer_Corruption_Report.log</span>
                                    </div>
                                    <pre className="text-left text-xs text-indigo-400/80 font-mono overflow-hidden leading-relaxed">
{`$ cat station_logs.sys
[ERROR] Cross-Ref failed: Station_ID 049
[WARN] Unstructured Data: FIR_2024_A2
[SYSTEM] No Relationship Cache Found
[IMPACT] Predictive Visibility: 0.2%
[STATUS] CRITICAL_LAG_DETECTED
[ACTION] Manual Intervention Required...`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* The Neural solution */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-emerald-600/10 blur-[120px] rounded-full group-hover:bg-emerald-600/20 transition-all duration-1000" />
                            <div className="relative grid grid-cols-2 gap-4">
                                <TechPill name="Neo4j" icon={Network} />
                                <TechPill name="Groq AI" icon={Brain} />
                                <TechPill name="Google Vision API" icon={Activity} />
                                <TechPill name="NetworkX" icon={GitMerge} />
                            </div>
                        </div>
                        <div className="text-left space-y-10">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black tracking-[0.4em] text-emerald-500 uppercase">System Resolution</p>
                                <h2 className="text-5xl font-black text-white tracking-tighter leading-none">NEURAL <br /> <span className="text-emerald-500">INNOVATION</span></h2>
                            </div>
                            <div className="space-y-8">
                                <SolutionItem 
                                    title="Universal OCR Pipeline" 
                                    desc="End-to-end proprietary engine that converts bilingual incident reports into actionable intelligence within milliseconds." 
                                />
                                <SolutionItem 
                                    title="Multidimensional Knowledge Graph" 
                                    desc="Utilizing high-order network science to uncover non-obvious links between offenders, vehicles, and location clusters." 
                                />
                                <SolutionItem 
                                    title="Strategic Protocol Engine" 
                                    desc="Autonomous generation of actionable recommendations for infrastructure, enforcement, and education (The 3E Protocol)." 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Industrial Footer ── */}
                <div className="pt-20 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-8 text-slate-500 relative">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                    <div className="space-y-1 text-center md:text-left">
                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">CrimeGraph AI Registry</p>
                        <p className="text-[10px] uppercase font-bold tracking-tighter">© 2026 Strategic Policing Solutions • Industrial Grade Intelligence</p>
                    </div>
                    <div className="flex gap-10 text-[10px] font-black uppercase tracking-widest">
                        <span className="flex items-center gap-2 group cursor-help"><div className="w-1 h-1 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform" /> SECURE_CORE: L3</span>
                        <span className="flex items-center gap-2 group cursor-help"><div className="w-1 h-1 rounded-full bg-indigo-500 group-hover:scale-150 transition-transform" /> NEURAL_LOAD: OPTIMAL</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChallengeItem({ title, desc }: { title: string; desc: string }) {
    return (
        <div className="space-y-2 group">
            <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-amber-500 transition-colors">{title}</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm italic">{desc}</p>
        </div>
    );
}

function SolutionItem({ title, desc }: { title: string; desc: string }) {
    return (
        <div className="space-y-2 group">
            <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider group-hover:scale-105 origin-left transition-all">{title}</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm italic">{desc}</p>
        </div>
    );
}

function TechPill({ name, icon: Icon }: { name: string; icon: LucideIcon }) {
    return (
        <div className="p-10 bg-slate-950 border border-slate-900 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all duration-500 hover:border-emerald-500/50 hover:bg-slate-900/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)] group cursor-default">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 group-hover:border-emerald-500/30 transition-colors">
                <Icon size={24} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase group-hover:text-slate-200 transition-colors">{name}</span>
        </div>
    );
}

import { GitMerge } from 'lucide-react';

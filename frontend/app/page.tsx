"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  MapPin, 
  BarChart2, 
  ArrowRight,
  Brain,
  Shield,
  Users,
  LogOut
} from 'lucide-react';
import Cookies from 'js-cookie';
import { API_BASE_URL } from '@/lib/api';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (target === 0) return;
        const duration = 1500;
        const steps = 40;
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
    const [loggedInUser, setLoggedInUser] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/stats`)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(() => {});

        // Avoid synchronous setState in effect
        Promise.resolve().then(() => {
            const token = Cookies.get('auth_token');
            if (token) {
                setLoggedInUser(localStorage.getItem('username') || 'User');
            }
        });
    }, []);

    return (
        <div className="flex-grow flex flex-col items-center justify-center h-full text-center space-y-12 relative overflow-hidden py-12">
            {/* Background Gradients */}
            <div className="absolute top-0 -left-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

            {/* Top Right Auth Area */}
            <div className="absolute top-6 right-8 z-50 flex items-center gap-3">
                {loggedInUser ? (
                    <>
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg font-medium border border-slate-700 backdrop-blur-md transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                        >
                            <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase">
                                {loggedInUser.charAt(0)}
                            </div>
                            {loggedInUser}
                        </Link>
                        <button
                            onClick={() => {
                                Cookies.remove('auth_token');
                                localStorage.removeItem('auth_token');
                                localStorage.removeItem('username');
                                window.location.reload();
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg font-medium border border-slate-700 hover:border-red-700/50 backdrop-blur-md transition-all active:scale-95"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </>
                ) : (
                    <Link 
                        href="/login" 
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg font-medium border border-slate-700 backdrop-blur-md transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                    >
                        <Shield size={16} className="text-indigo-400" />
                        Secure Login
                    </Link>
                )}
            </div>

            <div className="relative z-10 space-y-6 max-w-4xl px-4 mt-16">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-sm text-slate-300 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    System Operational v2.0
                </div>
                
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
                    Next-Gen <br /> 
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
                        CrimeGraph AI
                    </span>
                </h1>
                
                <p className="max-w-2xl mx-auto text-lg text-slate-400 leading-relaxed">
                    Intelligent FIR Relationship Mapping System. <br />
                    Transform raw PDF FIRs into actionable intelligence. 
                    Our AI engine extracts critical data, analyzes severity trends, and maps geometric hotspots automatically.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    <Link 
                        href="/dashboard" 
                        className="group px-8 py-3.5 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        View Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link 
                        href="/upload" 
                        className="px-8 py-3.5 bg-slate-800 text-white rounded-xl font-semibold border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-colors flex items-center justify-center"
                    >
                        Upload New FIR
                    </Link>
                </div>
            </div>

            {/* Live Stats Bar */}
            {stats && stats.total_accidents > 0 && (
                <div className="relative z-10 flex flex-wrap justify-center gap-8 px-6 py-4 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <FileText size={18} className="text-indigo-400" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-white">
                                <AnimatedCounter target={stats.total_accidents} />
                            </p>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider">FIRs Analyzed</p>
                        </div>
                    </div>
                    <div className="w-px bg-slate-700/50 hidden sm:block" />
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Users size={18} className="text-purple-400" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-white">
                                <AnimatedCounter target={stats.total_victims} />
                            </p>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Victims Tracked</p>
                        </div>
                    </div>
                    <div className="w-px bg-slate-700/50 hidden sm:block" />
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Brain size={18} className="text-emerald-400" />
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-bold text-white">
                                <AnimatedCounter target={Math.round(stats.avg_confidence * 100)} suffix="%" />
                            </p>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider">AI Accuracy</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 w-full max-w-5xl px-4 mt-8 pb-20">
                <FeatureCard 
                    href="/upload"
                    icon={<FileText size={28} className="text-indigo-400" />}
                    title="AI Extraction"
                    desc="OCR & NLP for Typed/Handwritten FIRs in English & Telugu."
                    color="border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5"
                />
                <FeatureCard 
                    href="/dashboard"
                    icon={<BarChart2 size={28} className="text-emerald-400" />}
                    title="Live Dashboard"
                    desc="Real-time stats, charts, and cause analysis at a glance."
                    color="border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5"
                />
                <FeatureCard 
                    href="/hotspots"
                    icon={<MapPin size={28} className="text-amber-400" />}
                    title="Hotspot Mapping"
                    desc="Geospatial visualization of high-risk zones and blackspots."
                    color="border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5"
                />
                <FeatureCard 
                    href="/trends"
                    icon={<Shield size={28} className="text-purple-400" />}
                    title="Trend Analysis"
                    desc="Monthly trends, day-of-week patterns, and severity evolution."
                    color="border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5"
                />
            </div>
        </div>
    );
}

function FeatureCard({ href, icon, title, desc, color }: { 
    href: string; 
    icon: React.ReactNode; 
    title: string; 
    desc: string; 
    color: string; 
}) {
    return (
        <Link 
            href={href} 
            className={`group p-6 rounded-2xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden backdrop-blur-sm ${color}`}
        >
            <div className="mb-3 p-3 rounded-xl bg-slate-900/50 w-fit group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                {desc}
            </p>
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                <ArrowRight size={18} className="text-slate-500" />
            </div>
        </Link>
    );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart2, 
  Map, 
  UploadCloud, 
  FileText, 
  ShieldAlert, 
  Menu,
  X,
  TrendingUp,
  Home,
  Share2,
  Activity,
  Zap,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { group: "Operations", items: [
    { label: "Home", href: "/", icon: Home },
    { label: "Neural Upload", href: "/upload", icon: UploadCloud },
    { label: "Evidence Locker", href: "/accidents", icon: FileText },
  ]},
  { group: "Intelligence", items: [
    { label: "Command Dashboard", href: "/dashboard", icon: BarChart2 },
    { label: "Tactical Hotspots", href: "/hotspots", icon: Map },
    { label: "Graph Topology", href: "/graph-explorer", icon: Share2 },
  ]},
  { group: "Analysis", items: [
    { label: "Trend Dynamics", href: "/trends", icon: TrendingUp },
    { label: "Strategic Reports", href: "/insights", icon: ShieldAlert },
    { label: "Jurisdiction Map", href: "/jurisdictions", icon: Map },
  ]}
];

interface SystemStatus {
  online: boolean;
  load: number;
  sync_mode: string;
  ai_service: { status: string };
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<SystemStatus>({ 
    online: true, 
    load: 14.2, 
    sync_mode: 'Neural Sync',
    ai_service: { status: 'online' }
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/system/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error("Failed to fetch system status", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-md lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 left-0 z-40 h-screen w-72 bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800/50 transition-all duration-500 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 shadow-[0_0_50px_rgba(0,0,0,0.5)]`}
      >
        <div className="flex flex-col h-full px-5 py-8">
          {/* Logo (Refined) */}
          <div className="mb-10 px-2 flex items-center gap-4">
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative w-12 h-12 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center shadow-xl">
                    <ShieldAlert className="text-indigo-400 group-hover:text-white transition-colors" size={26} />
                </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight uppercase leading-none">CrimeGraph</h1>
              <span className="text-[10px] text-indigo-400 font-bold tracking-[0.2em] uppercase">Intelligence Portal</span>
            </div>
          </div>

          {/* Navigation (Grouped) */}
          <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-1">
            {NAV_ITEMS.map((group) => (
              <div key={group.group}>
                <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-4">
                    {group.group}
                </h3>
                <nav className="space-y-1">
                    {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    
                    return (
                        <Link 
                            key={item.href} 
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
                                isActive 
                                ? "bg-indigo-600/10 text-white shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]" 
                                : "text-slate-400 hover:bg-slate-900 hover:text-white"
                            }`}
                            onClick={() => setIsOpen(false)}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,1)]" />
                            )}
                            <Icon 
                                size={20} 
                                className={`transition-all duration-300 ${
                                    isActive 
                                    ? "text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" 
                                    : "text-slate-500 group-hover:text-indigo-400"
                                }`} 
                            />
                            <span className={`text-sm tracking-tight ${isActive ? "font-bold text-indigo-100" : "font-medium"}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <Zap size={12} className="ml-auto text-indigo-500 animate-pulse" />
                            )}
                        </Link>
                    );
                    })}
                </nav>
              </div>
            ))}
          </div>

          {/* System Bio-Metrics / Status (Functional) */}
          <div className="mt-auto pt-6 border-t border-slate-800/50">
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full animate-ping ${status.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            System Link: {status.online ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    <Lock size={12} className={status.online ? "text-indigo-500" : "text-slate-600"} />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Processing Load</span>
                        <span className="text-indigo-400 font-mono">{status.load.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div 
                            className="bg-indigo-500 h-full transition-all duration-1000" 
                            style={{ width: `${status.load}%` }} 
                        />
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                    <Activity size={10} className={status.ai_service.status === 'online' ? "text-indigo-500" : "text-red-500"} />
                    <span>Neural Network v2.4a {status.ai_service.status === 'online' ? 'Sync' : 'Critical'}</span>
                </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { 
    Layers, 
    Database, 
    Crosshair, 
    Radio, 
    Maximize2,
    Activity,
    ShieldAlert,
    Target
} from 'lucide-react';
import { API_BASE_URL } from "@/lib/api";

// Dynamic import to prevent SSR issues with Leaflet
const AccidentMap = dynamic(() => import("@/components/AccidentMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-slate-900/50 rounded-3xl flex flex-col items-center justify-center border border-slate-800 space-y-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
        <div className="relative animate-spin w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full" />
      </div>
      <p className="text-slate-500 font-mono text-xs tracking-widest uppercase">Initializing Geospatial Engine...</p>
    </div>
  ),
});

export default function HotspotsPage() {
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  const handleGeocodeAll = async () => {
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/map/geocode-all`, {
        method: "POST",
      });
      const data = await res.json();
      setGeocodeResult(
        `✅ Geocoded ${data.geocoded} locations, ${data.failed} failed out of ${data.total} total`
      );
    } catch {
      setGeocodeResult("❌ Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Tactical Header */}
      <div className="relative p-8 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Radio size={140} className="text-emerald-500" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 w-fit">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Radio size={14} className="text-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Tactical Feed</span>
                    </div>
                    <div className="glass px-3 py-1 rounded-full border border-slate-700/50 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic opacity-80">OSM Core: Active</span>
                    </div>
                </div>
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                    Hotspot <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Telemetry</span>
                </h1>
                <p className="text-slate-400 text-sm max-w-xl font-medium leading-relaxed">
                    Visualizing kinetic impact clusters through neural geospatial mapping. Identify high-risk sectors and optimize emergency response deployment.
                </p>
            </div>

            <button
                onClick={handleGeocodeAll}
                disabled={geocoding}
                className="group/btn relative px-8 py-4 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 hover:text-white rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-black uppercase tracking-widest flex items-center gap-3 overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0 -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite]" />
                {geocoding ? <div className="animate-spin w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full" /> : <Database size={18} />}
                {geocoding ? "Syncing Coordinates..." : "Neural Geocode Parse"}
            </button>
        </div>
      </div>

      {geocodeResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-bold text-emerald-300 backdrop-blur-sm flex items-center gap-3 animate-in fade-in zoom-in-95">
          <ShieldAlert size={16} />
          {geocodeResult}
        </div>
      )}

      {/* Map Command View */}
      <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-[2.5rem] blur opacity-25 group-hover:opacity-100 transition duration-1000" />
          <div className="relative bg-slate-950 border border-slate-800 rounded-[2rem] p-6 shadow-2xl overflow-hidden min-h-[700px]">
            {/* Removed internal absolute badge to prevent overlap with Map Title */}
            
            <div className="absolute bottom-6 right-6 z-10">
                <div className="glass p-2 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors cursor-pointer">
                    <Maximize2 size={18} className="text-slate-400" />
                </div>
            </div>

            <AccidentMap />
          </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group glass p-8 rounded-3xl border border-slate-800/50 hover:border-indigo-500/30 transition-all duration-500 overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Crosshair size={100} className="text-indigo-500" />
            </div>
            <h3 className="text-sm font-black text-slate-200 mb-6 flex items-center gap-3 uppercase tracking-widest">
                <Layers size={18} className="text-indigo-400" /> System Features
            </h3>
            <div className="space-y-4">
                {[
                    { label: "Kinetic Marker Interactivity", desc: "Drill down into FIR specifics on-click" },
                    { label: "Neural Severity Mapping", desc: "Color-spectrum coded risk assessment" },
                    { label: "Spatial Density Clusters", desc: "Intelligent grouping of incident zones" }
                ].map((item, i) => (
                    <div key={i} className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        <div>
                            <p className="text-[11px] font-bold text-slate-300 leading-none mb-1">{item.label}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        <div className="group glass p-8 rounded-3xl border border-slate-800/50 hover:border-emerald-500/30 transition-all duration-500 overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Target size={100} className="text-emerald-500" />
            </div>
            <h3 className="text-sm font-black text-slate-200 mb-6 flex items-center gap-3 uppercase tracking-widest">
                <Target size={18} className="text-emerald-400" /> Geocode Core
            </h3>
            <div className="space-y-4">
                {[
                    { label: "Nominatim Neural Pathing", desc: "Proprietary address-to-coordinate conversion" },
                    { label: "Persistent Spatial Vault", desc: "Long-term caching of geographical hits" },
                    { label: "Real-time Vector Ingestion", desc: "On-the-fly parsing of new incident reports" }
                ].map((item, i) => (
                    <div key={i} className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <div>
                            <p className="text-[11px] font-bold text-slate-300 leading-none mb-1">{item.label}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="glass p-8 rounded-3xl border border-slate-800/50">
          <h3 className="text-sm font-black text-slate-200 mb-6 flex items-center gap-3 uppercase tracking-widest">
            <Activity size={18} className="text-red-400" /> Conflict Severity
          </h3>
          <div className="space-y-3">
            {[
                { label: "Fatal Outcome", color: "bg-red-500", glow: "rgba(239,68,68,0.5)", text: "text-red-400" },
                { label: "Grievous Kinetic Impact", color: "bg-amber-500", glow: "rgba(245,158,11,0.5)", text: "text-amber-400" },
                { label: "Non-Fatal Signature", color: "bg-indigo-500", glow: "rgba(99,102,241,0.5)", text: "text-indigo-400" }
            ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/50 rounded-2xl group/item hover:border-slate-700 transition-all">
                    <span className={`text-[11px] font-black uppercase tracking-tight ${item.text}`}>{item.label}</span>
                    <div className={`w-3 h-3 rounded-full ${item.color}`} style={{ boxShadow: `0 0 12px ${item.glow}` }} />
                </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

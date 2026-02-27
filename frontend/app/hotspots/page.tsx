"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Dynamic import to prevent SSR issues with Leaflet
const AccidentMap = dynamic(() => import("@/components/AccidentMap"), {
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

import { Map, Layers, Database, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from "@/lib/api";

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
             <Map className="text-emerald-500" /> Accident Hotspot Map
          </h1>
          <p className="text-slate-400 mt-2">
            Geospatial visualization of accident clusters in Vijayawada (OpenStreetMap)
          </p>
        </div>
        <button
          onClick={handleGeocodeAll}
          disabled={geocoding}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold flex items-center gap-2"
        >
          {geocoding ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Database size={18} />}
          {geocoding ? "Geocoding..." : "Geocode Missing Locations"}
        </button>
      </div>

      {geocodeResult && (
        <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-300 backdrop-blur-sm">
          {geocodeResult}
        </div>
      )}

      {/* Map */}
      <div className="bg-slate-900/50 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-2xl">
          <AccidentMap />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Layers size={18} className="text-blue-400" /> Map Features
          </h3>
          <ul className="text-sm text-slate-400 space-y-2">
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Click markers for details</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Color-coded severity</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Zoom to clusters</li>
          </ul>
        </div>
        
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Database size={18} className="text-purple-400" /> Geocoding System
          </h3>
          <ul className="text-sm text-slate-400 space-y-2">
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Auto-geocodes addresses</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Permanent coordinate storage</li>
            <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Nominatim API (Free Tier)</li>
          </ul>
        </div>

        <div className="glass p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-red-400" /> Severity Legend
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
              <span className="text-red-200 font-medium">Fatal</span>
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
              <span className="text-yellow-200 font-medium">Grievous</span>
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded border border-blue-500/20">
              <span className="text-blue-200 font-medium">Non-Fatal</span>
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

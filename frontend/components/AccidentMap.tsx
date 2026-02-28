"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { API_BASE_URL } from "@/lib/api";

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface AccidentMarker {
  id: number;
  fir_number: string;
  severity: string;
  cause: string;
  incident_date: string;
  address: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
  victim_count: number;
  fatality_count: number;
  confidence_score: number;
}

interface MapData {
  count: number;
  center: { lat: number; lng: number };
  data: AccidentMarker[];
}

const SEVERITY_COLORS: Record<string, string> = {
  Fatal: "#ef4444",
  Grievous: "#f59e0b",
  "Simple": "#3b82f6",
  "Non-Injury": "#10b981",
  Unknown: "#6b7280",
};

const defaultCenter = { lat: 16.60, lng: 80.45 };

// Component to update map center dynamically
function ReCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function AccidentMap() {
  const router = useRouter();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    fetch(`${API_BASE_URL}/map/locations`)
      .then((res) => res.json())
      .then((data) => {
        setMapData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Map data error:", err);
        setError("Failed to load map data");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-[600px] w-full flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-8 h-8 border-4 border-slate-800 border-t-indigo-500 rounded-full" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initializing Tactical Grid...</p>
        </div>
      </div>
    );
  }

  const center: [number, number] = mapData?.center 
    ? [mapData.center.lat, mapData.center.lng] 
    : [defaultCenter.lat, defaultCenter.lng];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black text-white tracking-tight">Accident Hotspots <span className="text-slate-500 ml-1">— NTR District</span></h2>
          {mapData && (
            <span className="px-3 py-1 text-[10px] font-black bg-slate-800/80 border border-slate-700/50 rounded-full text-indigo-400 uppercase tracking-widest shadow-lg">
              {mapData.count} locations identified
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {Object.entries(SEVERITY_COLORS).map(([severity, color]) => (
          <div key={severity} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-slate-400">{severity}</span>
          </div>
        ))}
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl glass-effect z-0" style={{ height: '600px' }}>
        {error && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[1000] text-red-400">
            {error}
          </div>
        )}
        
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%", background: "#0f172a" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <ReCenter center={center} />

          {(mapData?.data || []).map((marker: AccidentMarker) => (
            <CircleMarker
              key={marker.id}
              center={[marker.lat, marker.lng]}
              radius={marker.severity === "Fatal" ? 8 : 6}
              pathOptions={{
                fillColor: SEVERITY_COLORS[marker.severity] || SEVERITY_COLORS.Unknown,
                fillOpacity: 0.8,
                color: "#ffffff",
                weight: 1,
              }}
            >
              <Popup>
                <div className="p-2 min-w-[180px] text-slate-900 font-sans">
                  <h3 className="font-bold border-b pb-1 mb-2 text-xs">FIR #{marker.fir_number}</h3>
                  <div className="space-y-1 text-[11px]">
                    <p><span className="font-semibold">Severity:</span> {marker.severity}</p>
                    <p><span className="font-semibold">Cause:</span> {marker.cause}</p>
                    <p><span className="font-semibold">Area:</span> {marker.area}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/accidents/${marker.id}`)}
                    className="mt-3 w-full bg-indigo-600 text-white rounded py-1.5 text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                  >
                    View Full Analysis
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Stats Cards */}
      {mapData && mapData.data && mapData.data.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Mapped" value={mapData.count || 0} color="#3b82f6" />
          <StatCard label="Fatalities" value={mapData.data.filter((d: AccidentMarker) => d.severity === 'Fatal').length} color="#ef4444" />
          <StatCard label="Grievous" value={mapData.data.filter((d: AccidentMarker) => d.severity === 'Grievous').length} color="#f59e0b" />
          <StatCard label="Confidence Index" value={Math.round((mapData.data.reduce((acc: number, curr: AccidentMarker) => acc + curr.confidence_score, 0) / (mapData.count || 1)) * 100) || 0} unit="%" color="#10b981" />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, unit = "" }: { label: string; value: number; color: string; unit?: string }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-md">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

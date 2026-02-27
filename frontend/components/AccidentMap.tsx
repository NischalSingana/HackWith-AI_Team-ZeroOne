"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, HeatmapLayerF } from "@react-google-maps/api";
import { API_BASE_URL } from "@/lib/api";
import { GOOGLE_MAPS_LIBRARIES } from "@/lib/google-maps";

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

// Premium Dark Theme for Google Maps
const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
];

const mapContainerStyle = {
  height: "500px",
  width: "100%",
};

const defaultCenter = { lat: 16.60, lng: 80.45 };

export default function AccidentMap() {
  const router = useRouter();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<AccidentMarker | null>(null);
  const [heatmapData, setHeatmapData] = useState<google.maps.visualization.WeightedLocation[]>([]);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

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

  // Load heatmap data if toggled
  useEffect(() => {
    if (showHeatmap && isLoaded && heatmapData.length === 0) {
      fetch(`${API_BASE_URL}/map/heatmap`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            const formatted = data.data.map((p: [number, number, number]) => ({
              location: new google.maps.LatLng(p[0], p[1]),
              weight: p[2],
            }));
            setHeatmapData(formatted);
          }
        })
        .catch((err) => console.error("Heatmap error:", err));
    }
  }, [showHeatmap, isLoaded, heatmapData.length]);

  const mapOptions = useMemo(() => ({
    styles: mapStyles,
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
  }), []);

  const onMarkerClick = useCallback((marker: AccidentMarker) => {
    setSelectedMarker(marker);
  }, []);

  if (!isLoaded) {
    return (
      <div className="h-[500px] w-100 flex items-center justify-center bg-slate-900 rounded-xl border border-slate-700">
        <div className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-200">Accident Hotspots — NTR District</h2>
          {mapData && (
            <span className="px-3 py-1 text-sm bg-slate-700 rounded-full text-slate-300">
              {mapData.count} locations
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg ${
              showHeatmap
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600"
            }`}
          >
            {showHeatmap ? "🔥 Heatmap ON" : "Heatmap OFF"}
          </button>
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
      <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl glass-effect">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10 text-slate-400">
            <div className="animate-spin w-8 h-8 border-3 border-slate-500 border-t-blue-500 rounded-full mb-2" />
            <span>Fetching markers...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10 text-red-400">
            {error}
          </div>
        )}
        
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapData?.center || defaultCenter}
          zoom={12}
          options={mapOptions}
        >
          {showHeatmap && heatmapData.length > 0 && (
            <HeatmapLayerF
              data={heatmapData}
              options={{ radius: 30, opacity: 0.6 }}
            />
          )}

          {!showHeatmap && mapData?.data.map((marker: AccidentMarker) => (
            <MarkerF
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={() => onMarkerClick(marker)}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: SEVERITY_COLORS[marker.severity] || SEVERITY_COLORS.Unknown,
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "#ffffff",
                scale: marker.severity === "Fatal" ? 10 : 8,
              }}
            />
          ))}

          {selectedMarker && (
            <InfoWindowF
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-2 min-w-[200px] text-slate-900">
                <h3 className="font-bold border-b pb-1 mb-2">FIR #{selectedMarker.fir_number}</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Severity:</span> {selectedMarker.severity}</p>
                  <p><span className="font-medium">Cause:</span> {selectedMarker.cause}</p>
                  <p><span className="font-medium">Area:</span> {selectedMarker.area}</p>
                </div>
                <button
                  onClick={() => router.push(`/accidents/${selectedMarker.id}`)}
                  className="mt-3 w-full bg-blue-600 text-white rounded py-1.5 text-xs font-bold hover:bg-blue-700"
                >
                  View Full Analysis
                </button>
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      </div>

      {/* Stats Cards */}
      {mapData && mapData.data.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Mapped" value={mapData.count} color="#3b82f6" />
          <StatCard label="Fatalities" value={mapData.data.filter((d: AccidentMarker) => d.severity === 'Fatal').length} color="#ef4444" />
          <StatCard label="Grievous" value={mapData.data.filter((d: AccidentMarker) => d.severity === 'Grievous').length} color="#f59e0b" />
          <StatCard label="Confidence Index" value={Math.round((mapData.data.reduce((acc: number, curr: AccidentMarker) => acc + curr.confidence_score, 0) / mapData.count) * 100)} unit="%" color="#10b981" />
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

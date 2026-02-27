"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { useMemo } from "react";

interface MiniMapProps {
  lat: number;
  lng: number;
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

export default function MiniMap({ lat, lng }: MiniMapProps) {
  const center: [number, number] = useMemo(() => [lat, lng], [lat, lng]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 h-64 w-full relative z-0 shadow-lg bg-[#0f172a]">
      <MapContainer
        center={center}
        zoom={15}
        style={containerStyle}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <CircleMarker 
          center={center} 
          radius={8}
          pathOptions={{
            fillColor: "#3b82f6",
            fillOpacity: 1,
            color: "#ffffff",
            weight: 2
          }}
        />
      </MapContainer>
    </div>
  );
}

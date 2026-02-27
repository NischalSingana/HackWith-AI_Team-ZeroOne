"use client";

import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { useMemo } from "react";
import { GOOGLE_MAPS_LIBRARIES } from "@/lib/google-maps";

interface MiniMapProps {
  lat: number;
  lng: number;
}

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
];

const containerStyle = {
  width: "100%",
  height: "100%",
};

export default function MiniMap({ lat, lng }: MiniMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const center = useMemo(() => ({ lat, lng }), [lat, lng]);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    zoomControl: true,
    styles: mapStyles,
  }), []);

  if (!isLoaded) {
    return (
      <div className="w-full h-64 bg-slate-900 animate-pulse rounded-xl border border-slate-700 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-500 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 h-64 w-full relative z-0 shadow-lg">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        options={mapOptions}
      >
        <MarkerF position={center} />
      </GoogleMap>
    </div>
  );
}

// components/Map.tsx
"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

function MapRecenter({ location }: { location: [number, number] | null }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (location && !hasCentered.current) {
      map.flyTo(location, 16, { animate: true });
      hasCentered.current = true;
    }
  }, [location, map]);
  return null;
}

// Pomocná funkce pro barvu
const getPathColor = (dist: number) => {
  if (dist <= 20) return "#16a34a"; // Zelená (na trase)
  if (dist <= 50) return "#f97316"; // Oranžová (blízko)
  return "#dc2626"; // Červená (mimo)
};

interface TrackPoint {
  coords: [number, number];
  dist: number;
}

interface MapProps {
  routeCoordinates: [number, number][];
  userLocation: [number, number] | null;
  userPathWithDist?: TrackPoint[]; // Změna typu
}

export default function Map({
  routeCoordinates,
  userLocation,
  userPathWithDist = [],
}: MapProps) {
  const center: [number, number] = [49.811, 14.295];
  const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url={`https://api.mapy.cz/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`}
        attribution="&copy; Seznam.cz, a.s."
      />

      {/* Referenční trasa - ŽLUTÁ (jak jsi chtěl) */}
      <Polyline
        positions={routeCoordinates}
        pathOptions={{ color: "#fbbf24", weight: 6, opacity: 0.7 }}
      />

      {/* Vlastní trasa - Segmentované vykreslování pro barvy */}
      {userPathWithDist.map((point, idx) => {
        if (idx === 0) return null;
        const prevPoint = userPathWithDist[idx - 1];
        return (
          <Polyline
            key={idx}
            positions={[prevPoint.coords, point.coords]}
            pathOptions={{
              color: getPathColor(point.dist),
              weight: 5,
            }}
          />
        );
      })}

      <MapRecenter location={userLocation} />

      {userLocation && (
        <Circle
          center={userLocation}
          radius={15}
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 1,
          }}
        />
      )}
    </MapContainer>
  );
}

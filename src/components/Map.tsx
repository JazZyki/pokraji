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

interface TrackSegment {
  points: TrackPoint[];
}

interface MapProps {
  routeCoordinates: [number, number][];
  userLocation: [number, number] | null;
  segments: TrackSegment[]; // Změna z plochého pole na segmenty
  userPathWithDist?: TrackPoint[]; // Změna typu
}

interface TrackPoint {
  coords: [number, number];
  dist: number;
}

export default function Map({
  routeCoordinates,
  userLocation,
  segments = [], // Přijímáme segmenty
}: MapProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY;

  return (
    <MapContainer
      center={[49.811, 14.295]}
      zoom={13}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <TileLayer
        url={`https://api.mapy.cz/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`}
        attribution="&copy; Seznam.cz"
      />

      {/* Referenční trasa */}
      <Polyline
        positions={routeCoordinates}
        pathOptions={{ color: "#2d2e88", weight: 8, opacity: 0.8 }}
      />

      {/* Vykreslení segmentů (každá session je samostatná čára) */}
      {segments.map((segment, sIdx) => (
        <div key={`segment-${sIdx}`}>
          {segment.points.map((point, pIdx) => {
            if (pIdx === 0) return null;
            const prevPoint = segment.points[pIdx - 1];
            return (
              <Polyline
                key={`line-${sIdx}-${pIdx}`}
                positions={[prevPoint.coords, point.coords]}
                pathOptions={{
                  color: getPathColor(point.dist),
                  weight: 5,
                }}
              />
            );
          })}
        </div>
      ))}

      <MapRecenter location={userLocation} />

      {userLocation && (
        <Circle
          center={userLocation}
          radius={15}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}

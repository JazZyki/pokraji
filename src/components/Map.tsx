// components/Map.tsx
"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import { useEffect, useRef } from "react";
import { Tooltip } from "react-leaflet";

function MapRecenter({ location }: { location: [number, number] | null }) {
  const map = useMap();
  const hasCenteredGPS = useRef(false); // Sleduje, jestli jsme už zafocusovali na živou polohu

  useEffect(() => {
    if (location && !hasCenteredGPS.current) {
      map.flyTo(location, 17, {
        animate: true,
        duration: 1.5, // délka animace v sekundách
      });

      // Nastavíme na true, aby nás to neházelo zpět, když se budeme hýbat
      hasCenteredGPS.current = true;
    }
  }, [location, map]);

  return null;
}
// Pomocná funkce pro barvu
const getPathColor = (dist: number) => {
  if (dist <= 50) return "#16a34a"; // Zelená (na trase)
  if (dist <= 150) return "#f97316"; // Oranžová (blízko)
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
  poiPoints?: PoiPoint[]; // Přidáno
  unlockedIds?: Set<string>; // Přidáno
  onPoiClick?: (poi: PoiPoint) => void; // Přidáno pro callback při kliknutí na POI
}

interface TrackPoint {
  coords: [number, number];
  dist: number;
}

interface PoiPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export default function Map({
  routeCoordinates,
  userLocation,
  segments = [], // Přijímáme segmenty
  poiPoints = [], // Přidáno
  unlockedIds = new Set(), // Přidáno
  onPoiClick = () => {}, // Přidáno
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

      {poiPoints?.map((poi) => (
        <Circle
          key={poi.id}
          center={[poi.lat, poi.lon]}
          radius={30}
          pathOptions={{
            color: unlockedIds?.has(poi.id) ? "#16a34a" : "#e40521",
            fillColor: unlockedIds?.has(poi.id) ? "#16a34a" : "#e40521",
            fillOpacity: 0.3,
            weight: 2,
          }}
          eventHandlers={{
            click: () => onPoiClick(poi),
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.8}>
            {poi.name}
          </Tooltip>
        </Circle>
      ))}

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

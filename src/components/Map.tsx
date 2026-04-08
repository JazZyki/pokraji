// components/Map.tsx
"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
import { Tooltip } from "react-leaflet";
import { Target } from "lucide-react";

function ManualCenterButton({ location }: { location: [number, number] | null }) {
  const map = useMap();

  const handleManualCenter = () => {
    if (location) {
      map.flyTo(location, 16, { animate: true });
    } else {
      alert("Čekám na GPS signál...");
    }
  };

  return (
    <div className="absolute bottom-20 right-6 z-[1000]">
      <button
        onClick={handleManualCenter}
        className="bg-white p-3 rounded-full shadow-2xl border-2 border-primary text-primary active:bg-slate-100 transition-colors"
        title="Centrovat na moji polohu"
      >
        <Target className="size-6" />
      </button>
    </div>
  );
}

function MapRecenter({ location, isTracking }: { location: [number, number] | null; isTracking: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (isTracking && location) {
      // Mapa se plynule přesune na každou novou pozici z GPS
      map.flyTo(location, map.getZoom(), { 
        animate: true,
        duration: 0.5 
      });
    }
  }, [location, map, isTracking]);

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
  isTracking?: boolean; // Přidáno
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
  isTracking = false, // Přidáno
}: MapProps & { isTracking: boolean }) {
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

      <MapRecenter location={userLocation} isTracking={isTracking} />
      <ManualCenterButton location={userLocation} />

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

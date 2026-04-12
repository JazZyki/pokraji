"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";

// 1. TLAČÍTKO S INDIKACÍ STAVU
function MapRecenter({ 
  location, 
  forceCenterTrigger 
}: { 
  location: [number, number] | null; 
  forceCenterTrigger: number;
}) {
  const map = useMap();
  
  useEffect(() => {
    // Spustí se jen když se změní číslo triggeru (tedy při kliku)
    if (location && forceCenterTrigger > 0) {
      map.flyTo(location, 17, { 
        animate: true, 
        duration: 0.8 
      });
    }
  }, [forceCenterTrigger, location, map]);
  
  return null;
}

function ResizeMap({ isFullScreen }: { isFullScreen: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Počkáme malou chvíli na dokončení CSS tranzice
    setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 300);
  }, [isFullScreen, map]);
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
  segments = [],
  poiPoints = [],
  unlockedIds = new Set(),
  onPoiClick = () => {},
  isTracking = false,
}: MapProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY;
  const [forceCenterTrigger, setForceCenterTrigger] = useState(0);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[49.811, 14.295]}
        zoom={13}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url={`https://api.mapy.cz/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`}
          attribution='&copy; Seznam.cz'
        />
        
        {/* Teď už jen tenhle jeden useEffect pro manuální skok */}
        <MapRecenter 
          location={userLocation} 
          forceCenterTrigger={forceCenterTrigger}
        />

        <Polyline positions={routeCoordinates} pathOptions={{ color: "#2d2e88", weight: 8, opacity: 0.8 }} />

        {/* POI body */}
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
            eventHandlers={{ click: () => onPoiClick(poi) }}
          />
        ))}

        {/* Historie trasy */}
        {segments.map((segment, sIdx) => (
          <div key={`segment-${sIdx}`}>
            {segment.points.map((point, pIdx) => {
              if (pIdx === 0) return null;
              const prevPoint = segment.points[pIdx - 1];
              return (
                <Polyline
                  key={`line-${sIdx}-${pIdx}`}
                  positions={[prevPoint.coords, point.coords]}
                  pathOptions={{ color: getPathColor(point.dist), weight: 5 }}
                />
              );
            })}
          </div>
        ))}

        {userLocation && (
          <Circle
            center={userLocation}
            radius={15}
            pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1 }}
          />
        )}
      </MapContainer>

      {/* --- TLAČÍTKO JE TEĎ TADY - ABSOLUTNĚ POZICOVANÉ NAD KONTEJNEREM --- */}
      <div className="absolute bottom-45 right-5 z-[500]">
        <button
          onClick={() => {
            if (userLocation) {
              // Jediný způsob, jak pohnout mapou, je toto kliknutí
              setForceCenterTrigger(prev => prev + 1);
            } else {
              alert("Čekám na GPS signál...");
            }
          }}
          className="p-2 rounded-full shadow-md transition-all bg-white text-primary active:scale-90 active:bg-slate-100"
        >
          <Crosshair className="size-8" />
        </button>
      </div>
    </div>
  );
}
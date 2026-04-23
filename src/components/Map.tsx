"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  CircleMarker,
  useMap,
} from "react-leaflet";
import React, { useEffect, useRef } from "react";
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
  const lastTrigger = useRef(forceCenterTrigger);
  
  useEffect(() => {
    // Spustí se jen když se trigger skutečně zvýšil (klik na tlačítko)
    if (location && forceCenterTrigger > lastTrigger.current) {
      map.flyTo(location, 17, { 
        animate: true, 
        duration: 0.8 
      });
    }
    lastTrigger.current = forceCenterTrigger;
  }, [forceCenterTrigger, location, map]);
  
  return null;
}

// Pomocná funkce pro barvu
const getPathColor = (point: TrackPoint) => {
  // Pokud jsme mimo teritorium (isOff), je vše OK -> zelená
  if (point.isOff) return "#16a34a";
  
  // Pokud jsme v teritoriu, barva podle vzdálenosti od trasy
  if (point.dist <= 100) return "#16a34a"; // Zelená (na trase do 100m)
  if (point.dist <= 200) return "#f97316"; // Oranžová (blízko 101-200m)
  return "#dc2626"; // Červená (mimo > 200m)
};

interface TrackSegment {
  points: TrackPoint[];
}

interface MapProps {
  routeCoordinates: [number, number][];
  userLocation: [number, number] | null;
  segments: TrackSegment[];
  userPathWithDist?: TrackPoint[];
  poiPoints?: PoiPoint[];
  unlockedIds?: Set<string>;
  onPoiClick?: (poi: PoiPoint) => void;
  isTracking?: boolean;
}

interface TrackPoint {
  coords: [number, number];
  dist: number;
  isOff?: boolean;
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
}: MapProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY;
  // Startujeme na 0, aby první načtení location nespustilo autofocus
  const [forceCenterTrigger, setForceCenterTrigger] = React.useState(0);

  // --- OPTIMALIZACE: Seskupování bodů stejné barvy ---
  const coloredLines = React.useMemo(() => {
    const lines: { positions: [number, number][]; color: string }[] = [];

    segments.forEach((segment, sIdx) => {
      if (segment.points.length < 2) return;

      let currentChunk: [number, number][] = [segment.points[0].coords];
      // Barva prvního úseku je určena barvou druhého bodu (cíle prvního segmentu)
      let currentColor = getPathColor(segment.points[1] || segment.points[0]);

      for (let i = 1; i < segment.points.length; i++) {
        const point = segment.points[i];
        const pointColor = getPathColor(point);

        currentChunk.push(point.coords);

        if (pointColor !== currentColor) {
          // Barva se změnila -> uložíme dosavadní chunk
          lines.push({
            positions: [...currentChunk],
            color: currentColor,
          });
          // Nový chunk začíná posledním bodem předchozího, aby na sebe navazovaly
          currentChunk = [point.coords];
          currentColor = pointColor;
        }
      }

      // Přidáme poslední zbytek
      if (currentChunk.length > 1) {
        lines.push({
          positions: currentChunk,
          color: currentColor,
        });
      }
    });

    return lines;
  }, [segments]);

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

        {/* Historie trasy - optimalizovaná verze */}
        {coloredLines.map((line, idx) => (
          <Polyline
            key={`track-line-${idx}`}
            positions={line.positions}
            pathOptions={{ color: line.color, weight: 5 }}
          />
        ))}

        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={8}
            pathOptions={{ 
              color: "white", 
              fillColor: "#3b82f6", 
              fillOpacity: 1, 
              weight: 2 
            }}
          />
        )}
      </MapContainer>

      {/* --- TLAČÍTKO CENTROVÁNÍ --- */}
      <div className="absolute bottom-45 right-5 z-[500]">
        <button
          onClick={() => {
            if (userLocation) {
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

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SokolLoader } from "@/components/SokolLoader";

const MapWithNoSSR = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

interface GeoJSONPath {
  coordinates: [number, number][];
}

interface TrackPoint {
  coords: [number, number];
  dist: number;
  sessionId?: string; // Nové
}

interface TrackSegment {
  points: TrackPoint[];
}

// Typy pro WakeLock (v TS zatím nejsou standardem)
interface WakeLockSentinel extends EventTarget {
  release(): Promise<void>;
  readonly released: boolean;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapPage() {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string>("Čekám na GPS...");
  const lastSavedPos = useRef<{ lat: number; lon: number } | null>(null);
  
  // DRŽÍME SEGMENTY (pro výpočet a vykreslení)
  const [segments, setSegments] = useState<TrackSegment[]>([]);

  // VÝPOČET VZDÁLENOSTI (ze všech segmentů)
  const totalDistance = segments.reduce((acc, segment) => {
    const segmentDist = segment.points.reduce((segAcc, point, idx) => {
      if (idx === 0) return 0;
      const prev = segment.points[idx - 1];
      return segAcc + calculateDistance(prev.coords[0], prev.coords[1], point.coords[0], point.coords[1]);
    }, 0);
    return acc + segmentDist;
  }, 0);

  // FUNKCE PRO ZAPNUTÍ/VYPNUTÍ TRASY
  const handleToggleTracking = () => {
    if (!isTracking) {
      const newSessionId = crypto.randomUUID();
      localStorage.setItem("current_session_id", newSessionId);
      // Přidáme nový prázdný segment do stavu, abychom do něj mohli hned zapisovat
      setSegments(prev => [...prev, { points: [] }]);
      setIsTracking(true);
    } else {
      localStorage.removeItem("current_session_id");
      setIsTracking(false);
    }
  };

  const saveLocation = useCallback(async (lat: number, lon: number) => {
    const teamId = localStorage.getItem("knin_team_id");
    const sessionId = localStorage.getItem("current_session_id");
    
    if (!teamId || !sessionId) return;

    const { data, error } = await supabase.rpc("track_team_location", {
      t_id: teamId,
      lat_val: lat,
      lon_val: lon,
      s_id: sessionId,
    });

    if (error) {
      setDebugMsg(`❌ Chyba DB: ${error.message}`);
    } else if (data) {
      const newPoint = { coords: [lat, lon] as [number, number], dist: data.dist, sessionId };
      
      // AKTUALIZACE STAVU: Přidáme bod do posledního segmentu
      setSegments(prev => {
        const newSegments = [...prev];
        const lastIdx = newSegments.length - 1;
        if (lastIdx >= 0) {
          newSegments[lastIdx] = {
            ...newSegments[lastIdx],
            points: [...newSegments[lastIdx].points, newPoint]
          };
        } else {
          newSegments.push({ points: [newPoint] });
        }
        return newSegments;
      });

      setDebugMsg(data.is_off ? `❗ MIMO TRASU! (${Math.round(data.dist)}m)` : `✅ Uloženo: ${new Date().toLocaleTimeString()}`);
    }
  }, []);

  // ... (useEffect pro fetchInitialData - ten máš víceméně dobře)
  
  // POZOR: V returnu musíš změnit props pro Mapu:
  return (
    <main className="h-screen w-full flex flex-col overflow-hidden text-slate-900">
      <div className="p-4 bg-white shadow-md flex justify-between items-center z-50">
        <div className="flex flex-col">
          <Image
            src="/pokraji_logo.png"
            alt="Logo Knin"
            width={240}
            height={170}
            className="mb-1"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer shadow-sm">
              Menu
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>Team</DropdownMenuItem>
              <DropdownMenuItem>Subscription</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex justify-between items-center bg-white p-3 border-t-2 border-t-primary">
        <span className="text-xl font-bold font-tyrs text-slate-500 mt-1">
          Vzdálenost:{" "}
          <span className="block text-3xl font-fugner text-primary">
            {totalDistance.toFixed(2)} km
          </span>
        </span>
        <Button
          onClick={handleToggleTracking}
          variant={"secondary"}
          size={"lg"}
          className={`px-8 h-12 py-4 rounded-full font-bold text-lg text-white uppercase transition-all shadow-lg ${
            isTracking ? "bg-primary" : "bg-secondary"
          }`}
        >
          {isTracking ? "Ukončit trasu" : "Začít trasu"}
        </Button>
      </div>

      <div className="flex-grow relative">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none w-full px-10 text-center">
          <div className="inline-block bg-black/80 text-white px-4 py-2 rounded-full text-[10px] font-mono backdrop-blur-md border border-white/20 shadow-2xl">
            {debugMsg}
          </div>
        </div>
        {!loading && (
          <MapWithNoSSR
            routeCoordinates={route}
            userLocation={userLocation}
            segments={segments}
          />
        )}
      </div>
    </main>
  );
}

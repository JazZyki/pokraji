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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [userPath, setUserPath] = useState<TrackPoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string>("Čekám na GPS...");
  const lastSavedPos = useRef<{ lat: number; lon: number } | null>(null);

  const totalDistance = userPath.reduce((acc, point, idx) => {
    if (idx === 0) return 0;
    const prev = userPath[idx - 1];
    return (
      acc +
      calculateDistance(
        prev.coords[0],
        prev.coords[1],
        point.coords[0],
        point.coords[1]
      )
    );
  }, 0);

  const saveLocation = useCallback(async (lat: number, lon: number) => {
    const teamId = localStorage.getItem("knin_team_id");
    if (!teamId) return;

    const { data, error } = await supabase.rpc("track_team_location", {
      t_id: teamId,
      lat_val: lat,
      lon_val: lon,
    });

    if (error) {
      setDebugMsg(`❌ Chyba DB: ${error.message}`);
    } else if (data) {
      setUserPath((prev) => [...prev, { coords: [lat, lon], dist: data.dist }]);
      if (data.is_off) {
        setDebugMsg(`❗ MIMO TRASU! (${Math.round(data.dist)}m)`);
      } else {
        setDebugMsg(`✅ Uloženo: ${new Date().toLocaleTimeString()}`);
      }
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const teamId = localStorage.getItem("knin_team_id");
        const { data: routeData } = await supabase
          .from("route_display")
          .select("geojson_data")
          .maybeSingle();

        if (routeData?.geojson_data) {
          const geojson = routeData.geojson_data as unknown as GeoJSONPath;
          setRoute(geojson.coordinates.map(([lon, lat]) => [lat, lon]));
        }

        if (teamId) {
          const { data: history, error: histError } = await supabase
            .from("team_tracking")
            .select("lat_val, lon_val, distance_from_route")
            .eq("team_id", teamId)
            .order("created_at", { ascending: true });

          if (!histError && history && history.length > 0) {
            const historyPoints: TrackPoint[] = history.map((h) => ({
              coords: [h.lat_val, h.lon_val],
              dist: h.distance_from_route || 0,
            }));
            setUserPath(historyPoints);
            const lastPoint = historyPoints[historyPoints.length - 1].coords;
            setUserLocation(lastPoint);
            lastSavedPos.current = { lat: lastPoint[0], lon: lastPoint[1] };
          }
        }
      } catch {
        setDebugMsg("❌ Chyba při načítání dat");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!isTracking || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 100) return;

        const newPos: [number, number] = [latitude, longitude];
        setUserLocation(newPos);

        let shouldSave = false;
        if (!lastSavedPos.current) {
          shouldSave = true;
        } else {
          const dist = Math.sqrt(
            Math.pow(latitude - lastSavedPos.current.lat, 2) +
              Math.pow(longitude - lastSavedPos.current.lon, 2)
          );
          if (dist > 0.00007) shouldSave = true;
        }

        if (shouldSave) {
          saveLocation(latitude, longitude);
          lastSavedPos.current = { lat: latitude, lon: longitude };
        }
      },
      (error) => setDebugMsg(`❌ GPS Error: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking, saveLocation]);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
          setDebugMsg("🔒 Režim aplikace: Aktivní");
        }
      } catch (error) {
        if (error instanceof Error) {
          setDebugMsg(`⚠️ WakeLock selhal: ${error.message}`);
        }
      }
    };

    if (isTracking) requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    };
  }, [isTracking]);

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <SokolLoader />
      </div>
    );

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
          onClick={() => setIsTracking(!isTracking)}
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
            userPathWithDist={userPath}
          />
        )}
      </div>
    </main>
  );
}

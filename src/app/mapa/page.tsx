"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

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
      <div className="p-10 text-center font-bold">Načítám mapu a trasu...</div>
    );

  return (
    <main className="h-screen w-full flex flex-col overflow-hidden text-slate-900">
      <div className="p-4 bg-white shadow-md z-10 flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-green-700 tracking-tight leading-none">
            Nový Knín Trek
          </h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Vzdálenost:{" "}
            <span className="text-slate-800">
              {totalDistance.toFixed(2)} km
            </span>
          </span>
        </div>
        <button
          onClick={() => setIsTracking(!isTracking)}
          className={`px-8 py-2 rounded-full font-black text-sm text-white transition-all shadow-lg active:scale-95 ${
            isTracking
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isTracking ? "STOP" : "START TREK"}
        </button>
      </div>

      <div className="flex-grow relative">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none w-full px-10 text-center">
          <div className="inline-block bg-black/80 text-white px-4 py-2 rounded-full text-[10px] font-mono backdrop-blur-md border border-white/20 shadow-2xl">
            {debugMsg}
          </div>
        </div>
        <MapWithNoSSR
          routeCoordinates={route}
          userLocation={userLocation}
          userPathWithDist={userPath}
        />
      </div>
    </main>
  );
}

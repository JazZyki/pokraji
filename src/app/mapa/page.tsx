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

export default function MapPage() {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [userPath, setUserPath] = useState<[number, number][]>([]);
  const [isTracking, setIsTracking] = useState(false);

  // Ref pro uchování poslední uložené pozice (aby se neukládalo každou vteřinu)
  const lastSavedPos = useRef<{ lat: number; lon: number } | null>(null);

  const saveLocation = useCallback(async (lat: number, lon: number) => {
    const teamId = localStorage.getItem("knin_team_id");
    if (!teamId) return;

    const { data, error } = await supabase.rpc("track_team_location", {
      t_id: teamId,
      lat_val: lat,
      lon_val: lon,
    });

    if (error) console.error("Chyba při ukládání:", error);

    if (data?.is_off) {
      console.warn("Jsi mimo trasu!");
    }
  }, []);

  // 1. Načtení referenční trasy (ihned po startu)
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const { data, error } = await supabase
          .from("route_display")
          .select("geojson_data")
          .maybeSingle();

        if (error) throw error;

        if (data && data.geojson_data) {
          const geojson = data.geojson_data as unknown as GeoJSONPath;
          const coords = geojson.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
          );
          setRoute(coords);
        }
      } catch (err) {
        console.error("Chyba při načítání:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoute();
  }, []);

  // 2. Sledování polohy (jen když je isTracking = true)
  useEffect(() => {
    if (!isTracking || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 50) return; // Ignorujeme nepřesné body

        const newPos: [number, number] = [latitude, longitude];
        setUserLocation(newPos);

        // Kontrola, zda jsme se pohnuli o dostatečný kus (cca 5-7 metrů)
        let shouldSave = false;
        if (!lastSavedPos.current) {
          shouldSave = true;
        } else {
          const dist = Math.sqrt(
            Math.pow(latitude - lastSavedPos.current.lat, 2) +
              Math.pow(longitude - lastSavedPos.current.lon, 2)
          );
          if (dist > 0.00005) shouldSave = true;
        }

        if (shouldSave) {
          setUserPath((prev) => [...prev, newPos]);
          saveLocation(latitude, longitude);
          lastSavedPos.current = { lat: latitude, lon: longitude };
        }
      },
      (error) => console.error("GPS Error:", error.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking, saveLocation]);

  if (loading) return <div className="p-10 text-center">Načítám mapu...</div>;

  return (
    <main className="h-screen w-full flex flex-col">
      <div className="p-4 bg-white shadow-md z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold text-green-700 tracking-tight">
          Nový Knín Trek
        </h1>
        <button
          onClick={() => setIsTracking(!isTracking)}
          className={`px-6 py-2 rounded-full font-bold text-sm text-white transition-all shadow-lg ${
            isTracking
              ? "bg-red-500 hover:bg-red-600 active:scale-95"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95"
          }`}
        >
          {isTracking ? "STOP" : "START TREK"}
        </button>
      </div>
      <div className="flex-grow relative">
        <MapWithNoSSR
          routeCoordinates={route}
          userLocation={userLocation}
          userPath={userPath}
        />
      </div>
    </main>
  );
}

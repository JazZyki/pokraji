// src/app/mapa/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react"; // Přidán useCallback
import { supabase } from "@/lib/supabase";

const MapWithNoSSR = dynamic(() => import("@/components/Map"), {
  ssr: false,
});

// Definujeme rozhraní mimo komponentu
interface GeoJSONPath {
  coordinates: [number, number][];
}

export default function MapPage() {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );

  // Zabalíme saveLocation do useCallback, aby mohl být bezpečně v useEffectu
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
      console.warn("NENENE tudy ne, jsi mimo trasu!");
    }
  }, []);

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
          // Nahrazení 'any' za explicitní typování dvojice čísel
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

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          if (latitude === 0 && longitude === 0) return;
          if (accuracy > 100) return;

          setUserLocation([latitude, longitude]);
          saveLocation(latitude, longitude);
        },
        (error) => console.error("GPS:", error.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [saveLocation]); // saveLocation je nyní stabilní díky useCallback

  if (loading)
    return (
      <div className="p-10 text-center text-slate-900">Načítám mapu...</div>
    );

  return (
    <main className="h-screen w-full flex flex-col">
      <div className="p-4 bg-white shadow-md z-10">
        <h1 className="text-xl font-bold text-green-700">
          Nový Knín Trek - Live
        </h1>
      </div>
      <div className="flex-grow relative">
        <MapWithNoSSR routeCoordinates={route} userLocation={userLocation} />
      </div>
    </main>
  );
}

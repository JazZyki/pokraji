"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SokolLoader } from "@/components/SokolLoader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GpxImport } from "@/components/GpxImport";
import { PoiModal } from "@/components/PoiModal";

const MapWithNoSSR = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <SokolLoader />,
});

// Pomocná funkce pro výpočet vzdálenosti
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
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
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

interface TrackPoint {
  coords: [number, number];
  dist: number;
  sessionId?: string;
}

interface TrackSegment {
  points: TrackPoint[];
}

interface GeoJSONData {
  coordinates: [number, number][];
}

interface PoiPoint {
  id: string;
  lat: number;
  lon: number;
  name: string;
  description?: string;
}

export default function MapPage() {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [isTracking, setIsTracking] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string>("Načítám data...");
  const [segments, setSegments] = useState<TrackSegment[]>([]);
  const lastSavedPos = useRef<{ lat: number; lon: number } | null>(null);
  const [poiPoints, setPoiPoints] = useState<PoiPoint[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [selectedPoi, setSelectedPoi] = useState<PoiPoint | null>(null);

  // Výpočet celkové vzdálenosti
  const totalDistance = segments.reduce((acc, segment) => {
    const segmentDist = segment.points.reduce((segAcc, point, idx) => {
      if (idx === 0) return 0;
      const prev = segment.points[idx - 1];
      return (
        segAcc +
        calculateDistance(
          prev.coords[0],
          prev.coords[1],
          point.coords[0],
          point.coords[1],
        )
      );
    }, 0);
    return acc + segmentDist;
  }, 0);

  // Načtení historických dat
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const teamId = localStorage.getItem("knin_team_id");
        if (!teamId) return;

        // 1. Načtení trasy
        const { data: routeData } = await supabase
          .from("route_display")
          .select("geojson_data")
          .maybeSingle();

        if (routeData?.geojson_data) {
          const coords = (routeData.geojson_data as GeoJSONData).coordinates;
          setRoute(coords.map(([lon, lat]: [number, number]) => [lat, lon]));
        }

        // 2. Načtení historie tras týmu
        const { data: history, error: histError } = await supabase
          .from("team_tracking")
          .select("lat_val, lon_val, distance_from_route, session_id")
          .eq("team_id", teamId)
          .order("created_at", { ascending: true });

        if (history && !histError) {
          const grouped = history.reduce(
            (acc: { [key: string]: TrackPoint[] }, h) => {
              const sId = h.session_id || "old_session";
              if (!acc[sId]) acc[sId] = [];
              acc[sId].push({
                coords: [h.lat_val, h.lon_val],
                dist: h.distance_from_route || 0,
                sessionId: sId,
              });
              return acc;
            },
            {},
          );

          const { data: pois } = await supabase.from("poi_points").select("*");

          if (pois) setPoiPoints(pois);

          const newSegments = Object.values(grouped).map((points) => ({
            points,
          }));
          setSegments(newSegments);

          if (newSegments.length > 0) {
            const lastPoints = newSegments[newSegments.length - 1].points;
            if (lastPoints.length > 0) {
              const lastP = lastPoints[lastPoints.length - 1];
              setUserLocation(lastP.coords);
              lastSavedPos.current = {
                lat: lastP.coords[0],
                lon: lastP.coords[1],
              };
            }
          }

          // 4. Načtení progresu týmu (přidej toto):
          const { data: progress } = await supabase
            .from("team_poi_progress")
            .select("poi_id")
            .eq("team_id", teamId);

          if (progress) {
            const ids = new Set(progress.map((p) => p.poi_id));
            setUnlockedIds(ids);
          }
        }
        setDebugMsg("GPS připravena");
      } catch {
        setDebugMsg("❌ Chyba při inicializaci");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Funkce pro odeslání polohy
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

    if (!error && data) {
      const newPoint: TrackPoint = {
        coords: [lat, lon],
        dist: data.dist,
        sessionId,
      };
      setSegments((prev) => {
        const updated = [...prev];
        if (updated.length === 0) updated.push({ points: [] });
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          points: [...updated[lastIdx].points, newPoint],
        };
        return updated;
      });
      setDebugMsg(
        data.is_off
          ? `❗ MIMO TRASU (${Math.round(data.dist)}m)`
          : `✅ OK: ${new Date().toLocaleTimeString()}`,
      );
    }
  }, []);

  // Toggle sledování
  const handleToggleTracking = () => {
    if (!isTracking) {
      const newSessionId = crypto.randomUUID();
      localStorage.setItem("current_session_id", newSessionId);
      setSegments((prev) => [...prev, { points: [] }]);
      setIsTracking(true);
      setDebugMsg("🛰️ Vyhledávám signál...");
    } else {
      localStorage.removeItem("current_session_id");
      setIsTracking(false);
      setDebugMsg("Trasa ukončena");
    }
  };

  // Watch Position (GPS)
  useEffect(() => {
  if (!isTracking) return;

  const watchId = navigator.geolocation.watchPosition(
    async (pos) => { // Přidáno async
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy > 80) return; // V lese buďme trochu tolerantnější

      setUserLocation([latitude, longitude]);

      // --- KONTROLA POI ---
      // Použijeme for...of místo forEach pro lepší práci s async/await
      for (const poi of poiPoints) {
        const dist = calculateDistance(latitude, longitude, poi.lat, poi.lon) * 1000;

        if (dist <= 60) { // Zvětšeno na 60m pro jistotu
          const teamId = localStorage.getItem("knin_team_id");
          
          // Zápis do DB - pokud projde, aktualizujeme stav
          const { error } = await supabase
            .from("team_poi_progress")
            .insert({ team_id: teamId, poi_id: poi.id });

          // Pokud není chyba (nebo už tam záznam je), přidáme do Setu
          if (!error || (error && 'code' in error && error.code === '23505')) {
            setUnlockedIds((prev) => {
              if (prev.has(poi.id)) return prev;
              const next = new Set(prev);
              next.add(poi.id);
              return next;
            });
            setDebugMsg(`📍 ODEMČENO: ${poi.name}`);
          } else {
            console.error("Chyba při odemykání POI:", error);
          }
        }
      }

      // --- UKLÁDÁNÍ TRASY ---
      let shouldSave = false;
      if (!lastSavedPos.current) {
        shouldSave = true;
      } else {
        const d = Math.sqrt(
          Math.pow(latitude - lastSavedPos.current.lat, 2) +
          Math.pow(longitude - lastSavedPos.current.lon, 2)
        );
        if (d > 0.00008) shouldSave = true;
      }

      if (shouldSave) {
        saveLocation(latitude, longitude);
        lastSavedPos.current = { lat: latitude, lon: longitude };
      }
    },
    (err) => setDebugMsg(`❌ GPS: ${err.message}`),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}, [isTracking, poiPoints, saveLocation]);

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <SokolLoader />
      </div>
    );

  return (
    <main className="h-screen w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white shadow-md flex justify-between items-center z-50">
        <Image
          src="/pokraji_logo.png"
          alt="Logo"
          width={200}
          height={100}
          priority
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="px-4 py-2 border rounded-md shadow-sm">
            Menu
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => window.location.reload()}>
              Obnovit mapu
            </DropdownMenuItem>

            {/* GpxImport už v sobě má div, který se v MenuItemu bude chovat správně */}
            <GpxImport onImportComplete={() => window.location.reload()} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info bar */}
      <div className="flex justify-between items-center bg-white p-3 border-t-2 border-primary">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase">
            Vzdálenost
          </span>
          <span className="text-3xl font-bold text-primary">
            {totalDistance.toFixed(2)} km
          </span>
        </div>
        <Button
          onClick={handleToggleTracking}
          variant={isTracking ? "destructive" : "secondary"}
          className="px-8 h-12 rounded-full font-bold shadow-lg uppercase"
        >
          {isTracking ? "Ukončit trasu" : "Začít trasu"}
        </Button>
      </div>

      {/* Map Container */}
      <div className="grow relative bg-slate-200">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000 w-full px-10 text-center pointer-events-none">
          <div className="inline-block bg-black/70 text-white px-4 py-1 rounded-full text-[10px] backdrop-blur-md border border-white/20">
            {debugMsg}
          </div>
        </div>
        <PoiModal 
      poi={selectedPoi}
      isOpen={!!selectedPoi}
      onClose={() => setSelectedPoi(null)}
      isUnlocked={selectedPoi ? unlockedIds.has(selectedPoi.id) : false}
    />
        <MapWithNoSSR
          routeCoordinates={route}
          userLocation={userLocation}
          segments={segments}
          poiPoints={poiPoints}
          unlockedIds={unlockedIds}
          onPoiClick={(poi) => setSelectedPoi(poi)}
        />
      </div>
    </main>
  );
}

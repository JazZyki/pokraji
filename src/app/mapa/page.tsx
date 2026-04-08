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
import { useRouter } from "next/navigation";

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
  created_at?: string;
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
  const isTrackingRef = useRef(isTracking);
  const router = useRouter();
  const [elapsedTime, setElapsedTime] = useState(0);
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTracking) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTracking]);

  // Pomocná funkce pro formátování času (HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

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
    const teamId = localStorage.getItem("knin_team_id");
    if (!teamId) {
      router.push("/");
      return;
    }
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
          .select(
            "lat_val, lon_val, distance_from_route, session_id, created_at",
          )
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
                created_at: h.created_at,
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
          const { data: progress, error: progressError } = await supabase
            .from("team_poi_progress")
            .select("poi_id")
            .eq("team_id", teamId);

          if (progressError) {
            setDebugMsg(`❌ Chyba načítání POI: ${progressError.message}`);
          }

          if (progress) {
            console.log("Načtené POI z DB:", progress);
            const ids = new Set(progress.map((p) => String(p.poi_id))); // Jistota stringu
            setUnlockedIds(ids);
          }

          let totalSecondsFromHistory = 0;

          Object.values(grouped).forEach((points: TrackPoint[]) => {
            if (points.length > 1) {
              // Předpokládáme, že body mají property 'created_at' z DB
              // Pokud ji nemáš v interface TrackPoint, přidej ji tam.
              const start = new Date(points[0].created_at || "").getTime();
              const end = new Date(
                points[points.length - 1].created_at || "",
              ).getTime();
              totalSecondsFromHistory += Math.floor((end - start) / 1000);
            }
          });

          setElapsedTime(totalSecondsFromHistory);
        }
        setDebugMsg("GPS připravena");
      } catch {
        setDebugMsg("❌ Chyba při inicializaci");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [router]);

  const calculatePace = () => {
            if (totalDistance === 0 || elapsedTime === 0) return "--:--";

            // Celkový čas v minutách děleno vzdáleností
            const paceDecimal = elapsedTime / 60 / totalDistance;
            const mins = Math.floor(paceDecimal);
            const secs = Math.round((paceDecimal - mins) * 60);

            return `${mins}:${secs.toString().padStart(2, "0")}`;
          };

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.error("WakeLock failed", err);
      }
    };

    if (isTracking) requestWakeLock();

    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [isTracking]);

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
      localStorage.setItem("current_session_id", newSessionId); // Zápis
      setSegments((prev) => [...prev, { points: [] }]);
      setIsTracking(true);
      isTrackingRef.current = true; // Okamžitá aktualizace Refu
      setDebugMsg("🛰️ Startuji GPS...");
    } else {
      localStorage.removeItem("current_session_id");
      setIsTracking(false);
      isTrackingRef.current = false;
      setDebugMsg("Trasa ukončena");
    }
  };

  // Watch Position (GPS)
  // 2. UPRAVENÝ GPS EFFECT
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation([latitude, longitude]);

        if (poiPoints.length > 0) {
          for (const poi of poiPoints) {
            // Pokud už je v Setu (odemčený), přeskočíme ho
            if (unlockedIds.has(String(poi.id))) continue;

            const distToPoi =
              calculateDistance(latitude, longitude, poi.lat, poi.lon) * 1000;

            // Tolerance 100 metrů pro spolehlivost v terénu
            if (distToPoi <= 100) {
              const teamId = localStorage.getItem("knin_team_id");
              if (teamId) {
                const { error } = await supabase
                  .from("team_poi_progress")
                  .insert({ team_id: teamId, poi_id: poi.id });

                // Pokud insert projde (nebo už tam je - code 23505), odemkneme v aplikaci
                if (!error || (error && error.code === "23505")) {
                  setUnlockedIds((prev) => new Set([...prev, String(poi.id)]));
                  setDebugMsg(`🌟 BOD ODEMČEN: ${poi.name}`);
                } else {
                  console.error("Chyba při ukládání POI:", error);
                }
              }
            }
          }
        }

        if (!isTrackingRef.current) return;

        // ZMÍRNĚNÍ PODMÍNKY: Pokud ladíš, dej sem klidně 300, ať vidíš, že to běží
        if (accuracy > 150) {
          setDebugMsg(`Slabý signál: ${Math.round(accuracy)}m`);
          return;
        }

        setDebugMsg("✅ Sleduji a ukládám...");

        // Logika uložení
        const teamId = localStorage.getItem("knin_team_id");
        const sId = localStorage.getItem("current_session_id");

        if (teamId && sId) {
          let shouldSave = false;
          if (!lastSavedPos.current) {
            shouldSave = true;
          } else {
            const d =
              calculateDistance(
                lastSavedPos.current.lat,
                lastSavedPos.current.lon,
                latitude,
                longitude,
              ) * 1000;
            if (d >= 10) shouldSave = true;
          }

          if (shouldSave) {
            // Voláme přímo RPC přes Supabase pro test, zda to projde
            const { data, error } = await supabase.rpc("track_team_location", {
              t_id: teamId,
              lat_val: latitude,
              lon_val: longitude,
              s_id: sId,
            });

            if (!error && data) {
              lastSavedPos.current = { lat: latitude, lon: longitude };
              // Aktualizace stavu pro mapu
              const newPoint: TrackPoint = {
                coords: [latitude, longitude] as [number, number],
                dist: data.dist,
                sessionId: sId,
              };
              setSegments((prev) => {
                const copy = [...prev];
                if (copy.length > 0) {
                  copy[copy.length - 1].points.push(newPoint);
                }
                return copy;
              });
            } else if (error) {
              setDebugMsg(`❌ DB Chyba: ${error.message}`);
            }
          }
        }
      },
      (err) => setDebugMsg(`❌ GPS Error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [poiPoints, unlockedIds]); // ODEBRÁNO saveLocation ze závislostí!

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
      <div className="flex justify-between items-center bg-white p-3 border-t-2 border-primary shadow-inner">
        <div className="flex gap-4 sm:gap-8">
          {/* Vzdálenost */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
              Vzdálenost
            </span>
            <span className="text-xl font-bold text-primary leading-none">
              {totalDistance.toFixed(2)} <span className="text-xs">km</span>
            </span>
          </div>

          {/* Čas */}
          <div className="flex flex-col border-l border-slate-200 pl-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
              Čistý čas
            </span>
            <span className="text-xl font-bold text-slate-700 leading-none font-mono">
              {formatTime(elapsedTime)}
            </span>
          </div>

          {/* Tempo */}
          <div className="flex flex-col border-l border-slate-200 pl-4 hidden xs:flex">
            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
              Tempo
            </span>
            <span className="text-xl font-bold text-slate-700 leading-none font-mono">
              {calculatePace()} <span className="text-xs">min/km</span>
            </span>
          </div>
        </div>

        <Button
          onClick={handleToggleTracking}
          variant={isTracking ? "destructive" : "secondary"}
          className="px-6 h-10 rounded-full font-bold shadow-md uppercase text-xs"
        >
          {isTracking ? "Pauza" : "Pokračovat"}
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
          isTracking={isTracking}
        />
      </div>
    </main>
  );
}

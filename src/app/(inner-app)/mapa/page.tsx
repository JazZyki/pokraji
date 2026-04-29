"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { SokolLoader } from "@/components/SokolLoader";
import { PoiModal } from "@/components/PoiModal";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTracking, TrackPoint } from "@/lib/TrackingContext";

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

interface GeoJSONData {
  coordinates: [number, number][];
}

interface QuizQuestion {
  q: string;
  a: string[];
  c: number;
}

interface PoiPoint {
  id: string;
  lat: number;
  lon: number;
  name: string;
  description?: string;
  history_text?: string;
  quiz_data?: QuizQuestion | QuizQuestion[] | string; // JSON column from Supabase
}

export default function MapPage() {
  const { 
    isTracking, 
    segments, setSegments, 
    userLocation, 
    elapsedTime, setElapsedTime, 
    debugMsg, setDebugMsg,
    handleToggleTracking 
  } = useTracking();

  const [route, setRoute] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [poiPoints, setPoiPoints] = useState<PoiPoint[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [quizResponses, setQuizResponses] = useState<Record<string, Record<number, number>>>({});
  const [selectedPoi, setSelectedPoi] = useState<PoiPoint | null>(null);
  const router = useRouter();
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    // Najdeme elementy podle ID nebo tagů (v layoutu je musíme označit)
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');

    if (isFullScreen) {
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';
    } else {
      if (header) header.style.display = 'flex';
      if (footer) footer.style.display = 'flex';
    }

    return () => {
      if (header) header.style.display = 'flex';
      if (footer) footer.style.display = 'flex';
    };
  }, [isFullScreen]);

  // Pomocná funkce pro formátování času (HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  // Výpočet celkové vzdálenosti (používáme segments z contextu)
  const totalDistance = segments.reduce((acc, segment) => {
    const segmentDist = segment.points.reduce((segAcc, point, idx) => {
      if (idx === 0) return 0;
      const prev = segment.points[idx - 1];
      const dist = calculateDistance(
        prev.coords[0],
        prev.coords[1],
        point.coords[0],
        point.coords[1],
      );
      // Ignorujeme nereálné skoky (např. > 0.5 km mezi dvěma bezprostředně po sobě jdoucími body)
      if (dist > 0.5) return segAcc;
      return segAcc + dist;
    }, 0);
    return acc + segmentDist;
  }, 0);

  // Načtení historických dat
  useEffect(() => {
    const teamId = localStorage.getItem("knin_team_id");
    console.log("🔍 Inicializace Mapy pro tým:", teamId);
    
    if (!teamId) {
      console.warn("⚠️ Žádné teamId v localStorage, přesměrovávám...");
      router.push("/");
      return;
    }
    
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // 1. Načtení trasy
        const { data: routeData } = await supabase
          .from("route_display")
          .select("geojson_data")
          .maybeSingle();

        if (routeData?.geojson_data) {
          const coords = (routeData.geojson_data as GeoJSONData).coordinates;
          setRoute(coords.map(([lon, lat]: [number, number]) => [lat, lon]));
          console.log("✅ Trasa načtena, počet bodů:", coords.length);
        }

        // 2. Načtení historie jen pokud ještě nemáme segments (např. při prvním loadu)
        if (segments.length === 0) {
          console.log("🛰️ Stahuji historii z team_tracking...");
          const { data: history, error: histError } = await supabase
            .from("team_tracking")
            .select(
              "lat_val, lon_val, distance_from_route, session_id, created_at",
            )
            .eq("team_id", teamId)
            .order("created_at", { ascending: true });

          if (histError) {
            console.error("❌ Chyba při načítání historie:", histError.message);
          }

          if (history && !histError) {
            console.log(`📊 Staženo ${history.length} bodů historie.`);
            
            const processedSegments: { points: TrackPoint[] }[] = [];
            let currentPoints: TrackPoint[] = [];
            let lastTime = 0;
            let lastLat = 0;
            let lastLon = 0;
            let lastSessionId = "";

            history.forEach((h) => {
              const currentTime = new Date(h.created_at).getTime();
              const sId = h.session_id || "missing";
              
              let isNewSegment = false;
              
              if (currentPoints.length === 0) {
                isNewSegment = true;
              } else {
                // Skok 1: Změna ID vycházky (session_id)
                if (sId !== lastSessionId) isNewSegment = true;
                
                // Skok 2: Časová proluka větší než 15 minut mezi body
                if (currentTime - lastTime > 15 * 60 * 1000) isNewSegment = true;
                
                // Skok 3: Nereálná vzdálenost - pokud bod uskočí o více než 1 km
                const distToLast = calculateDistance(lastLat, lastLon, h.lat_val, h.lon_val);
                if (distToLast > 1) isNewSegment = true;
              }
              
              if (isNewSegment && currentPoints.length > 0) {
                processedSegments.push({ points: currentPoints });
                currentPoints = [];
              }
              
              currentPoints.push({
                coords: [h.lat_val, h.lon_val],
                dist: h.distance_from_route || 0,
                sessionId: sId,
                created_at: h.created_at
              });
              
              lastTime = currentTime;
              lastLat = h.lat_val;
              lastLon = h.lon_val;
              lastSessionId = sId;
            });
            
            if (currentPoints.length > 0) {
              processedSegments.push({ points: currentPoints });
            }
            
            console.log("🧩 Zpracované segmenty:", processedSegments.length, processedSegments);
            setSegments(processedSegments);

            let totalSecondsFromHistory = 0;
            processedSegments.forEach((segment) => {
              if (segment.points.length > 1) {
                const start = new Date(segment.points[0].created_at || "").getTime();
                const end = new Date(
                  segment.points[segment.points.length - 1].created_at || "",
                ).getTime();
                totalSecondsFromHistory += Math.floor((end - start) / 1000);
              }
            });

            setElapsedTime(totalSecondsFromHistory);
          }
        }

        // 3. POI Body
        const { data: pois } = await supabase.from("poi_points").select("*");
        if (pois) {
          setPoiPoints(pois);
          console.log("📍 Načteno POI bodů:", pois.length);
        }

        // 4. Progres týmu
        const { data: progress } = await supabase
          .from("team_poi_progress")
          .select("poi_id")
          .eq("team_id", teamId);

        const teamName = localStorage.getItem("knin_team_name") || "";
        const isKrakonos = teamName.toLowerCase() === "krakonos";

        if (progress) {
          const ids = new Set(progress.map((p) => String(p.poi_id)));
          
          // Speciální bypass pro testera (Krakonoš)
          if (isKrakonos && pois) {
            pois.forEach(p => ids.add(String(p.id)));
            console.log("🎅 Krakonoš detekován: Všechny body odemčeny pro testování.");
          }

          setUnlockedIds(ids);
          console.log("🔓 Odemčené body:", ids.size);
        }

        // 5. Načtení odpovědí na kvíz
        const { data: teamData } = await supabase
          .from("teams")
          .select("quiz_responses")
          .eq("id", teamId)
          .maybeSingle();

        if (teamData?.quiz_responses) {
          setQuizResponses(teamData.quiz_responses as Record<string, Record<number, number>>);
          console.log("📝 Načteny předchozí odpovědi na kvíz.");
        }

        setDebugMsg("GPS připravena");
      } catch (err) {
        console.error("🔥 Fatální chyba v fetchInitialData:", err);
        setDebugMsg("❌ Chyba při inicializaci");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [router, segments.length, setElapsedTime, setSegments, setDebugMsg]);

  // POI Proximity Check (provádíme i v Mapa page, protože tady chceme UI feedback)
  useEffect(() => {
    if (!userLocation || poiPoints.length === 0) return;

    const checkPois = async () => {
      const [lat, lon] = userLocation;
      for (const poi of poiPoints) {
        if (unlockedIds.has(String(poi.id))) continue;

        const distToPoi = calculateDistance(lat, lon, poi.lat, poi.lon) * 1000;

        if (distToPoi <= 20) {
          const teamId = localStorage.getItem("knin_team_id");
          if (teamId) {
            const { error } = await supabase
              .from("team_poi_progress")
              .insert({ team_id: teamId, poi_id: poi.id });

            if (!error || (error && "code" in error && error.code === "23505")) {
              setUnlockedIds((prev) => new Set([...prev, String(poi.id)]));
              setDebugMsg(`🌟 BOD ODEMČEN: ${poi.name}`);
              
              // Haptická odezva: dvě krátká zavibrování
              if ("vibrate" in navigator) {
                navigator.vibrate([100, 50, 100]);
              }
            }
          }
        }
      }
    };
    checkPois();
  }, [userLocation, poiPoints, unlockedIds, setDebugMsg]);

  const calculatePace = () => {
    if (totalDistance === 0 || elapsedTime === 0) return "--:--";
    const paceDecimal = elapsedTime / 60 / totalDistance;
    const mins = Math.floor(paceDecimal);
    const secs = Math.round((paceDecimal - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleQuizAnswer = async (poiId: string, qIdx: number, aIdx: number) => {
    const teamId = localStorage.getItem("knin_team_id");
    if (!teamId) return;

    // Aktualizace lokálního stavu
    const newResponses = {
      ...quizResponses,
      [poiId]: {
        ...(quizResponses[poiId] || {}),
        [qIdx]: aIdx
      }
    };
    setQuizResponses(newResponses);

    // Uložení do Supabase
    await supabase
      .from("teams")
      .update({ quiz_responses: newResponses })
      .eq("id", teamId);
  };

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background/70">
        <SokolLoader />
      </div>
    );

  return (
    <main className="h-screen w-full flex flex-col overflow-hidden">
      {/* Info bar */}
      <div className="flex justify-between items-center bg-background p-3 border-t-2 border-primary shadow-inner">
        <div className="flex gap-4 sm:gap-8">
          {/* Vzdálenost */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-def-text uppercase leading-none mb-1">
              Vzdálenost
            </span>
            <span className="text-xl font-bold text-primary leading-none">
              {totalDistance.toFixed(2)} <span className="text-xs">km</span>
            </span>
          </div>

          {/* Čas */}
          <div className="flex flex-col border-l border-slate-200 pl-4">
            <span className="text-[10px] font-bold text-def-text uppercase leading-none mb-1">
              Čistý čas
            </span>
            <span className="text-xl font-bold text-def-text leading-none font-mono">
              {formatTime(elapsedTime)}
            </span>
          </div>

          {/* Tempo */}
          <div className="hidden flex-col border-l border-slate-200 pl-4 xs:flex">
            <span className="text-[10px] font-bold text-def-text uppercase leading-none mb-1">
              Tempo
            </span>
            <span className="text-xl font-bold text-def-text leading-none font-mono">
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
      <div className={`grow relative bg-slate-200 transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-1001' : ''}`}>
        <div className="flex gap-2 absolute top-5 right-5 z-1000 bg-white p-2 rounded-full shadow-md">
           <Button
            onClick={() => setIsFullScreen(!isFullScreen)}
            variant="outline"
            size="icon"
            className="rounded-full size-8"
          >
            {isFullScreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </Button>
        </div>
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
          savedResponses={selectedPoi ? quizResponses[selectedPoi.id] : {}}
          onAnswer={handleQuizAnswer}
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

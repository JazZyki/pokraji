"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Clock, MapPin, Footprints, Calendar } from "lucide-react";
import { SokolLoader } from "@/components/SokolLoader";
import { PoiModal } from "@/components/PoiModal";
import { Footer } from "@/components/Footer";

interface SessionStats {
  id: string;
  distance: number;
  duration: number; // v sekundách
  date: string;
}

interface PoiStats {
  id: string;
  name: string;
  isUnlocked: boolean;
  unlockedAt: string | null; // Přidáno pole pro čas odemčení
}

interface TrackingPoint {
  lat_val: number;
  lon_val: number;
  session_id: string | null;
  created_at: string;
}

interface PoiProgress {
  poi_id: string;
  unlocked_at: string;
}

interface PoiData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
}

interface PoiStats extends PoiData {
  isUnlocked: boolean;
  unlockedAt: string | null;
}

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

export default function StatsPage() {
  const [sessions, setSessions] = useState<SessionStats[]>([]);
  const [pois, setPois] = useState<PoiStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoi, setSelectedPoi] = useState<PoiStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const teamId = localStorage.getItem("knin_team_id");
        if (!teamId) {
          setLoading(false);
          return;
        }

        // 1. Načtení dat
        const [historyRes, poisRes, progressRes] = await Promise.all([
          supabase
            .from("team_tracking")
            .select("lat_val, lon_val, session_id, created_at")
            .eq("team_id", teamId)
            .order("created_at", { ascending: true }),
          supabase
            .from("poi_points")
            .select("id, name, lat, lon, description"),
          supabase
            .from("team_poi_progress")
            .select("poi_id, unlocked_at")
            .eq("team_id", teamId)
        ]);

        // 2. Zpracování historie (vycházek) s inteligentním dělením segmentů
        if (historyRes.data && historyRes.data.length > 0) {
          const processedSessions: SessionStats[] = [];
          let currentPoints: TrackingPoint[] = [];
          let lastTime = 0;
          let lastLat = 0;
          let lastLon = 0;
          let lastSessionId = "";

          historyRes.data.forEach((h) => {
            const currentTime = new Date(h.created_at).getTime();
            const sId = h.session_id || "default";

            let isNewSegment = false;

            if (currentPoints.length === 0) {
              isNewSegment = true;
            } else {
              if (sId !== lastSessionId) isNewSegment = true;
              if (currentTime - lastTime > 15 * 60 * 1000) isNewSegment = true; // Proluka > 15 min
              const distToLast = calculateDistance(lastLat, lastLon, h.lat_val, h.lon_val);
              if (distToLast > 1) isNewSegment = true; // Skok > 1 km
            }

            if (isNewSegment && currentPoints.length > 0) {
              let dist = 0;
              for (let i = 1; i < currentPoints.length; i++) {
                const d = calculateDistance(
                  currentPoints[i - 1].lat_val,
                  currentPoints[i - 1].lon_val,
                  currentPoints[i].lat_val,
                  currentPoints[i].lon_val
                );
                if (d <= 0.5) dist += d; // Ignorování nereálných drobných skoků
              }
              const start = new Date(currentPoints[0].created_at);
              const end = new Date(currentPoints[currentPoints.length - 1].created_at);

              if (dist > 0.005) {
                processedSessions.push({
                  id: (currentPoints[0].session_id || "default") + "_" + start.getTime(),
                  distance: dist,
                  duration: Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)),
                  date: start.toLocaleDateString("cs-CZ"),
                });
              }
              currentPoints = [];
            }

            currentPoints.push(h);
            lastTime = currentTime;
            lastLat = h.lat_val;
            lastLon = h.lon_val;
            lastSessionId = sId;
          });

          // Uložení posledního segmentu
          if (currentPoints.length > 0) {
            let dist = 0;
            for (let i = 1; i < currentPoints.length; i++) {
              const d = calculateDistance(
                currentPoints[i - 1].lat_val,
                currentPoints[i - 1].lon_val,
                currentPoints[i].lat_val,
                currentPoints[i].lon_val
              );
              if (d <= 0.5) dist += d;
            }
            const start = new Date(currentPoints[0].created_at);
            const end = new Date(currentPoints[currentPoints.length - 1].created_at);

            if (dist > 0.005) {
              processedSessions.push({
                id: (currentPoints[0].session_id || "default") + "_" + start.getTime(),
                distance: dist,
                duration: Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)),
                date: start.toLocaleDateString("cs-CZ"),
              });
            }
          }

          setSessions(processedSessions.sort((a, b) => {
            const timeA = parseInt(a.id.split('_').pop() || "0");
            const timeB = parseInt(b.id.split('_').pop() || "0");
            return timeB - timeA;
          }));
        }

        // 3. Zpracování POI
        if (poisRes.data) {
          const progressMap = new Map();
          if (progressRes.data) {
            progressRes.data.forEach(p => {
              progressMap.set(String(p.poi_id).toLowerCase(), p.unlocked_at);
            });
          }

          const mappedPois = poisRes.data.map((p) => {
            const poiIdLower = String(p.id).toLowerCase();
            const unlockedAt = progressMap.get(poiIdLower);
            
            return {
              ...p,
              isUnlocked: progressMap.has(poiIdLower),
              unlockedAt: unlockedAt || null,
            };
          });

          setPois(mappedPois);
        }

      } catch (err) {
        console.error("Kritická chyba StatsPage:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <SokolLoader />;

  return (
    <div className="p-6 space-y-8 pb-20 min-h-full overflow-scroll h-[calc(100vh-18rem)]">
      {/* CELKOVÉ SHRNUTÍ */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-primary text-white p-4 rounded-2xl shadow-lg">
          <Footprints className="mb-2 opacity-80" />
          <p className="text-xs uppercase font-bold opacity-80">Celkem km</p>
          <p className="text-2xl font-bold">
            {sessions.reduce((a, b) => a + b.distance, 0).toFixed(1)} km
          </p>
        </div>
        <div className="bg-secondary p-4 rounded-2xl shadow-md border border-background-2">
          <Trophy className="mb-2 text-slate-200" />
          <p className="text-xs uppercase font-bold text-slate-200">Body</p>
          <p className="text-2xl font-bold text-slate-300">
            {pois.filter((p) => p.isUnlocked).length} / {pois.length}
          </p>
        </div>
      </section>

      {/* SEZNAM VYCHÁZEK */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-def-text flex items-center gap-2">
          <Calendar className="size-5 text-primary" /> Historie vycházek
        </h2>
        {sessions.map((s) => (
          <div
            key={s.id}
            className="bg-background-2 p-4 rounded-xl shadow-sm border border-background flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-primary">{s.date}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1 mb-0">
                <Clock className="size-3" /> {Math.floor(s.duration / 60)} min
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary">
                {s.distance.toFixed(2)} km
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* SBÍRKA POI */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-def-text flex items-center gap-2">
          <MapPin className="size-5 text-primary" /> Sbírka bodů
        </h2>
        <div className="grid grid-cols-2 gap-3 pb-8 text-left uppercase">
          {pois.map((poi) => (
            <div
              key={poi.id}
              onClick={() => setSelectedPoi(poi)}
              className={`p-3 rounded-xl border transition-all flex flex-col justify-start text-sm cursor-pointer active:scale-95 shadow-sm ${
                poi.isUnlocked
                  ? "bg-background-2 border-green-500"
                  : "bg-background-2 border-slate-200 opacity-60"
              }`}
            >
              <div className="flex justify-between items-start">
                <p className={`font-bold mb-0 leading-tight ${poi.isUnlocked ? "text-def-text" : "text-def-text/50"}`}>
                  {poi.isUnlocked ? "✅" : "🔒"} {poi.name}
                </p>
              </div>

              {poi.isUnlocked && (
                 <span className="text-[9px] mt-2 text-green-600 font-medium">ZOBRAZIT INFO</span>
              )}
            </div>
          ))}
        </div>
      </section>
      <PoiModal
        poi={selectedPoi}
        isOpen={!!selectedPoi}
        onClose={() => setSelectedPoi(null)}
        isUnlocked={selectedPoi ? selectedPoi.isUnlocked : false}
      />
      <Footer />
    </div>
  );
}

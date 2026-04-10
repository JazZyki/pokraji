"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Clock, MapPin, Footprints, Calendar } from "lucide-react";
import { SokolLoader } from "@/components/SokolLoader";
import { PoiModal } from "@/components/PoiModal";

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

      // 2. Zpracování historie (vycházek)
      if (historyRes.data && historyRes.data.length > 0) {
        const grouped = historyRes.data.reduce((acc: Record<string, TrackingPoint[]>, curr) => {
          const sId = curr.session_id || "default";
          if (!acc[sId]) acc[sId] = [];
          acc[sId].push(curr);
          return acc;
        }, {});

        const processedSessions = Object.entries(grouped).map(([id, points]) => {
          let dist = 0;
          for (let i = 1; i < points.length; i++) {
            dist += calculateDistance(
              points[i - 1].lat_val,
              points[i - 1].lon_val,
              points[i].lat_val,
              points[i].lon_val
            );
          }
          const start = new Date(points[0].created_at);
          const end = new Date(points[points.length - 1].created_at);

          return {
            id,
            distance: dist,
            duration: Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)),
            date: start.toLocaleDateString("cs-CZ"),
          };
        }).filter(s => s.distance > 0.005);

        setSessions(processedSessions.sort((a, b) => 
          new Date(b.id === 'default' ? 0 : b.date.split('.').reverse().join('-')).getTime() - 
          new Date(a.id === 'default' ? 0 : a.date.split('.').reverse().join('-')).getTime()
        ));
      }

      // 3. Zpracování POI (Zásadní oprava mapování)
      if (poisRes.data) {
        // Vytvoříme Mapu se stringovými klíči pro jistotu
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
              // 4. Přidáno onClick a styly pro klikatelnost
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
    </div>
  );
}

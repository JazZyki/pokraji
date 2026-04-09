"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Clock, MapPin, Footprints, Calendar } from "lucide-react";
import { SokolLoader } from "@/components/SokolLoader";

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

  useEffect(() => {
  const fetchStats = async () => {
    try {
      setLoading(true);
      const teamId = localStorage.getItem("knin_team_id");
      if (!teamId) {
        setLoading(false);
        return;
      }

      // 1. Načtení historie a POI paralelně (rychlejší)
      const [historyRes, poisRes, progressRes] = await Promise.all([
        supabase
          .from("team_tracking")
          .select("lat_val, lon_val, session_id, created_at")
          .eq("team_id", teamId)
          .order("created_at", { ascending: true }),
        supabase
          .from("poi_points")
          .select("id, name"),
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

        const processedSessions = Object.entries(grouped).map(([id, points]: [string, TrackingPoint[]]) => {
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
        }).filter(s => s.distance > 0.005); // Velmi malý filtr, aby se ukázalo skoro vše

        setSessions(processedSessions.reverse());
      }

      // 3. Zpracování POI (Sbírka)
      if (poisRes.data) {
        const progressMap = new Map(
          (progressRes.data || []).map((p: PoiProgress) => [p.poi_id, p.unlocked_at])
        );

        setPois(poisRes.data.map((p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
          isUnlocked: progressMap.has(p.id),
          unlockedAt: progressMap.get(p.id) || null,
        })));
      }

    } catch (err) {
      console.error("Chyba při načítání statistik:", err);
    } finally {
      // TOTO MUSÍ BÝT TADY, aby se loader vypnul vždycky
      setLoading(false);
    }
  };

  fetchStats();
}, []);

  if (loading) return <SokolLoader />;

  return (
    <div className="p-6 space-y-8 pb-20 bg-slate-50 min-h-full overflow-y-auto">
      {/* CELKOVÉ SHRNUTÍ */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-primary text-white p-4 rounded-2xl shadow-lg">
          <Footprints className="mb-2 opacity-80" />
          <p className="text-xs uppercase font-bold opacity-80">Celkem km</p>
          <p className="text-2xl font-bold">
            {sessions.reduce((a, b) => a + b.distance, 0).toFixed(1)} km
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100">
          <Trophy className="mb-2 text-secondary" />
          <p className="text-xs uppercase font-bold text-slate-400">Body</p>
          <p className="text-2xl font-bold text-slate-700">
            {pois.filter((p) => p.isUnlocked).length} / {pois.length}
          </p>
        </div>
      </section>

      {/* SEZNAM VYCHÁZEK */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="size-5 text-primary" /> Historie vycházek
        </h2>
        {sessions.map((s) => (
          <div
            key={s.id}
            className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-slate-700">{s.date}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
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
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MapPin className="size-5 text-primary" /> Odemčené body
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pois.map((poi) => (
            <div
              key={poi.id}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-center ${
                poi.isUnlocked
                  ? "bg-white border-green-500 shadow-sm"
                  : "bg-slate-50 border-slate-200 opacity-60"
              }`}
            >
              <div className="flex justify-between items-start">
                <p
                  className={`font-bold ${poi.isUnlocked ? "text-slate-800" : "text-slate-400"}`}
                >
                  {poi.isUnlocked ? "✅" : "🔒"} {poi.name}
                </p>
              </div>

              {poi.isUnlocked && poi.unlockedAt && (
                <p className="text-[10px] mt-2 text-green-600 font-medium flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(poi.unlockedAt).toLocaleString("cs-CZ", {
                    day: "numeric",
                    month: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

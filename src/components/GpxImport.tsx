"use client";

import { useState } from "react";
import gpxParser from "gpxparser";
import { supabase } from "@/lib/supabase";
import { calculateDistance } from "@/lib/utils";

export function GpxImport({ onImportComplete }: { onImportComplete: () => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const teamId = localStorage.getItem("knin_team_id");
    if (!teamId) {
      alert("Chyba: Tým nebyl nalezen.");
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xml = e.target?.result as string;
        const gpx = new gpxParser();
        gpx.parse(xml);

        // 1. Získání bodů ze všech stop a cest v GPX
        interface GpxPoint {
          lat: number;
          lon: number;
        }
        let allPoints: GpxPoint[] = [];
        
        if (gpx.tracks && gpx.tracks.length > 0) {
          gpx.tracks.forEach(track => {
            allPoints = [...allPoints, ...track.points];
          });
        }
        
        if (allPoints.length === 0 && gpx.routes && gpx.routes.length > 0) {
          gpx.routes.forEach(route => {
            allPoints = [...allPoints, ...route.points];
          });
        }
        
        if (allPoints.length === 0 && gpx.waypoints && gpx.waypoints.length > 0) {
          allPoints = gpx.waypoints.map(p => ({ lat: p.lat, lon: p.lon }));
        }

        if (allPoints.length === 0) throw new Error("GPX neobsahuje žádné body trasy.");

        // 2. KONTROLA POI BODŮ (před proředěním pro přesnost)
        console.log(`📍 Kontrola POI bodů v importovaném GPX (${allPoints.length} bodů)...`);
        const { data: pois } = await supabase.from("poi_points").select("id, lat, lon, name");
        
        if (pois && pois.length > 0) {
          const unlockedPois = new Set<string>();
          
          for (const point of allPoints) {
            for (const poi of pois) {
              if (unlockedPois.has(poi.id)) continue;
              
              const dist = calculateDistance(point.lat, point.lon, poi.lat, poi.lon) * 1000;
              if (dist <= 100) { // Limit 100 metrů
                unlockedPois.add(poi.id);
                console.log(`🌟 Nalezen POI v GPX: ${poi.name}`);
              }
            }
          }

          if (unlockedPois.size > 0) {
            console.log(`💾 Ukládám ${unlockedPois.size} odemčených POI do databáze...`);
            const inserts = Array.from(unlockedPois).map(poiId => ({
              team_id: teamId,
              poi_id: poiId
            }));

            const { error: poiError } = await supabase
              .from("team_poi_progress")
              .upsert(inserts, { onConflict: "team_id, poi_id" });

            if (poiError) console.error("Chyba při ukládání POI progresu:", poiError);
          }
        }

        // 3. PROŘEDĚNÍ BODŮ PRO MAPU/HISTORII
        // Zvýšeno na 5000 pro 50km trasu (1 bod / 10m)
        const maxPoints = 5000;
        const skip = Math.ceil(allPoints.length / maxPoints);
        const trackPoints = skip > 1 
          ? allPoints.filter((_, index) => index % skip === 0) 
          : allPoints;

        const sessionId = crypto.randomUUID();

        // 4. Volání RPC funkce pro uložení trasy
        const { error } = await supabase.rpc("import_gpx_points", {
          t_id: teamId,
          s_id: sessionId,
          points: trackPoints
        });

        if (error) throw error;
        
        alert(`Úspěšně importováno. Trasa má ${trackPoints.length} bodů a bylo automaticky odemčeno nalezené POI.`);
        onImportComplete();
      } catch (err: unknown) {
        console.error("Chyba při importu:", err);
        const errorMessage = err instanceof Error ? err.message : "Chyba importu.";
        alert(errorMessage);
      } finally {
        setUploading(false);
        event.target.value = ""; 
      }
    };
    reader.readAsText(file);
  };

  return (
    <label className="flex items-center w-full cursor-pointer py-1">
      <span className="font-bold uppercase">{uploading ? "Nahrávám..." : "Importovat GPX"}</span>
      <input
        type="file"
        accept=".gpx"
        onChange={handleFileUpload}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
      />
    </label>
  );
}

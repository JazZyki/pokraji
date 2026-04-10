"use client";

import { useState } from "react";
import gpxParser from "gpxparser";
import { supabase } from "@/lib/supabase";
import { Upload } from "lucide-react";

export function GpxImport({ onImportComplete }: { onImportComplete: () => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("onChange event fired!");
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("File picked:", file.name);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xml = e.target?.result as string;
        const gpx = new gpxParser();
        gpx.parse(xml);

        // 1. Získání bodů z GPX (univerzální pro různé formáty)
        interface GpxPoint {
          lat: number;
          lon: number;
          [key: string]: unknown;
        }
        let rawPoints: GpxPoint[] = [];
        if (gpx.tracks?.[0]?.points) rawPoints = gpx.tracks[0].points;
        else if (gpx.routes?.[0]?.points) rawPoints = gpx.routes[0].points;
        else if (gpx.waypoints) rawPoints = gpx.waypoints;

        if (rawPoints.length === 0) throw new Error("GPX neobsahuje žádné body trasy.");

        // 2. Mapování na čistý objekt souřadnic
        const allPoints = rawPoints.map(p => ({ lat: p.lat, lon: p.lon }));

        // 3. PROŘEDĚNÍ BODŮ (Ochrana proti Timeooutu)
        // Cílíme na max 2000 bodů, což je pro mapu i DB ideální
        const maxPoints = 2000;
        const skip = Math.ceil(allPoints.length / maxPoints);
        const trackPoints = skip > 1 
          ? allPoints.filter((_, index) => index % skip === 0) 
          : allPoints;

        console.log(`Původně bodů: ${allPoints.length}, odesílám proředěných: ${trackPoints.length}`);

        const teamId = localStorage.getItem("knin_team_id");
        const sessionId = crypto.randomUUID();

        // 4. Volání RPC funkce
        const { error } = await supabase.rpc("import_gpx_points", {
          t_id: teamId,
          s_id: sessionId,
          points: trackPoints
        });

        if (error) throw error;
        
        alert(`Úspěšně importováno ${trackPoints.length} bodů (z původních ${allPoints.length}).`);
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
    <>
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
    </>

  );
}


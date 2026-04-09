"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookOpen, Map as MapIcon } from "lucide-react";

export default function InfoPage() {
  const router = useRouter();

  const handleGoToMap = () => {
    // Označíme si, že uživatel už info viděl
    localStorage.setItem("knin_info_seen", "true");
    router.push("/mapa");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-md p-8 space-y-6">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <BookOpen className="size-8" /> Informace o soutěži
        </h1>
        
        <div className="prose prose-slate">
          <p>Vítejte na trase Sokol Nový Knín! Zde jsou základní pravidla:</p>
          <ul>
            <li>Sledujte žlutou trasu na mapě.</li>
            <li>Procházejte červené POI body pro jejich odemknutí.</li>
            <li>Mimo trasu vás aplikace upozorní červeným nápisem.</li>
            <li>Pauzy můžete dělat libovolně, čistý čas se sčítá.</li>
          </ul>
        </div>

        <Button onClick={handleGoToMap} className="w-full h-14 text-lg font-bold gap-2">
          rozumím, přejít na mapu <MapIcon />
        </Button>
      </div>
    </div>
  );
}
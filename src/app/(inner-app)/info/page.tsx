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
    <div className="min-h-screen p-6 flex flex-col items-center">
        <h1 className="w-full text-3xl font-bold text-def-text flex items-center justify-center gap-4 mb-6 border-b-2 border-def-text pb-2">
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

        <Button 
        variant="default"
        size="lgx"
        onClick={handleGoToMap} 
        >
          <MapIcon size={24} /> rozumím, přejít na mapu 
        </Button>
    </div>
  );
}
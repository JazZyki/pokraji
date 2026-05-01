"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookOpen, Map as MapIcon, FileText } from "lucide-react";

export default function InfoPage() {
  const router = useRouter();

  const handleGoToMap = () => {
    // Označíme si, že uživatel už info viděl
    localStorage.setItem("knin_info_seen", "true");
    router.push("/mapa");
  };

  return (
    <div className="p-6 space-y-8 pb-25 min-h-full overflow-scroll h-[calc(100vh-18rem)]">
        <h1 className="w-full text-primary text-3xl font-bold flex items-center justify-center gap-4 mb-6 border-b-2 border-secondary pb-2">
          <BookOpen className="size-8" /> Informace o soutěži
        </h1>
        
        <div className="prose prose-slate">
          <p>Vítejte v aplikaci PoKraji, kterou pro Vás připravil Sokol Nový Knín. Zde jsou základní pravidla:</p>
          <ul>
            <li>sledujte tmavě modrou trasu na mapě. To je reálná hranice Nového Knína. Trasu, kterou bude potřeba sledovat, nahrajeme po absolvování úvodního výletu, který se koná 2.-3. května.</li>
            <li>procházejte červené body (POI) pro jejich odemknutí. Citlivost POI je nastavena na 20 m.</li>
            <li>Pokud se budete oddalovat od vytyčené trasy, čára, která sleduje vaši trasu zoranžoví</li>
            <li>Pokud budete mimo trasu, aplikace Vás upozorní tím, že čára sledující vaši trasu zčervená</li>
            <li>Pauzy si můžete dělat libovolně, důležité je co nejpresnější kopírování vyznačené, tmavomodré, trasy.</li>
            <li>Po odemčení každého POI je možné si tapem na bod, nebo v sekci &quot;Moje statistiky&quot;, zobrazit zajímavosti o daném bodě a malý kvíz. Není ale určitě potřeba kvíz vyplňovat ihned. Dejte si čas a vyplňte jej až tehdy, kdy budete znát odpovědi.</li>
            <li>Aplikace je potřeba, aby běžela sama. V průběhu trasování doporučujeme nepřepínat v telefonu na jiné aplikace. Pokud k tomu dojde, začne se aplikace samovolně uspávat a tím pádem přestane trackovat pozici.</li>
            <li>Doporučujeme mít k dispozici i jinou trasovací aplikaci, která poběží paralelně (nebo i u jiného člena týmu). Následně je možné do účtu týmu importovat data z této aplikace. V případě komplikací nepřijdete o svou trasu.</li>
            <li>Do chatu můžete psát poznámky k jednotlivým úsekům (např. že na poli je bláto a doporučujete jej obejít), nebo můžete vkládat obrázky / fotit. Ale pamatujte, že vše uvidí všichni uživatelé.</li>
            <li>Na delší úseky doporučujeme přibalit powerbanku :-)</li>
          </ul>
        </div>

        <Button
          variant="outline"
          size="lgx"
          onClick={() => window.open("/pokraji-navod.pdf", "_blank")}
          className="mt-6">
            <FileText className="size-5" /> Stáhnout návod (PDF)
          </Button>
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
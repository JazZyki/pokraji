"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Users, Play, Map as MapIcon, Download, Search } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SokolText } from "@/components/SokolText";
import { SokolLoader } from "@/components/SokolLoader";
import { Footer } from "@/components/Footer";

// Rozhraní pro událost instalace (PWA)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

// Rozhraní pro iOS specifické vlastnosti navigátoru
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

export default function RegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState("");
  const [loading, setLoading] = useState(true);
  const [existingTeam, setExistingTeam] = useState<{
    id: string;
    name: string;
    members: string[];
  } | null>(null);

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from("teams")
      .select("id, team_name")
      .ilike("team_name", teamName)
      .maybeSingle();

    if (error) {
      alert("Chyba při hledání týmu: " + error.message);
      setLoading(false);
      return;
    }

    if (data) {
      document.cookie = `knin_team_id=${data.id}; path=/; max-age=86400; SameSite=Lax`;
      localStorage.setItem("knin_team_id", data.id);
      localStorage.setItem("knin_team_name", data.team_name);
      
      // Místo na mapu jdeme na info
      router.push("/info"); 
    } else {
      alert("Tým s tímto názvem nebyl nalezen.");
      setLoading(false);
    }
  };

 useEffect(() => {
    // 1. FUNKCE PRO KONTROLU REGISTRACE (Asynchronní)
    const checkExistingRegistration = async () => {
      const savedId = localStorage.getItem("knin_team_id");
      const infoSeen = localStorage.getItem("knin_info_seen");

      if (savedId) {
        // Pokud uživatel už má tým A ZÁROVEŇ už viděl info, pošli ho rovnou na mapu
        if (infoSeen === "true") {
          router.push("/mapa");
          return;
        }

        const { data, error } = await supabase
          .from("teams")
          .select("id, team_name, members")
          .eq("id", savedId)
          .single();

        if (data && !error) {
          setExistingTeam({
            id: data.id,
            name: data.team_name,
            members: data.members || [],
          });
        }
      }
      setLoading(false);
    };

    // 2. DETEKCE INSTALACE (PWA)
    // Zjistíme, jestli aplikace běží v režimu "na ploše"
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as NavigatorStandalone).standalone === true;

    // Použijeme requestAnimationFrame, aby React mohl dokončit render
    // a až pak změnil stav pro tlačítko (řeší to tvůj error s kaskádou)
    requestAnimationFrame(() => {
      if (!isStandalone) {
        setShowInstallBtn(true);
      }
    });

    // 3. EVENT LISTENER PRO ANDROID/CHROME
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Pokud prohlížeč vyhodí prompt, ujistíme se, že tlačítko vidíme
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. SPUŠTĚNÍ KONTROLY DATABÁZE
    checkExistingRegistration();

    // CLEANUP (Odstranění listeneru při odchodu ze stránky)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [router]);

  // --- ÚPRAVA 3: REGISTRACE ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .insert([
        {
          team_name: teamName,
          members: members.split(",").map((m) => m.trim()),
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Chyba při registraci: " + error.message);
      setLoading(false);
      return;
    }
    localStorage.setItem("knin_team_id", data.id);
    localStorage.setItem("knin_team_name", data.team_name);
    
    // Nový tým jde vždy nejdříve na info
    router.push("/info");
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowInstallBtn(false);
      }
    } else {
      alert(
        "Pro instalaci na iPhone: Klikněte na tlačítko sdílení (čtvereček s šipkou nahoru) a vyberte 'Přidat na plochu'.",
      );
    }
  };

  const handleLogout = () => {
    if (confirm("Opravdu chcete odhlásit tým?")) {
      localStorage.clear();
      setExistingTeam(null);
    }
  };

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background/70">
        <SokolLoader />
      </div>
    );

  return (
    <div className="min-h-screen bg-secondary/80 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-6">
          <Image
            src="/pokraji_logo.png"
            alt="PoTrati Sokol Nový Knín"
            width={277}
            height={71}
            className="w-full h-auto mb-6 object-contain"
          />
        </div>
        <div className="flex flex-col gap-6">
          {showInstallBtn && (
            <Button onClick={handleInstallClick} variant="outline" size="lg">
              <Download className="size-4" /> INSTALOVAT JAKO APLIKACI
            </Button>
          )}

          {existingTeam ? (
            <div className="text-center space-y-6 py-2">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Tým připraven
                </p>
                <h2 className="text-3xl text-secondary font-black">
                  <SokolText text={existingTeam.name} />
                </h2>
              </div>
              <div className="bg-slate-100 rounded-lg p-4 border border-slate-100">
                <div className="flex flex-wrap justify-center gap-2">
                  {existingTeam.members.map((m, i) => (
                    <span
                      key={i}
                      className="bg-white px-3 py-1 rounded-full text-sm shadow-sm border-2 border-secondary/90 text-secondary/90 font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => router.push("/mapa")}
                  variant={"secondary"}
                  size={"lg"} // Opraveno z lgx
                  className="w-full gap-2"
                >
                  <MapIcon className="size-5" /> VSTOUPIT DO MAPY
                </Button>
                <Button onClick={handleLogout} variant={"ghost"} size={"lg"}>
                  Odhlásit tým
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex bg-slate-200 p-1 rounded-xl">
                <button
                  onClick={() => setMode("register")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                    mode === "register"
                      ? "bg-secondary shadow-sm text-white"
                      : "text-slate-500"
                  }`}
                >
                  NOVÝ TÝM
                </button>
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                    mode === "login"
                      ? "bg-secondary shadow-sm text-white"
                      : "text-slate-500"
                  }`}
                >
                  MÁM TÝM
                </button>
              </div>

              <form
                onSubmit={mode === "register" ? handleRegister : handleLogin}
                className="space-y-6"
              >
                <p className="text-slate-500 text text-center font-bold">
                  {mode === "register"
                    ? "Zaregistruj tým a vyraz na 50km trasu!"
                    : "Zadej přesný název týmu pro pokračování."}
                </p>

                <div className="space-y-4">
                  <input
                    required
                    className="w-full p-3 border-2 border-secondary text-slate-700 rounded-xl focus:ring-2 focus:ring-secondary outline-none"
                    placeholder="Název týmu"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />

                  {mode === "register" && (
                    <div className="relative">
                      <Users className="absolute left-3 top-3.5 text-secondary size-5" />
                      <input
                        required
                        className="w-full p-3 pl-10 border-2 border-secondary text-slate-700 rounded-xl focus:ring-2 focus:ring-secondary outline-none"
                        placeholder="Jan, Marie, Petr..."
                        value={members}
                        onChange={(e) => setMembers(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <Button
                  disabled={loading}
                  type="submit" // KLÍČOVÉ: Zajistí spuštění onSubmit formuláře
                  variant={"secondary"}
                  size={"lg"} // Změněno z lgx na lg (pokud nemáš lgx definované v button.tsx)
                  className="w-full gap-2" // Přidáno pro jistotu šířky a mezery mezi ikonou a textem
                >
                  {loading ? (
                    <SokolLoader /> // Nebo jen text "Načítám..."
                  ) : mode === "register" ? (
                    <>
                      <Play className="size-5" /> START DOBRODRUŽSTVÍ
                    </>
                  ) : (
                    <>
                      <Search className="size-5" /> NAJÍT MŮJ TÝM
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

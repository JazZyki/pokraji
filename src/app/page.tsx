"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Users, Play, Map as MapIcon, Download } from "lucide-react";

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

  useEffect(() => {
    const checkExistingRegistration = async () => {
      const savedId = localStorage.getItem("knin_team_id");
      if (savedId) {
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

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBtn(true);
    };

    // Detekce standalone režimu bez použití 'any'
    const nav = window.navigator as NavigatorStandalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone;

    if (!isStandalone) {
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setTimeout(() => setShowInstallBtn(true), 100);
      }
    }

    checkExistingRegistration();

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
  }, []);

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
        "Pro instalaci na iPhone: Klikněte na tlačítko sdílení (čtvereček s šipkou nahoru) a vyberte 'Přidat na plochu'."
      );
    }
  };

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
    router.push("/mapa");
  };

  const handleLogout = () => {
    if (confirm("Opravdu chcete odhlásit tým?")) {
      localStorage.clear();
      setExistingTeam(null);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-green-700">
        Načítám...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <h1 className="text-3xl font-black text-center mb-2 text-green-700 tracking-tight italic">
          NOVÝ KNÍN TREK
        </h1>

        {showInstallBtn && (
          <button
            onClick={handleInstallClick}
            className="mb-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 transition-all active:scale-95"
          >
            <Download className="size-4" /> INSTALOVAT JAKO APLIKACI
          </button>
        )}

        {existingTeam ? (
          <div className="text-center space-y-6 py-2">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Tým připraven
              </p>
              <h2 className="text-3xl font-black text-slate-800 uppercase">
                {existingTeam.name}
              </h2>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex flex-wrap justify-center gap-2">
                {existingTeam.members.map((m, i) => (
                  <span
                    key={i}
                    className="bg-white px-3 py-1 rounded-full text-sm shadow-sm border border-slate-200 text-slate-600 font-medium"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/mapa")}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95"
              >
                <MapIcon className="size-5" /> VSTOUPIT DO MAPY
              </button>
              <button
                onClick={handleLogout}
                className="text-[10px] text-slate-300 hover:text-red-500 uppercase font-bold tracking-tighter transition-colors"
              >
                Odhlásit tým
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6">
            <p className="text-slate-500 text-sm text-center">
              Zaregistruj tým a vyraz na 50km trasu!
            </p>
            <div className="space-y-4">
              <input
                required
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="Název týmu"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <div className="relative">
                <Users className="absolute left-3 top-3.5 text-slate-400 size-5" />
                <input
                  required
                  className="w-full p-3 pl-10 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Jan, Marie, Petr..."
                  value={members}
                  onChange={(e) => setMembers(e.target.value)}
                />
              </div>
            </div>
            <button
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              <Play className="size-5" /> START DOBRODRUŽSTVÍ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

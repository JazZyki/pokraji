// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Users, Play, Map as MapIcon, LogOut } from "lucide-react";

export default function RegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingTeam, setExistingTeam] = useState<{
    id: string;
    name: string;
    members: string[];
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkExistingRegistration = async () => {
      const savedId = localStorage.getItem("knin_team_id");

      if (savedId) {
        // Kontrola přímo v databázi
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
        } else {
          // Pokud tým v DB neexistuje, promažeme neplatná data z mobilu
          localStorage.removeItem("knin_team_id");
          localStorage.removeItem("knin_team_name");
        }
      }
      setLoading(false);
    };

    checkExistingRegistration();
  }, []);

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
    if (confirm("Opravdu chceš smazat data týmu z tohoto zařízení?")) {
      localStorage.clear();
      setExistingTeam(null);
    }
  };

  if (loading && !teamName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse text-green-700 font-bold">
          Otevírám mapu...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-green-700">
          Nový Knín Trek
        </h1>

        {existingTeam ? (
          <div className="text-center space-y-6 py-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Vítejte zpět
              </p>
              <h2 className="text-3xl font-black text-slate-800 uppercase">
                {existingTeam.name}
              </h2>
            </div>

            {/* Výpis členů */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500 mb-2 font-semibold">
                Složení týmu:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {existingTeam.members.map((member, idx) => (
                  <span
                    key={idx}
                    className="bg-white px-3 py-1 rounded-full text-sm shadow-sm border border-slate-200 font-medium text-slate-700"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => router.push("/mapa")}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-green-200 active:scale-95"
              >
                <MapIcon className="size-5" /> VSTOUPIT DO MAPY
              </button>

              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center gap-1"
              >
                <LogOut className="size-3" /> Odhlásit tým
              </button>
            </div>
          </div>
        ) : (
          /* --- VARIANTA: NOVÁ REGISTRACE --- */
          <>
            <p className="text-slate-500 text-center mb-8">
              Zaregistruj svůj tým a vyraz na 50km trasu!
            </p>

            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Název týmu
                </label>
                <input
                  required
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Např. Rychlé šípy"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Členové týmu (oddělení čárkou)
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 text-slate-400 size-5" />
                  <input
                    className="w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Jan, Marie, Petr..."
                    value={members}
                    onChange={(e) => setMembers(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="size-5" /> START DOBRODRUŽSTVÍ
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

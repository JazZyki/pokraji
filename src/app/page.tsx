// src/app/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Users, Play } from "lucide-react";

export default function RegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Uložíme tým do Supabase
    const { data, error } = await supabase
      .from("teams")
      .insert([
        {
          team_name: teamName,
          members: members.split(",").map((m) => m.trim()), // převede "Jan, Petr" na pole
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Chyba při registraci: " + error.message);
      setLoading(false);
      return;
    }

    // 2. Uložíme ID týmu do telefonu (localStorage)
    localStorage.setItem("knin_team_id", data.id);
    localStorage.setItem("knin_team_name", data.team_name);

    // 3. Přesměrujeme na mapu (tu vytvoříme v dalším kroku)
    router.push("/mapa");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-green-700">
          Nový Knín Trek
        </h1>
        <p className="text-slate-500 text-center mb-8">
          Zaregistruj svůj tým a vyraz na 50km trasu!
        </p>

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Název týmu</label>
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
            {loading ? (
              "Registruji..."
            ) : (
              <>
                <Play className="size-5" /> START DOBRODRUŽSTVÍ
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

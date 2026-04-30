"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SokolLoader } from "@/components/SokolLoader";
import { BadgeQuestionMark, MapPin, Users, Clock, TrendingUp, Trophy } from "lucide-react";

import { calculateDistance } from "@/lib/utils";

interface TeamStats {

  id: string;
  team_name: string;
  members: string[];
  quiz_responses: Record<string, Record<number, number>>;
  created_at: string;
}

interface PoiPoint {
  id: string;
  name: string;
  quiz_data?: QuizQuestion | QuizQuestion[] | string;
}

interface QuizQuestion {
  q?: string;
  a?: string[];
  c?: number;
  question?: string;
  options?: string[];
  answer?: string;
}

interface TeamStats {
  teamId: string;
  name: string;
  members: string[];
  distance: number;
  timeSeconds: number;
  lastPing: string | null;
  quizScore: number;
  totalQuestions: number;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TeamStats[]>([]);
  const [pois, setPois] = useState<PoiPoint[]>([]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // V reálném nasazení by toto mělo být v env proměnné
    if (password === "sokol2026") {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      alert("Nesprávné heslo");
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAdminData();
    }
  }, [isAuthenticated]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*");
      
      if (teamsError) throw teamsError;

      // 2. Fetch POIs for quiz scoring
      const { data: poisData, error: poisError } = await supabase
        .from("poi_points")
        .select("id, name, quiz_data");
      
      if (poisError) throw poisError;
      setPois(poisData);

      // 3. Fetch Tracking data for all teams
      // V ideálním případě bychom toto chtěli agregované z DB, 
      // ale pro rozumný počet týmů to můžeme spočítat tady.
      const { data: trackingData, error: trackingError } = await supabase
        .from("team_tracking")
        .select("team_id, lat_val, lon_val, created_at, session_id")
        .order("created_at", { ascending: true });

      if (trackingError) throw trackingError;

      // Agregace dat
      const stats: TeamStats[] = (teamsData as TeamData[]).map(team => {
        const teamPings = trackingData.filter(p => p.team_id === team.id);
        
        // Výpočet vzdálenosti
        let distance = 0;
        let timeSeconds = 0;
        let lastPing = null;

        if (teamPings.length > 0) {
          lastPing = teamPings[teamPings.length - 1].created_at;
          
          // Seskupit podle session_id pro výpočet času a vzdálenosti v segmentech
          const sessions: Record<string, any[]> = {};
          teamPings.forEach(ping => {
            const sId = ping.session_id || "default";
            if (!sessions[sId]) sessions[sId] = [];
            sessions[sId].push(ping);
          });

          Object.values(sessions).forEach(pings => {
            if (pings.length > 1) {
              const start = new Date(pings[0].created_at).getTime();
              const end = new Date(pings[pings.length - 1].created_at).getTime();
              timeSeconds += (end - start) / 1000;

              for (let i = 1; i < pings.length; i++) {
                distance += calculateDistance(
                  pings[i-1].lat_val, pings[i-1].lon_val,
                  pings[i].lat_val, pings[i].lon_val
                );
              }
            }
          });
        }

        // Výpočet skóre kvízu
        let quizScore = 0;
        let totalQuestions = 0;

        poisData.forEach(poi => {
          const poiResponses = team.quiz_responses?.[poi.id];
          if (poi.quiz_data) {
            let quizArray: any[] = [];
            try {
              quizArray = Array.isArray(poi.quiz_data) ? poi.quiz_data : [poi.quiz_data];
              // Podpora obou formátů (viz PoiModal)
              quizArray = quizArray.map(q => {
                if (q.question && Array.isArray(q.options)) {
                  return { q: q.question, a: q.options, c: q.options.indexOf(q.answer) };
                }
                return q;
              });
            } catch(e) {}

            totalQuestions += quizArray.length;

            if (poiResponses) {
              quizArray.forEach((q, idx) => {
                if (poiResponses[idx] === q.c) {
                  quizScore++;
                }
              });
            }
          }
        });

        return {
          teamId: team.id,
          name: team.team_name,
          members: team.members,
          distance,
          timeSeconds,
          lastPing,
          quizScore,
          totalQuestions
        };
      });

      setData(stats.sort((a, b) => b.distance - a.distance));
    } catch (err) {
      console.error("Admin data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Admin Přihlášení</CardTitle>
            <CardDescription>Zadejte administrátorské heslo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input 
                type="password" 
                placeholder="Heslo" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full">Vstoupit</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500">Přehled závodu Nový Knín Trek</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchAdminData} variant="outline" disabled={loading}>
              {loading ? "Aktualizuji..." : "Obnovit data"}
            </Button>
            <Button onClick={() => {
              sessionStorage.removeItem("admin_auth");
              setIsAuthenticated(false);
            }} variant="ghost">Odhlásit</Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Týmy celkem</CardTitle>
              <Users className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Ušlá vzdálenost</CardTitle>
              <TrendingUp className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.reduce((acc, curr) => acc + curr.distance, 0).toFixed(1)} km
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Aktivní týmy</CardTitle>
              <MapPin className="size-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.filter(d => d.lastPing && (new Date().getTime() - new Date(d.lastPing).getTime()) < 600000).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Průměrný kvíz</CardTitle>
              <Trophy className="size-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.length > 0 ? (data.reduce((acc, curr) => acc + (curr.quizScore / (curr.totalQuestions || 1)), 0) / data.length * 100).toFixed(0) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard & Statistiky</CardTitle>
            <CardDescription>Aktuální pořadí podle ušlé vzdálenosti</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <SokolLoader />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Tým</TableHead>
                      <TableHead>Členové</TableHead>
                      <TableHead className="text-right">Vzdálenost</TableHead>
                      <TableHead className="text-right">Čas</TableHead>
                      <TableHead className="text-right">Tempo</TableHead>
                      <TableHead className="text-right">Kvíz</TableHead>
                      <TableHead className="text-right">Poslední ping</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((team) => {
                      const pace = team.distance > 0 ? team.timeSeconds / 60 / team.distance : 0;
                      const lastPingDate = team.lastPing ? new Date(team.lastPing) : null;
                      
                      return (
                        <TableRow key={team.teamId}>
                          <TableCell className="font-bold">{team.name}</TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            {team.members.join(", ")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">
                            {team.distance.toFixed(2)} km
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatTime(team.timeSeconds)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {pace > 0 ? `${Math.floor(pace)}:${Math.round((pace % 1) * 60).toString().padStart(2, '0')}` : "--:--"} min/km
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold">{team.quizScore} / {team.totalQuestions}</span>
                              <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-500" 
                                  style={{ width: `${(team.quizScore / (team.totalQuestions || 1)) * 100}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-400">
                            {lastPingDate ? lastPingDate.toLocaleTimeString() : "nikdy"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

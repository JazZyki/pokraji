"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  MessageSquare,
  Camera,
  Send,
  AlertTriangle,
  Info,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import imageCompression from "browser-image-compression";

interface TeamComment {
  id: string;
  team_id: string;
  team_name: string;
  text: string;
  photo_url: string | null;
  type: "info" | "warning" | "photo";
  created_at: string;
}

export default function NastenkaPage() {
  const [comments, setComments] = useState<TeamComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<"info" | "warning" | "photo">(
    "info",
  );
  const [uploading, setUploading] = useState(false);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    // Realtime update - volitelné, ale skvělé
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_comments" },
        fetchComments,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchComments() {
    const { data } = await supabase
      .from("team_comments")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setComments(data);
  }

  // Zpracování a nahrání fotky
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Komprese obrazu (max 1MB, max šířka 1200px)
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      // 2. Nahrání do Storage
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("PoKraji")
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      // 3. Získání URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("PoKraji").getPublicUrl(fileName);

      setTempPhotoUrl(publicUrl);
      setCommentType("photo");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Neznámá chyba";
      alert(`Chyba: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() && !tempPhotoUrl) return;

    const teamId = localStorage.getItem("knin_team_id");
    const teamName = localStorage.getItem("knin_team_name");

    const { error } = await supabase.from("team_comments").insert([
      {
        team_id: teamId,
        team_name: teamName || "Anonymní tým",
        text: newComment,
        photo_url: tempPhotoUrl,
        type: commentType,
      },
    ]);

    if (!error) {
      setNewComment("");
      setTempPhotoUrl(null);
      setCommentType("info");
      fetchComments();
    }
  };

  useEffect(() => {
    setMyTeamId(localStorage.getItem("knin_team_id"));
  }, []);

  useEffect(() => {
  // Označíme čas návštěvy pro notifikační tečku v menu
  localStorage.setItem("nastenka_last_seen", new Date().toISOString());
}, []);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* SEZNAM ZPRÁV */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 pb-32">
        {comments.map((c) => {
          const isMe = c.team_id === myTeamId;

          return (
            <div
              key={c.id}
              className={`max-w-[85%] p-4 rounded-2xl shadow-sm flex flex-col ${
                isMe
                  ? "ml-auto bg-primary/10 border-r-4 border-r-primary rounded-tr-none"
                  : "mr-auto bg-white border-l-4 border-l-slate-400 rounded-tl-none"
              } ${c.type === "warning" ? "border-l-red-500 bg-red-50" : ""}`}
            >
              <div
                className={`flex justify-between items-start mb-1 gap-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                <span
                  className={`font-bold text-xs uppercase tracking-tight ${isMe ? "text-primary" : "text-slate-500"}`}
                >
                  {isMe ? "Můj tým" : c.team_name}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">
                  {new Date(c.created_at).toLocaleString("cs-CZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "numeric",
                  })}
                </span>
              </div>

              <p
                className={`text-sm leading-relaxed ${isMe ? "text-right" : "text-left"}`}
              >
                {c.text}
              </p>

              {c.photo_url && (
                <div className="mt-3 rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={c.photo_url}
                    alt="Foto z trasy"
                    className="w-full h-auto"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FORMULÁŘ DOLE */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t p-4 z-50">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-grow bg-slate-100 rounded-2xl p-2 border focus-within:ring-2 ring-primary">
              {tempPhotoUrl && (
                <div className="mb-2 relative inline-block">
                  <img
                    src={tempPhotoUrl}
                    className="size-16 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setTempPhotoUrl(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full size-5 text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Napiš vzkaz..."
                className="w-full bg-transparent border-none outline-none text-sm p-1 resize-none"
                rows={newComment.includes("\n") ? 3 : 1}
              />
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              ref={fileInputRef}
              onChange={handlePhotoUpload}
            />

            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
            </Button>

            <Button size="icon" onClick={handleSubmit} disabled={uploading}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

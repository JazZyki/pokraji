"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Camera, Send, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import imageCompression from "browser-image-compression";
import Image from "next/image";

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
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    setMyTeamId(localStorage.getItem("knin_team_id"));
    fetchComments();
    // Realtime update
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_comments" },
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

  // Zpracování a nahrání fotky s vylepšenou optimalizací
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // OPTIMALIZACE PRO MOBILNÍ DATA:
      // - Max 0.3MB (300KB) pro rychlé načítání v terénu
      // - Max 1000px (dostatečné pro mobily i lightbox)
      // - Konverze do WebP (moderní, vysoce efektivní formát)
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1000,
        useWebWorker: true,
        fileType: 'image/webp' as string, // Vynutíme WebP pro úsporu dat
      };
      
      const compressedFile = await imageCompression(file, options);

      // 2. Nahrání do Storage (přípona .webp)
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("PoKraji")
        .upload(fileName, compressedFile, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Získání URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("PoKraji").getPublicUrl(fileName);

      setTempPhotoUrl(publicUrl);
      setCommentType("photo");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Neznámá chyba";
      alert(`Chyba při nahrávání: ${errorMessage}`);
      console.error(err);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu chceš smazat tento vzkaz?")) return;

    const teamId = localStorage.getItem("knin_team_id");
    
    const { error } = await supabase
      .from("team_comments")
      .delete()
      .match({ id: id, team_id: teamId });

    if (error) {
      alert(`Chyba při mazání: ${error.message}`);
    } else {
      fetchComments();
    }
  };

  useEffect(() => {
    // Označíme čas návštěvy pro notifikační tečku v menu
    localStorage.setItem("nastenka_last_seen", new Date().toISOString());
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* SEZNAM ZPRÁV */}
      <div className="grow overflow-y-auto p-4 space-y-4 pb-32">
        {comments.map((c) => {
          const isMe = c.team_id === myTeamId;

          return (
            <div
              key={c.id}
              className={`max-w-[85%] p-4 rounded-2xl shadow-sm flex flex-col bg-background-2 group ${
                isMe
                  ? "ml-auto border-r-4 border-r-primary rounded-tr-none"
                  : "mr-auto border-l-4 border-l-slate-400 rounded-tl-none"
              } `}
            >
              <div
                className={`flex justify-between items-start mb-1 gap-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
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
                {isMe && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="sm:opacity-0 group-hover:opacity-100 transition-opacity p-2 -m-1 text-red-500 hover:bg-red-50 rounded-full"
                    title="Smazat vzkaz"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <p
                className={`text-sm leading-relaxed mb-1 ${isMe ? "text-right" : "text-left"}`}
              >
                {c.text}
              </p>

              {c.photo_url && (
                <div 
                  className="mt-3 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity aspect-video relative"
                  onClick={() => setSelectedPhoto(c.photo_url)}
                >
                  <Image
                    src={c.photo_url}
                    alt="Foto z trasy"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 85vw, 500px"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LIGHTBOX / MODAL PRO FOTKY */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogPortal>
          <DialogOverlay className="z-[6000]" />
          <DialogContent className="max-w-4xl p-0 border-none bg-transparent shadow-none z-[6001] w-[95vw] sm:w-[85vw] h-auto max-h-[90vh] flex items-center justify-center">
            {selectedPhoto && (
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={selectedPhoto}
                  alt="Full size photo"
                  width={1200}
                  height={800}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                  priority
                />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute -top-12 right-0 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors"
                >
                  <X className="size-6" />
                </button>
              </div>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* FORMULÁŘ DOLE */}
      <div className="fixed bottom-0 left-0 right-0 bg-background-2/50 backdrop-blur-lg border-t p-4 z-50">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex gap-2 items-end">
            <div className="grow bg-background-2 rounded-2xl p-2 border focus-within:ring-2 ring-primary">
              {tempPhotoUrl && (
                <div className="mb-2 relative inline-block">
                  <Image
                    src={tempPhotoUrl}
                    alt="Náhled"
                    width={64}
                    height={64}
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

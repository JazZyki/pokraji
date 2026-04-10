"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  X,
  Map as MapIcon,
  Trophy,
  BookOpen,
  MessageSquare,
  LogOut,
  RefreshCw,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  SunMedium,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GpxImport } from "@/components/GpxImport";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // --- LOGIKA SLEDOVÁNÍ NOVÝCH ZPRÁV (TEČKA) ---
  useEffect(() => {
    const checkNewMessages = async () => {
      const lastSeen =
        localStorage.getItem("nastenka_last_seen") || new Date(0).toISOString();
      const { count } = await supabase
        .from("team_comments")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastSeen);

      setHasNewMessage(!!count && count > 0);
    };

    checkNewMessages();
    const interval = setInterval(checkNewMessages, 30000); // Kontrola každých 30s
    return () => clearInterval(interval);
  }, [pathname]);

  const navItems = [
    { name: "Mapa trasy", href: "/mapa", icon: MapIcon, color: "bg-blue-500" },
    {
      name: "Moje Statistiky",
      href: "/statistiky",
      icon: Trophy,
    },
    {
      name: "Diskuse",
      href: "/nastenka",
      icon: MessageSquare,
      badge: hasNewMessage,
    },
    {
      name: "Pravidla a Info",
      href: "/info",
      icon: BookOpen,
    },
  ];

  const handleNavigate = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleLogout = () => {
    if (confirm("Opravdu se chcete odhlásit?")) {
      localStorage.clear();
      router.push("/");
    }
  };

  return (
    <>
      <header className="h-18 bg-background border-b-4 border-primary px-4 flex justify-between items-center z-1001 relative shadow-md">
        <Image
          src="/pokraji_logo.png"
          alt="Logo"
          width={140}
          height={60}
          className="h-10 w-auto cursor-pointer"
          onClick={() => router.push("/mapa")}
        />

        <button
          onClick={() => setIsOpen(true)}
          className="relative p-2 text-menu-btn hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Menu className="size-7" />
          {hasNewMessage && (
            <span className="absolute top-2 right-2 size-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />
          )}
        </button>
      </header>

      {/* --- OFF-CANVAS MENU OVERLAY --- */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-2000 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsOpen(false)}
      />

      {/* --- OFF-CANVAS PANEL --- */}
      <div
        className={`fixed top-0 right-0 h-full  min-w-75 w-[75%] max-w-sm bg-background z-2001 shadow-2xl transform transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          {/* Header menu */}
          <div className="p-6 flex justify-between items-center border-b border-primary">
            <h2 className="text-2xl font-bold text-def-text">MENU</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 bg-background-2 rounded-full"
            >
              <X className="size-6 text-menu-btn" />
            </button>
          </div>

          {/* Navigační položky */}
          <nav className="flex-grow p-4 space-y-3 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigate(item.href)}
                className={`w-full flex items-center p-4 rounded-2xl border transition-all bg-menu-btns text-def-text uppercase ${
                  pathname === item.href
                    ? "border-primary shadow-md ring-1 ring-primary/20 text-primary"
                    : "border-slate-100 shadow-sm active:scale-95"
                }`}
              >
                <div className={`p-3 rounded-xl text-white bg-secondary mr-4`}>
                  <item.icon className="size-6" />
                </div>
                <div className="flex-grow text-left">
                  <span
                    className={`font-bold block ${pathname === item.href ? "text-def-text" : "text-def-text"}`}
                  >
                    {item.name}
                  </span>
                  {item.badge && (
                    <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full uppercase font-black">
                      Nové!
                    </span>
                  )}
                </div>
                <ChevronRight
                  className={`size-5 ${pathname === item.href ? "text-primary" : "text-slate-300"}`}
                />
              </button>
            ))}
            <div className="w-full flex items-center p-4 rounded-2xl border border-slate-100 bg-menu-btns shadow-sm active:scale-95 transition-all">
              <div className="p-3 rounded-xl text-white bg-secondary mr-4">
                <Upload className="size-6" />
              </div>
              <div className="flex-grow text-left">
                <GpxImport
                  onImportComplete={() => {
                    setIsOpen(false);
                    window.location.reload();
                  }}
                />
              </div>
              <ChevronRight className="size-5 text-slate-300" />
            </div>
          </nav>

          {/* Footer menu */}
          <div className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1 tracking-widest text-center">
                Režim zobrazení
              </p>
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                {[
                  { id: "light", icon: Sun, label: "Jasný" },
                  { id: "dark", icon: Moon, label: "Tmavý" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all ${
                      theme === t.id
                        ? "bg-primary text-white shadow-md scale-105"
                        : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                    }`}
                  >
                    <t.icon className="size-5 mb-1" />
                    <span className="text-[9px] font-bold uppercase">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 p-3 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <RefreshCw className="size-4" /> Obnovit aplikaci
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 p-3 text-red-500 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <LogOut className="size-4" /> ODHLÁSIT TÝM
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

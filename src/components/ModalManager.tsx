"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useTracking, ActiveModal } from "@/lib/TrackingContext";
import { SokolLoader } from "./SokolLoader";

// Dynamický import stránek jako komponent
const StatsPage = dynamic(() => import("@/app/(inner-app)/statistiky/page"), {
  loading: () => <SokolLoader />,
});
const BoardPage = dynamic(() => import("@/app/(inner-app)/nastenka/page"), {
  loading: () => <SokolLoader />,
});
const InfoPage = dynamic(() => import("@/app/(inner-app)/info/page"), {
  loading: () => <SokolLoader />,
});

export function ModalManager() {
  const { activeModal, setActiveModal } = useTracking();

  if (!activeModal) return null;

  const getTitle = () => {
    switch (activeModal) {
      case "stats":
        return "Moje Statistiky";
      case "board":
        return "Diskuse";
      case "info":
        return "Pravidla a Info";
      default:
        return "";
    }
  };

  const renderContent = () => {
    switch (activeModal) {
      case "stats":
        return <StatsPage />;
      case "board":
        return <BoardPage />;
      case "info":
        return <InfoPage />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[1050] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Hlavička modálu */}
      <header className="flex-none h-16 bg-background border-b-2 border-primary px-4 flex justify-between items-center shadow-sm">
        <h2 className="text-xl font-bold text-def-text uppercase">{getTitle()}</h2>
        <button
          onClick={() => setActiveModal(null)}
          className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
        >
          <X className="size-6 text-slate-600" />
        </button>
      </header>

      {/* Obsah modálu */}
      <main className="flex-1 overflow-hidden relative bg-background">
        <Suspense fallback={<SokolLoader />}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  );
}

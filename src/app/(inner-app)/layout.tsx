"use client";

import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { TrackingProvider } from "@/lib/TrackingContext";
import { ModalManager } from "@/components/ModalManager";

// Teď už ssr: false bude fungovat, protože jsme v Client Component
const Header = dynamic(() => import("@/components/Header"), { 
  ssr: false,
  loading: () => <div className="h-16 bg-white border-b border-slate-200 shadow-sm" />
});

export default function InnerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TrackingProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <header className="flex-none">
          <Header />
        </header>

        <main className="flex-1 relative overflow-hidden">
          {children}
        </main>

        <footer className="flex-none">
          <Footer />
        </footer>

        <ModalManager />
      </div>
    </TrackingProvider>
  );
}
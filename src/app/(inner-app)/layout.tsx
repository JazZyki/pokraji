"use client"; // <--- TOTO JE KLÍČOVÉ

import dynamic from "next/dynamic";

// Teď už ssr: false bude fungovat, protože jsme v Client Component
const Header = dynamic(() => import("@/components/Header"), { 
  ssr: false,
  loading: () => <div className="h-16 bg-white border-b border-slate-200 shadow-sm" />
});

export default function InnerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex-1 relative overflow-hidden bg-slate-50">
        {children}
      </main>
    </div>
  );
}
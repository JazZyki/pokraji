"use client";

import dynamic from "next/dynamic";

// Dynamický import headeru - vypne rendering na serveru
const HeaderNoSSR = dynamic(() => import("@/components/Header"), {
  ssr: false,
  // Volitelný loading stav, aby header neposkočil
  loading: () => <div className="h-[112px] bg-white border-b" /> 
});

export default function InnerAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full flex flex-col">
      <HeaderNoSSR />
      <div className="flex-grow relative pb-4">
        {children}
      </div>
    </div>
  );
}
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Map as MapIcon,  Footprints, LogOut, MessagesSquare } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const handleLogout = () => {
    if (confirm("Opravdu se chcete odhlásit?")) {
      localStorage.clear();
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 w-full p-4 bg-white shadow-md flex justify-between items-center z-50">
      <Image
        src="/pokraji_logo.png"
        alt="Logo"
        width={180}
        height={80}
        priority
        className="cursor-pointer"
        onClick={() => router.push("/mapa")}
      />
      <DropdownMenu>
        <DropdownMenuTrigger className="px-4 py-2 border rounded-md shadow-sm bg-white">
          Menu
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push("/mapa")}>
            <MapIcon className="mr-2 h-4 w-4" /> Mapa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/info")}>
            <BookOpen className="mr-2 h-4 w-4" /> Pravidla a Info
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/statistiky")}>
            <Footprints className="mr-2 h-4 w-4" /> Statistiky
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/nastenka")}>
            <MessagesSquare className="mr-2 h-4 w-4" /> Nástěnka
          </DropdownMenuItem>
          <div className="h-px bg-slate-200 my-1" />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Odhlásit tým
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
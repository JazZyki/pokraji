"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCcw } from "lucide-react";

export function PWAUpdateHandler() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Registrace service workeru
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        // Kontrola, zda už na nás nečeká nová verze
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Sledování nových aktualizací
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });
      });

      // Zpracování obnovení po aktivaci nového SW
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const updateApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-500">
      <Card className="bg-primary text-primary-foreground border-none shadow-2xl">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <p className="font-bold text-sm">Nová verze k dispozici!</p>
            <p className="text-xs opacity-90">Aktualizujte pro nejnovější funkce.</p>
          </div>
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={updateApp}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCcw className="h-4 w-4" />
            Aktualizovat
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

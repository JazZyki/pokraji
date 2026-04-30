"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { calculateDistance } from "./utils";

export interface TrackPoint {
  coords: [number, number];
  dist: number;
  sessionId?: string;
  created_at?: string;
}

export interface TrackSegment {
  points: TrackPoint[];
}

export type ActiveModal = "stats" | "board" | "info" | null;

interface TrackingContextType {
  isTracking: boolean;
  setIsTracking: (val: boolean) => void;
  segments: TrackSegment[];
  setSegments: React.Dispatch<React.SetStateAction<TrackSegment[]>>;
  userLocation: [number, number] | null;
  elapsedTime: number;
  setElapsedTime: React.Dispatch<React.SetStateAction<number>>;
  debugMsg: string;
  setDebugMsg: (msg: string) => void;
  handleToggleTracking: () => void;
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [segments, setSegments] = useState<TrackSegment[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [debugMsg, setDebugMsg] = useState("GPS vypnuta");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  
  const lastSavedPos = useRef<{ lat: number; lon: number } | null>(null);
  const isTrackingRef = useRef(isTracking);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Timer pro čas
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  // WakeLock API
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        console.error("WakeLock failed", err);
      }
    };
    if (isTracking) requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [isTracking]);

  // --- BOD 3: SPUŠTĚNÍ/ZASTAVENÍ GPS DLE STAVU TRACKOVÁNÍ ---
  const startGps = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    if (watchIdRef.current !== null) return;

    console.log("🛰️ Zapínám GPS watch...");
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation([latitude, longitude]);

        if (!isTrackingRef.current) return;

        // Filtrování nepřesných bodů
        if (accuracy > 100) {
          setDebugMsg(`Slabý signál: ${Math.round(accuracy)}m`);
          return;
        }

        const teamId = typeof window !== 'undefined' ? localStorage.getItem("knin_team_id") : null;
        const sId = typeof window !== 'undefined' ? localStorage.getItem("current_session_id") : null;

        if (teamId && sId) {
          let shouldSave = false;
          if (!lastSavedPos.current) {
            shouldSave = true;
          } else {
            const d = calculateDistance(lastSavedPos.current.lat, lastSavedPos.current.lon, latitude, longitude) * 1000;
            if (d >= 10) shouldSave = true; // Ukládáme každých 10 metrů
          }

          if (shouldSave) {
            // --- BOD 2: OPTIMISTICKÉ PŘIDÁNÍ BODU DO MAPY ---
            // Přidáme bod hned, abychom viděli trasu i při výpadku internetu
            const newPointBase: TrackPoint = {
              coords: [latitude, longitude],
              dist: 0, // Bude aktualizováno z DB pokud se povede
              sessionId: sId,
              created_at: new Date().toISOString()
            };

            setSegments((prev) => {
              if (prev.length === 0) return [{ points: [newPointBase] }];
              const lastIdx = prev.length - 1;
              const updatedLastSegment = {
                ...prev[lastIdx],
                points: [...prev[lastIdx].points, newPointBase],
              };
              const newSegments = [...prev];
              newSegments[lastIdx] = updatedLastSegment;
              return newSegments;
            });

            lastSavedPos.current = { lat: latitude, lon: longitude };

            // Odeslání na server
            try {
              const { data, error } = await supabase.rpc("track_team_location", {
                t_id: teamId,
                lat_val: latitude,
                lon_val: longitude,
                s_id: sId,
              });

              if (!error && data) {
                // Pokud server vrátil přesnou vzdálenost, aktualizujeme poslední bod
                const currentDist = data.distance_from_route ?? 0;
                setSegments((prev) => {
                  if (prev.length === 0) return prev;
                  const newSegments = [...prev];
                  const lastSeg = { ...newSegments[newSegments.length - 1] };
                  const lastPointIdx = lastSeg.points.length - 1;
                  if (lastPointIdx >= 0) {
                    lastSeg.points[lastPointIdx] = { 
                      ...lastSeg.points[lastPointIdx], 
                      dist: currentDist 
                    };
                  }
                  newSegments[newSegments.length - 1] = lastSeg;
                  return newSegments;
                });
                setDebugMsg(`✅ OK: ${new Date().toLocaleTimeString()}`);
              } else if (error) {
                console.warn("⚠️ Chyba při odesílání bodu (offline?):", error.message);
                setDebugMsg("⚠️ Offline: Ukládám lokálně");
              }
            } catch (err) {
              setDebugMsg("⚠️ Chyba spojení");
            }
          }
        }
      },
      (err) => setDebugMsg(`❌ GPS Error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      console.log("💤 Vypínám GPS watch...");
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Správa GPS modulu dle stavu trackování
  useEffect(() => {
    if (isTracking) {
      startGps();
    } else {
      stopGps();
    }
    return () => stopGps();
  }, [isTracking, startGps, stopGps]);

  const handleToggleTracking = useCallback(() => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }

    if (!isTrackingRef.current) {
      const newSessionId = crypto.randomUUID();
      localStorage.setItem("current_session_id", newSessionId);
      setSegments((prev) => [...prev, { points: [] }]);
      setIsTracking(true);
      setDebugMsg("🛰️ Startuji GPS...");
    } else {
      localStorage.removeItem("current_session_id");
      setIsTracking(false);
      setDebugMsg("Trasa pozastavena");
    }
  }, []);

  return (
    <TrackingContext.Provider value={{
      isTracking, setIsTracking, segments, setSegments, 
      userLocation, elapsedTime, setElapsedTime, debugMsg, setDebugMsg,
      handleToggleTracking, activeModal, setActiveModal
    }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error("useTracking must be used within a TrackingProvider");
  }
  return context;
};

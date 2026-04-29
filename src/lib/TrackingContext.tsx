"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "./supabase";

export interface TrackPoint {
  coords: [number, number];
  dist: number;
  sessionId?: string;
  created_at?: string;
}

export interface TrackSegment {
  points: TrackPoint[];
}

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
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

// Pomocná funkce pro výpočet vzdálenosti
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [segments, setSegments] = useState<TrackSegment[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [debugMsg, setDebugMsg] = useState("Inicializace...");
  
  const lastSavedPos = useRef<{ lat: number; lon: number } | null>(null);
  const isTrackingRef = useRef(isTracking);

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

  // WakeLock
  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;
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

  const handleToggleTracking = useCallback(() => {
    // Krátká haptická odezva při stisku tlačítka
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
      setDebugMsg("Trasa ukončena");
    }
  }, []);

  // Watch Position
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation([latitude, longitude]);

        if (!isTrackingRef.current) return;

        if (accuracy > 150) {
          setDebugMsg(`Slabý signál: ${Math.round(accuracy)}m`);
          return;
        }

        const teamId = localStorage.getItem("knin_team_id");
        const sId = localStorage.getItem("current_session_id");

        if (teamId && sId) {
          let shouldSave = false;
          if (!lastSavedPos.current) {
            shouldSave = true;
          } else {
            const d = calculateDistance(lastSavedPos.current.lat, lastSavedPos.current.lon, latitude, longitude) * 1000;
            if (d >= 10) shouldSave = true;
          }

          if (shouldSave) {
            const { data, error } = await supabase.rpc("track_team_location", {
              t_id: teamId,
              lat_val: latitude,
              lon_val: longitude,
              s_id: sId,
            });

            if (!error && data) {
              lastSavedPos.current = { lat: latitude, lon: longitude };
              // Supabase RPC vrací distance_from_route
              const currentDist = data.distance_from_route ?? 0;

              const newPoint: TrackPoint = {
                coords: [latitude, longitude],
                dist: currentDist,
                sessionId: sId,
              };
              setSegments((prev) => {
                if (prev.length === 0) return [{ points: [newPoint] }];
                const lastIdx = prev.length - 1;
                const updatedLastSegment = {
                  ...prev[lastIdx],
                  points: [...prev[lastIdx].points, newPoint],
                };
                const newSegments = [...prev];
                newSegments[lastIdx] = updatedLastSegment;
                return newSegments;
              });
              setDebugMsg(`✅ OK: ${new Date().toLocaleTimeString()}`);
            }
          }
        }
      },
      (err) => setDebugMsg(`❌ GPS Error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <TrackingContext.Provider value={{
      isTracking, setIsTracking, segments, setSegments, 
      userLocation, elapsedTime, setElapsedTime, debugMsg, setDebugMsg,
      handleToggleTracking
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

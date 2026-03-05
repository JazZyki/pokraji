// src/components/Map.tsx
"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react"; // Změna: useRef místo useState

function MapRecenter({ location }: { location: [number, number] | null }) {
  const map = useMap();
  const hasCentered = useRef(false); // Ref místo state

  useEffect(() => {
    if (location && !hasCentered.current) {
      map.flyTo(location, 16, { animate: true });
      hasCentered.current = true; // Změna ref nezpůsobí render smyčku
    }
  }, [location, map]);

  return null;
}

if (typeof window !== "undefined") {
  L.Marker.prototype.options.icon = L.icon({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
}

interface MapProps {
  routeCoordinates: [number, number][];
  userLocation: [number, number] | null;
  userPath?: [number, number][]; // Nová volitelná vlastnost
}

export default function Map({
  routeCoordinates,
  userLocation,
  userPath = [],
}: MapProps) {
  const center: [number, number] = [49.811, 14.295];
  const apiKey = process.env.NEXT_PUBLIC_MAPY_API_KEY;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url={`https://api.mapy.cz/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`}
        attribution='&copy; <a href="https://www.seznam.cz/">Seznam.cz, a.s.</a>'
      />

      <Polyline
        positions={routeCoordinates}
        pathOptions={{ color: "#16a34a", weight: 5, opacity: 1 }}
      />
      <Polyline
        positions={userPath}
        pathOptions={{ color: "#3b82f6", weight: 4, dashArray: "5, 10" }} // Přerušovaná čára vypadá skvěle
      />

      <MapRecenter location={userLocation} />

      {userLocation && (
        <>
          <Circle
            center={userLocation}
            radius={10}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 1,
            }}
          />
          <Circle
            center={userLocation}
            radius={30}
            pathOptions={{ color: "#3b82f6", fillOpacity: 0.1 }}
          />
        </>
      )}
    </MapContainer>
  );
}

# Nový Knín Trek - Gemini Context

This document provides essential context and instructions for AI agents working on the Nový Knín Trek project.

## Project Overview

**Nový Knín Trek** is a specialized Next.js web application designed to track participants during a 50km trek. It is built as a Progressive Web App (PWA) to ensure offline capabilities and reliable tracking in varied terrain.

### Core Technologies
- **Framework:** Next.js 16 (App Router) with React 19.
- **Styling:** Tailwind CSS 4 and [shadcn/ui](https://ui.shadcn.com/) components.
- **Backend:** [Supabase](https://supabase.com/) for authentication, database (PostgreSQL), and specialized RPC functions.
- **Mapping:** [Leaflet](https://leafletjs.com/) (via `react-leaflet`) with [Mapy.cz](https://api.mapy.cz/) outdoor tiles.
- **PWA Features:** Service worker (`public/sw.js`), Web Manifest, and WakeLock API to keep the screen active during tracking.

### Key Features
- **Real-time Tracking:** Uses the Geolocation API to monitor and record user positions.
- **Route Persistence:** Tracks are stored in segments to handle session interruptions and multi-day activities.
- **POI System:** Points of Interest (POIs) that unlock automatically when a user is within range (100m).
- **Analytics:** Calculates distance, elapsed time, and pace (min/km).
- **Offline First:** Designed to load and function (mapping) even with intermittent connectivity.

---

## Technical Architecture

### Directory Structure
- `src/app/(inner-app)/`: Main functional routes (`/mapa`, `/info`, `/nastenka`, `/statistiky`).
- `src/components/`: UI components. `Map.tsx` is the primary interactive element.
- `src/lib/`: Shared logic, including the Supabase client (`supabase.ts`) and styling utilities (`utils.ts`).
- `necesary/`: Contains static trek data (`geo.json`, `export.gpx`).
- `public/`: Assets, custom fonts (Sokol fonts), and PWA configuration.

### Data Model & Backend
The app relies on several Supabase tables and RPCs:
- `route_display`: Stores GeoJSON data for the trek route.
- `team_tracking`: Records individual GPS pings.
- `team_poi_progress`: Tracks which POIs a team has visited.
- `track_team_location`: A PostgreSQL function (RPC) that calculates distance from the route and saves the point.

---

## Development Guidelines

### Commands
- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Production Start:** `npm run start`
- **Linting:** `npm run lint`

### Coding Standards
- **TypeScript:** Strict typing is preferred. Check `types/index.d.ts` for global declarations.
- **Client Components:** Components interacting with Leaflet or Browser APIs (Geolocation, WakeLock) MUST be marked with `"use client"` and often require dynamic importing with `ssr: false`.
- **Styling:** Use Tailwind CSS 4 utility classes. Prefer the `cn()` utility for conditional class merging.
- **Performance:** Be mindful of `useEffect` dependencies in the tracking logic to prevent excessive re-renders or API calls.

### Map Implementation
The `Map.tsx` component uses `react-leaflet`. Mapy.cz tiles require an API key (`NEXT_PUBLIC_MAPY_API_KEY`). Ensure all coordinate pairs are handled in the `[lat, lon]` format expected by Leaflet, as GeoJSON often uses `[lon, lat]`.

---

## Important Files
- `src/app/(inner-app)/mapa/page.tsx`: Main tracking logic and state management.
- `src/components/Map.tsx`: Leaflet map configuration and rendering.
- `src/lib/supabase.ts`: Centralized Supabase client.
- `public/sw.js`: Service worker for PWA functionality.
- `package.json`: Dependency list and scripts.

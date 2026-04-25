self.addEventListener("install", () => {
  console.log("Service Worker instalován");
  // Přinutí SW se okamžitě aktivovat
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker aktivován");
  // Převzetí kontroly nad všemi klienty okamžitě
  event.waitUntil(clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  // Tento prázdný fetch stačí k tomu, aby prohlížeč uznal PWA jako instalovatelné
  // V budoucnu zde může být logika pro caching (Offline-first)
  event.respondWith(fetch(event.request));
});

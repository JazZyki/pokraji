self.addEventListener("install", () => {
  console.log("Service Worker instalován");
});

self.addEventListener("fetch", (event) => {
  // Tento prázdný fetch stačí k tomu, aby prohlížeč uznal PWA jako instalovatelné
  event.respondWith(fetch(event.request));
});

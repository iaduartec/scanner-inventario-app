const CACHE_NAME = "duartec-inventario-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/constants.js",
  "./js/demo-data.js",
  "./js/scanner.js",
  "./js/storage.js",
  "./js/ui.js",
  "./js/utils.js",
  "./manifest.webmanifest",
  "./download/index.html",
  "./vendor/html5-qrcode/html5-qrcode.min.js",
  "./vendor/tesseract/tesseract.min.js",
  "./vendor/tesseract/worker.min.js",
  "./vendor/tesseract/core/tesseract-core.js",
  "./vendor/tesseract/core/tesseract-core.wasm.js",
  "./vendor/tesseract/core/tesseract-core.wasm",
  "./vendor/tesseract/core/tesseract-core-simd.js",
  "./vendor/tesseract/core/tesseract-core-simd.wasm.js",
  "./vendor/tesseract/core/tesseract-core-simd.wasm",
  "./vendor/tesseract/core/tesseract-core-lstm.js",
  "./vendor/tesseract/core/tesseract-core-lstm.wasm.js",
  "./vendor/tesseract/core/tesseract-core-lstm.wasm",
  "./vendor/tesseract/core/tesseract-core-simd-lstm.js",
  "./vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "./vendor/tesseract/core/tesseract-core-simd-lstm.wasm",
  "./vendor/tesseract/core/tesseract-core-relaxedsimd.js",
  "./vendor/tesseract/core/tesseract-core-relaxedsimd.wasm.js",
  "./vendor/tesseract/core/tesseract-core-relaxedsimd.wasm",
  "./vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.js",
  "./vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "./vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm",
  "./vendor/tesseract/lang/eng.traineddata.gz",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
    return;
  }

  event.respondWith(
    (async () => {
      const isHeavyAsset = requestUrl.pathname.includes('/vendor/') || 
                           requestUrl.pathname.includes('/lang/') ||
                           requestUrl.pathname.includes('.wasm');

      // Heavy assets: Cache-First
      if (isHeavyAsset) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
      }

      // App logic: Network-First
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseClone = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, responseClone);
        }
        return networkResponse;
      } catch (err) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        const fallbackUrl = requestUrl.pathname.startsWith("/download/")
          ? "./download/index.html"
          : "./index.html";
        return caches.match(fallbackUrl);
      }
    })()
  );
});

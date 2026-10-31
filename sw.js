// sw.js — makes Chào work offline and enables multi-threaded inference.
// • Precaches the app shell and the ONNX runtime.
// • Adds cross-origin isolation headers (COOP/COEP) so WebAssembly can use threads
//   on static hosts like GitHub Pages that can't set headers themselves.
// • When offline, answers missing model files with 404 so the ML library fails fast
//   instead of hanging (downloaded models are served from Cache Storage).
const VERSION = 'chao-v2';
const SHELL = [
  './', './index.html', './app.js', './lang.js', './phrases.js', './worker.js', './audio-worklet.js',
  './manifest.webmanifest',
  './transformers.min.js', './ort-wasm-simd-threaded.mjs', './ort-wasm-simd-threaded.wasm',
  './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './bvp-latin-400.woff2', './bvp-latin-600.woff2', './bvp-latin-700.woff2',
  './bvp-vietnamese-400.woff2', './bvp-vietnamese-600.woff2', './bvp-vietnamese-700.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('chao-') && key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque' || res.type === 'opaqueredirect') return res;
  const headers = new Headers(res.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const MODEL_HOSTS = /(^|\.)huggingface\.co$|(^|\.)hf\.co$|xethub/i;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const isPage = req.mode === 'navigate';
      let res = await cache.match(isPage ? './index.html' : req, { ignoreSearch: true });
      if (!res) {
        try {
          res = await fetch(req);
          if (res.ok && !isPage) cache.put(req, res.clone());
        } catch {
          res = isPage ? await cache.match('./index.html') : Response.error();
        }
      }
      return isolate(res);
    })());
    return;
  }

  if (MODEL_HOSTS.test(url.hostname)) {
    event.respondWith(fetch(req).catch(() => new Response(null, { status: 404, statusText: 'Offline' })));
  }
});

// Cache-first para o app shell → abre 100% offline.
// Ao alterar arquivos, suba a versão para forçar atualização.
const CACHE = 'ideias-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/cloud.js',
  '/firebase-config.js',
  '/vendor/firebase/firebase-app.js',
  '/vendor/firebase/firebase-auth.js',
  '/vendor/firebase/firebase-firestore.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Só intercepta GET do próprio site. Login Google e Firestore passam direto.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) => hit || fetch(e.request).catch(() => caches.match('/index.html'))
    )
  );
});

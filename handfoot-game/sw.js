/* Hand & Foot — offline support for the installed (home-screen) app.

   Strategy
   - The game's own files: NETWORK FIRST, falling back to the saved copy. Online you always get
     the latest version (no stale-copy problem after an update); offline, the saved copy opens.
   - Google Fonts: CACHE FIRST. Saved on the first online visit; without them the game falls
     back to system fonts, so a miss is harmless.
   - Everything else (Firebase and its connections): not touched. It goes straight to the network.

   Written for cruise-ship Wi-Fi in particular. It is often connected with no internet paid for,
   where requests either hang or get answered by a login ("captive") portal. So a network answer
   is only used, and only saved, if it's a clean response from this site itself: status 200, same
   origin, not a redirect. Anything else, or no answer within NETWORK_TIMEOUT_MS, falls back to
   the saved copy. A portal can't impersonate this site either: it's served over https, so a
   hijacked request fails outright rather than returning a fake page.

   Bump CACHE when the list below changes; old caches are deleted on activation. The game files
   themselves refresh on every online load, so a normal update doesn't need a bump. */

const CACHE = 'hf-app-v1';
const APP_SHELL = [
  './',
  './index.html',
  './handfoot.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];
const NETWORK_TIMEOUT_MS = 3000;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hf-app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isTrustworthy(res) {
  return !!res && res.status === 200 && res.type === 'basic' && !res.redirected;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then(res => {
    if (isTrustworthy(res)) cache.put(request, res.clone());
    return res;
  });
  try {
    const res = await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (isTrustworthy(res)) return res;
    throw new Error('untrustworthy response');
  } catch (e) {
    network.catch(() => {});   // a slow answer may still arrive; if it's good it refreshes the cache
    const saved = (await cache.match(request, {ignoreSearch: true}))
      || (request.mode === 'navigate' ? await cache.match('./handfoot.html') : undefined);
    if (saved) return saved;
    return network;            // nothing saved yet (first ever visit): all we can do is wait
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  } catch (e) {
    return new Response('', {status: 504});   // offline, never saved: fall back to system fonts
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) { event.respondWith(networkFirst(request)); return; }
  if (FONT_HOSTS.includes(url.hostname)) { event.respondWith(cacheFirst(request)); return; }
  // Anything else passes through untouched.
});

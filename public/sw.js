/* LMR network-first SW: always prefer live site so APK/PWA stays in sync */
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  event.respondWith(
    fetch(req)
      .then((res) => res)
      .catch(async () => {
        const cache = await caches.open('lmr-fallback-v1')
        const cached = await cache.match(req)
        if (cached) return cached
        return new Response('لا يوجد اتصال', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
  )
})

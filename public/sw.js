const CACHE_NAME = 'gymup-v4'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      const cache = await caches.open(CACHE_NAME)
      // allSettled: 1つ失敗してもインストール自体は続行
      await Promise.allSettled([
        cache.add(scope),
        cache.add(`${scope}index.html`),
      ])
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
          return res
        })
        .catch(async () => {
          const scope = self.registration.scope
          return (
            (await caches.match(event.request)) ||
            (await caches.match(`${scope}index.html`)) ||
            (await caches.match(scope))
          )
        }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
        return res
      })
    }),
  )
})

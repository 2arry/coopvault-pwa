// Loaded into the app's service worker (see vite.config.js → workbox.importScripts).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Cooperative360', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cooperative360', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag || 'c360',
      renotify: true,
      data: { url: data.url || '/notifications' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/notifications'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

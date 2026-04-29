// Service worker for push notifications
self.addEventListener('push', function(event) {
  let data = {}
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: 'New Update', body: 'Check your schedule' }
  }
  
  const options = {
    body: data.body || 'New schedule update available',
    icon: data.icon || '/theo-icon.png',
    badge: '/theo-badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.data?.url || '/dashboard?tab=schedule',
    },
    actions: [
      {
        action: 'view',
        title: 'View Schedule',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'THEO Mini Update', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  
  if (event.action === 'dismiss') {
    return
  }
  
  const urlToOpen = event.notification.data?.url || '/dashboard?tab=schedule'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})
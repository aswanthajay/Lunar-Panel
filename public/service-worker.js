// Lunar Panel Web Push Notification Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Lunar Panel Notification',
        body: event.data.text(),
      };
    }
  }

  const title = data.title || 'Lunar Panel Notification';
  const options = {
    body: data.body || 'You have received an update from Lunar Panel.',
    icon: data.icon || '/favicons/android-chrome-192x192.png',
    badge: data.badge || '/favicons/favicon-32x32.png',
    vibrate: [150, 80, 150],
    data: data.data || { url: '/' },
    requireInteraction: data.data?.category === 'server_crash' || data.data?.category === 'admin_node_status',
    actions: data.actions || [
      { action: 'open', title: 'View Details' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already an open window/tab from our origin
      for (const client of windowClients) {
        if ('focus' in client) {
          if (targetUrl && client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

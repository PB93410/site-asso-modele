/* Notifications des alertes de cours (modules.alertes). Pas de tracking. */
self.addEventListener('push', (event) => {
  let data = { title: 'Cours', body: 'Un cours a changé.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      if (event.data) data.body = event.data.text();
    } catch {
      /* ignore */
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cours', {
      body: data.body || 'Un cours a changé.',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

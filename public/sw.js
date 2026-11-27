// Avisos del dashboard: muestra el aviso diario y, al tocarlo, abre la sección que corresponde.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  e.waitUntil(self.registration.showNotification(String(d.title || 'MYB'), {
    body: String(d.body || ''), icon: '/icono-192.png', badge: '/icono-192.png', tag: 'myb-dia', renotify: true, data: { url: d.url },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let url = new URL('/', self.location.origin).href;
  try { const u = new URL(e.notification.data?.url || '/', self.location.origin); if (u.origin === self.location.origin) url = u.href; } catch { /* queda el inicio */ }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.location.origin));
    if (w) return w.navigate(url).then(x => (x || w).focus());
    return self.clients.openWindow(url);
  }));
});

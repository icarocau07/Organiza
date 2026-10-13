// Service Worker minimalista: não intercepta rede nem mantém cache offline.
// Recebe eventos Web Push mesmo quando não há abas do Organiza abertas.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = {}; }
  const title = typeof payload.title === "string" ? payload.title : "Organiza";
  const body = typeof payload.body === "string" ? payload.body : "Você tem uma tarefa para realizar.";
  const tag = typeof payload.tag === "string" ? payload.tag : "organiza-lembrete";
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag,
    data: { url: "/home.html" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL("/home.html", self.location.origin).href;
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = windows.find((item) => item.url.startsWith(self.location.origin));
    if (open) {
      await open.focus();
      if ("navigate" in open) await open.navigate(target);
    } else if (clients.openWindow) {
      await clients.openWindow(target);
    }
  })());
});

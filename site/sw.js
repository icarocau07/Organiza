// Atualiza esta versão do Service Worker assim que for publicada.
// Não elimina inscrições Web Push nem mexe nas preferências do usuário.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Service Worker minimalista: não intercepta rede nem mantém cache offline.
// Recebe eventos Web Push mesmo quando não há abas do Organiza abertas.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = {}; }
  // Se o provedor/OS entregou tarde, não mostramos um lembrete antecipado vencido.
  // O TTL curto no servidor também reduz esse risco durante o transporte.
  if (typeof payload.dueAt === "string" && Number.isFinite(Date.parse(payload.dueAt)) &&
      Date.now() >= Date.parse(payload.dueAt)) {
    return;
  }
  const title = typeof payload.title === "string" ? payload.title : "Organiza";
  const body = typeof payload.body === "string" ? payload.body : "Você tem uma tarefa para realizar.";
  const tag = typeof payload.tag === "string" ? payload.tag : "organiza-lembrete";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    // Ícone expandido: ✓ azul, sem quadrado ao redor.
    icon: "/icons/checkmark-192.png",
    // Ícone pequeno do Android: apenas ✓ monocromático e transparente.
    badge: "/icons/checkmark-badge-96.png",
    tag,
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

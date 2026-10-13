import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Nunca importar este módulo dentro de arquivos publicados na pasta site/.
export function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no Netlify.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT no Netlify.");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return publicKey;
}

export function answer(json, status = 200) {
  return Response.json(json, { status, headers: { "Cache-Control": "no-store" } });
}

export async function getAuthenticatedUser(req, admin) {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user;
}

export function validEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    // Lista de provedores Web Push conhecidos; não enviar requisições arbitrárias do servidor.
    return host === "fcm.googleapis.com" ||
      host === "fcm-xm.googleapis.com" ||
      host === "android.googleapis.com" ||
      host === "push.services.mozilla.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host === "notify.windows.com" || host.endsWith(".notify.windows.com");
  } catch { return false; }
}

export function cleanSubscription(raw) {
  const endpoint = raw?.endpoint;
  const p256dh = raw?.keys?.p256dh;
  const auth = raw?.keys?.auth;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !validEndpoint(endpoint) ||
      typeof p256dh !== "string" || !/^[\w-]{60,150}$/.test(p256dh) ||
      typeof auth !== "string" || !/^[\w-]{15,100}$/.test(auth)) {
    return null;
  }
  return { endpoint, keys: { p256dh, auth } };
}

export function validTimezone(zone) {
  if (typeof zone !== "string" || zone.length > 100) return false;
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: zone }); return true; }
  catch { return false; }
}

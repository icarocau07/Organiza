import webpush from "web-push";
import { answer, cleanSubscription, getAdmin, getAuthenticatedUser, getVapid, validTimezone } from "../lib/push-shared.mjs";

export default async function handler(req) {
  if (req.method === "GET") {
    try { return answer({ publicKey: getVapid() }); }
    catch (err) { console.error(err.message); return answer({ error: "Notificações ainda não foram configuradas no servidor." }, 503); }
  }
  if (!["POST", "DELETE"].includes(req.method)) return answer({ error: "Método não permitido." }, 405);

  try {
    const admin = getAdmin();
    const user = await getAuthenticatedUser(req, admin);
    if (!user) return answer({ error: "Faça login novamente para configurar notificações." }, 401);

    let body;
    try { body = await req.json(); }
    catch { return answer({ error: "JSON inválido." }, 400); }

    if (req.method === "DELETE") {
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return answer({ error: "Inscrição inválida." }, 400);
      const { error } = await admin.from("push_subscriptions")
        .delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint);
      if (error) throw error;
      return answer({ ok: true });
    }

    if (body.action === "subscribe") {
      getVapid();
      const subscription = cleanSubscription(body.subscription);
      const timezone = body.timezone;
      const lead = Number(body.leadMinutes);
      if (!subscription || !validTimezone(timezone) || ![5, 15, 30, 60].includes(lead)) {
        return answer({ error: "Dados de inscrição inválidos." }, 400);
      }
      const { error } = await admin.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription,
        timezone,
        lead_minutes: lead,
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return answer({ ok: true });
    }

    if (body.action === "test") {
      getVapid();
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return answer({ error: "Inscrição inválida." }, 400);
      const { data: row, error } = await admin.from("push_subscriptions")
        .select("id, subscription, last_test_at")
        .eq("user_id", user.id).eq("endpoint", subscription.endpoint).maybeSingle();
      if (error) throw error;
      if (!row) return answer({ error: "Ative as notificações antes do teste." }, 404);
      if (row.last_test_at && Date.now() - Date.parse(row.last_test_at) < 60000) {
        return answer({ error: "Aguarde 1 minuto entre os testes." }, 429);
      }
      const { error: updateError } = await admin.from("push_subscriptions")
        .update({ last_test_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", user.id);
      if (updateError) throw updateError;
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title: "Organiza · Teste", body: "Notificações funcionando! Você receberá lembretes das suas tarefas.",
          url: "/home.html", tag: "organiza-push-test"
        }), { TTL: 120, timeout: 8000 });
        return answer({ ok: true });
      } catch (pushError) {
        if ([404, 410].includes(pushError.statusCode)) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          return answer({ error: "Inscrição expirada. Desative e ative novamente." }, 410);
        }
        console.error("Erro de teste push:", pushError.statusCode || pushError.message);
        return answer({ error: "O navegador não aceitou o envio de teste. Confira suas permissões." }, 502);
      }
    }
    return answer({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("Falha no endpoint de notificações:", error.message);
    return answer({ error: "Falha no servidor. Confira as variáveis e a tabela de notificações." }, 500);
  }
}

import webpush from "web-push";
import { DateTime } from "luxon";
import { getAdmin, getVapid } from "../lib/push-shared.mjs";
import { decidirLembreteAntecipado } from "../lib/reminder-time.mjs";

const PAGE_SIZE = 500;
const MAX_SENDS_PER_RUN = 80; // Protege a execução contra excesso de chamadas na função agendada.

async function fetchAll(admin, table, columns, filters = (query) => query) {
  const results = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const query = filters(admin.from(table).select(columns).order("id", { ascending: true }).range(start, start + PAGE_SIZE - 1));
    const { data, error } = await query;
    if (error) throw error;
    results.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return results;
  }
}

export default async function handler() {
  try {
    const admin = getAdmin();
    getVapid();
    const now = DateTime.utc();
    // Limita tarefas candidatas por data sem assumir que todos usam o fuso UTC.
    const yesterday = now.minus({ days: 2 }).toISODate();
    const tomorrow = now.plus({ days: 2 }).toISODate();
    const subscriptions = await fetchAll(admin, "push_subscriptions",
      "id,user_id,subscription,timezone,lead_minutes");
    if (!subscriptions.length) return;

    const byUser = new Map();
    for (const sub of subscriptions) {
      if (!byUser.has(sub.user_id)) byUser.set(sub.user_id, []);
      byUser.get(sub.user_id).push(sub);
    }
    const tasks = await fetchAll(admin, "tarefas", "id,user_id,texto,data_limite,hora_limite,concluida",
      (q) => q.eq("concluida", false).not("hora_limite", "is", null)
        .gte("data_limite", yesterday).lte("data_limite", tomorrow));
    let sent = 0;
    for (const task of tasks) {
      const targets = byUser.get(task.user_id) || [];
      for (const row of targets) {
        if (sent >= MAX_SENDS_PER_RUN) {
          console.warn("Limite de envios da rodada atingido; verifique escalabilidade.");
          return;
        }
        const localTime = String(task.hora_limite || "").slice(0, 5);
        const due = DateTime.fromISO(`${task.data_limite}T${localTime}`, { zone: row.timezone });
        if (!due.isValid) continue;
        const scheduledFor = due.toUTC().toISO();
        // NUNCA envia push depois da hora. O cron roda a cada 5 minutos:
        // toleramos uma janela pequena depois do instante programado,
        // mas sempre antes do vencimento real da tarefa.
        const lembrete = decidirLembreteAntecipado(
          now.toMillis(), due.toMillis(), Number(row.lead_minutes)
        );
        if (!lembrete) continue;

        // Reconfirma o relógio real: uma rodada com muitos usuários pode demorar.
        // Jamais reserva nem envia uma notificação antecipada se a tarefa já venceu.
        if (!decidirLembreteAntecipado(Date.now(), due.toMillis(), Number(row.lead_minutes))) continue;

        // Reforço contra tarefas alteradas/concluídas entre a consulta e o envio.
        const { data: latest, error: latestError } = await admin.from("tarefas")
          .select("concluida,data_limite,hora_limite,user_id").eq("id", task.id).maybeSingle();
        if (latestError || !latest || latest.concluida || latest.user_id !== row.user_id ||
            latest.data_limite !== task.data_limite ||
            String(latest.hora_limite || "").slice(0,5) !== localTime) continue;

        // Inserção com restrição UNIQUE: duas execuções simultâneas não enviam em duplicidade.
        const { data: claim, error: claimError } = await admin.from("push_delivery_log").insert({
          subscription_id: row.id,
          task_id: task.id,
          scheduled_for: scheduledFor,
          lead_minutes: row.lead_minutes
        }).select("id").single();
        if (claimError?.code === "23505") continue;
        if (claimError) { console.error("Falha ao reservar lembrete:", claimError.message); continue; }
        try {
          // O Push Service não deve guardar um lembrete para entregar após o prazo.
          const segundosRestantes = Math.floor((due.toMillis() - Date.now()) / 1000);
          if (segundosRestantes <= 0) {
            await admin.from("push_delivery_log").delete().eq("id", claim.id);
            continue;
          }
          await webpush.sendNotification(row.subscription, JSON.stringify({
            title: "Organiza · Lembrete de tarefa",
            body: `${task.texto} — começa em aproximadamente ${Math.ceil(segundosRestantes / 60)} minuto${Math.ceil(segundosRestantes / 60) === 1 ? "" : "s"}.`,
            url: "/home.html",
            dueAt: scheduledFor,
            tag: `task-${task.id}-${Date.parse(scheduledFor)}-${row.lead_minutes}`
          }), { TTL: Math.min(900, segundosRestantes), timeout: 7000 });
          sent++;
        } catch (err) {
          if ([404, 410].includes(err.statusCode)) {
            await admin.from("push_subscriptions").delete().eq("id", row.id);
          } else {
            // Falha transitória: permite tentativa na próxima rodada.
            await admin.from("push_delivery_log").delete().eq("id", claim.id);
            console.error("Push falhou:", err.statusCode || err.message);
          }
        }
      }
    }
    console.log(`Organiza Web Push: ${sent} notificações enviadas nesta rodada.`);
  } catch (error) {
    console.error("Falha no agendamento Web Push:", error.message);
    throw error;
  }
}

export const config = { schedule: "*/5 * * * *" }; // UTC; a conversão de cada usuário usa o timezone registrado.

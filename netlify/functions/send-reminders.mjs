import webpush from "web-push";
import { DateTime } from "luxon";
import { getAdmin, getVapid } from "../lib/push-shared.mjs";

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
        const before = due.minus({ minutes: row.lead_minutes });
        const late = due.plus({ minutes: 5 });
        const minutesAfterReminder = now.diff(before, "minutes").minutes;
        const minutesAfterLate = now.diff(late, "minutes").minutes;
        // Um lembrete antecipado e, se seguir pendente, um aviso de atraso.
        const lateNotice = minutesAfterLate >= 0 && minutesAfterLate < 10;
        if (!(minutesAfterReminder >= 0 && minutesAfterReminder < 10) && !lateNotice) continue;
        const noticeLead = lateNotice ? -1 : row.lead_minutes;

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
          lead_minutes: noticeLead
        }).select("id").single();
        if (claimError?.code === "23505") continue;
        if (claimError) { console.error("Falha ao reservar lembrete:", claimError.message); continue; }
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({
            title: lateNotice ? "Organiza · Tarefa atrasada" : "Organiza · Lembrete de tarefa",
            body: lateNotice
              ? `${task.texto} — o horário já passou e a tarefa ainda está pendente.`
              : `${task.texto} — começa em aproximadamente ${row.lead_minutes} minutos.`,
            url: "/home.html",
            tag: `task-${task.id}-${Date.parse(scheduledFor)}-${noticeLead}`
          }), { TTL: 900, timeout: 7000 });
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

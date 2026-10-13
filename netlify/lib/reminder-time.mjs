// Regra de agendamento isolada para testes. Relógio e vencimento em milissegundos UTC.
// Cron: a cada 5 min. A pequena tolerância não pode ultrapassar o prazo real.
export const JANELA_MINUTOS = 6;
const MINUTO = 60_000;

export function decidirLembreteAntecipado(agoraMs, vencimentoMs, antecedenciaMin) {
  if (![5, 15, 30, 60].includes(antecedenciaMin) ||
      !Number.isFinite(agoraMs) || !Number.isFinite(vencimentoMs)) return null;

  // Mais importante que qualquer margem: tarefa vencida não recebe aviso antecipado.
  if (agoraMs >= vencimentoMs) return null;

  const instanteAviso = vencimentoMs - antecedenciaMin * MINUTO;
  const fimDaJanela = Math.min(
    instanteAviso + JANELA_MINUTOS * MINUTO,
    vencimentoMs
  );
  if (agoraMs < instanteAviso || agoraMs >= fimDaJanela) return null;

  return {
    minutosRestantes: Math.max(1, Math.ceil((vencimentoMs - agoraMs) / MINUTO))
  };
}

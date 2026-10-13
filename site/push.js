// Organiza Web Push: configura as notificações deste navegador/dispositivo.
(() => {
  "use strict";

  const banco = window.organizaClient;
  const $ = (id) => document.getElementById(id);
  const modal = $("modal-notificacoes");
  const abrir = $("abrir-notificacoes");
  const fechar = $("fechar-notificacoes");
  const ativar = $("push-ativar");
  const desativar = $("push-desativar");
  const testar = $("push-testar");
  const antecedencia = $("push-antecedencia");
  const status = $("push-status");
  const mensagem = $("push-mensagem");
  let busy = false;
  const KEY_ANTECEDENCIA = "organiza-push-antecedencia";
  const antecedenciaSalva = localStorage.getItem(KEY_ANTECEDENCIA);
  if (["5", "15", "30", "60"].includes(antecedenciaSalva)) {
    antecedencia.value = antecedenciaSalva;
  }

  function feedback(text, error = false) {
    mensagem.textContent = text;
    mensagem.hidden = !text;
    mensagem.dataset.kind = error ? "error" : "success";
  }

  function suportado() {
    return window.isSecureContext && "serviceWorker" in navigator &&
      "PushManager" in window && "Notification" in window;
  }

  function iosSemInstalacao() {
    const eIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const instalado = window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;
    return eIOS && !instalado;
  }

  function mensagemErroPush(error) {
    const texto = String(error?.message || "");
    if (/push service error|registration failed/i.test(texto)) {
      return "O serviço Push deste navegador não respondeu. Verifique rede, VPN, proxy, extensões de privacidade e se o navegador está atualizado. Teste também em outra rede. Detalhes: " + texto;
    }
    if (/AbortError|NetworkError|Failed to fetch/i.test(error?.name + " " + texto)) {
      return "Falha de rede ao registrar notificações. Verifique as permissões e a conexão do navegador com o serviço Push. Detalhes: " + texto;
    }
    if (/NotAllowedError|permission|denied/i.test(error?.name + " " + texto)) {
      return "Notificações bloqueadas. Nas configurações do navegador, permita notificações para organizadev.netlify.app.";
    }
    if (/InvalidStateError|not active/i.test(error?.name + " " + texto)) {
      return "O Service Worker ainda não está pronto. Atualize a página e tente novamente.";
    }
    return texto || "Não foi possível ativar notificações neste navegador.";
  }

  function uint8Array(chave) {
    const padding = "=".repeat((4 - (chave.length % 4)) % 4);
    const base64 = (chave + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }

  async function getToken() {
    const { data, error } = await banco.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Sua sessão expirou. Faça login novamente.");
    return data.session.access_token;
  }

  async function requisicao(method, body) {
    const token = await getToken();
    const response = await fetch("/api/push", {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    let json;
    try { json = await response.json(); }
    catch { throw new Error("A função de notificações não respondeu. Confira o deploy no Netlify."); }
    if (!response.ok) throw new Error(json.error || `Falha HTTP ${response.status}`);
    return json;
  }

  async function subscricaoAtual() {
    const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return { registro, subscricao: await registro.pushManager.getSubscription() };
  }

  async function estado() {
    if (!suportado() || iosSemInstalacao()) {
      status.textContent = iosSemInstalacao()
        ? "No iPhone/iPad, adicione o Organiza à Tela de Início e abra pelo ícone para ativar o Web Push."
        : "Este navegador ou modo não suporta Web Push. Use uma versão atual do Chrome, Edge, Firefox ou Safari com notificações habilitadas.";
      ativar.disabled = true;
      desativar.disabled = true;
      testar.disabled = true;
      return;
    }
    const { subscricao } = await subscricaoAtual();
    const ativo = Boolean(subscricao) && Notification.permission === "granted";
    status.textContent = ativo
      ? "Notificações ativadas neste dispositivo. Os lembretes podem chegar mesmo com o site fechado."
      : Notification.permission === "denied"
        ? "Notificações bloqueadas pelo navegador. Libere-as nas configurações do site."
        : "Notificações desativadas neste dispositivo.";
    ativar.disabled = ativo || Notification.permission === "denied";
    desativar.disabled = !subscricao;
    testar.disabled = !ativo;
  }

  async function executar(callback) {
    if (busy) return;
    busy = true;
    ativar.disabled = desativar.disabled = testar.disabled = true;
    try { await callback(); }
    catch (err) { feedback(mensagemErroPush(err), true); }
    finally {
      busy = false;
      try { await estado(); }
      catch (err) { feedback("Não foi possível consultar o estado: " + err.message, true); }
    }
  }

  abrir.addEventListener("click", async () => {
    feedback("");
    modal.showModal();
    try { await estado(); }
    catch (err) { feedback(err.message, true); }
  });
  fechar.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });

  ativar.addEventListener("click", async () => {
    // Solicitação de permissão DIRETO do clique (importante para iOS e navegadores modernos).
    if (!suportado()) return;
    let permission;
    try { permission = await Notification.requestPermission(); }
    catch (error) { feedback("O navegador não autorizou a solicitação: " + error.message, true); return; }
    if (permission !== "granted") {
      feedback("Permissão negada. Autorize notificações nas configurações do navegador.", true);
      await estado();
      return;
    }
    await executar(async () => {
      const response = await fetch("/api/push", { cache: "no-store" });
      const config = await response.json();
      if (!response.ok || !config.publicKey) throw new Error(config.error || "Chave VAPID não configurada no Netlify.");
      const { subscricao: antiga } = await subscricaoAtual();
      // Aguarda o Service Worker ficar ativo, importante em alguns navegadores.
      const registro = await navigator.serviceWorker.ready;
      const subscricao = antiga || await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: uint8Array(config.publicKey)
      });
      try {
        await requisicao("POST", {
          action: "subscribe", subscription: subscricao.toJSON(),
          leadMinutes: Number(antecedencia.value),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        });
      } catch (err) {
        if (!antiga) await subscricao.unsubscribe();
        throw err;
      }
      localStorage.setItem(KEY_ANTECEDENCIA, antecedencia.value);
      feedback("Notificações ativadas! O aviso antecipado chega antes do horário, sujeito ao agendamento e à entrega do navegador.");
    });
  });

  desativar.addEventListener("click", () => executar(async () => {
    const { subscricao } = await subscricaoAtual();
    if (subscricao) {
      await requisicao("DELETE", { subscription: subscricao.toJSON() });
      await subscricao.unsubscribe();
    }
    feedback("Notificações desativadas neste dispositivo.");
  }));

  testar.addEventListener("click", () => executar(async () => {
    const { subscricao } = await subscricaoAtual();
    if (!subscricao) throw new Error("Ative as notificações primeiro.");
    await requisicao("POST", { action: "test", subscription: subscricao.toJSON() });
    feedback("Teste enviado! Confira as notificações do sistema operacional.");
  }));

  antecedencia.addEventListener("change", async () => {
    if (!suportado()) return;
    await executar(async () => {
      const { subscricao } = await subscricaoAtual();
      if (!subscricao || Notification.permission !== "granted") return;
      await requisicao("POST", {
        action: "subscribe", subscription: subscricao.toJSON(),
        leadMinutes: Number(antecedencia.value),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      });
      localStorage.setItem(KEY_ANTECEDENCIA, antecedencia.value);
      feedback("Antecedência atualizada para este dispositivo.");
    });
  });

  // Evita notificação de tarefas privadas após sair de uma conta em dispositivo compartilhado.
  window.organizaDisablePushForLogout = async () => {
    if (!suportado()) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try { await requisicao("DELETE", { subscription: subscription.toJSON() }); }
    finally { await subscription.unsubscribe(); }
  };
})();

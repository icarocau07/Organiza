// Organiza: tarefas no Supabase, prazos, recorrência e modais de tarefas/perfil.
(() => {
  "use strict";

  const banco = window.organizaClient;
  const $ = (seletor) => document.querySelector(seletor);

  const elementos = {
    carregando: $("#carregando"),
    aplicativo: $("#aplicativo"),
    abrirCriar: $("#abrir-criar-tarefa"),
    modalTarefa: $("#modal-tarefa"),
    fecharModalTarefa: $("#fechar-modal-tarefa"),
    cancelarTarefa: $("#cancelar-tarefa"),
    tituloModalTarefa: $("#titulo-modal-tarefa"),
    mensagemTarefa: $("#mensagem-tarefa"),
    formulario: $("#task-form"),
    texto: $("#task-input"),
    categoria: $("#task-category"),
    prioridade: $("#task-priority"),
    dataLimite: $("#task-date"),
    horaLimite: $("#task-time"),
    recorrente: $("#task-recurring"),
    camposRecorrencia: $("#campos-recorrencia"),
    frequencia: $("#task-frequency"),
    adicionar: $("#adicionar-tarefa"),
    lista: $("#task-list"),
    contador: $("#contador"),
    resumoAtrasadas: $("#resumo-atrasadas"),
    vazio: $("#mensagem-vazia"),
    limpar: $("#limpar-concluidas"),
    filtroStatus: $("#filtro-status"),
    filtroCategoria: $("#filtro-categoria"),
    aviso: $("#aviso"),
    tema: $("#theme-toggle"),
    abrirPerfil: $("#abrir-perfil"),
    modal: $("#modal-perfil"),
    fecharPerfil: $("#fechar-perfil"),
    avatarTopo: $("#avatar-topo"),
    avatarModal: $("#avatar-modal"),
    nomeExibido: $("#modal-nome-exibido"),
    emailPerfil: $("#modal-email"),
    dataPerfil: $("#modal-data"),
    totalPerfil: $("#modal-total"),
    formPerfil: $("#form-perfil-modal"),
    nomePerfil: $("#modal-nome"),
    salvarPerfil: $("#modal-salvar"),
    mensagemPerfil: $("#modal-mensagem"),
    sairConta: $("#sair-conta")
  };

  const categorias = { pessoal: "Pessoal", trabalho: "Trabalho", estudos: "Estudos" };
  const prioridades = { baixa: "Baixa", media: "Média", alta: "Alta" };
  const frequencias = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal" };
  let usuarioAtual = null;
  let tarefas = [];
  let tarefaEmEdicao = null;

  function mostrarMensagem(elemento, texto, erro = false) {
    elemento.textContent = texto;
    elemento.dataset.kind = erro ? "error" : "success";
    elemento.hidden = !texto;
  }

  function atualizarBotaoTema() {
    const escuro = document.documentElement.dataset.theme === "dark";
    elementos.tema.textContent = escuro ? "☀" : "☾";
    elementos.tema.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo escuro");
  }

  elementos.tema.addEventListener("click", () => {
    const escuro = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = escuro ? "dark" : "light";
    localStorage.setItem("organiza-tema", escuro ? "escuro" : "claro");
    atualizarBotaoTema();
  });
  atualizarBotaoTema();

  // Data e horário guardados separadamente e interpretados no horário LOCAL.
  // Sem horário: a tarefa só fica atrasada APÓS o fim da data indicada.
  function hojeLocal() {
    return dataISO(new Date());
  }

  function converterData(data) {
    const [ano, mes, dia] = data.split("-").map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  }

  function dataISO(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  }

  function formatarData(data) {
    return data ? converterData(data).toLocaleDateString("pt-BR") : "";
  }

  function horaTarefa(tarefa) {
    // PostgreSQL time pode retornar HH:MM:SS; input type=time trabalha com HH:MM.
    return typeof tarefa.hora_limite === "string" ? tarefa.hora_limite.slice(0, 5) : "";
  }

  function momentoLimite(tarefa) {
    if (!tarefa.data_limite) return null;
    const [ano, mes, dia] = tarefa.data_limite.split("-").map(Number);
    const hora = horaTarefa(tarefa);
    if (hora) {
      const [h, m] = hora.split(":").map(Number);
      return new Date(ano, mes - 1, dia, h, m, 0, 0);
    }
    return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
  }

  function formatarPrazo(tarefa) {
    const data = formatarData(tarefa.data_limite);
    const hora = horaTarefa(tarefa);
    return hora ? `${data} às ${hora}` : data;
  }

  function estaAtrasada(tarefa, agora = new Date()) {
    const limite = momentoLimite(tarefa);
    return !tarefa.concluida && limite !== null && limite.getTime() < agora.getTime();
  }

  function diferencaDias(dataInicio, dataFim) {
    // Datas em UTC ao meio-dia só para contar os dias, sem efeitos de horário de verão.
    const inicio = Date.parse(`${dataInicio}T12:00:00Z`);
    const fim = Date.parse(`${dataFim}T12:00:00Z`);
    return Math.round((fim - inicio) / 86400000);
  }

  function descricaoAtraso(tarefa, agora) {
    if (!horaTarefa(tarefa)) {
      const dias = diferencaDias(tarefa.data_limite, dataISO(agora));
      return `${dias} ${dias === 1 ? "dia" : "dias"}`;
    }
    const minutos = Math.max(1, Math.ceil((agora - momentoLimite(tarefa)) / 60000));
    if (minutos < 60) return `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas} ${horas === 1 ? "hora" : "horas"}`;
    const dias = Math.floor(minutos / 1440);
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }

  function proximaDataRecorrente(dataAnterior, frequencia, hora = null) {
    const agora = new Date();
    let proxima = dataAnterior;
    // Avança a periodicidade até o primeiro prazo após este instante,
    // preservando o mesmo horário para a próxima ocorrência.
    for (let i = 0; i < 10000; i++) {
      const d = converterData(proxima);
      if (frequencia === "diaria") d.setDate(d.getDate() + 1);
      else if (frequencia === "semanal") d.setDate(d.getDate() + 7);
      else if (frequencia === "mensal") {
        const diaOriginal = d.getDate();
        const ultimoProximoMes = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + 1);
        d.setDate(Math.min(diaOriginal, ultimoProximoMes));
      } else throw new Error("Frequência de recorrência inválida.");
      proxima = dataISO(d);
      if (momentoLimite({ data_limite: proxima, hora_limite: hora }) > agora) return proxima;
    }
    throw new Error("Não foi possível calcular a próxima data.");
  }

  function atualizarCampoHorario() {
    const comData = Boolean(elementos.dataLimite.value);
    elementos.horaLimite.disabled = !comData;
    if (!comData) elementos.horaLimite.value = "";
  }

  elementos.dataLimite.addEventListener("change", atualizarCampoHorario);

  function atualizarCamposRecorrencia() {
    const ativado = elementos.recorrente.checked;
    elementos.camposRecorrencia.hidden = !ativado;
    elementos.dataLimite.required = ativado;
    elementos.frequencia.required = ativado;
  }

  elementos.recorrente.addEventListener("change", atualizarCamposRecorrencia);

  function abrirModalTarefa(tarefa = null) {
    tarefaEmEdicao = tarefa;
    elementos.formulario.reset();
    mostrarMensagem(elementos.mensagemTarefa, "");
    elementos.tituloModalTarefa.textContent = tarefa ? "Editar tarefa" : "Criar tarefa";
    elementos.adicionar.textContent = tarefa ? "Salvar alterações" : "Criar tarefa";
    elementos.adicionar.disabled = false;

    if (tarefa) {
      elementos.texto.value = tarefa.texto;
      elementos.categoria.value = tarefa.categoria;
      elementos.prioridade.value = tarefa.prioridade;
      elementos.dataLimite.value = tarefa.data_limite || "";
      elementos.horaLimite.value = horaTarefa(tarefa);
      elementos.recorrente.checked = Boolean(tarefa.recorrente);
      elementos.frequencia.value = tarefa.frequencia_recorrencia || "semanal";
    }
    atualizarCamposRecorrencia();
    atualizarCampoHorario();
    elementos.modalTarefa.showModal();
    elementos.texto.focus();
  }

  elementos.abrirCriar.addEventListener("click", () => abrirModalTarefa());
  elementos.fecharModalTarefa.addEventListener("click", () => elementos.modalTarefa.close());
  elementos.cancelarTarefa.addEventListener("click", () => elementos.modalTarefa.close());
  elementos.modalTarefa.addEventListener("click", (evento) => {
    if (evento.target === elementos.modalTarefa) elementos.modalTarefa.close();
  });

  async function carregarTarefas() {
    if (!usuarioAtual) return false;
    try {
      const { data, error } = await banco
        .from("tarefas")
        .select("id, user_id, texto, categoria, prioridade, concluida, criada_em, data_limite, hora_limite, recorrente, frequencia_recorrencia")
        .eq("user_id", usuarioAtual.id)
        .order("criada_em", { ascending: false });
      if (error) throw error;
      tarefas = data || [];
      renderizarTarefas();
      return true;
    } catch (erro) {
      mostrarMensagem(elementos.aviso, "Erro ao carregar tarefas. Confira se executou ATUALIZAR_HORARIO.sql no Supabase (e ATUALIZAR_BANCO.sql se ainda não havia atualizado). Detalhes: " + erro.message, true);
      return false;
    }
  }

  function renderizarTarefas() {
    elementos.lista.replaceChildren();
    const agora = new Date();
    const hoje = dataISO(agora);
    const concluidas = tarefas.filter((tarefa) => tarefa.concluida).length;
    const atrasadas = tarefas.filter((tarefa) => estaAtrasada(tarefa, agora)).length;
    elementos.contador.textContent = `${concluidas} de ${tarefas.length} concluídas`;
    elementos.limpar.disabled = concluidas === 0;
    elementos.resumoAtrasadas.hidden = atrasadas === 0;
    elementos.resumoAtrasadas.textContent = `${atrasadas} ${atrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}`;

    const filtro = elementos.filtroStatus.value;
    const categoria = elementos.filtroCategoria.value;
    const visiveis = tarefas.filter((tarefa) => {
      const estadoCerto = filtro === "todas" ||
        (filtro === "pendentes" && !tarefa.concluida) ||
        (filtro === "concluidas" && tarefa.concluida) ||
        (filtro === "atrasadas" && estaAtrasada(tarefa, agora));
      const categoriaCerta = categoria === "todas" || tarefa.categoria === categoria;
      return estadoCerto && categoriaCerta;
    });

    // Atrasadas no topo, depois prazos mais próximos, sem prazo e concluídas.
    visiveis.sort((a, b) => {
      if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
      const aAtrasada = estaAtrasada(a, agora), bAtrasada = estaAtrasada(b, agora);
      if (aAtrasada !== bAtrasada) return aAtrasada ? -1 : 1;
      if (Boolean(a.data_limite) !== Boolean(b.data_limite)) return a.data_limite ? -1 : 1;
      if (a.data_limite && b.data_limite) {
        const diferenca = momentoLimite(a) - momentoLimite(b);
        if (diferenca !== 0) return diferenca;
      }
      return String(b.criada_em).localeCompare(String(a.criada_em));
    });

    elementos.vazio.hidden = visiveis.length > 0;
    elementos.vazio.textContent = tarefas.length === 0
      ? "Você ainda não tem tarefas. Clique em Criar tarefa!"
      : "Nenhuma tarefa corresponde aos filtros escolhidos.";

    for (const tarefa of visiveis) {
      const atrasada = estaAtrasada(tarefa, agora);
      const item = document.createElement("li");
      item.className = "task-item";
      item.classList.toggle("completed", tarefa.concluida);
      item.classList.toggle("overdue", atrasada);
      item.classList.toggle("due-today", !tarefa.concluida && tarefa.data_limite === hoje);

      const label = document.createElement("label");
      label.className = "task-main";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = tarefa.concluida;
      checkbox.setAttribute("aria-label", `Concluir: ${tarefa.texto}`);

      const conteudo = document.createElement("span");
      conteudo.className = "task-content";
      const titulo = document.createElement("span");
      titulo.className = "task-title";
      titulo.textContent = tarefa.texto;
      const detalhes = document.createElement("small");
      const corPrioridade = { alta: "priority-high", media: "priority-medium", baixa: "priority-low" };
      detalhes.className = `task-details ${corPrioridade[tarefa.prioridade] || ""}`;
      detalhes.textContent = `${categorias[tarefa.categoria] || "Pessoal"} · Prioridade ${prioridades[tarefa.prioridade] || "Média"}`;
      conteudo.append(titulo, detalhes);

      const informacoes = document.createElement("span");
      informacoes.className = "task-meta";
      if (tarefa.data_limite) {
        const prazo = document.createElement("span");
        prazo.className = "due-badge";
        if (atrasada) {
          prazo.classList.add("is-overdue");
          prazo.textContent = `⏰ Atrasada há ${descricaoAtraso(tarefa, agora)} · ${formatarPrazo(tarefa)}`;
        } else if (!tarefa.concluida && tarefa.data_limite === hoje) {
          prazo.classList.add("is-today");
          prazo.textContent = horaTarefa(tarefa)
            ? `● Vence hoje às ${horaTarefa(tarefa)}`
            : `● Vence hoje (até 23h59)`;
        } else {
          prazo.textContent = `📅 ${tarefa.concluida ? "Prazo" : "Até"} ${formatarPrazo(tarefa)}`;
        }
        informacoes.append(prazo);
      }
      if (tarefa.recorrente) {
        const repeticao = document.createElement("span");
        repeticao.className = "recurrence-badge";
        repeticao.textContent = `↻ ${frequencias[tarefa.frequencia_recorrencia] || "Recorrente"}`;
        informacoes.append(repeticao);
      }
      conteudo.append(informacoes);
      label.append(checkbox, conteudo);

      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        const finalizar = checkbox.checked;
        try {
          const alteracoes = { concluida: finalizar };
          if (finalizar && tarefa.recorrente) {
            // Ciclo novo: a tarefa permanece pendente com a próxima data.
            alteracoes.concluida = false;
            alteracoes.data_limite = proximaDataRecorrente(
              tarefa.data_limite, tarefa.frequencia_recorrencia, tarefa.hora_limite
            );
          }
          const { error } = await banco.from("tarefas")
            .update(alteracoes)
            .eq("id", tarefa.id)
            .eq("user_id", usuarioAtual.id);
          if (error) throw error;
          const carregou = await carregarTarefas();
          if (carregou && finalizar && tarefa.recorrente) {
            mostrarMensagem(elementos.aviso, `Tarefa recorrente concluída! Próxima realização: ${formatarPrazo({ data_limite: alteracoes.data_limite, hora_limite: tarefa.hora_limite })}.`);
          }
        } catch (erro) {
          mostrarMensagem(elementos.aviso, "Erro ao atualizar tarefa: " + erro.message, true);
          await carregarTarefas();
        }
      });

      const acoes = document.createElement("div");
      acoes.className = "task-actions";
      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "secondary-button";
      editar.textContent = "Editar";
      editar.setAttribute("aria-label", `Editar: ${tarefa.texto}`);
      editar.addEventListener("click", () => abrirModalTarefa(tarefa));

      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "danger-button";
      excluir.textContent = "Excluir";
      excluir.setAttribute("aria-label", `Excluir: ${tarefa.texto}`);
      excluir.addEventListener("click", async () => {
        if (!window.confirm(`Excluir a tarefa "${tarefa.texto}"?`)) return;
        excluir.disabled = true;
        try {
          const { error } = await banco.from("tarefas")
            .delete()
            .eq("id", tarefa.id)
            .eq("user_id", usuarioAtual.id);
          if (error) throw error;
          await carregarTarefas();
          mostrarMensagem(elementos.aviso, "Tarefa excluída.");
        } catch (erro) {
          excluir.disabled = false;
          mostrarMensagem(elementos.aviso, "Erro ao excluir tarefa: " + erro.message, true);
        }
      });
      acoes.append(editar, excluir);
      item.append(label, acoes);
      elementos.lista.append(item);
    }
  }

  elementos.formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!usuarioAtual) return;
    const texto = elementos.texto.value.trim();
    if (!texto) return;
    const recorrente = elementos.recorrente.checked;
    const dataLimite = elementos.dataLimite.value || null;
    const horaLimite = elementos.horaLimite.value || null;
    if (horaLimite && !dataLimite) {
      mostrarMensagem(elementos.mensagemTarefa, "Escolha uma data antes de informar o horário.", true);
      elementos.dataLimite.focus();
      return;
    }
    if (recorrente && !dataLimite) {
      mostrarMensagem(elementos.mensagemTarefa, "Informe uma data para a tarefa recorrente.", true);
      elementos.dataLimite.focus();
      return;
    }

    const valores = {
      texto,
      categoria: elementos.categoria.value,
      prioridade: elementos.prioridade.value,
      data_limite: dataLimite,
      hora_limite: dataLimite ? horaLimite : null,
      recorrente,
      frequencia_recorrencia: recorrente ? elementos.frequencia.value : null
    };
    elementos.adicionar.disabled = true;
    try {
      let query;
      if (tarefaEmEdicao) {
        query = banco.from("tarefas").update(valores)
          .eq("id", tarefaEmEdicao.id).eq("user_id", usuarioAtual.id);
      } else {
        query = banco.from("tarefas").insert({
          user_id: usuarioAtual.id, ...valores, concluida: false
        });
      }
      const { error } = await query;
      if (error) throw error;
      const foiEdicao = Boolean(tarefaEmEdicao);
      elementos.modalTarefa.close();
      await carregarTarefas();
      mostrarMensagem(elementos.aviso, foiEdicao ? "Tarefa atualizada!" : "Tarefa criada!");
    } catch (erro) {
      mostrarMensagem(elementos.mensagemTarefa, "Não foi possível salvar: " + erro.message, true);
    } finally {
      elementos.adicionar.disabled = false;
    }
  });

  // Atualiza o aviso de atraso quando o relógio passa do horário combinado.
  // Não faz novas consultas à API: só redesenha as tarefas já carregadas.
  window.setInterval(() => {
    if (usuarioAtual && !document.hidden) renderizarTarefas();
  }, 30000);

  elementos.filtroStatus.addEventListener("change", renderizarTarefas);
  elementos.filtroCategoria.addEventListener("change", renderizarTarefas);
  window.addEventListener("focus", () => { if (usuarioAtual) renderizarTarefas(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && usuarioAtual) renderizarTarefas();
  });

  elementos.limpar.addEventListener("click", async () => {
    const quantidade = tarefas.filter((tarefa) => tarefa.concluida).length;
    if (quantidade === 0 || !usuarioAtual) return;
    if (!window.confirm(`Excluir permanentemente ${quantidade} tarefa(s) concluída(s)?`)) return;
    elementos.limpar.disabled = true;
    try {
      const { error } = await banco.from("tarefas")
        .delete().eq("user_id", usuarioAtual.id).eq("concluida", true);
      if (error) throw error;
      await carregarTarefas();
      mostrarMensagem(elementos.aviso, "Tarefas concluídas removidas.");
    } catch (erro) {
      mostrarMensagem(elementos.aviso, "Erro ao limpar tarefas: " + erro.message, true);
      elementos.limpar.disabled = false;
    }
  });

  // ---------------- Perfil em modal ----------------
  function atualizarAvatar(usuario) {
    const nome = usuario.user_metadata?.display_name?.trim() || usuario.email || "Usuário";
    const inicial = Array.from(nome)[0]?.toUpperCase() || "U";
    elementos.avatarTopo.textContent = inicial;
    elementos.avatarModal.textContent = inicial;
    elementos.nomeExibido.textContent = usuario.user_metadata?.display_name?.trim() || "Minha conta";
  }

  async function carregarPerfil() {
    elementos.salvarPerfil.disabled = true;
    mostrarMensagem(elementos.mensagemPerfil, "");

    try {
      const { data, error } = await banco.auth.getUser();
      if (error) throw error;
      if (!data.user) {
        window.location.replace("./");
        return;
      }
      usuarioAtual = data.user;
      atualizarAvatar(usuarioAtual);

      elementos.emailPerfil.textContent = usuarioAtual.email || "Não informado";
      elementos.dataPerfil.textContent = new Date(usuarioAtual.created_at).toLocaleDateString("pt-BR");
      elementos.nomePerfil.value = usuarioAtual.user_metadata?.display_name || "";

      const { count, error: erroContagem } = await banco
        .from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", usuarioAtual.id);

      elementos.totalPerfil.textContent = erroContagem ? "Indisponível" : String(count ?? 0);
      if (erroContagem) mostrarMensagem(elementos.mensagemPerfil, erroContagem.message, true);
      elementos.salvarPerfil.disabled = false;
    } catch (erro) {
      mostrarMensagem(elementos.mensagemPerfil, "Erro ao carregar perfil: " + erro.message, true);
    }
  }

  elementos.abrirPerfil.addEventListener("click", () => {
    elementos.modal.showModal();
    carregarPerfil();
  });
  elementos.fecharPerfil.addEventListener("click", () => elementos.modal.close());
  elementos.modal.addEventListener("click", (evento) => {
    if (evento.target === elementos.modal) elementos.modal.close();
  });

  elementos.formPerfil.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nome = elementos.nomePerfil.value.trim();
    if (!nome) return;
    elementos.salvarPerfil.disabled = true;

    try {
      const { data, error } = await banco.auth.updateUser({ data: { display_name: nome } });
      if (error) throw error;
      usuarioAtual = data.user;
      atualizarAvatar(data.user);
      mostrarMensagem(elementos.mensagemPerfil, "Nome atualizado com sucesso!");
    } catch (erro) {
      mostrarMensagem(elementos.mensagemPerfil, "Erro ao salvar nome: " + erro.message, true);
    } finally {
      elementos.salvarPerfil.disabled = false;
    }
  });

  // Encerra a sessão pelo botão localizado dentro do modal de perfil.
  elementos.sairConta.addEventListener("click", async () => {
    elementos.sairConta.disabled = true;
    elementos.sairConta.textContent = "Saindo...";
    mostrarMensagem(elementos.mensagemPerfil, "");

    try {
      const { error } = await banco.auth.signOut();
      if (error) throw error;
      window.location.replace("./");
    } catch (erro) {
      mostrarMensagem(elementos.mensagemPerfil, "Não foi possível sair: " + erro.message, true);
      elementos.sairConta.disabled = false;
      elementos.sairConta.textContent = "↪ Sair da conta";
    }
  });

  // ---------------- Autenticação inicial ----------------
  banco.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") window.location.replace("./");
  });

  async function iniciar() {
    try {
      const { data, error } = await banco.auth.getUser();
      if (error) throw error;
      if (!data.user) {
        window.location.replace("./");
        return;
      }

      usuarioAtual = data.user;
      atualizarAvatar(usuarioAtual);
      elementos.abrirCriar.disabled = false;
      await carregarTarefas();
      elementos.carregando.hidden = true;
      elementos.aplicativo.hidden = false;
    } catch (erro) {
      elementos.carregando.textContent = "Erro ao verificar a conta: " + erro.message;
    }
  }

  elementos.abrirCriar.disabled = true;
  iniciar();
})();

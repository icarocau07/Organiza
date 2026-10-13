// Página para redefinir a senha após clicar no link enviado pelo Supabase.
(() => {
  "use strict";

  const banco = window.organizaClient;
  const formulario = document.querySelector("#reset-form");
  const senha = document.querySelector("#nova-senha");
  const confirmar = document.querySelector("#confirmar-senha");
  const salvar = document.querySelector("#salvar-senha");
  const mensagem = document.querySelector("#reset-mensagem");
  const botaoTema = document.querySelector("#theme-toggle");

  let recuperacaoValida = false;
  const veioLink = window.organizaVeioDeRecuperacao === true;

  function mostrarMensagem(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.dataset.kind = erro ? "error" : "success";
  }

  function atualizarTema() {
    const escuro = document.documentElement.dataset.theme === "dark";
    botaoTema.textContent = escuro ? "☀" : "☾";
    botaoTema.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo escuro");
  }

  botaoTema.addEventListener("click", () => {
    const escuro = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = escuro ? "dark" : "light";
    localStorage.setItem("organiza-tema", escuro ? "escuro" : "claro");
    atualizarTema();
  });
  atualizarTema();

  function habilitarFormulario() {
    recuperacaoValida = true;
    formulario.hidden = false;
    salvar.disabled = false;
    mostrarMensagem("Link confirmado! Digite uma senha nova.");
  }

  // O Supabase sinaliza PASSWORD_RECOVERY quando valida o link.
  banco.auth.onAuthStateChange((evento, sessao) => {
    if (evento === "PASSWORD_RECOVERY" && sessao) {
      habilitarFormulario();
    }
  });

  async function verificarLink() {
    // No fluxo de redirecionamento padrão, o fragmento contém type=recovery.
    // Se a SDK detectar a recuperação pelo evento, ele também habilita o form.
    if (!veioLink) {
      mostrarMensagem("Abra esta página pelo link de recuperação recebido no seu e-mail. Se ele expirou, solicite outro na tela de login.", true);
      return;
    }

    try {
      // Aguarda a SDK processar os tokens do link antes de consultar o usuário.
      const { data, error } = await banco.auth.getUser();
      if (error || !data.user) {
        throw error || new Error("Link inválido ou expirado.");
      }
      habilitarFormulario();
    } catch (erro) {
      if (!recuperacaoValida) {
        mostrarMensagem("Não foi possível validar o link. Solicite uma nova recuperação na tela de login.", true);
      }
    }
  }
  verificarLink();

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!recuperacaoValida) return;

    if (senha.value !== confirmar.value) {
      mostrarMensagem("As senhas não coincidem. Confira e tente novamente.", true);
      confirmar.focus();
      return;
    }

    if (senha.value.length < 8) {
      mostrarMensagem("A senha deve ter pelo menos 8 caracteres.", true);
      senha.focus();
      return;
    }

    salvar.disabled = true;
    mostrarMensagem("Salvando sua nova senha...");

    try {
      const { error } = await banco.auth.updateUser({
        password: senha.value
      });
      if (error) throw error;

      // Não precisamos manter a sessão de recuperação aberta.
      const { error: erroSaida } = await banco.auth.signOut();
      formulario.hidden = true;
      senha.value = "";
      confirmar.value = "";
      recuperacaoValida = false;

      if (erroSaida) {
        mostrarMensagem("Senha alterada! Volte para o login. Não foi possível encerrar a sessão automaticamente.");
      } else {
        mostrarMensagem("Senha alterada com sucesso! Volte para o login e entre com a nova senha.");
      }
    } catch (erro) {
      mostrarMensagem("Não foi possível alterar a senha: " + erro.message, true);
      salvar.disabled = false;
    }
  });
})();

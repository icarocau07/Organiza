// Login e cadastro: usa a conexão criada em config.js.
(() => {
  "use strict";

  const banco = window.organizaClient;
  const formulario = document.querySelector("#login-form");
  const email = document.querySelector("#email");
  const senha = document.querySelector("#senha");
  const entrar = document.querySelector("#entrar");
  const cadastrar = document.querySelector("#cadastrar");
  const esqueciSenha = document.querySelector("#esqueci-senha");
  const mensagem = document.querySelector("#mensagem");
  const botaoTema = document.querySelector("#theme-toggle");

  function mostrarMensagem(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.dataset.kind = erro ? "error" : "success";
    mensagem.hidden = !texto;
  }

  function alternarBotoes(bloquear) {
    entrar.disabled = bloquear;
    cadastrar.disabled = bloquear;
    esqueciSenha.disabled = bloquear;
  }

  function atualizarBotaoTema() {
    const escuro = document.documentElement.dataset.theme === "dark";
    botaoTema.textContent = escuro ? "☀" : "☾";
    botaoTema.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo escuro");
  }

  botaoTema.addEventListener("click", () => {
    const escuro = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = escuro ? "dark" : "light";
    localStorage.setItem("organiza-tema", escuro ? "escuro" : "claro");
    atualizarBotaoTema();
  });
  atualizarBotaoTema();

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    alternarBotoes(true);
    mostrarMensagem("Entrando...");

    try {
      const { error } = await banco.auth.signInWithPassword({
        email: email.value.trim(),
        password: senha.value
      });
      if (error) throw error;
      window.location.replace("home.html");
    } catch (erro) {
      mostrarMensagem("Não foi possível entrar: " + erro.message, true);
    } finally {
      alternarBotoes(false);
    }
  });

  cadastrar.addEventListener("click", async () => {
    if (!formulario.reportValidity()) return;
    alternarBotoes(true);
    mostrarMensagem("Criando conta...");

    try {
      const { data, error } = await banco.auth.signUp({
        email: email.value.trim(),
        password: senha.value,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      if (data.session) {
        window.location.replace("home.html");
      } else {
        mostrarMensagem("Cadastro solicitado! Verifique seu e-mail e confirme a conta antes de entrar.");
      }
    } catch (erro) {
      mostrarMensagem("Não foi possível criar a conta: " + erro.message, true);
    } finally {
      alternarBotoes(false);
    }
  });

  // Recuperação: pede apenas o e-mail, sem exigir a senha antiga.
  esqueciSenha.addEventListener("click", async () => {
    const endereco = email.value.trim();

    if (!endereco || !email.checkValidity()) {
      mostrarMensagem("Digite um e-mail válido no campo acima para recuperar sua senha.", true);
      email.focus();
      return;
    }

    alternarBotoes(true);
    mostrarMensagem("Solicitando link de recuperação...");

    try {
      // Mantém o mesmo host e porta do Live Server.
      const destino = new URL("redefinir-senha.html", window.location.href).href;
      const { error } = await banco.auth.resetPasswordForEmail(endereco, {
        redirectTo: destino
      });
      if (error) throw error;

      // A mesma resposta para contas existentes ou não: evita revelar cadastros.
      mostrarMensagem("Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também o spam.");
    } catch (erro) {
      mostrarMensagem("Não foi possível solicitar a recuperação: " + erro.message, true);
    } finally {
      alternarBotoes(false);
    }
  });

  // Se já há uma sessão ativa, não precisa mostrar a tela de login.
  async function iniciar() {
    try {
      const { data: sessaoAtual, error: erroSessao } = await banco.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!sessaoAtual.session) return;

      const { data, error } = await banco.auth.getUser();
      if (error) throw error;
      if (data.user) window.location.replace("home.html");
    } catch (erro) {
      mostrarMensagem("Não foi possível verificar a sessão: " + erro.message, true);
    }
  }

  iniciar();
})();

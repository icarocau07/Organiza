# Configuração do Organiza (desenvolvimento e deploy)

Este guia destina-se a quem deseja executar uma **cópia própria** do Organiza ou publicar alterações no site existente.

## 1. Supabase

1. Crie um projeto Supabase (ou use um projeto próprio existente).
2. Para **um projeto novo e vazio**, abra o SQL Editor e execute **na ordem** os três arquivos em `supabase/sql/`:
   - `01_criar_tabela_e_rls.sql` (cria a tabela `tarefas` e as políticas RLS)
   - `02_adicionar_prazos_e_recorrencia.sql`
   - `03_adicionar_horario.sql`
3. Abra `site/config.js` e altere `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para os valores públicos do seu projeto Supabase. **Nunca copie uma chave secreta para o frontend.**
4. Configure Authentication no painel do Supabase e ative a confirmação por e-mail conforme sua necessidade.

**Para o Organiza que já está online:** se os três conjuntos de campos já existem, **não execute novamente a criação da tabela**. Alterar o `config.js` apontará o aplicativo para outro projeto e poderá dar a impressão de que as tarefas sumiram. Faça backup antes de trocar de projeto.

## 2. URLs de autenticação

No Supabase → **Authentication → URL Configuration**:

- Site URL em produção: `https://organizadev.netlify.app`
- Redirect URL de recuperação: `https://organizadev.netlify.app/redefinir-senha.html`
- Redirect URL da página de entrada (se necessário): `https://organizadev.netlify.app/` (ou `.../index.html`)

Para testes locais, autorize também as URLs exatas fornecidas pelo Live Server, inclusive a página `redefinir-senha.html` na porta e no host corretos. As URLs de exemplo só funcionarão se corresponderem exatamente ao endereço de origem.

## 3. E-mails

A autenticação do Supabase utiliza as configurações SMTP do projeto, em **Authentication → SMTP Settings** (a organização do painel pode mudar). O SMTP e a **senha de app do Gmail devem ficar apenas no painel do Supabase**, nunca no Git.

O Gmail SMTP foi escolhido para testes. Para receber usuários reais em escala, configure um provedor de e-mails transacionais e verifique seu domínio remetente. A capacidade de envio também fica sujeita aos limites do Supabase.

## 4. Executar localmente

Abra a pasta `site/` no VS Code ou abra `site/index.html` com o Live Server. Use um servidor HTTP, em vez de abrir o arquivo diretamente com `file://`.

Rotas relevantes:

- `/` ou `/index.html`: login e cadastro
- `/home.html`: lista de tarefas (exige sessão)
- `/redefinir-senha.html`: nova senha, aberta a partir de um link válido
- `/login.html`: alias legado da página de login

## 5. Publicação Netlify

**Para continuar usando https://organizadev.netlify.app:** abra o site existente no painel Netlify. Em Deploys, você pode publicar manualmente **somente a pasta `site/`**. Se preferir deploy automático, conecte o repositório GitHub a **esse mesmo site**; a configuração `netlify.toml` aponta para `site/` e não exige comando de build.

Depois de publicar, teste com duas contas distintas e verifique se cada uma só consegue ler e modificar suas próprias tarefas.

## 6. Orientações de segurança

- A `publishable key` é pública e pode aparecer no repositório, **mas não autoriza ignorar RLS**.
- Não publique senha SMTP, senhas do banco, chave `service_role`, chaves `sb_secret_...`, tokens de sessão ou arquivos `.env` com valores privados.
- **Não inclua dados reais de usuários, prints de sessões ou backups do banco no repositório**.
- Se um segredo privado tiver sido enviado ao GitHub, remova-o, revogue-o/rotacione-o no serviço de origem e trate o histórico do Git como comprometido.

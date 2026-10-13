# Web Push no Organiza — Instalação passo a passo

Esta atualização usa **Service Worker + Push API + Netlify Functions + Supabase**. Envia lembretes em segundo plano mesmo sem a página aberta, **desde que o navegador e o sistema permitam e mantenham a inscrição ativa**. Não é um alarme com entrega garantida ao segundo.

> ✅ Site: https://organizadev.netlify.app
>
> ⚠️ Se você já tem tarefas e usuários no Supabase, execute **somente** `supabase/sql/04_notificacoes_web_push.sql`. Não execute os SQLs antigos novamente.

## 1 — Faça backup e atualize o repositório

Faça uma cópia do projeto atual. Extraia este ZIP e copie o conteúdo da pasta `organiza/` para a pasta existente clonada do GitHub **sem apagar a pasta `.git`**. Os arquivos antigos da aplicação (`site/`) devem continuar presentes.

## 2 — Atualize o Supabase (somente novas tabelas)

Entre no [Supabase Dashboard](https://supabase.com/dashboard), abra seu projeto Organiza e vá a **SQL Editor → New query**.

Cole e execute `supabase/sql/04_notificacoes_web_push.sql`.

O script cria duas tabelas novas:

- `push_subscriptions`: inscrição, fuso horário e antecedência de cada dispositivo autorizado.
- `push_delivery_log`: controle de lembretes enviados; evita duplicidade na maioria dos casos.

As tabelas têm RLS ligado e **não podem ser lidas nem alteradas diretamente pelo usuário do frontend**; a função Netlify autentica com `getUser(jwt)` e só então usa sua chave de servidor.

## 3 — Gere um par de chaves VAPID (uma vez)

No VS Code, abra a pasta raiz `organiza` e execute:

```bash
npm install
npx web-push generate-vapid-keys
```

Guarde as duas chaves em local seguro. **Nunca envie a chave privada ao GitHub.**

- `Public Key` → `VAPID_PUBLIC_KEY`
- `Private Key` → `VAPID_PRIVATE_KEY`

Para gerar chaves você precisa ter [Node.js](https://nodejs.org/) instalado.

## 4 — Configure as variáveis no Netlify

No [Netlify](https://app.netlify.com), abra o projeto **organizadev** e entre em **Project configuration → Environment variables** (a nomenclatura pode variar). Adicione as cinco variáveis, disponíveis para **Functions**:

| Nome | Onde encontrar / o que usar |
|---|---|
| `SUPABASE_URL` | Project URL no Supabase: endereço `https://...supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → chave secreta `service_role` (ou chave secreta equivalente compatível) |
| `VAPID_PUBLIC_KEY` | Public Key gerada no passo 3 |
| `VAPID_PRIVATE_KEY` | Private Key gerada no passo 3 |
| `VAPID_SUBJECT` | `mailto:seu-email-de-contato@gmail.com` (um e-mail de contato válido; não é uma senha SMTP) |

**Atenção:** `SUPABASE_SERVICE_ROLE_KEY` tem privilégios elevados e ignora RLS. Nunca coloque essa chave em `site/config.js`, HTML, README, prints ou mensagens públicas. Salve apenas no ambiente privado das Functions no Netlify. Não a confunda com `sb_publishable_...`.

Se o Netlify oferecer configuração de escopo, ative **Functions**. Após salvar variáveis, faça um novo deploy (deploy existente não recebe variáveis retroativamente).

## 5 — Publique pelo GitHub (não por ZIP arrastado)

O projeto já possui `netlify.toml` com `publish = "site"`, pasta de funções e uma função agendada.

No terminal, execute na pasta do repositório:

```bash
npm run check
git status
git add .
git commit -m "feat: notificacoes Web Push"
git push origin main
```

O Netlify precisará instalar as dependências de `package.json` durante o build. **Use o deploy conectado ao GitHub**, não somente a opção manual de arrastar pasta, pois as funções e dependências de servidor precisam ser processadas.

Em **Netlify → Deploys**, espere aparecer `Published` e confira, em **Functions**, se aparecem:

- `push-settings` (endpoint HTTP `/api/push`)
- `send-reminders` (etiqueta `Scheduled`, executada a cada 5 minutos)

As Scheduled Functions são executadas no deploy publicado. O cron é em UTC; a conversão do prazo usa o fuso do dispositivo que ativou o push.

## 6 — Ative no aplicativo

1. Acesse https://organizadev.netlify.app e entre na sua conta.
2. Na `home.html`, clique no **sino 🔔**.
3. Escolha **5, 15, 30 ou 60 minutos** de antecedência.
4. Clique em **Ativar notificações** e **Permitir** no navegador.
5. Clique em **Enviar teste** e confirme que chegou uma notificação do sistema.
6. Crie uma tarefa **com data e hora** daqui a aproximadamente 20–25 minutos e aguarde o aviso no horário correspondente.
7. Feche a aba para testar o recebimento em segundo plano.

O cron roda a cada 5 minutos e o horário real pode variar. **Esta versão nunca envia o lembrete antecipado depois do vencimento e remove o aviso adicional de atraso**. Se a função executar tarde demais, o lembrete é pulado em vez de ser enviado após o horário. Recomenda-se **15 minutos** em vez de 5 minutos, pois dá maior margem para atrasos do agendador e do navegador. A entrega do serviço Push ainda pode sofrer atrasos independentes depois do envio.

**Tarefas somente com data, sem horário, não geram push.** Tarefas concluídas não devem gerar novos avisos. Tarefas recorrentes agendadas para a próxima data podem voltar a gerar push normalmente.

## 7 — Teste no celular

- **Android (Chrome):** permita notificações para o navegador/site. O Android pode restringir notificações quando o navegador é economizado ou está em modo de economia de bateria.
- **iPhone/iPad (iOS/iPadOS 16.4+):** no Safari, abra o site, use **Compartilhar → Adicionar à Tela de Início**, abra o Organiza pelo ícone instalado, faça login e ative pelo sino. O Web Push não funciona do mesmo jeito em uma aba comum no iPhone.
- **Desktop:** use Chrome, Edge, Firefox ou Safari compatível; permita notificações para o site e também no sistema operacional. Cada navegador exige ativação individual.
- **Firefox:** em Configurações → Privacidade e Segurança → Permissões → Notificações, permita `organizadev.netlify.app`. Evite modo privado para inscrição.
- **Edge:** em Configurações → Cookies e permissões do site (ou Permissões do site) → Notificações, permita o domínio. Verifique também notificações do Windows.
- **Safari no Mac:** autorize notificações nas configurações do Safari e no macOS.
- **Brave/Opera e outros:** o funcionamento depende da versão e do serviço Push do navegador; não existe configuração que garanta Web Push em qualquer navegador/rede.

Cada dispositivo deve ativar suas próprias notificações. O mesmo usuário pode ter mais de um dispositivo inscrito.

## 8 — Se não funcionar

| Sintoma | Verifique |
|---|---|
| `/api/push` retorna 404 | Functions não foram publicadas: verifique deploy Git e `netlify.toml` |
| `/api/push` retorna 503 | Faltam chaves VAPID no ambiente Netlify |
| Ao ativar dá 401 | Sessão expirada: faça login novamente |
| Ao ativar dá 500 | Confira `04_notificacoes_web_push.sql`, `SUPABASE_SERVICE_ROLE_KEY`, Functions Logs |
| Notificação de teste não chega | Permissões do navegador e do sistema, Web Push e inscrições antigas |
| Teste chega, lembrete não | A tarefa precisa de **data e horário**; confira fuso horário, cron agendado e Logs |
| iPhone não permite | Instale o app na Tela de Início e abra pelo ícone |
| "Permission denied" | Altere a permissão de notificações nas configurações do navegador/site |
| "Registration failed - push service error" | Navegador não alcançou seu provedor Push: teste outra rede/VPN/firewall, atualize navegador, confirme permissões; o problema ocorre antes do Supabase |
| Só recebe notificações após vencer | Atualize esta versão corrigida, selecione 15 minutos e crie tarefa com 30 minutos de antecedência; confira os logs da função agendada |

Os envios dependem de rede, bateria, permissão e entrega do provedor push. A função do Netlify é agendada, não em tempo real: não há garantia de entrega em um horário exato.

## 9 — Limites e custos

Uma rotina a cada 5 minutos executa cerca de **8.640 vezes por mês**, ainda que não haja tarefas. Essas execuções e o envio de Web Push podem consumir cotas/recursos de Netlify e Supabase. Confira seu plano e acompanhe o uso em **Netlify → Usage** e **Supabase → Usage**; não assuma que será gratuito sem limites.

Para escalar a muitos usuários ou oferecer alarmes pontuais, será necessário revisar paginação, filas, limite de envios por execução, retentativas e monitoramento. Esta versão é adequada para testes e um grupo inicial pequeno.

## 10 — Checklist de segurança

- [ ] Não publiquei `SUPABASE_SERVICE_ROLE_KEY` em `site/` ou no GitHub.
- [ ] Executei somente SQL `04` no projeto existente.
- [ ] Ativei as variáveis no Netlify e criei um deploy novo.
- [ ] Testei login, tarefas, perfil e recuperação de senha como antes.
- [ ] Testei com duas contas e confirmei que cada uma vê apenas suas tarefas.
- [ ] O botão **Sair da conta** cancela a inscrição Web Push deste dispositivo antes de encerrar a sessão.

> Observação: para manter notificações em outro dispositivo, faça a ativação lá também. Se você remover uma conta diretamente no painel sem abrir o app, os registros são excluídos do banco pela relação `on delete cascade`.

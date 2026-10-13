# Correção de horário e compatibilidade de navegadores

Site: https://organizadev.netlify.app

## O que foi corrigido

- O backend não envia mais o **push de atraso** após o vencimento. Além disso, usa TTL até o horário de vencimento e o Service Worker descarta mensagens tardias (conforme comportamento do navegador).
- Um lembrete de 5/15/30/60 minutos só é enviado **antes do prazo**.
- Janela de tolerância de até seis minutos depois do instante antecipado, sem atravessar o prazo.
- A notificação informa os minutos restantes de acordo com a hora do agendador.
- Erros de Push em Edge, Firefox e Safari aparecem com orientações de rede/permissões.
- Melhor espera pela ativação do Service Worker e domínios de Web Push confiáveis atualizados.
- 15 minutos virou sugestão padrão para novos dispositivos.

## Atualização sem perda de dados

1. Faça backup dos arquivos atuais e **não delete a pasta `.git`**.
2. Copie esta versão completa (raiz `organiza/`) para seu repositório existente.
3. Execute `npm run check` e `npm test`.
4. `git add . && git commit -m "fix: avisar tarefas antes do prazo" && git push origin main`.
5. Aguarde deploy de produção do Netlify. **Não é necessário executar SQL nem gerar novas chaves VAPID**.
6. Abra o site em cada navegador e vá ao sino: escolha **15 minutos** e ative ou atualize a preferência. Se a inscrição ficar inválida, desative e ative de novo.
7. Crie uma tarefa com data/hora para **30-40 minutos no futuro**; confira o envio na hora escolhida (com alguns minutos de tolerância). Feche a aba para testar Web Push em segundo plano.

## Limitações reais

- O cron Netlify está configurado para rodar **a cada 5 minutos** (`*/5 * * * *`). Por isso a chegada pode variar; o serviço de Push ou SO também pode atrasar a entrega.
- Não há garantia de entrega antecipada se o cron atrasar demais: preferimos **não enviar lembrete vencido**.
- O horário da tarefa é interpretado no fuso horário salvo no dispositivo que ativou notificações.
- Cada navegador/dispositivo deve ativar Web Push individualmente.
- iPhone/iPad requer instalar o app na Tela de Início para Web Push (iOS 16.4+).
- Redes corporativas/VPN/proxy ou configurações de privacidade podem impedir o registro com o serviço Push. Não há como garantir entrega em todos os navegadores ou redes.
- O painel de tarefas continua destacando tarefas atrasadas mesmo que o lembrete antecipado não tenha sido entregue.

## Diagnóstico

No Netlify: **Cloud compute → Functions → send-reminders → Logs**.
No site: F12 → Console e Network, filtre por `/api/push` e `sw.js`.
Não envie credenciais, JWTs, endpoints de inscrição Web Push nem chaves VAPID privadas em capturas públicas.

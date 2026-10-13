# ✓ Personalizar o ícone das notificações do Organiza

**Site:** https://organizadev.netlify.app

## O que foi alterado

O ícone anterior usado pelo Service Worker tinha um fundo azul opaco, o que em alguns dispositivos Android aparecia como um **bloco branco** na barra de notificações. A nova versão usa exatamente o mesmo ✓ da marca do Organiza, extraído do `site/icons/icon-512.png`.

| Arquivo | Uso |
| --- | --- |
| `site/icons/checkmark-192.png` | Ícone azul de ✓ sobre fundo **transparente**, exibido quando o sistema aceita ícones coloridos |
| `site/icons/checkmark-badge-96.png` | Badge branco com somente ✓ e fundo **transparente**, para barra de status / tratamento monocromático no Android |
| `site/sw.js` | Mostra os dois ícones ao receber push de teste ou de tarefa |

Os ícones tradicionais de instalação do Organiza **não foram alterados**. O fundo do pequeno ícone da notificação não vem mais de um quadrado opaco.

## Como publicar no seu repositório atual

1. Faça backup da sua pasta atual `organiza`.
2. Extraia o ZIP e copie o conteúdo da pasta **`organiza/`** para a pasta atual do repositório (não apague a pasta oculta `.git`).
3. No VS Code, confira os arquivos novos em `site/icons/`.
4. Execute:

   ```bash
   git add .
   git commit -m "style: usar check do Organiza nas notificacoes"
   git push origin main
   ```
5. Aguarde **Netlify → organizadev → Deploys** publicar a versão nova.
6. No celular, abra `https://organizadev.netlify.app`, atualize a página para receber o novo Service Worker e acesse o sininho para enviar uma notificação de teste.
7. Se ainda aparecer o desenho antigo, feche e reabra a aba (ou app instalado). A atualização do Service Worker pode demorar alguns instantes.

**Não é necessário** mudar suas variáveis no Netlify, reexecutar SQL, gerar VAPID ou reativar a inscrição. O botão **Enviar teste** continua funcionando como antes.

## Limitação do Android

A barra de status do Android renderiza o **badge** como um símbolo monocromático e pode mudar sua cor, tamanho e posição. O resultado exato depende do navegador, versão do Android e fabricante. A imagem expandida pode exibir o ícone azul.

Caso queira verificar os arquivos após publicar, acesse:

- https://organizadev.netlify.app/icons/checkmark-192.png
- https://organizadev.netlify.app/icons/checkmark-badge-96.png

Se qualquer endereço retornar 404, o deploy não incluiu os novos ícones.

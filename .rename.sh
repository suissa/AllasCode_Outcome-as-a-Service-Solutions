#!/usr/bin/env bash
set -uo pipefail
cd /mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest || exit 1

gmove() { git mv "$1" "$2" >/dev/null 2>&1 || mv -f "$1" "$2"; }

gmove layouts/classic.html layouts/site.html
gmove layouts/classic.css layouts/site.css
gmove layouts/classic.json layouts/site.json
gmove runtime/classic-page.js runtime/site-page.js
gmove runtime/classic.js runtime/site.js
gmove layouts/guild.html layouts/chat.html
gmove layouts/guild.json layouts/chat.json
gmove runtime/guild.js runtime/chat.js
gmove pages/pt-BR/classic.json pages/pt-BR/site.json
gmove pages/pt-BR/guild.json pages/pt-BR/chat.json
gmove classico.html site.html
gmove guilda.html chat.html

# --- manifestos de pagina
sed -i 's|"id": "classic"|"id": "site"|; s|"route": "/classico"|"route": "/site"|; s|"entry": "classico.html"|"entry": "site.html"|; s|"layout": "classic"|"layout": "site"|; s|experience.presentation.classic|experience.presentation.site|' pages/pt-BR/site.json
sed -i 's|"id": "guild"|"id": "chat"|; s|"route": "/guilda"|"route": "/chat"|; s|"entry": "guilda.html"|"entry": "chat.html"|; s|"layout": "guild"|"layout": "chat"|; s|experience.presentation.guilda|experience.presentation.chat|; s|OaaS.Quest — Modo Guilda|OaaS.Quest — Chat|' pages/pt-BR/chat.json

# --- layouts
sed -i 's|"id": "classic"|"id": "site"|; s|"name": "Institucional clássico"|"name": "Site institucional"|; s|layouts/classic.html|layouts/site.html|; s|layouts/classic.css|layouts/site.css|; s|runtime/classic-page.js|runtime/site-page.js|; s|runtime/classic.js|runtime/site.js|; s|"shell": "classic-nav + main + classic-footer"|"shell": "site-nav + main + site-footer"|' layouts/site.json
sed -i 's|"id": "guild"|"id": "chat"|; s|"name": "Guilda conversacional"|"name": "Chat de missão"|; s|layouts/guild.html|layouts/chat.html|; s|runtime/guild.js|runtime/chat.js|; s|"shell": "guild-sidebar + guild-main + guild-side"|"shell": "chat-sidebar + chat-main + chat-side"|; s|guild-navigation|chat-navigation|; s|welcome|welcome|; s|conversation|conversation|; s|"guild-sections"|"chat-sections"|' layouts/chat.json

# --- conteudo
sed -i 's|    "classic": {|    "site": {|; s|    "guilda": {|    "chat": {|; s|"Como funciona a Guilda"|"Como funciona o Chat"|' content/experience.pt-BR.json
sed -i 's|"guildAriaLabel"|"chatAriaLabel"|; s|"guildPreviewStatus"|"chatPreviewStatus"|; s|"guildPreviewPrompt"|"chatPreviewPrompt"|; s|"guildKicker"|"chatKicker"|; s|"guildTitle"|"chatTitle"|; s|"guildDescription"|"chatDescription"|; s|"classicAriaLabel"|"siteAriaLabel"|; s|"classicPreviewDescription"|"sitePreviewDescription"|; s|"classicKicker"|"siteKicker"|; s|"classicTitle"|"siteTitle"|; s|"classicDescription"|"siteDescription"|; s|"Entrar no Modo Guilda"|"Entrar no Chat"|; s|"Modo Guilda"|"Chat"|; s|"Explorar o Modo Clássico"|"Explorar o Site"|; s|"Modo Clássico"|"Site"|; s|"Missão recebida do Modo Guilda"|"Missão recebida do Chat"|; s|^  "guild": {|  "chat": {|' content/ui-copy.pt-BR.json

echo "MOVED+REPLACED"
ls layouts runtime pages/pt-BR

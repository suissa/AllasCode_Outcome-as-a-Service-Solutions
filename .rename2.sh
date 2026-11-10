#!/usr/bin/env bash
set -uo pipefail
cd /mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest || exit 1

# --- runtime do chat
sed -i 's|page.sources\["ui-copy"\].guild|page.sources["ui-copy"].chat|; s|OQ.setMode("guilda"|OQ.setMode("chat"|; s|OQ.history("guilda")|OQ.history("chat")|g; s|OQ.logInteraction("guilda"|OQ.logInteraction("chat"|g' runtime/chat.js

# --- conteudo do chat
sed -i 's|const mode = "guilda";|const mode = "chat";|; s|REGISTRO DA GUILDA|REGISTRO DO CHAT|; s|Os ofícios da Guilda|As especialidades do Chat|; s|A Guilda adapta sua estratégia|O Chat adapta sua estratégia|; s|registros da Guilda|registros do Chat|; s|CAMINHOS DA GUILDA|CAMINHOS DO CHAT|' content.js

# --- app.js (estado e modo)
sed -i 's|conversations:{guilda:\[\],classico:\[\]}|conversations:{chat:[],site:[]}|; s|conversations:{guilda:\[\],classico:\[\],...(raw.conversations||{})}|conversations:{chat:[],site:[],...(raw.conversations||{})}|; s|source:"guilda"|source:"chat"|' app.js
sed -i 's|const KEY="oaas.quest.v1",DISCOVERY_KEY="goaltropic.discovery.v1";|const KEY="oaas.quest.v1",DISCOVERY_KEY="goaltropic.discovery.v1";\ntry{const legacy=JSON.parse(localStorage.getItem(KEY)\|\"null\");if(legacy\&\&legacy.conversations){const c=legacy.conversations;if(!c.chat\&\&c.guilda)c.chat=c.guilda;if(!c.site\&\&c.classico)c.site=c.classico;}}catch{}|' app.js

# --- home (seletor de experiencia)
sed -i 's|data-mode="guilda"|data-mode="chat"|; s|data-mode="classico"|data-mode="site"|; s|href="/guilda"|href="/chat"|; s|href="/classico"|href="/site"|; s|chooser.guildAriaLabel|chooser.chatAriaLabel|g; s|chooser.guildTitle|chooser.chatTitle|g; s|chooser.classicAriaLabel|chooser.siteAriaLabel|g; s|chooser.classicTitle|chooser.siteTitle|g; s|Modo Guilda|Chat|g; s|Modo Clássico|Site|g; s|Entrar no Modo Guilda|Entrar no Chat|g; s|Explorar o Modo Clássico|Explorar o Site|g; s|shot--guilda|shot--chat|g' layouts/chooser.html
sed -i 's|shot--guilda|shot--chat|g; s|Modo Clássico|Site|g; s|Modo Guilda|Chat|g' layouts/chooser.css

# --- exemplos
sed -i 's|href="/guilda"|href="/chat"|; s|logo-white.png|logo-dark.png|g; s|logo-black.png|logo-dark.png|g' layouts/exemplos.html

# --- template do chat
sed -i 's|href="/classico"|href="/site"|g; s|href="/classico#produtos"|href="/site#produtos"|g; s|href="/classico#desenvolvedores"|href="/site#desenvolvedores"|g; s|Mudar para Modo Clássico|Ir para o Site|g; s|Salão da Guilda|Chat|g; s|ADVENTURERS GUILD|CHAT DE MISSÃO|g; s|Bem-vindo à Guilda.|Bem-vindo ao Chat.|g; s|class="guild-logo">OaaS<span>.</span>Quest</a>|class="guild-logo"><img src="/logo-dark.png" alt="OaaS.Quest" width="900" height="200"></a>|g' layouts/chat.html

# --- entry do chat
sed -i 's|data-oaas-page="guild"|data-oaas-page="chat"|; s|OaaS.Quest — Modo Guilda|OaaS.Quest — Chat|' chat.html

# --- entry da home
sed -i 's|Escolha entre a jornada conversacional do Modo Guilda e a página institucional do Modo Clássico.|Escolha entre o Chat de missão e o Site institucional.|' index.html

# --- vite
sed -i 's|{ route: "/guilda", entry: "guilda.html", pageId: "guild" },|{ route: "/chat", entry: "chat.html", pageId: "chat" },|; s|{ route: "/classico", entry: "classico.html", pageId: "classic" },|{ route: "/site", entry: "site.html", pageId: "site" },|; s|guilda.html -> /guilda|chat.html -> /chat|; s|classico.html -> /classico|site.html -> /site|; s|de modo que /guilda|de modo que /chat|' vite.config.ts

# --- forger
sed -i 's|["home","classic","guild","discovery","proposal"]|["home","site","chat","discovery","proposal"]|; s|/classico/|/site/|g; s|/guilda/|/chat/|g' scripts/forger.mjs

echo DONE
grep -n "conversations" app.js | head -3
grep -n "route:" vite.config.ts | head -8

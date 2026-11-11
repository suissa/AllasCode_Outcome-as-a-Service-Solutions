# futuro-do-mercado-corporativo-IA

## OaaS.Quest

Plataforma OaaS.Quest: site institucional (Site), jornada conversacional (Chat) e motor de descoberta (Discovery Engine).

## Desenvolvimento

O front-end usa Vite em modo multi-page, com hot reload e rotas limpas.

```bash
bun install        # ou npm install
bun run dev        # http://localhost:5173
bun run dev:api    # Fastify em http://localhost:3000 (requer PostgreSQL e OpenRouter)
bun run build      # gera dist/
bun run preview    # serve dist/ como em producao
bun run test       # suite de testes
bun run typecheck  # typecheck do dominio e da config do Vite
npm run test:e2e:install # instala o Chromium usado pelos testes de navegador
npm run test:e2e         # executa os testes E2E localmente
npm run test:e2e:debug   # abre o Playwright Inspector para depuração
```

| Rota | Entrada | Página |
|---|---|---|
| / | index.html | Home (seletor de experiencia) |
| /site | site.html | Site institucional |
| /chat | chat.html | Chat de missão |
| /exemplos | exemplos.html | Exemplos práticos |
| /descoberta | descoberta/index.html | Discovery Engine |

O nome do arquivo HTML é o nome da rota. Detalhes em [docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md](docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md).

`/exemplos` não é uma rota órfã: a home publica o link em `.home-foot` e a topbar do Site
publica o link ao lado do CTA.

O `vite.config.ts` publica um manifesto de assets por rota em `/oaas-assets.json` (dev) e em
`dist/oaas-assets.json` (build). O roteador client-side lê esse manifesto para trocar as
folhas de estilo junto com o conteúdo da página — no build os arquivos têm nome com hash,
por isso o caminho declarado no layout é apenas reserva.

O `scripts/forger.mjs` gera as páginas estáticas para buscadores em `dist/seo/`, separadas das
entradas do app em `dist/`: as duas saídas nunca ocupam o mesmo caminho.

## Design

Todas as páginas consomem os mesmos tokens de tema (`--oq-*`) definidos em `layouts/themes.css`.
O wrapper global (`<html>`) carrega **uma** classe de tema por vez (`oq-theme-abyss`,
`oq-theme-carbon`, `oq-theme-ember`, `oq-theme-paper`); o seletor flutuante troca de tema
removendo a classe atual e adicionando a nova. Tipografia self-hosted (Archivo + Spline Sans Mono).
O sistema está documentado em [DESIGN.md](DESIGN.md), o contexto de produto em [PRODUCT.md](PRODUCT.md).

A navegação entre `/`, `/site`, `/chat` e `/exemplos` é client-side (View Transitions API):
o documento não recarrega, o runtime troca o conteúdo e as folhas de estilo.

O movimento é um sistema único: a revelação por máscara de palavra é aplicada pelo shell
(`page-config.js`, função `applyMotion`) depois dos runtimes do layout, para que o conteúdo
renderizado por JavaScript também entre na revelação. `/descoberta` e `/proposta` mantêm o
próprio mundo visual. `/exemplos` acrescenta uma camada de scroll com GSAP + ScrollTrigger
(`runtime/exemplos-scroll.js`): o conteúdo entra pela margem lateral — esquerda, direita, esquerda —
e assenta no meio, compondo o layout; o herói cede espaço enquanto a página avança.

No WSL, o projeto fica em /mnt/d (DrvFs) e nao suporta inotify; o vite.config.ts liga o watcher em polling automaticamente nesse caso.

O dev server sobe desacoplado do terminal, com supervisor, e nao tem limite de tempo:

```bash
wsl -- bash scripts/dev-server.sh
```

Ele escuta em `0.0.0.0:5173` (dando acesso pela rede local em `http://<ip-do-wifi>:5173`),
o supervisor religa o Vite se ele cair e o log fica em `/tmp/oaas-dev.log`. O hot reload
depende do watcher: passar `watch: null` no `server` do Vite **desliga** o watcher
inteiro, e nao apenas usa o padrao.


## Chat com LLM e PostgreSQL

O Chat usa Fastify como API, PostgreSQL para persistir sessões/mensagens/contexto da missão e OpenRouter para gerar as respostas conversacionais. Consulte [docs/CHAT-API.md](docs/CHAT-API.md).

Configure `.env` a partir de `.env.example` e execute `npm run dev:api` e `npm run dev` em terminais separados. O Vite encaminha `/api` ao Fastify durante o desenvolvimento. A chave OpenRouter permanece exclusivamente no servidor.

### Testes E2E (execução local)

Os testes de navegador não rodam mais no GitHub Actions. Para executá-los localmente:

```bash
npm install
npm run test:e2e:install
npm run test:e2e
```

Para depurar interativamente, use `npm run test:e2e:debug`. O Playwright inicia o Vite automaticamente em `http://127.0.0.1:5173`. Em caso de falha, envie a saída completa do terminal e o arquivo `trace.zip` correspondente em `test-results/`; a configuração mantém traces quando um teste falha.

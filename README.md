# futuro-do-mercado-corporativo-IA

## OaaS.Quest

Plataforma OaaS.Quest: site institucional (Site), jornada conversacional (Chat) e motor de descoberta (Discovery Engine).

## Desenvolvimento

O front-end usa Vite em modo multi-page, com hot reload e rotas limpas.

```bash
bun install        # ou npm install
bun run dev        # http://localhost:5173
bun run build      # gera dist/
bun run preview    # serve dist/ como em producao
bun run test       # suite de testes
bun run typecheck  # typecheck do dominio e da config do Vite
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
próprio mundo visual.

No WSL, o projeto fica em /mnt/d (DrvFs) e nao suporta inotify; o vite.config.ts liga o watcher em polling automaticamente nesse caso.

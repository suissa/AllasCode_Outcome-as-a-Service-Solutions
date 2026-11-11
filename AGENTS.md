# OaaS.Quest — instruções do repositório

## Terminal: WSL, sempre

Nesta máquina o terminal de trabalho é o **WSL (Ubuntu)**. O PowerShell existe apenas
como porta de entrada para chamar `wsl.exe` — nunca como ambiente onde o trabalho acontece.

- Todo comando de projeto passa por: `wsl -- bash -c "cd /mnt/d/... && <comando>"`
- Nunca instalar binários nativos do Windows para satisfazer dependência que roda no WSL.
- Preferir um script `.sh` temporário no repositório quando o comando tem aspas, `$`
  ou `&&` — o PowerShell expande `$(...)` e `$var` dentro de aspas duplas antes de o
  comando chegar ao bash.
- A skill `wsl-first` (instalada globalmente) cobre esse protocolo; carregue-a antes de
  qualquer trabalho de linha de comando.

Caminho do projeto no WSL: `/mnt/d/www/Freelas/_____suissadev/OaaS/OaaS.Quest`

## Comandos

```bash
bun run typecheck   # tsc --noEmit (app + tsconfig.node.json)
bun run test        # tsx --test  (suite node:test)
bun run build       # vite build -> dist/
bun run dev         # vite dev server
```

Dependências via **bun** (`bun.lock`). O `node_modules` fica em `/mnt/d` (DrvFs, sem
inotify): o Vite já liga polling automático nesse caso.

Atenção: este repositório **rastreia** o `node_modules` (o `.gitignore` tem `node_moules/*`,
com erro de digitação, então nada é ignorado de fato) e o CI instala com **npm**
(`npm install --include=dev`, sem lockfile congelado — o `package-lock.json` é a fonte do CI).
Ao adicionar dependência, use **npm** para não criar shims duplicados: o bun gera
`.bin/*.bunx` e `.bin/*.exe` ao lado dos shims npm que já estão versionados.

## Estrutura

- `pages/pt-BR/*.json` — manifesto por rota (`route`, `entry`, `layout`, `contentRefs`,
  `clientNavigation`).
- `layouts/*.json` + `layouts/*.html` + `layouts/*.css` — template, folha e renderer de cada layout.
- `runtime/*.js` — runtimes de página. Todo runtime exporta `mount(page)`.
- `content/*.json` — **toda** a copy. O runtime formata; nunca inventa texto.
- `page-loader.js` — resolve fontes por nome; precisa cobrir **todas** as fontes que os
  manifestos declaram, senão a página renderiza em branco em runtime (build e teste passam).
- `page-config.js` — shell único: monta o template, executa os runtimes, liga o tema e o router.
- `scripts/forger.mjs` — gera as páginas estáticas de SEO em `dist/seo/`. **Nunca** em
  `dist/index.html` ou `dist/<rota>/index.html`: esses são do app (Vite). O forger falha com
  `FORGER_COLLIDE` se detectar uma entrada do app no destino.
- `docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md` e `DESIGN.md` — arquitetura e sistema visual.

Rotas: `/` (home), `/site`, `/chat`, `/descoberta`, `/exemplos`.

## Regras do projeto

1. A copy vem de `content/*.json`. Sem cliente, número, depoimento, preço ou foto inventados.
2. Chat (`/chat`) e Discovery (`/descoberta`) não podem regredir.
3. Sistema visual único: `layouts/themes.css` define os tokens `--oq-*` e as classes de tema
   (`oq-theme-abyss|carbon|ember|paper`) no wrapper global (`<html>`). Nenhuma página define
   cor literal fora desse contrato.
4. Uma única classe semântica por elemento. Variante é atributo (`data-variant`,
   `data-density`), nunca classe modificadora.
5. Um único momento de movimento autorado por página, sempre a partir de um estado já visível.
6. Ao mexer numa affordance, `grep` o `data-testid` dela nos testes antes — o único sinal
   de quebra é o e2e, o TypeScript continua verde.

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

## Estrutura

- `pages/pt-BR/*.json` — manifesto por rota (`route`, `entry`, `layout`, `contentRefs`).
- `layouts/*.json` + `layouts/*.html` + `layouts/*.css` — template, folha e renderer de cada layout.
- `runtime/*.js` — runtimes de página (renderers, scroll-spy, revelações).
- `content/*.json` — **toda** a copy. O runtime formata; nunca inventa texto.
- `page-loader.js` — resolve fontes por nome; precisa cobrir **todas** as fontes que os
  manifestos declaram, senão a página renderiza em branco em runtime (build e teste passam).
- `docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md` e `DESIGN.md` — arquitetura e sistema visual.

Rotas: `/` (home), `/guilda`, `/classico`, `/descoberta`, `/exemplos`.

## Regras do projeto

1. A copy vem de `content/*.json`. Sem cliente, número, depoimento, preço ou foto inventados.
2. Modo Guilda (`/guilda`) e Discovery (`/descoberta`) não podem regredir.
3. Sistema visual único: `layouts/tokens.css` é a base da home e do Modo Clássico;
   `styles.css` é exclusivo da Guilda.
4. Um único momento de movimento autorado por página, sempre a partir de um estado já visível.
5. Ao mexer numa affordance, `grep` o `data-testid` dela nos testes antes — o único sinal
   de quebra é o e2e, o TypeScript continua verde.

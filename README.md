# futuro-do-mercado-corporativo-IA

## OaaS.Quest

Plataforma OaaS.Quest: site institucional (Modo Clássico), jornada conversacional (Modo Guilda) e motor de descoberta (Discovery Engine).

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
| /guilda | guilda.html | Modo Guilda |
| /classico | classico.html | Modo Clássico |
| /descoberta | descoberta/index.html | Discovery Engine |

O nome do arquivo HTML é o nome da rota. Detalhes em [docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md](docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md).

## Design

A home e o Modo Clássico usam o mesmo sistema canônico: tokens em `layouts/tokens.css`, tipografia self-hosted (Archivo + Spline Sans Mono) e faixas azuis de seção. O sistema está documentado em [DESIGN.md](DESIGN.md), o contexto de produto em [PRODUCT.md](PRODUCT.md). O Modo Guilda mantém o próprio mundo visual em `styles.css`.

No WSL, o projeto fica em /mnt/d (DrvFs) e nao suporta inotify; o vite.config.ts liga o watcher em polling automaticamente nesse caso.

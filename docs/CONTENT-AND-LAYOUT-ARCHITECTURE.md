# Arquitetura de páginas, layouts e conteúdo

Layouts (`layouts/*.json`) descrevem estrutura visual, template HTML, slots, folhas de estilo e runtime. Páginas (`pages/pt-BR/*.json`) declaram rota, entrada, layout, idioma, título, seções e referências de conteúdo. Conteúdos (`content/*.json`) guardam dados reutilizáveis e localizáveis.

| Página | Rota | Entrada | Layout | Navegação client-side |
|---|---|---|---|---|
| Home | `/` | `index.html` | `chooser` | sim |
| Site | `/site` | `site.html` | `site` | sim |
| Chat | `/chat` | `chat.html` | `chat` | sim |
| Exemplos | `/exemplos` | `exemplos.html` | `exemplos` | sim |
| Descoberta | `/descoberta` | `descoberta/index.html` | `discovery` | não (MPA própria) |
| Proposta | `/proposta` | `proposta/index.html` | `proposal` | não (MPA própria) |

As fontes `experience.pt-BR.json`, `agent-team.pt-BR.json` e `sector-playbooks.pt-BR.json` são reutilizadas. As perguntas da missão e a configuração de descoberta foram extraídas para `mission-steps.pt-BR.json` e `discovery.pt-BR.json`.

Regras: não inserir novos textos ou perguntas nos runtimes; compartilhar dados semânticos entre os modos; layout controla apresentação, página controla rota e composição, conteúdo fornece dados; toda página aponta para layout e entrada existentes; novas traduções usam diretórios de locale próprios.

## Vite, rotas e hot reload

O front-end roda com Vite em modo multi-page (`appType: "mpa"`). O mapa de rotas fica em `vite.config.ts` e é a única fonte de verdade do mapeamento entre o nome do arquivo HTML e o nome da rota:

| Entrada HTML | Rota |
|---|---|
| index.html | `/` |
| site.html | `/site` |
| chat.html | `/chat` |
| exemplos.html | `/exemplos` |
| descoberta/index.html | `/descoberta` |

A entrada `proposta/index.html` é publicada pelo próprio diretório e não entra no mapa de rotas do Vite.

O nome do arquivo HTML é o nome da rota. Os links internos nunca apontam para arquivos `.html`, e sim para as rotas.

No desenvolvimento, um middleware do Vite reescreve a rota limpa para a entrada correspondente, de modo que `/site` serve `site.html`. No build, cada rota é publicada de duas formas: `dist/<rota>.html` e `dist/<rota>/index.html`, para que a rota funcione em hospedagem estática sem regra de rewrite e sem barra final.

O hot reload vem da resolução estática de módulos: `page-config.js` usa `import.meta.glob` para pullar manifestos de página, descritores de layout, templates, conteúdo, folhas de estilo e runtimes. Qualquer alteração em JSON, template, CSS ou runtime chega ao grafo de módulos e provoca a atualização da página sem reiniciar o servidor.

No WSL o projeto fica em `/mnt/d`, montado via DrvFs, que não suporta inotify. Nesse caso `vite.config.ts` liga o watcher em modo polling (`server.watch.usePolling`), porque sem isso o hot reload nunca dispara.

Comandos:

- `npm run dev` (ou `bun run dev`) sobe o servidor de desenvolvimento com hot reload.
- `npm run build` gera o site estático em `dist/`.
- `npm run preview` serve o `dist/` para conferir as rotas como em produção.

## Páginas rastreáveis e artefatos de SEO (forger)

`scripts/forger.mjs` gera, a partir dos manifestos de página, uma versão estática de cada rota
para que buscadores e agentes leiam o produto sem executar o runtime. Essa saída é um artefato
**diferente** do app e, por isso, não pode ocupar os mesmos caminhos:

- as páginas rastreáveis vão para `dist/seo/<rota>/index.html` (a raiz do `dist/seo/` é a home);
- `sitemap.xml`, `robots.txt` e `llms.txt` ficam na raiz do `dist/`, onde a hospedagem estática
  os espera;
- o build do Vite continua dono de `dist/index.html` e `dist/<rota>/index.html`.

O forger se recusa a sobrescrever uma entrada do app: se o destino já for o HTML do Vite
(reconhecido pelo mount point `#oaas-page-root`), a execução falha com `FORGER_COLLIDE` em vez de
entregar ao visitante uma página sem runtime e sem estilo. Sem essa separação, rodar a suíte de
testes depois do build apagava o site construído inteiro.

## Shell da página e o contrato `mount(page)`

`page-config.js` é o orquestrador único. Ele:

1. resolve o manifesto da página indicada por `data-oaas-page` e o descritor do layout;
2. monta o template em `#oaas-page-root` e publica `window.OaaSPage`;
3. publica `window.OaaSPageReady` e depois `window.OaaSPageScriptsReady`;
4. executa os runtimes declarados pelo layout;
5. aplica a política de movimento — `applyMotion(resolved)`, que só roda nas páginas com `clientNavigation: true`;
6. aplica o tema e monta o seletor flutuante;
7. liga o roteador client-side.

Todo runtime de layout exporta `mount(page)`. O shell chama `mount()` a cada render — inclusive na navegação client-side — sem reimportar o módulo e sem duplicar listeners. Runtimes em uso: `runtime/chooser-page.js`, `runtime/site-page.js`, `runtime/site.js`, `runtime/chat.js`, `content.js` e `runtime/exemplos-page.js`.

A lógica de resolução fica em `page-loader.js`, sem dependência do Vite, e é testada de forma isolada em `test/page-architecture.test.ts`.

Os testes verificam entradas HTML, templates, folhas de estilo externas, integridade dos descritores, o mapeamento rota ↔ entrada e a resolução de cada `contentRef` contra os arquivos JSON reais.

## Templates físicos

O markup de apresentação foi extraído para `layouts/chooser.html`, `layouts/site.html`, `layouts/chat.html`, `layouts/exemplos.html`, `layouts/discovery.html` e `layouts/proposal.html`. Os arquivos `index.html`, `site.html`, `chat.html`, `exemplos.html`, `descoberta/index.html` e `proposta/index.html` são pontos de entrada: declaram a página, carregam o runtime e oferecem o mount point `#oaas-page-root`. O `page-config.js` busca o template indicado pelo descritor JSON e o monta antes de resolver `OaaSPageReady`. Scripts de interação aguardam essa promessa para não procurar elementos antes da montagem.

## Folhas de estilo

Cada layout tem sua própria folha, e o descritor do layout é a fonte de verdade: o descritor declara `stylesheet` e `stylesheets`, e o teste `each entry HTML links the stylesheet declared by its layout` garante que a entrada e o descritor não divirjam.

| Layout | Folha | Natureza |
|---|---|---|
| chooser (home) | `layouts/chooser.css` | seletor de experiência |
| site | `layouts/site.css` | página institucional |
| chat | `layouts/chat.css` | chat de missão |
| exemplos | `layouts/exemplos.css` | exemplos práticos |
| discovery | `layouts/discovery.css` | motor de descoberta |
| proposal | `layouts/proposal.css` | proposta preliminar |

Sobre essa base:

- `layouts/themes.css` é o contrato de tokens do sistema (ver abaixo).
- `layouts/tokens.css` é a base compartilhada: reset, tipografia, chrome da home e barra de progresso de leitura. Consome apenas `var(--oq-*)` — não existe mais tema claro hardcoded com `--ground/--panel/--band`.
- `layouts/motion.css` é o movimento compartilhado: revelação por máscara de palavra e deslocamento dos blocos de texto.
- Na navegação client-side, a troca de folhas é feita pelo manifesto de assets `/oaas-assets.json` (ver abaixo); o descritor do layout entra apenas como reserva.
- O Discovery Engine e a Proposta são MPAs próprias: `layouts/discovery.css` e `layouts/proposal.css` mantêm suas próprias paletas e não entram no contrato `--oq-*`.
- As fontes (Archivo e Spline Sans Mono) são self-hosted em `fonts/`, sem requisição externa.

O sistema de design está documentado em [DESIGN.md](../DESIGN.md).

## Temas globais

`layouts/themes.css` define o contrato de cor e as quatro classes de tema. O wrapper global é o `<html>` e carrega **uma** classe de tema por vez:

| Tema | Classe | Fundo | Acento |
|---|---|---|---|
| Abismo (padrão) | `oq-theme-abyss` | `#0a0e1a` | `#35dcf5` |
| Carbono | `oq-theme-carbon` | `#0b0b11` | `#b79bff` |
| Brasa | `oq-theme-ember` | `#12100e` | `#fbbf24` |
| Papel | `oq-theme-paper` | `#f4f5f9` | `#2f49e0` |

Trocar de tema é remover a classe atual do `<html>` e adicionar a nova. Nenhum CSS é reescrito, porque todas as páginas consomem apenas `var(--oq-*)`.

### Contrato de tokens `--oq-*`

| Token | Papel |
|---|---|
| `--oq-ground` | fundo da página |
| `--oq-ground-2` | fundo de seção alternada |
| `--oq-surface` | superfície de cartão e painel |
| `--oq-surface-2` | superfície elevada |
| `--oq-surface-3` | superfície de destaque |
| `--oq-ink` | texto principal |
| `--oq-ink-2` | corpo de texto |
| `--oq-muted` | apoio e legenda |
| `--oq-line` | filete |
| `--oq-line-strong` | filete de destaque e borda de controle |
| `--oq-accent` | acento único: ação e estado ativo |
| `--oq-accent-2` | acento secundário |
| `--oq-accent-soft` | fundo de acento translúcido |
| `--oq-positive` | estado positivo |
| `--oq-warning` | estado de atenção |
| `--oq-critical` | estado crítico |
| `--oq-shadow` | sombra de elevação |

Os mesmos arquivos definem, fora da paleta, `--oq-font`, `--oq-mono`, `--oq-radius`, `--oq-radius-sm`, `--oq-radius-lg`, `--oq-max` e `--oq-ease`.

### `runtime/theme.js`

| Export | O que faz |
|---|---|
| `applyTheme(id, persist)` | remove a classe de tema atual do `<html>`, adiciona a nova, atualiza o seletor e, se `persist`, grava em `localStorage` |
| `applyStoredTheme()` | aplica o tema salvo; roda antes da primeira pintura, para a página nascer na cor escolhida |
| `buildThemeSwitcher()` | injeta o seletor flutuante de temas no canto inferior direito |

A persistência usa a chave `localStorage["oaas.quest.theme"]`. O shell (`page-config.js`) chama `applyStoredTheme()` na inicialização e `buildThemeSwitcher()` quando a página participa da navegação client-side.

## Revelação de títulos

`runtime/word-reveal.js` aplica a revelação por máscara de palavra — o formato do herói do bubble.io: cada palavra sobe de baixo de uma máscara, escalonada 65ms por palavra, em `.95s cubic-bezier(.2, .7, .2, 1)`.

- Alvo: **todos** os títulos (`h1`–`h4`) e os semi-títulos (o parágrafo que segue um título) das páginas do novo sistema.
- O título é quebrado em `.wm` (máscara) > `.wm__i` (palavra), com o índice de escalonamento em `--i`.
- Os blocos de texto entram com deslocamento vertical de 28px e atraso próprio em milissegundos (`--d`).
- O atributo `data-words` continua dando controle explícito no template; quem o declara tem prioridade sobre a detecção automática.
- `initWordReveal(document)` é chamado pelo shell depois de executar os runtimes, para que o conteúdo renderizado também entre na revelação. Reexecutar desmonta a observação anterior, porque a navegação client-side monta páginas novas no mesmo documento.
- Quem chama é **apenas o shell**: `page-config.js`, função `applyMotion`, chama `initWordReveal(document)` depois de executar os runtimes do layout. `runtime/chooser-page.js` e `runtime/site-page.js` não chamam — as chamadas redundantes foram removidas, porque o shell é o orquestrador único do movimento.
- `applyMotion` só roda nas páginas com `clientNavigation: true` (`/`, `/site`, `/chat`, `/exemplos`). `/descoberta` e `/proposta` mantêm o próprio mundo visual.
- Com `prefers-reduced-motion: reduce`, os blocos entram visíveis, sem deslocamento.

As regras de estilo vivem em `layouts/motion.css`.

## Navegação client-side

`runtime/router.js` roteia por rota, troca o conteúdo, troca as folhas de estilo e reexecuta o runtime do layout — tudo dentro de uma **View Transition** (`document.startViewTransition`), sem recarregar o documento.

| Responsabilidade | Onde |
|---|---|
| Mapa de rotas participativas | só as páginas com `"clientNavigation": true`: home, site, chat e exemplos |
| Folhas de estilo da rota | manifesto de assets `/oaas-assets.json` (reserva: campo `stylesheets` do layout) |
| Troca de página | `renderPage(pageId)` do shell, o mesmo caminho do primeiro render |
| Histórico | `pushState` na navegação e `popstate` no botão voltar |
| Transição | `document.startViewTransition`, com fallback para navegação normal |
| Rotas fora do mapa | `window.location.assign` — `/descoberta` e `/proposta` continuam como MPA |

O shell cria o roteador com `createRouter({ pages, layouts, renderPage }).start(resolved.page.id)`, apenas para páginas com `clientNavigation`.

A rota `/exemplos` não é órfã: a home publica o link `.home-link` em `.home-foot`, ao lado de `.home-note`, e a topbar do Site publica o link `.topbar-link`, entre `.topbar-meta` e o CTA `#nav-cta`.

## Manifesto de assets (`/oaas-assets.json`)

O `vite.config.ts` carrega o plugin `oaasAssetsManifest()`, que publica um manifesto com as folhas de estilo e os scripts de cada rota:

- no desenvolvimento, `configureServer` serve `/oaas-assets.json`, gerado a partir do HTML de entrada de cada rota;
- no build, `closeBundle` grava `dist/oaas-assets.json`, a partir do HTML já processado, onde os arquivos têm nome com hash.

O manifesto é indexado por `pageId` (`home`, `site`, `chat`, `exemplos`, `discovery`) e cada entrada traz `styles` e `scripts`.

`runtime/router.js` lê esse manifesto em `loadAssets()` e usa a lista de `styles` para trocar as folhas de estilo junto com o conteúdo da página. O campo `stylesheets` do descritor de layout (`layouts/*.json`) é apenas **reserva**: só entra quando o manifesto não devolve nada para a rota.

O motivo é objetivo — no build os arquivos têm nome com hash (`/assets/site-<hash>.css`), então o router não consegue derivar a URL da folha a partir do caminho de origem (`/layouts/site.css`).

## Copy: onde o texto mora

Nenhum texto de produto é escrito dentro dos runtimes. A copy da home vive em `content/ui-copy.pt-BR.json`, no bloco `chooser`; a do Site, em `experience.presentation.site`; a do Chat, em `experience.presentation.chat`; e a do Chat em `content/ui-copy.pt-BR.json`, no bloco `chat`.

O template declara o vínculo com o texto, e o runtime resolve:

- `data-copy="chooser.heading"` aponta para o catálogo de locale (`content/ui-copy.pt-BR.json`). O teste `chooser template copy bindings resolve against the locale catalog` valida que todo vínculo aponta para uma string existente.
- `data-page-copy="experience.presentation.site.hero.title"` aponta para as fontes do manifesto da própria página.

O texto embutido no template é o fallback sem JavaScript; com o runtime carregado, o valor do catálogo substitui o fallback. Nenhuma das duas rotas inventa texto: uma lê o catálogo de locale, a outra lê as fontes do manifesto.

## Estrutura de conteúdo do Chat

`content.js` monta as seções do Chat a partir do conteúdo externo. Nenhum texto de produto é escrito no runtime: a copy vem inteira de `content/*.json` (`experience.presentation.chat`, `agent-team`, `sector-playbooks`).

| Seção | Âncora | Origem |
|---|---|---|
| Método | `metodo` | `experience.customerJourney` |
| Jornada de 90 dias | `jornada-90` | `experience["90DayMethod"].phases` |
| Especialidades | `especialidades` | `agent-team.roles` |
| Reinos e ofícios | `reinos` | `sector-playbooks.sectors` |
| Orbe de métricas | `orbe` | `experience.measurement` |
| Acordos e recompensas | `tesouro` | `experience.commercialModel` |
| Perguntas ao Mestre | `perguntas` | `experience.faq` |

A seção `tesouro` é renderizada no conteúdo, mas não tem entrada na navegação de seções: `experience.presentation.chat.navigation` tem seis chaves e elas mapeiam para `metodo`, `especialidades`, `jornada-90`, `orbe`, `reinos` e `perguntas`.

## Duas listas de navegação no Chat

A sidebar do Chat (`layouts/chat.html`) tem duas listas de navegação, com responsabilidades distintas:

| Lista | Origem | Conteúdo |
|---|---|---|
| `.chat-nav` | template | navegação principal: Chat (`#inicio`), Minha missão (`#missao`) e Site (`/site`), com ícones SVG inline |
| `.chat-nav-sections` | runtime (`content.js`) | âncoras das seções, montadas a partir de `experience.presentation.chat.navigation` |

`content.js` escreve **apenas** dentro de `.chat-nav-sections` e nunca substitui a `.chat-nav` do layout. O acoplamento importa: quando o runtime sobrescrevia a nav inteira, o link para `/site` sumia do Chat.

## Runtimes por layout

Os descritores JSON declaram também os scripts necessários a cada experiência. O `page-config.js` carrega os runtimes na ordem declarada depois de montar o template e publicar `OaaSPageReady`. Os comportamentos do seletor, do Site, do Chat e dos Exemplos vivem em `runtime/*.js`; os HTMLs de entrada deixam de conter scripts inline ou listas duplicadas de dependências. O renderer compartilhado trata tanto o carregamento antes quanto depois de `DOMContentLoaded`, pois os scripts são carregados dinamicamente.

| Layout | Runtimes |
|---|---|
| chooser | `runtime/chooser-page.js` |
| site | `runtime/site-page.js` + `runtime/site.js` |
| chat | `runtime/chat.js` + `content.js` |
| exemplos | `runtime/exemplos-page.js` |

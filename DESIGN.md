# Sistema de design — OaaS.Quest

Direção escolhida: **canon**. O padrão da categoria, executado sem ironia nem truque, com a barra de acabamento em Stripe, Linear e Notion. O Chat conserva o próprio mundo de fantasia (Mestre da Guilda, reinos e ofícios) dentro do mesmo sistema visual.

Documento de direção: `.impeccable/surfaces/site-html.md`. Contexto de produto: `PRODUCT.md`. Arquitetura de páginas: `docs/CONTENT-AND-LAYOUT-ARCHITECTURE.md`.

## Princípios

1. **Um acento por tema, uma tipografia, divisórias por filete.** A cor vem inteira dos tokens de tema; nada de segunda cor de marca, nada de sombra dura, nada de gradiente em texto.
2. **A página é um documento, não uma vitrine.** Filetes horizontais separam blocos; cartões são a exceção.
3. **Estruturas variadas.** Cada seção usa a forma que explica seu conteúdo: lista com filetes para o método, timeline para as fases, colunas para o modelo comercial, details/summary para as dúvidas.
4. **A copy é verdade de produto.** Todo texto visível vem de `content/*.json`. O runtime formata; não inventa.
5. **Um único sistema de movimento, orquestrado pelo shell.** O movimento tem função (orientar a leitura), não enfeite. Quem aplica a revelação é o shell, depois dos runtimes do layout — nunca uma página isolada.

## Camadas do sistema

| Camada | Arquivo | Papel |
|---|---|---|
| Temas | `layouts/themes.css` | contrato de tokens `--oq-*` e as quatro classes de tema |
| Base | `layouts/tokens.css` | reset, tipografia e chrome da home; consome `--oq-*` |
| Movimento | `layouts/motion.css` | revelação por máscara de palavra e deslocamento de blocos |
| Site | `layouts/site.css` | página institucional |
| Chat | `layouts/chat.css` | chat de missão |
| Exemplos | `layouts/exemplos.css` | exemplos práticos |

As folhas do sistema novo importam `themes.css` e `motion.css` — `site.css`, `chat.css` e `exemplos.css` diretamente, `chooser.css` através de `tokens.css`. É por isso que trocar de tema ou de ritmo de movimento nunca exige reescrever CSS de página. O Discovery Engine e a Proposta são MPAs próprias e mantêm suas próprias paletas.

## Temas

O wrapper global é o `<html>` e carrega **uma** classe de tema por vez. Trocar de tema é remover a classe atual e adicionar a nova — nenhum CSS é reescrito, porque todas as páginas consomem apenas `var(--oq-*)`.

| Tema | Classe | Fundo | Acento |
|---|---|---|---|
| Abismo (padrão) | `oq-theme-abyss` | `#0a0e1a` | `#35dcf5` |
| Carbono | `oq-theme-carbon` | `#0b0b11` | `#b79bff` |
| Brasa | `oq-theme-ember` | `#12100e` | `#fbbf24` |
| Papel | `oq-theme-paper` | `#f4f5f9` | `#2f49e0` |

`runtime/theme.js` é o dono do tema: `applyTheme(id, persist)` troca a classe, `applyStoredTheme()` aplica a escolha salva (antes da primeira pintura, para a página nascer na cor escolhida) e `buildThemeSwitcher()` injeta o seletor flutuante no canto inferior direito. A preferência fica em `localStorage["oaas.quest.theme"]`.

Nenhuma página do novo sistema define cor literal fora do contrato de tokens. O tema claro deixou de ser um caso especial do CSS: é apenas mais um tema.

### Contrato de tokens

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

Fora da paleta, o mesmo arquivo define `--oq-font`, `--oq-mono`, `--oq-radius`, `--oq-radius-sm`, `--oq-radius-lg`, `--oq-max` e `--oq-ease`.

Tipografia: **Archivo** (texto e títulos) e **Spline Sans Mono** (números, rótulos, métricas), ambas self-hosted em `fonts/` com `font-display: swap`. Sem Google Fonts, sem requisição externa.

Escala: H1 `clamp(34px, 5.2vw, 64px)`; H2 de seção `clamp(28px, 3.4vw, 42px)`; corpo 16–17,5px com linha 1,65; apoio 13,5–15px. Medida de corpo entre 46 e 74 `ch`. `text-wrap: balance` nos títulos. Números com `font-variant-numeric: tabular-nums`.

## Uma classe semântica por elemento

Cada elemento HTML carrega **no máximo uma** classe. Variante é atributo — `data-variant="ghost"`, `data-density="compact"`, `data-role="user"` — nunca classe modificadora. As classes `cta cta-ghost` e `section section-tight` saíram do sistema: o estado mora no atributo, a forma na classe.

| Superfície | Namespace |
|---|---|
| Site | `site-page` na raiz, e classes semânticas sem prefixo: `topbar`, `hero`, `section`, `panel`, `cta`, `strip`, `steps`, `phase`, `faq`, `footer` |
| Chat | `chat-*` (o antigo `guild-*` sumiu) |
| Exemplos | `exemplos-*` |
| Home | chrome próprio da home: `nav`, `footer`, `home-*` |

## Movimento

Regra única: **ease-out exponencial a partir de um estado já visível**. Nenhum conteúdo aparece do nada; o que se move é a posição.

| Onde | O quê |
|---|---|
| Títulos (h1–h4) e semi-títulos | cada palavra sobe de baixo de uma máscara, escalonada 65ms por palavra (`.95s` em `cubic-bezier(.2, .7, .2, 1)`) — o mesmo formato do herói do bubble.io |
| Blocos de texto | deslocamento vertical de 28px com atraso próprio em milissegundos |
| Rolagem | a barra de progresso da coroa da página cresce com o documento (`animation-timeline: scroll()`) |
| Scroll por GSAP (`/exemplos`) | o conteúdo entra pela margem lateral — esquerda, direita, esquerda — e assenta no meio, compondo o layout; o herói cede espaço enquanto a página avança e a barra de progresso acompanha o documento — tudo em `runtime/exemplos-scroll.js` |
| Hover | linhas e listas deslizam 8px para a direita (`transform`, nunca `padding`) e o item ganha acento |
| Troca de página | View Transition na navegação client-side: a saída sobe 6px, a entrada desce 10px |

A revelação é implementada em `runtime/word-reveal.js` e estilizada em `layouts/motion.css`: `.wm` é a máscara, `.wm__i` é a palavra, `--i` marca o índice do escalonamento e `--d` o atraso do bloco. O runtime aplica a revelação a **todos** os títulos (`h1`–`h4`) e a todos os semi-títulos (o parágrafo que segue um título) das páginas do novo sistema; o atributo `data-words` no template permite controlar um bloco explicitamente e tem prioridade sobre a detecção automática.

Quem aplica é **apenas o shell**: `page-config.js`, função `applyMotion`, chama `initWordReveal(document)` depois de executar os runtimes do layout, para que o conteúdo renderizado por JavaScript também entre na revelação. Nenhum runtime de página chama a revelação por conta própria. `applyMotion` roda somente nas páginas com `clientNavigation: true` — `/`, `/site`, `/chat` e `/exemplos`; `/descoberta` e `/proposta` mantêm o próprio mundo visual.

A página de Exemplos tem uma camada a mais: `runtime/exemplos-scroll.js` usa GSAP + ScrollTrigger para o que o CSS não fazia — o conteúdo **entra pela margem lateral** quando chega na viewport (`.9s`, `power3.out`, alternando o lado: esquerda, direita, esquerda), o herói cede espaço enquanto a página avança (`scrub` com `ease: "none"`) e o círculo numerado da arquitetura acende quando a sua camada chega. A revelação por máscara de palavra também é lateral nessa página: cada palavra entra pela margem esquerda da própria máscara, e o título que viaja dentro de um cartão não é quebrado em palavras — o bloco chega com o próprio título. O runtime é carregado só por `/exemplos`, o `gsap.matchMedia()` não registra animação nenhuma sob `prefers-reduced-motion: reduce` e a `clearProps` devolve o elemento ao CSS no fim da entrada, para o hover do cartão continuar valendo. O `destroy()` é chamado quando a rota deixa de ser a de Exemplos, para nenhum gatilho ficar apontando para elemento que saiu da árvore.

Tudo respeita `prefers-reduced-motion: reduce` e degrada sem JavaScript: sem barra de progresso, sem deslocamento, sem blur.

## Componentes

- **Navegação** — sticky, filete inferior, sublinhado que desenha no hover, `aria-current` por scroll-spy. No mobile vira duas linhas: marca + CTA, e as seções viram uma faixa rolável.
- **Duas listas no Chat** — a sidebar do Chat tem duas navegações distintas: `.chat-nav` (principal, declarativa no template, com ícones SVG inline: Chat, Minha missão, Site) e `.chat-nav-sections` (âncoras das seções, preenchida em tempo de execução pelo `content.js`). São listas independentes: o runtime escreve só na segunda e nunca substitui a primeira — quando substituiu, o link para `/site` sumiu do Chat.
- **Botões** — 44px (42px compacto), raio 8px, elevação apenas no hover; variante fantasma em contorno, marcada por `data-variant="ghost"`.
- **Ciclo do herói** — 7 etapas em lista com espinha vertical e nós circulares; a versão compacta fica no painel do herói.
- **Listas com filete** — padrão do sistema: linha de 1px no topo e na base, sem cartão.
- **Tabela de modelo comercial** — dois campos por linha, 180px + 1fr.
- **Dúvidas** — `details/summary` nativo, com chevron em SVG.
- **Seletor de temas** — painel flutuante no canto inferior direito, com amostra de cor e rótulo por tema.
- **Revelação por máscara de palavra** — `runtime/word-reveal.js` quebra o título em palavras (`.wm` > `.wm__i`), marca o índice de cada uma (`--i`) e observa a entrada do bloco na viewport (`.is-in`). Sem JavaScript a página não existe: o conteúdo é injetado pelo runtime.

## Acessibilidade

Contraste mínimo 4,5:1 no corpo e 3:1 em texto grande, filetes e ícones. Foco visível de 2px com `outline-offset: 3px`. `::selection` com o acento. Barra de rolagem no tom da marca. Números tabulares em toda métrica. A navegação de seções é uma lista de links reais; as prévias da home são `aria-hidden` e o texto real fica na lista. O seletor de temas marca a opção corrente com `aria-pressed`, e o painel é `aria-expanded`/`aria-controls`.

## Marca

O logo usado em todas as páginas — navegação e rodapé, em todas as experiências — é `public/logo-dark.png`.

Fotos do time, do produto e do escritório ainda não existem no repositório: os slots de imagem estão previstos, não implementados. Enquanto isso, nenhuma imagem de stock entra no lugar — a página fica só com o conteúdo real.

## O que não é

Nada de gradiente em texto, vidro decorativo, `border-left` colorido com mais de 1px, sombra de offset duro, mono como fantasia, glifo Unicode como sistema de ícones, eyebrow acima do heading, hero-metric (número grande com label) nem parede de cartões "ícone + título + texto". Nada de cor literal fora do contrato `--oq-*` e nada de classe modificadora.

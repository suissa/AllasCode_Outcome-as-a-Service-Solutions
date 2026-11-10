# Sistema de design — OaaS.Quest

Direção escolhida: **canon**. O padrão da categoria, executado sem ironia nem truque, com a barra de acabamento em Stripe, Linear e Notion. O Modo Guilda mantém o próprio mundo visual (fantasia) e não participa deste sistema.

Documento de direção: `.impeccable/surfaces/classico-html.md`. Contexto de produto: `PRODUCT.md`.

## Princípios

1. **Um acento, uma tipografia, divisórias por filete.** Nada de segunda cor de marca, nada de sombra dura, nada de gradiente em texto.
2. **A página é um documento, não uma vitrine.** Filetes horizontais separam blocos; cartões são a exceção.
3. **Estruturas variadas.** Cada seção usa a forma que explica seu conteúdo: lista com filetes para o método, timeline para as fases, colunas para o modelo comercial, details/summary para as dúvidas.
4. **A copy é verdade de produto.** Todo texto visível vem de `content/*.json`. O runtime formata; não inventa.
5. **Um único momento de movimento autorado por página.** O movimento tem função (orientar a leitura), não enfeite.

## Tokens

Definidos em `layouts/tokens.css`, base da home e do Modo Clássico.

| Token | Valor | Uso |
|---|---|---|
| `--ground` | #FFFFFF | fundo padrão |
| `--panel` | #F7F8FA | blocos secundários (promessa, nota de integridade) |
| `--ink` | #0B0E14 | títulos e texto forte |
| `--ink-2` | #333B48 | corpo de texto |
| `--muted` | #5C6575 | apoio (contraste 5,6:1 no branco) |
| `--line` | #E4E7EC | filetes |
| `--accent` | #2F49E0 | acento único, links e estados ativos |
| `--accent-deep` | #1E31A8 | acento em fundo escuro |
| `--band` | #141C4E | faixa azul de seção |
| `--band-deep` | #0A1033 | fechamento |
| `--band-bright` | #1E31A8 | azul de destaque em faixa |

Tipografia: **Archivo** (texto e títulos) e **Spline Sans Mono** (números, rótulos, métricas), ambas self-hosted em `fonts/` com `font-display: swap`. Sem Google Fonts, sem requisição externa.

Escala: H1 `clamp(34px, 5.2vw, 64px)`; H2 de seção `clamp(28px, 3.4vw, 42px)`; corpo 16–17,5px com linha 1,65; apoio 13,5–15px. Medida de corpo entre 46 e 74 `ch`. `text-wrap: balance` nos títulos. Números com `font-variant-numeric: tabular-nums`.

## Faixas azuis

A página não é toda branca. O sistema tem três momentos de cor:

- **Navegação** — faixa `--band` em todas as páginas, com o logo branco. O CTA primário dentro da faixa vira branco sobre azul.
- **Seção de seção** — `.band` reescreve localmente `--line`, `--muted`, `--ink-2` e `--tick`, então as linhas divisórias, os textos de apoio e os marcadores acompanham a faixa sem CSS duplicado. No Modo Clássico, "O que a OaaS.Quest não é" é a faixa de meio de página; na home, o herói é a faixa.
- **Fechamento** — `--band-deep`, com o CTA branco e o secundário em contorno.

A home abre com a faixa (nav + herói) e volta ao branco nas duas experiências. O Modo Clássico tem faixa no meio e no fim.

## Movimento

Regra única: **ease-out exponencial a partir de um estado já visível**. Nenhum conteúdo aparece do nada; o que se move é a posição, e o que desenha é a linha.

| Onde | O quê |
|---|---|
| Rolagem | `.reveal` e `.reveal--soft` deslocam 16px / 8px conforme o elemento entra na viewport (`animation-timeline: view()`) |
| Rolagem | `.steps__spine--fill` preenche a espinha do método conforme a seção atravessa a tela |
| Rolagem | `.band__rule` desenha um filete de 72px sob o título da faixa |
| Rolagem | `.scroll-progress` na coroa da página cresce com o documento (`animation-timeline: scroll()`) |
| Entrada | Título do herói: cada palavra sobe de baixo de uma máscara, escalonada 65ms por palavra (`.95s` em `cubic-bezier(.2, .7, .2, 1)`) — o mesmo formato do herói do bubble.io |
| Hover | Linhas e listas deslizam 8px para a direita (`transform`, nunca `padding`) e o item ganha acento |
| Hover | Cycle do herói: o nó acende e o número fica azul |
| Hover | Prévia da home: o mockup amplia 3,5% e a dica "Passe o cursor para visualizar" aparece |
| Hover | Passo do método: o índice preenche de azul |

Tudo respeita `prefers-reduced-motion: reduce` e degrada sem `@supports (animation-timeline)`: sem barra de progresso, sem deslocamento, sem blur.

## Componentes

- **Navegação** — sticky, filete inferior, sublinhado que desenha no hover, `aria-current` por scroll-spy. No mobile vira duas linhas: marca + CTA, e as seções viram uma faixa rolável.
- **Botões** — 48px (42px compacto), raio 8px, elevação apenas no hover; variante fantasma em contorno.
- **Ciclo do herói** — 7 etapas em lista com espinha vertical e nós circulares; a versão compacta fica no painel do herói.
- **Listas com filete** — padrão do sistema: linha de 1px no topo e na base, sem cartão.
- **Tabela de modelo comercial** — dois campos por linha, 180px + 1fr.
- **Dúvidas** — `details/summary` nativo, com chevron em SVG.
- **Prévia da home** — mockup do modo dentro da linha da experiência, em escala de 3,5% no hover.
- **Revelação por máscara de palavra** — `runtime/word-reveal.js` quebra o título do herói em palavras (`.wm` > `.wm__i`), marca o índice de cada uma (`--i`) e observa a entrada do bloco na viewport (`.is-in`). O subtítulo, as ações e a nota do herói entram com 28px de deslocamento e atraso próprio em milissegundos (`--d`). Sem JavaScript a página não existe: o conteúdo é injetado pelo runtime.

## Acessibilidade

Contraste mínimo 4,5:1 no corpo e 3:1 em texto grande, filetes e ícones. Foco visível de 2px com `outline-offset: 3px`. `::selection` com o acento. Barra de rolagem no tom da marca. Números tabulares em toda métrica. A navegação de seções é uma lista de links reais; as prévias da home são `aria-hidden` e o texto real fica na lista.

## Marca

O logo oficial é `public/logo-black.png` (900×180) e sua versão `logo-white.png`, usada na faixa de navegação. As prévias da home usam o mesmo arquivo do site real, então o thumbnail não mente sobre a página que ele abre.

Fotos do time, do produto e do escritório ainda não existem no repositório: os slots de imagem estão previstos, não implementados. Enquanto isso, nenhuma imagem de stock entra no lugar — a página fica só com o conteúdo real.

## O que não é

Nada de gradiente em texto, vidro decorativo, `border-left` colorido com mais de 1px, sombra de offset duro, mono como fantasia, glifo Unicode como sistema de ícones, eyebrow acima do heading, hero-metric (número grande com label) nem parede de cartões "ícone + título + texto".

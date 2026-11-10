# Superfície: página clássica (/classico) e home (/)

## Escopo e modo do visitante

Persuade. Duas superfícies: a página institucional (/classico) e o seletor de experiência (/). A home não é uma página de marketing: é um seletor entre duas experiências do mesmo produto.

## Público, trabalho e ação

- **Público primário:** o empresário brasileiro que chega com um objetivo concreto (vender mais, cortar custo, reduzir retrabalho) e precisa saber em minutos se a OaaS.Quest entrega esse resultado.
- **Trabalho:** entender o método e sair com uma descoberta iniciada.
- **Ação:** botão primário que abre a descoberta (Modo Guilda) e o ciclo de 90 dias explained.
- **Prova disponível:** apenas o conteúdo real de `content/*.json` — método, jornada, ciclo, princípios de solução, setores, métricas, modelo comercial, FAQ. Nenhum cliente, número, depoimento, logo ou preço pode ser inventado. Números derivados do repositório e verdadeiros (90 dias, 5 etapas de jornada, 19 etapas de descoberta, 12 soluções mapeadas) são legítimos.
- **Restrições:** a copy é verdade de produto e não se reescreve. A folha de estilo e o runtime de cada layout são declarados nos descritores JSON. O Modo Guilda e o Discovery Engine mantêm o mundo visual atual e não podem regredir.

## Direção escolhida e momento memorável

Direção: o padrão da categoria, jogado sem ironia e sem truque, no nível de acabamento de Stripe, Linear e Notion.

Momento memorável: o **ciclo OaaS desenhando-se** — a cadeia de cinco nós (Objetivo → Diagnóstico → Solução → Execução → Medição) existe compacta no herói e se completa em rolagem na seção de método, com o nó ativo acendendo e a leitura correspondente aparecendo.

## Contrato de direção

THESIS: A página institucional da OaaS.Quest segue o arranjo que a categoria entrega — herói, método, ciclo, soluções, setores, métricas, modelo comercial, FAQ, fechamento — e o executa no nível de acabamento de Stripe, Linear e Notion: um único sistema tipográfico, um único acento, nenhuma ornamento sem função e nenhuma promessa que o produto não cumpra.

OWN-WORLD: Branco frio (#FFFFFF) sobre painéis #F7F8FA, tinta #0B0E14, filete #E4E7EC, um único cobalto #2F49E0 para ação e estado; Archivo como única grotesca (display e texto) e Spline Sans Mono para dado, código e rótulo; grade de 12 colunas, calha 24px, raio 8px, sombra apenas no hover, divisórias por filete de 1px em vez de bordas.

STORY: O empresário chega com um objetivo e quer saber se a OaaS.Quest o entrega. A página mostra o mecanismo funcionando — o ciclo se desenhando enquanto ele rola — e encerra com um CTA que abre a descoberta, sem prometer o que o conteúdo não promete.

FIRST VIEWPORT: Nav fina com marca, seis âncoras e CTA primário; herói em duas colunas — à esquerda o kicker, o H1 em duas batidas ("Sua empresa tem um objetivo." / "Nós construímos o caminho."), o parágrafo e os dois CTAs; à direita o painel do mecanismo com o ciclo de cinco nós e leitura de estado. Abaixo, faixa de quatro números reais: 90 dias, 5 etapas de jornada, 19 etapas de descoberta, 12 soluções mapeadas.

FORM: Padrão da categoria (canon), executado sem ironia. Posição na lista: a saída permanente, por último. Seed key 51aa6b7e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisões em aberto

- Logo e fotografia reais serão fornecidos pelo usuário em `medias/brand/`. Até lá, a marca é tipográfica e o slot de imagem fica definido mas vazio.
- O logo fornecido pode exigir ajuste de lockup e contraste na coroa da navegação.

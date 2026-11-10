# Arquitetura de páginas, layouts e conteúdo

Layouts (layouts/*.json) descrevem estrutura visual, template HTML, slots e runtime. Páginas (pages/pt-BR/*.json) declaram rota, entrada, layout, idioma, título, seções e referências de conteúdo. Conteúdos (content/*.json) guardam dados reutilizáveis e localizáveis.

| Página | Rota | Entrada | Layout |
|---|---|---|---|
| Home | / | index.html | chooser |
| Guilda | /guilda | guilda.html | guild |
| Clássico | /classico | classico.html | classic |
| Descoberta | /descoberta | descoberta/index.html | discovery |

As fontes experience.pt-BR.json, agent-team.pt-BR.json e sector-playbooks.pt-BR.json são reutilizadas. As perguntas da missão e a configuração de descoberta foram extraídas para mission-steps.pt-BR.json e discovery.pt-BR.json.

Regras: não inserir novos textos ou perguntas nos runtimes; compartilhar dados semânticos entre os modos; layout controla apresentação, página controla rota e composição, conteúdo fornece dados; toda página aponta para layout e entrada existentes; novas traduções usam diretórios de locale próprios.

## Vite, rotas e hot reload

O front-end roda com Vite em modo multi-page (`appType: "mpa"`). O mapa de rotas fica em `vite.config.ts` e é a única fonte de verdade do mapeamento entre o nome do arquivo HTML e o nome da rota:

| Entrada HTML | Rota |
|---|---|
| index.html | / |
| guilda.html | /guilda |
| classico.html | /classico |
| descoberta/index.html | /descoberta |

O nome do arquivo HTML é o nome da rota. Os links internos nunca apontam para arquivos `.html`, e sim para as rotas.

No desenvolvimento, um middleware do Vite reescreve a rota limpa para a entrada correspondente, de modo que `/guilda` serve `guilda.html`. No build, cada rota é publicada de duas formas: `dist/<rota>.html` e `dist/<rota>/index.html`, para que a rota funcione em hospedagem estática sem regra de rewrite e sem barra final.

O hot reload vem da resolução estática de módulos: `page-config.js` usa `import.meta.glob` para pullar manifestos de página, descritores de layout, templates, conteúdo, folhas de estilo e runtimes. Qualquer alteração em JSON, template, CSS ou runtime chega ao grafo de módulos e provoca a atualização da página sem reiniciar o servidor.

No WSL o projeto fica em `/mnt/d`, montado via DrvFs, que não suporta inotify. Nesse caso `vite.config.ts` liga o watcher em modo polling (`server.watch.usePolling`), porque sem isso o hot reload nunca dispara.

Comandos:

- `npm run dev` (ou `bun run dev`) sobe o servidor de desenvolvimento com hot reload.
- `npm run build` gera o site estático em `dist/`.
- `npm run preview` serve o `dist/` para conferir as rotas como em produção.

## Runtime de páginas

`page-config.js` é um módulo ES resolvido pelo Vite. Ele lê o manifesto da página indicado por `data-oaas-page`, resolve o descritor do layout e carrega apenas os arquivos JSON referenciados pela página, mais `mission-steps`, que pertence ao runtime da aplicação e é consumida por `app.js` em qualquer experiência. As referências são resolvidas e validadas antes de publicar `window.OaaSPage` e `window.OaaSPageReady`. O runtime de conteúdo usa essas fontes já carregadas, evitando uma segunda implementação da seleção de conteúdo.

A lógica de resolução fica em `page-loader.js`, sem dependência do Vite, e é testada de forma isolada em `test/page-architecture.test.ts`.

Os testes verificam entradas HTML, templates, folhas de estilo externas, integridade dos descritores, o mapeamento rota ↔ entrada e a resolução de cada `contentRef` contra os arquivos JSON reais.

## Templates físicos

O markup de apresentação foi extraído para `layouts/chooser.html`, `layouts/classic.html`, `layouts/guild.html` e `layouts/discovery.html`. Os arquivos `index.html`, `classico.html`, `guilda.html` e `descoberta/index.html` agora são pontos de entrada: declaram a página, carregam o runtime e oferecem o mount point `#oaas-page-root`. O `page-config.js` busca o template indicado pelo descritor JSON e o monta antes de resolver `OaaSPageReady`. Scripts de interação aguardam essa promessa para não procurar elementos antes da montagem.

## Folhas de estilo

Cada layout tem sua própria folha, e o descritor do layout é a fonte de verdade: o teste `each entry HTML links the stylesheet declared by its layout` garante que a entrada e o descritor não divirjam.

| Layout | Folha | Natureza |
|---|---|---|
| chooser (home) | `layouts/chooser.css` | sistema canônico da home |
| classic | `layouts/classic.css` | sistema canônico do Modo Clássico |
| guild (Guilda) | `styles.css` | mundo visual próprio da Guilda, intocado |
| discovery | `layouts/discovery.css` | motor de descoberta |

`layouts/tokens.css` é a base compartilhada pela home e pelo Modo Clássico: tokens de cor e tipografia, chrome comum (navegação, botões, rodapé), a classe `.band` para as faixas azuis e a barra de progresso de leitura. As fontes (Archivo e Spline Sans Mono) são self-hosted em `fonts/`, sem requisição externa.

O sistema de design está documentado em [DESIGN.md](../DESIGN.md).

## Copy: onde o texto mora

Nenhum texto de produto é escrito dentro dos runtimes. A copy da home vive em `content/ui-copy.pt-BR.json`, no bloco `chooser`; a do Modo Clássico, em `experience.presentation.classic`.

O template declara o vínculo com o texto, e o runtime resolve:

- `data-copy="chooser.heading"` aponta para o catálogo de locale (`content/ui-copy.pt-BR.json`). O teste `chooser template copy bindings resolve against the locale catalog` valida que todo vínculo aponta para uma string existente.
- `data-page-copy="experience.presentation.classic.hero.title"` aponta para as fontes do manifesto da própria página.

O texto embutido no template é o fallback sem JavaScript; com o runtime carregado, o valor do catálogo substitui o fallback. Nenhuma das duas rotas inventa texto: uma lê o catálogo de locale, a outra lê as fontes do manifesto.

## Runtimes por layout

Os descritores JSON declaram também os scripts necessários a cada experiência. O `page-config.js` carrega os runtimes na ordem declarada depois de montar o template e publicar `OaaSPageReady`. Os comportamentos do seletor, Clássico, Guilda e Discovery foram movidos para `runtime/*.js`; os HTMLs de entrada deixam de conter scripts inline ou listas duplicadas de dependências. O renderer compartilhado trata tanto o carregamento antes quanto depois de `DOMContentLoaded`, pois os scripts são carregados dinamicamente.

# Arquitetura de páginas, layouts e conteúdo

Layouts (layouts/*.json) descrevem estrutura visual, template HTML, slots e runtime. Páginas (pages/pt-BR/*.json) declaram rota, entrada, layout, idioma, título, seções e referências de conteúdo. Conteúdos (content/*.json) guardam dados reutilizáveis e localizáveis.

| Página | Entrada | Layout |
|---|---|---|
| Home | index.html | chooser |
| Clássico | classico.html | classic |
| Guilda | guilda.html | guild |
| Descoberta | descoberta/index.html | discovery |

As fontes experience.pt-BR.json, agent-team.pt-BR.json e sector-playbooks.pt-BR.json são reutilizadas. As perguntas da missão e a configuração de descoberta foram extraídas para mission-steps.pt-BR.json e discovery.pt-BR.json. Os templates HTML permanecem como pontos de entrada estáveis para preservar links.

Regras: não inserir novos textos ou perguntas nos runtimes; compartilhar dados semânticos entre os modos; layout controla apresentação, página controla rota e composição, conteúdo fornece dados; toda página aponta para layout e entrada existentes; novas traduções usam diretórios de locale próprios.

## Runtime de páginas

`page-config.js` carrega o manifesto da página indicado por `data-oaas-page`, resolve o descritor do layout e busca somente os arquivos JSON referenciados pela página. As referências são resolvidas e validadas antes de publicar `window.OaaSPage` e `window.OaaSPageReady`. O runtime de conteúdo usa essas fontes já carregadas, evitando uma segunda implementação da seleção de conteúdo. A página de descoberta usa a mesma configuração declarativa, com `data-config-root="../"` por estar em um subdiretório.

Os testes verificam entradas HTML, templates, folhas de estilo externas, integridade dos descritores e resolução de cada `contentRef` contra os arquivos JSON reais.

## Templates físicos

O markup de apresentação foi extraído para `layouts/chooser.html`, `layouts/classic.html`, `layouts/guild.html` e `layouts/discovery.html`. Os arquivos `index.html`, `classico.html`, `guilda.html` e `descoberta/index.html` agora são pontos de entrada: declaram a página, carregam o runtime e oferecem o mount point `#oaas-page-root`. O `page-config.js` busca o template indicado pelo descritor JSON e o monta antes de resolver `OaaSPageReady`. Scripts de interação aguardam essa promessa para não procurar elementos antes da montagem.

O CSS e os runtimes específicos continuam nos pontos de entrada nesta etapa; a extração de estilos e scripts para assets independentes é uma etapa posterior.

## Folhas de estilo

O `page-config.js` também carrega a folha de estilo declarada em cada descritor de layout e aguarda seu carregamento antes de montar o template. Os modos Seletor, Clássico e Guilda reutilizam `styles.css`; o Discovery Engine utiliza `layouts/discovery.css`. As entradas HTML não precisam mais declarar manualmente essas folhas de estilo.

## Runtimes por layout

Os descritores JSON declaram também os scripts necessários a cada experiência. O `page-config.js` carrega os runtimes na ordem declarada depois de montar o template e publicar `OaaSPageReady`. Os comportamentos do seletor, Clássico, Guilda e Discovery foram movidos para `runtime/*.js`; os HTMLs de entrada deixam de conter scripts inline ou listas duplicadas de dependências. O renderer compartilhado trata tanto o carregamento antes quanto depois de `DOMContentLoaded`, pois os scripts são carregados dinamicamente.

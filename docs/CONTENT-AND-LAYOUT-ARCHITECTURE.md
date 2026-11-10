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

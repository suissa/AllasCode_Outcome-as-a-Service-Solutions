# OaaS.Quest — Documentação de referência

Esta pasta reúne as definições de produto, operação, engenharia, contratos e comercialização necessárias para transformar uma intenção de negócio em um resultado mensurável, entregue e comprovável.

## Mapa de leitura

| Documento | Para que serve |
|---|---|
| [Commercial Model & Pricing](./Commercial-Model-and-Pricing.md) | Modelos de cobrança, composição de preço, fórmulas, exemplos e regras de margem |
| [Contract Playbook](./Contract-Playbook.md) | Estrutura contratual, cláusulas, anexos, regras de aceite, cobrança, bônus, créditos, reembolso e disputa |
| [Contract Composer](./Contract-Composer.md) | Motor executável para compor minutas, calcular preços, parametrizar cláusulas e gerar anexos |
| [Contract Workflow](./Contract-Workflow.md) | Persistência tenant-scoped, revisão, aprovação, verificação de assinaturas e ativação do contrato |
| [Contract Workflow](./Contract-Workflow.md) | Persistência tenant-scoped, revisão, aprovação, verificação de assinaturas e ativação do contrato |
| [Sector Solution Catalog](./Sector-Solution-Catalog.md) | Problemas, soluções, métricas, evidências e modelos comerciais por setor |
| [Delivery & Project Operating Model](./Delivery-Operating-Model.md) | Diagnóstico, proposta, planejamento, execução, gerenciamento, implantação e evolução |
| [Outcome Measurement & Evidence](./Outcome-Measurement-and-Evidence.md) | Baseline, metas, atribuição, qualidade de dados, prova, auditoria e liquidação |
| [Security, Trust & Platform Architecture](./Security-Trust-and-Architecture.md) | Identidade, autorização, isolamento, integrações, segurança de agentes e controles operacionais |
| [Implementation Plan](./Implementation-PLAN.md) | Backlog macro, Atomic Behaviors, critérios de aceitação e convenções de implementação |
| [Atomic Behavior Matrix](./Atomic-Behavior-Implementation-Matrix.md) | Mapeamento de capacidades e implementação |
| [Runtime Usage](./Runtime-Usage.md) | Estado e limites atuais do runtime de referência |
| [Syntropic Antifragility](./syntropic-antifragility/manifest.md) | Atomic Behaviors, contratos, fluxo 2flow, implementação e governança do ciclo de evolução sintropicamente antifrágil |
| [ADR-004 — Syntropic Antifragility](./ADR-004-syntropic-antifragility.md) | Decisão arquitetural e alternativas rejeitadas |
| [ADRs](.) | Decisões arquiteturais registradas |

## Princípio central

OaaS.Quest não vende um software genérico como resposta padrão. A plataforma identifica o resultado desejado, entende o contexto da organização, mede a situação atual, propõe alternativas, monta uma solução adequada, coordena pessoas/agentes/sistemas, verifica o resultado e aplica as regras comerciais acordadas.

O cliente pode interagir por interface web, API e canais conversacionais. O canal não altera a autoridade, as aprovações, a segurança ou a trilha de auditoria exigidas para uma ação.

## Como interpretar o conteúdo

Cada documento diferencia:

- **Regra de plataforma:** comportamento ou princípio que deve ser preservado no produto.
- **Capacidade implementada:** existe código/teste/documentação no repositório; isso não significa implantação produtiva.
- **Modelo operacional:** procedimento recomendado para conduzir um projeto.
- **Exemplo ilustrativo:** números e cenários para explicar o mecanismo; não são tabela oficial, benchmark garantido ou proposta comercial.
- **Decisão pendente:** depende de análise do cliente, validação técnica, jurídica, tributária ou financeira.

## Fontes e limites

Os exemplos comerciais foram consolidados a partir da pesquisa exploratória anterior e de modelos operacionais discutidos para OaaS.Quest. Resultados de terceiros citados na pesquisa não devem ser usados em publicidade, proposta ou alegação de ROI antes de validação independente da fonte, contexto, período e metodologia.

Os valores em reais são referências de modelagem. A proposta real deve ser calculada a partir de escopo, horas, capacidade, custo de infraestrutura/modelos, integração, risco, tributos, margem, dependências e valor econômico mensurável.

A documentação descreve controles e contratos de produto; não substitui aconselhamento jurídico, contábil, tributário, regulatório ou de segurança especializado.

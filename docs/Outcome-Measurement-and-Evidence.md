# Outcome Measurement & Evidence Protocol

## 1. Propósito

Uma cobrança baseada em resultado só é confiável quando as partes sabem exatamente o que será medido, em qual população, durante qual janela, a partir de qual fonte e por qual método. Este protocolo estabelece a base comum para diagnóstico, aceite, auditoria e liquidação.

## 2. Hierarquia de afirmações

Classificar toda afirmação:
- **Observada:** diretamente registrada em fonte identificada.
- **Calculada:** derivada por fórmula versionada de observações.
- **Atribuída:** parcela do resultado associada à intervenção segundo método declarado.
- **Causal:** estimada por desenho experimental/contrafactual defensável.
- **Estimativa/projeção:** hipótese de futuro, nunca resultado já entregue.

Não usar "causou", "garantiu" ou "gerou" quando a evidência só sustenta correlação ou contribuição.

## 3. Definição de métrica

Toda métrica deve definir:
- ID e nome;
- significado de negócio;
- tipo (count, ratio, currency, duration, rate etc.);
- unidade e moeda;
- direção desejada;
- numerador/denominador;
- agregação;
- granularidade;
- população;
- janela;
- fonte autoritativa;
- frequência;
- freshness;
- completude mínima;
- regra de deduplicação;
- exclusões;
- responsável;
- versão.

## 4. Baseline

A baseline deve registrar:
- valor e unidade;
- período inicial/final;
- população e segmentação;
- origem e timestamp de extração;
- regra de cálculo;
- sazonalidade e eventos relevantes;
- qualidade/completude;
- limitações;
- responsável e aprovação;
- snapshot imutável.

Sempre que possível, usar 30–90 dias de histórico como ponto de partida para processos de alta frequência. Isso é uma heurística exploratória, não uma regra: ciclos sazonais ou eventos raros exigem janelas maiores.

## 5. Meta e guardrails

Meta deve ter valor, unidade, direção, prazo e tolerância. Métricas guardrail impedem otimização nociva: conversão não pode crescer sacrificando margem, segurança, satisfação ou conformidade; velocidade não pode crescer sacrificando precisão.

## 6. Métodos de atribuição

### Direta
Usar quando o evento é operacionalmente atribuível e não há confundidores materiais conhecidos. Documentar a premissa de ausência de mudanças externas relevantes.

### Contribuição
Usar quando múltiplas iniciativas/equipes/condições influenciam o resultado. Descrever participação, limitações e fatores concorrentes. Não chamar de prova causal.

### Experimental
Usar grupo de controle, randomização ou desenho quase-experimental apropriado. Exige comparabilidade, tamanho de amostra, período e análise de contaminação. Diferença-em-diferenças é uma opção quando pressupostos forem defensáveis.

### Contrafactual/modelagem
Usar previsão ou modelo contrafactual apenas com validação, erro conhecido, versionamento, monitoramento de drift e explicação de limitações.

## 7. Fórmulas ilustrativas

Para métricas que aumentam:
`mudança bruta = observado - baseline`

Para métricas que diminuem:
`redução = baseline - observado`

Progresso limitado entre 0 e 1:
`progresso = clamp((observado - baseline)/(meta - baseline), 0, 1)` para aumento, com fórmula equivalente invertida para redução.

Diferença-em-diferenças:
`efeito estimado = (tratamento_depois - tratamento_antes) - (controle_depois - controle_antes)`

O método precisa declarar pressupostos e incerteza. Não usar a fórmula se unidades, períodos ou populações não forem comparáveis.

## 8. Fontes de verdade

Definir sistema primário por métrica: ERP, POS, WMS, CRM, Service Desk, agenda, financeiro, sistema contábil, TMS, MES/SCADA, ATS, analytics ou banco transacional. Logs da própria OaaS podem provar execução, mas não substituem o registro comercial autoritativo do cliente quando este for a fonte contratada.

## 9. Evidência mínima

Cada evidência deve ter:
- Evidence ID;
- tenant e outcome;
- source system/source record ID;
- timestamp de origem e captura;
- tipo e classificação de privacidade;
- hash/checksum;
- versão do extrator/regra;
- permissões e finalidade;
- retenção;
- vínculo com cálculo;
- responsável.

A evidência deve ser minimizada: armazenar referência, metadados e prova necessária, evitando cópias desnecessárias de dados pessoais/sensíveis.

## 10. Integridade e trilha

- IDs únicos por evento/registro;
- idempotência e deduplicação;
- relógios/timezones explícitos;
- append-only para fatos/evidências relevantes;
- snapshots imutáveis de cálculo;
- método e versão registrados;
- acesso auditado;
- amostragem independente;
- exportação e reconciliação.

Hash SHA-256 detecta alterações em conteúdo conhecido; hash não prova sozinho que o dado de origem era verdadeiro. Hash chain sem ancoragem externa também não impede administrador privilegiado de reescrever dados e cadeia. Backups independentes, controle de acesso, logs externos e ancoragem periódica fortalecem a garantia.

## 11. Amostragem e auditoria

A pesquisa exploratória sugeriu amostra de 5–10% como ponto inicial em certos fluxos. Não é regra universal. Dimensionar conforme volume, risco, taxa de erro esperada, materialidade e custo de auditoria. Em transações de alto impacto, pode ser necessário revisar 100% ou exigir dupla aprovação.

A auditoria deve registrar universo, seleção, amostra, resultado, discrepâncias, correção e responsável.

## 12. Exclusões e tratamento de eventos

Contrato deve resolver:
- duplicidade;
- spam/teste;
- registro incompleto;
- cancelamento e devolução;
- evento fraudulento;
- falha de sistema do cliente;
- falha de fornecedor terceiro;
- atraso de dados;
- mudança de processo;
- evento fora da população;
- erro de relógio;
- reprocessamento;
- pagamento espontâneo;
- evento já contabilizado em outro programa.

Exclusões devem ser objetivas e auditáveis, nunca escolhidas depois de ver o resultado para favorecer uma parte.

## 13. Confiança e amostra

Relatar cobertura, missingness, freshness, distribuição e amostra. Intervalo de confiança depende da distribuição, independência, desenho e tamanho. A implementação de referência tem uma aproximação normal com exigência mínima de n≥30; isso não substitui escolha estatística apropriada para cada métrica.

## 14. Apuração e contestação

1. Fechar janela de observação.
2. Congelar conjunto de dados elegível.
3. Validar integridade e qualidade.
4. Calcular baseline/observado/atribuição.
5. Gerar snapshot reproduzível.
6. Aplicar guardrails e caps.
7. Gerar relatório com memória de cálculo.
8. Abrir prazo de contestação.
9. Resolver divergência com evidência.
10. Emitir instrução de faturamento/refund/bonus/hold.

## 15. Estrutura de relatório

- objetivo e versão do contrato;
- métrica, baseline, meta e observado;
- população e período;
- fonte e qualidade;
- método e fórmula;
- resultado bruto e atribuído;
- confiança e limitações;
- guardrails;
- evidências;
- itens excluídos e motivo;
- memória de cálculo;
- fee/bonus/credit sugerido;
- decisão de aceite e responsáveis.

## 16. Relação com o código atual

O repositório já possui:
- cálculo de outcome com métrica, unidade, período e aprovação em `src/outcomes/settlement.ts`;
- atribuição direta/contribuição/experimental em `src/outcomes/attribution.ts`;
- snapshots de cálculo imutáveis e fingerprint SHA-256 descritos em ADR-003;
- ledger de uso idempotente em `src/commercial/metering.ts`;
- workflow de settlement com hold, disputa, invoice, bonus e refund em `src/commercial/settlement-workflow.ts`.

Limites: a função de cálculo de outcome e a função de atribuição são primitives simplificadas; a documentação não declara uma plataforma estatística completa nem conectores de fontes de verdade já implantados.

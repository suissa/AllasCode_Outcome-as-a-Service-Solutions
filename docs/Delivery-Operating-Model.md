# Delivery Operating Model — Diagnóstico, proposta, planejamento e execução

## 1. Ciclo operacional

OaaS.Quest deve tratar cada pedido como um caso de resultado com histórico e estado próprios:

1. **Intent Intake:** capturar objetivo, contexto, restrições e urgência.
2. **Qualification:** validar clareza, viabilidade inicial, autoridade e elegibilidade.
3. **Discovery:** entender organização, processos, pessoas, dados, sistemas e causas.
4. **Baseline:** medir situação atual e qualidade da evidência.
5. **Outcome Design:** estabelecer resultado, métrica, meta, período, guardrails e atribuição.
6. **Solution Design:** gerar alternativas e estimar custo, benefício, risco e dependências.
7. **Commercial Proposal:** montar escopo, preço, premissas, cronograma e condições.
8. **Contracting:** revisar, aprovar, assinar e congelar versões.
9. **Planning:** decompor em iniciativas, marcos, Atomic Behaviors, atores e dependências.
10. **Execution:** executar com aprovações, idempotência, integrações e supervisão.
11. **Verification:** validar entregáveis e resultado com evidências.
12. **Settlement:** calcular cobrança, bônus, créditos, reembolso ou disputa.
13. **Evolution:** aprender com operação e revisar plano/capacidade sem alterar contratos retroativamente.

## 2. Intake conversacional

A interface pode receber texto, áudio, imagem, documento e conversa via WhatsApp ou web. A captura deve identificar:
- o que o cliente quer mudar;
- por que isso importa;
- onde acontece;
- quem é afetado;
- como o processo funciona hoje;
- quando o resultado é necessário;
- quais sistemas/pessoas participam;
- quais restrições não podem ser violadas;
- quem pode aprovar.

A plataforma não deve exigir que o cliente conheça tecnologia. Perguntas de esclarecimento devem ser curtas e progressivas. Se a intenção for ambígua, não inventar baseline, meta, autoridade ou escopo.

## 3. Qualificação

Classificar cada caso por:
- clareza do objetivo;
- mensurabilidade;
- acesso a dados;
- viabilidade de integração;
- autoridade do patrocinador;
- impacto/risco;
- prazo;
- dependência externa;
- potencial econômico;
- capacidade interna disponível.

Saídas possíveis:
- qualificado para discovery;
- precisa de esclarecimento;
- requer assessment pago;
- inviável no momento, com razões;
- requer especialista/validação regulatória antes de prosseguir.

## 4. Diagnóstico da organização

### 4.1 Mapa mínimo
- organização, unidades e canais;
- jornada do cliente e processos internos;
- papéis e responsabilidades;
- sistemas de registro e integrações;
- dados disponíveis, qualidade e retenção;
- custos, volumes e sazonalidade;
- regras, exceções e aprovações;
- riscos e obrigações;
- iniciativas já em andamento.

### 4.2 Entregáveis
1. Resumo executivo do problema.
2. Mapa do processo atual (as-is).
3. Hipóteses de causa e evidências.
4. Inventário de sistemas e dados.
5. Baseline e confiança.
6. Oportunidades priorizadas.
7. Restrições, riscos e dependências.
8. Cenários e recomendação.
9. Estimativa de investimento/custo.
10. Plano de piloto e critérios de sucesso.

## 5. Desenho do resultado

Cada outcome deve ter:
- métrica primária e unidade;
- baseline com janela e população;
- meta e direção (aumentar/diminuir);
- prazo e período de apuração;
- fonte de verdade;
- guardrails de qualidade/risco;
- método de atribuição;
- amostra mínima;
- confiança e limitações;
- evento de aceite e pagamento.

A meta deve ser negociada com base em evidência. Não converter hipótese do cliente em compromisso garantido.

## 6. Desenho da solução

Gerar pelo menos uma alternativa recomendada e, quando útil, opções comparáveis:
- **Conservadora:** menor mudança, risco menor, resultado potencial limitado.
- **Balanceada:** melhor relação valor/esforço/risco.
- **Agressiva:** maior potencial, maior investimento/dependência/risco.

Para cada cenário: capacidades, processos alterados, atores, integrações, custo total, prazo, benefícios, premissas, risco, reversibilidade e confiança.

A solução pode combinar:
- software customizado;
- integrações com sistemas existentes;
- agentes e automações;
- mudanças de processo;
- treinamento e revisão humana;
- ferramentas de terceiros;
- observabilidade e suporte.

Não presumir que a resposta para todo problema seja um agente ou um novo software.

## 7. Estrutura padrão de proposta

1. Capa e validade.
2. Resumo do resultado desejado.
3. Diagnóstico e evidências.
4. Baseline e limitações.
5. Resultado-alvo e guardrails.
6. Solução recomendada e alternativas.
7. Escopo e entregáveis.
8. Arquitetura de integração e dados.
9. Plano de execução e marcos.
10. Responsabilidades do cliente e fornecedor.
11. Segurança, privacidade e aprovações.
12. Modelo de preço e memória de cálculo.
13. Métricas, atribuição e aceite.
14. SLA, suporte e continuidade.
15. Riscos, premissas e exclusões.
16. Termos comerciais e próximos passos.

A proposta deve indicar o que é fato observado, dado informado pelo cliente, estimativa, hipótese e compromisso contratual.

## 8. Planejamento de projeto

Cada projeto deve decompor o resultado em:
- outcomes;
- iniciativas;
- entregáveis;
- marcos;
- tarefas;
- Atomic Behaviors;
- integrações;
- aprovações;
- testes;
- evidências;
- riscos;
- orçamento e capacidade.

Cada tarefa precisa de owner, actor type, dependências, prioridade, esforço, data, critério de pronto, risco, idempotency key quando houver efeito externo e plano de recuperação.

### Exemplo: reduzir tempo de confirmação de agendamento
- Baseline: 120 minutos.
- Meta: 30 minutos.
- Processo: pedido → validação → disponibilidade → confirmação.
- Integrações: canal de entrada, agenda e CRM.
- Behaviors: capturar pedido, validar campos, consultar disponibilidade, propor horário, obter aprovação quando necessário, confirmar, notificar, registrar evidência.
- Guardrail: cancelamento/remarcação sensível exige aprovação conforme política.
- Medição: timestamp de entrada até confirmação válida.
- Modelo comercial: setup + base + fee por confirmação elegível ou por redução de tempo, conforme contrato.

Os valores do exemplo são uma fixture ilustrativa; um caso real precisa de fonte e janela definidas.

## 9. Fases de implantação

| Fase | Escopo típico | Gate de saída |
|---|---|---|
| Preparação | 2–3 semanas como referência inicial; acessos, dados, desenho, segurança | baseline e plano aprovados |
| Piloto | 2–4 semanas ou janela apropriada ao ciclo | critérios de sucesso e guardrails avaliados |
| Expansão controlada | 60–90 dias como referência exploratória | estabilidade por unidade/canal e capacidade |
| Produção contínua | operação, suporte, medição e evolução | revisão periódica e SLA |

Prazos não são SLA padrão; devem refletir volume, integração, aprovação e sazonalidade.

## 10. Gerenciamento contínuo

### Cadência
- diária: saúde técnica, falhas, fila, exceções e bloqueios;
- semanal: progresso, riscos, dependências, qualidade e ações;
- mensal: resultados, custo, SLA, faturamento e mudanças;
- trimestral: estratégia, metas, capacidade, segurança e roadmap.

### Painel de gerenciamento
- objetivo e progresso;
- baseline, meta e valor observado;
- confiança e cobertura de dados;
- tarefas e marcos;
- dependências e aprovações;
- custo planejado/real;
- consumo e saldo de franquia;
- incidentes e SLO;
- evidências e alterações;
- risco e decisões pendentes.

## 11. Mudança de escopo e controle

Solicitação de mudança precisa registrar:
- motivo e solicitante;
- impacto em escopo, custo, prazo e métricas;
- risco e dependências;
- nova versão de plano/contrato;
- aprovação das partes.

Não alterar baseline, meta, tarifa ou critério de aceite de forma retroativa.

## 12. Operação e incidentes

Definir severidade, detecção, resposta, contenção, comunicação, recuperação, análise de causa e prevenção. Em caso de risco, a plataforma deve pausar execução, revogar acesso ou voltar para modo manual conforme plano aprovado.

## 13. Evolução e aprendizado

A evolução pode propor mudanças em workflows, políticas, modelos, conectores e playbooks. Cada mudança passa por avaliação, teste, aprovação e versionamento. Aprendizado de um cliente não autoriza exposição de seus dados a outro cliente.

## 14. Critérios de encerramento

- entregáveis aceitos ou exceções registradas;
- resultado apurado ou limitação documentada;
- faturas e disputas conciliadas;
- acessos/segredos revogados quando necessário;
- dados exportados/retidos conforme contrato e lei;
- documentação operacional entregue;
- lições aprendidas registradas;
- plano de continuidade ou encerramento executado.

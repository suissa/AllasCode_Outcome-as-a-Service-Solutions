# Modelo comercial e precificação OaaS

## 1. Princípio econômico

A unidade de valor da OaaS.Quest é o resultado acordado, não a quantidade de telas, licenças ou funcionalidades entregues. A cobrança pode combinar disponibilidade/capacidade, trabalho de implantação, consumo mensurável e valor comprovadamente produzido.

O modelo precisa ser sustentável mesmo quando o resultado depende parcialmente do cliente, de terceiros ou do mercado. Por isso, "pagar somente pelo resultado" é uma opção comercial possível, não uma regra universal. Quando há custos fixos, dependências externas ou risco elevado, a proposta deve prever uma parcela de mobilização/capacidade e definir com precisão o que é resultado elegível.

## 2. Componentes de preço

Um acordo pode conter um ou mais componentes:

1. **Diagnóstico/Assessment:** preço fechado para descoberta, análise de dados, mapeamento de processos, avaliação de viabilidade e desenho da oportunidade.
2. **Implantação/Setup:** preço por projeto ou marco para integração, configuração, migração, treinamento, segurança e entrada em produção.
3. **Disponibilidade/Retainer:** valor recorrente para capacidade reservada, operação, suporte, monitoramento, manutenção e governança.
4. **Uso/Consumo:** preço por unidade válida consumida: transação, documento, atendimento, tarefa, chamada, unidade processada, usuário ativo ou volume.
5. **Marco/Milestone:** pagamento após entrega verificável de uma etapa ou artefato aceito.
6. **Resultado/Outcome fee:** percentual ou valor fixo associado a resultado medido segundo uma definição contratual.
7. **Compartilhamento de economia (gain-share):** percentual de economia líquida elegível e validada contra baseline.
8. **Compartilhamento de receita (revenue-share):** percentual de receita incremental elegível, com regra de atribuição, margem, cancelamentos, devoluções e janela de maturação.
9. **Bônus:** incentivo por superar meta, sustentar resultado ou cumprir qualidade/SLA acima do mínimo.
10. **Créditos/penalidades:** abatimentos por falha atribuível à OaaS.Quest, com limites, exceções e procedimento de correção.
11. **Serviços adicionais:** canal, integração, revisão humana especializada, unidade adicional, ambiente dedicado, relatório avançado ou cobertura operacional ampliada.

## 3. Formatos comerciais que podem ser combinados

| Modelo | Fórmula-base | Quando faz sentido | Cuidado principal |
|---|---|---|---|
| Preço fixo | valor por escopo | diagnóstico, implantação delimitada, entregável conhecido | controlar mudança de escopo |
| Recorrência fixa | mensalidade | operação contínua e capacidade reservada | explicitar capacidade e limites |
| Por unidade | quantidade válida × tarifa | documentos, pedidos, atendimentos, conciliações | deduplicação e definição da unidade |
| Por faixa | tarifa por faixa de volume | consumo previsível com economia de escala | definir limites e excedentes |
| Por marco | preço do marco aceito | implantação e projetos com etapas | critérios objetivos de aceite |
| Por resultado | valor por resultado ou percentual | resultado observável e atribuível | baseline e causalidade |
| Gain-share | economia líquida elegível × percentual | redução de custo/desperdício/perdas | custos evitados versus custos transferidos |
| Revenue-share | receita incremental elegível × percentual | crescimento de vendas/conversão/recuperação | devoluções, margem e fatores externos |
| Híbrido | base + uso + resultado ± ajustes | maior parte dos projetos reais | evitar dupla cobrança |
| Success fee puro | fee somente quando critério é atingido | baixo custo de entrega e controle alto | risco financeiro e variáveis fora do controle |

## 4. Fórmula de referência para proposta híbrida

`Preço do período = Base + Setup amortizado + Uso elegível + Fee de resultado + Bônus - Créditos`

A proposta pode separar faturamento de implantação, operação e resultado. A soma não deve cobrar duas vezes pelo mesmo valor econômico. Se o componente de uso já remunera integralmente a unidade processada, o fee de resultado deve remunerar um benefício diferente e claramente definido.

### 4.1 Custo mínimo sustentável

`Custo total = pessoas + infraestrutura + inferência/modelos + armazenamento + ferramentas + integrações + revisão humana + segurança/compliance + suporte + contingência`

`Preço mínimo = Custo total / (1 - margem bruta desejada)`

A fórmula é uma aproximação de margem bruta antes de tributos e despesas que não estejam incluídos no custo. Se tributos, comissões, taxas de pagamento ou inadimplência incidirem sobre receita, devem entrar explicitamente no modelo.

Outra forma de calcular preço com tributos/taxas percentuais sobre a receita:

`Preço = Custo / (1 - margem alvo - tributos sobre receita - taxas variáveis sobre receita)`

Só usar quando as parcelas forem realmente percentuais da receita e não estiverem duplicadas no custo.

### 4.2 Exemplo de custo ilustrativo

Um exercício exploratório anterior estimou: mão de obra R$ 27.900; infraestrutura R$ 1.050; inferência R$ 100; armazenamento R$ 200; ferramentas R$ 800; integrações R$ 500; revisão humana R$ 2.000; compliance R$ 1.500; reserva de 15% sobre uma base de custos. O total apresentado naquela pesquisa foi R$ 39.145, com faixa de preço ilustrativa de R$ 33.574 a R$ 58.931.

**Não reutilizar esse total sem recalcular.** A base, o tratamento da reserva, a margem e os tributos precisam ser reconciliados; a faixa pode não representar uma margem consistente. O exemplo existe para lembrar categorias de custo, não como orçamento validado.

## 5. Regras para cada componente

### 5.1 Base recorrente

Deve informar:
- capacidade reservada (horas, tarefas, volume ou janela de operação);
- ambientes, canais e integrações incluídos;
- suporte, horários e severidade;
- manutenção, monitoramento e governança;
- limites e política de excedente;
- itens explicitamente excluídos.

A base não deve ser descrita como "taxa sem entrega". Ela remunera capacidade, disponibilidade, operação e obrigações recorrentes identificáveis.

### 5.2 Uso

`Cobrança de uso = unidades válidas × tarifa unitária`

Contrato deve definir unidade, evento de origem, fonte de verdade, janela, duplicidade, falha, cancelamento, reprocessamento, unidade gratuita/franquia, arredondamento, moeda e conciliação.

Exemplo ilustrativo: R$ 3 por resolução automatizada válida acima da franquia. Uma conversa não equivale necessariamente a uma resolução; reabertura, transferência humana, spam, duplicidade e falha devem ter regra própria.

### 5.3 Resultado

Para uma métrica que aumenta:
`progresso = clamp((observado - baseline) / (meta - baseline), 0, 1)`

Para uma métrica que diminui:
`progresso = clamp((baseline - observado) / (baseline - meta), 0, 1)`

`fee de resultado = valor elegível × taxa × progresso`

O cálculo deve prever meta igual à baseline, amostra mínima, período, unidade, confiança, limites e tratamento de dados ausentes. A implementação atual de referência contém uma função de outcome fee simplificada; o contrato completo ainda deve validar regras como direção, denominador, floor/cap, elegibilidade, arredondamento e consistência da moeda.

### 5.4 Gain-share

`Economia líquida elegível = economia bruta validada - custos incrementais acordados - custos de transição elegíveis`

`Gain-share = economia líquida elegível × percentual contratado`

Não contar como economia: custo transferido para outra área, redução de qualidade, postergação de pagamento, queda de volume ou efeito de sazonalidade não ajustado. Definir se a economia é recorrente ou pontual.

### 5.5 Revenue-share

`Receita incremental elegível = receita líquida observada - receita contrafactual acordada`

`Revenue-share = receita incremental elegível × percentual contratado`

Deduzir impostos indiretos, descontos, cancelamentos, devoluções, chargebacks e custos variáveis quando o contrato definir receita líquida. Receita incremental não é sinônimo de lucro incremental.

### 5.6 Marcos

Cada marco deve conter artefato, critério de aceite, evidência, responsável, prazo, dependências, janela de revisão e consequência de rejeição. Pagamento por marco não significa que o resultado final do negócio já foi alcançado.

## 6. Exemplos de modelos por tipo de negócio

Os valores abaixo reproduzem exemplos exploratórios usados para explicar como estruturar uma oferta. São **ilustrativos, não preços oficiais nem pesquisa de mercado validada**.

| Cenário | Estrutura de exemplo | Observações |
|---|---|---|
| Atendimento automatizado essencial | R$ 1.500/mês; franquia de 300 resoluções; WhatsApp; SLA ilustrativo de 95% | excedente sugerido de R$ 3 por resolução válida |
| Atendimento Pro | R$ 3.500/mês; franquia de 1.000 resoluções; CRM; SLA ilustrativo de 97%; revisão humana | canal adicional R$ 1.200/mês; integração customizada R$ 2.500/mês |
| Jurídico — contratos | R$ 3.000/mês para até 50 contratos | excedente ilustrativo R$ 45 por contrato; revisão crítica humana R$ 150 |
| Contabilidade — lançamentos | R$ 2.000/mês para até 1.000 lançamentos | excedente ilustrativo R$ 2 por lançamento conciliado; assistência adicional R$ 1.500/mês |
| Redução de desperdício | base operacional + percentual da economia líquida comprovada | exige baseline de compra, consumo, perdas e descarte |
| Recuperação de crédito | fee por valor efetivamente recuperado ou faixa percentual | excluir pagamentos espontâneos/valores sem atribuição |
| Crescimento de vendas | base + percentual da receita incremental líquida | requer grupo de controle ou método de contribuição e janela de devolução |
| Implantação ERP/integração | assessment + setup por marcos + suporte recorrente | não confundir implantação com resultado de negócio |

## 7. Diagnóstico pago e piloto

### Assessment de viabilidade

Faixa exploratória anterior: R$ 1.500–25.000, variando com número de unidades, sistemas, qualidade dos dados, criticidade, esforço de entrevistas e profundidade da análise. Entregáveis típicos:
- mapa do processo atual;
- inventário de sistemas/dados;
- baseline preliminar e lacunas;
- oportunidades priorizadas;
- riscos e dependências;
- estimativa de esforço/custo;
- desenho do piloto e critérios de sucesso.

É possível creditar parte ou todo o assessment se o cliente assinar a implantação dentro de prazo (exemplo discutido: 30 dias). A regra de crédito precisa estar escrita e não deve gerar trabalho gratuito implícito.

### Piloto

Piloto de 2–4 semanas foi sugerido como referência inicial, não como duração universal. Definir:
- uma unidade de negócio/processo;
- população e volume;
- dados e acessos;
- baseline;
- hipótese e meta;
- grupo de comparação, quando viável;
- orçamento máximo;
- critérios de interrupção;
- aceite e plano de expansão.

Um piloto de 30 dias pode ser adequado para alguns processos, mas não é adequado a resultados com sazonalidade, baixo volume ou ciclo de conversão longo.

## 8. Política de risco e margem

- Precificar separadamente trabalho controlável e benefício dependente de terceiros.
- Exigir base/setup quando há custo de mobilização não recuperável.
- Usar caps para limitar exposição financeira de ambas as partes.
- Definir mínimo mensal, teto de consumo e autorização para excedente.
- Reservar contingência proporcional à incerteza, não um percentual automático sem justificativa.
- Modelar cenário pessimista, provável e otimista.
- Considerar custo de capital e prazo de recebimento em success fee.
- Não prometer economia, crescimento ou ROI sem baseline e método.

## 9. Governança dos números

Cada número da proposta recebe:
- unidade e moeda;
- fonte;
- data de referência;
- responsável pela premissa;
- fórmula;
- intervalo/nível de confiança;
- condição de validade;
- status: medido, informado pelo cliente, estimado ou hipótese.

## 10. Relação com o código atual

O repositório já possui tipos de fee `fixed`, `usage`, `milestone` e `outcome` em `src/commercial/agreement.ts`; medição de uso e ledger em `src/commercial/metering.ts`; cálculo simplificado de fee por resultado em `src/commercial/outcome-fee.ts`; e planejamento de ações de settlement em `src/commercial/settlement-workflow.ts`.

O modelo documental amplia o domínio comercial além do que está implementado. Gain-share, revenue-share, franquias/faixas, impostos, arredondamento, billing cycle, SLA credits, cap global, retenção, disputa detalhada e conciliação fiscal exigem modelagem/testes adicionais antes de serem tratados como capacidade de produto.

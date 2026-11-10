# Catálogo de soluções por setor

## 1. Como usar este catálogo

O catálogo é uma biblioteca de padrões de diagnóstico e solução, não um menu de produtos fixos. Cada oportunidade deve ser adaptada à operação, porte, maturidade digital, sistemas, dados, regulação, geografia e objetivo do cliente.

Para cada caso, a plataforma deve registrar: intenção, processo atual, hipótese de causa, baseline, meta, métrica guardrail, dados necessários, integrações, ator responsável, risco, modelo comercial e critério de aceite.

## 2. Padrões transversais

- Atendimento e experiência: reduzir espera, aumentar resolução, reduzir retrabalho e melhorar satisfação.
- Receita e conversão: qualificar demanda, reduzir abandono, elevar conversão e retenção.
- Eficiência operacional: reduzir tempo, custo por unidade, erros e atividades manuais.
- Planejamento: previsão, alocação de recursos, demanda e capacidade.
- Qualidade e risco: detecção de anomalia, fraude, não conformidade e exceções.
- Gestão de ativos: disponibilidade, manutenção, inventário e utilização.
- Conhecimento: localizar informação, preparar documentos, apoiar decisões e preservar contexto.
- Integração: conectar sistemas legados, eliminar redigitação e reconciliar eventos.
- Governança: trilha, aprovação, evidência, conformidade e explicabilidade.

## 3. Matriz setorial

### Varejo e e-commerce
**Problemas:** ruptura, excesso de estoque, margem baixa, baixa conversão, abandono, devolução, atendimento lento, perdas e operação de loja ineficiente.

**Soluções candidatas:** busca semântica; recomendação; atendimento e pós-venda; previsão de demanda; reposição; análise de sortimento; precificação e markdown; elasticidade; análise de margem; eficácia de promoção; auditoria de gôndola; escala de equipe; prevenção de perdas; CRM e recompra; logística; expansão de lojas/canais.

**Métricas:** conversão, ticket médio, receita líquida, margem de contribuição, ruptura, giro, cobertura, sell-through, markdown, devolução, perda, tempo de atendimento, resolução no primeiro contato.

**Evidências:** ERP, POS, e-commerce, WMS, CRM, catálogo, preços, pedidos, estoque, devoluções, tráfego e campanhas.

**Modelo comercial:** base + consumo por pedido/documento/atendimento; gain-share de economia líquida; revenue-share sobre venda incremental com método de atribuição.

**Guardrails:** margem mínima, disponibilidade real, preço mínimo, privacidade, devolução, sazonalidade e não manipulação de preço.

### Saúde
**Problemas:** acesso demorado, faltas, tarefas administrativas, documentos dispersos, fluxo de autorização e estoque.

**Soluções:** triagem administrativa, agendamento, confirmação, follow-up, organização documental, apoio à navegação do paciente, inventário, pesquisa clínica e sumarização assistida.

**Métricas:** tempo até atendimento/agendamento, taxa de comparecimento, tempo administrativo, pendências, utilização de agenda, ruptura de insumo.

**Evidências:** agenda, sistema de gestão, autorização, inventário e eventos administrativos com acesso mínimo.

**Modelo comercial:** setup + base por unidade/capacidade + tarifa por evento administrativo concluído. Não atrelar remuneração a desfecho clínico sem desenho clínico, ético, regulatório e causal apropriado.

**Guardrails:** sigilo, dados sensíveis, validação clínica, revisão profissional, segurança do paciente e controle de acesso.

### Jurídico
**Problemas:** volume documental, due diligence lenta, triagem inconsistente, cláusulas críticas não identificadas.

**Soluções:** classificação, extração, comparação de versões, triagem de risco, busca de precedentes internos, minuta assistida e gestão de obrigações.

**Métricas:** tempo de revisão, cobertura de cláusulas, taxa de erro material, retrabalho, documentos processados.

**Evidências:** documento e hash, versão, trecho, regra, revisor e decisão.

**Modelo comercial:** faixa mensal por volume + excedente por documento + revisão humana especializada.

**Guardrails:** sigilo profissional, controle de acesso, revisão por advogado, não emitir parecer/decisão autônoma fora do escopo autorizado.

### Contabilidade e BPO financeiro
**Problemas:** conciliação manual, documentos faltantes, fechamento lento, classificação inconsistente.

**Soluções:** captura documental, classificação sugerida, conciliação, detecção de divergência, cobrança de documentos e preparação de fechamento.

**Métricas:** lançamentos conciliados, taxa de exceção, tempo de fechamento, retrabalho, pendências e custo por lançamento.

**Evidências:** extrato, nota, lançamento, regra, correspondência e aprovação.

**Modelo comercial:** franquia por volume + excedente por item conciliado + revisão humana por exceção.

**Guardrails:** segregação de função, validação fiscal/contábil, aprovação de lançamento material e trilha imutável.

### Bancos, crédito e cobrança
**Problemas:** inadimplência, custo de cobrança, conciliação, fraude e risco.

**Soluções:** priorização de cobrança, negociação assistida, recuperação, conciliação, detecção de duplicidade, triagem de fraude e análise de risco.

**Métricas:** recuperação líquida incremental, custo por recuperação, atraso, tempo de conciliação, falsos positivos e perdas.

**Evidências:** títulos, recebimentos, extratos, eventos de cobrança e decisão.

**Modelo comercial:** base + fee por evento válido; percentual de valor efetivamente recuperado e atribuível; cobrança por conciliação.

**Guardrails:** regras de crédito/cobrança, privacidade, não discriminação, consentimento quando aplicável e revisão humana para decisões de alto impacto.

### Recursos humanos e recrutamento
**Problemas:** triagem demorada, agendamento, comunicação, onboarding e rotatividade.

**Soluções:** organização de candidaturas, extração de qualificações, agendamento, comunicação, onboarding e análise de retenção.

**Métricas:** tempo de triagem, tempo até entrevista, tempo de contratação, abandono e conclusão de onboarding.

**Evidências:** ATS, etapas, critérios, comunicação e aprovação.

**Modelo comercial:** por vaga, candidato processado ou pacote mensal.

**Guardrails:** critérios relacionados ao trabalho, auditoria de viés, explicabilidade, revisão humana e proteção de dados.

### Imobiliário
**Problemas:** lead sem resposta, baixa qualificação, visita não realizada e follow-up irregular.

**Soluções:** qualificação conversacional, distribuição de leads, agendamento, lembretes, follow-up e análise de funil.

**Métricas:** tempo de resposta, leads qualificados, visitas realizadas, conversão e comissão líquida.

**Evidências:** CRM, agenda, origem, visita e contrato.

**Modelo comercial:** base + tarifa por lead/visita válida; revenue-share apenas com regra de atribuição e janela de fechamento.

**Guardrails:** duplicidade, consentimento, origem do lead, ciclo de venda e participação de corretores.

### Logística, transporte e distribuição
**Problemas:** atrasos, rotas ineficientes, reentrega, falta de visibilidade, custo por entrega e exceções.

**Soluções:** cotação, roteirização, tracking, ETA, tratamento de exceções, previsão de capacidade e conciliação de frete.

**Métricas:** OTIF, custo por entrega, km por entrega, reentrega, atraso, avaria e tempo de exceção.

**Evidências:** TMS, GPS, comprovante de entrega, pedido, ocorrência e fatura.

**Modelo comercial:** setup + base + tarifa por entrega; gain-share de economia líquida comprovada.

**Guardrails:** segurança, clima, trânsito, indisponibilidade do destinatário e limites operacionais.

### Indústria e manufatura
**Problemas:** parada, defeito, desperdício, baixa utilização, manutenção reativa e planejamento deficiente.

**Soluções:** manutenção preditiva, inspeção visual, controle de qualidade, planejamento, reposição, gestão de ordens e análise de causa.

**Métricas:** OEE, MTBF, MTTR, scrap, rendimento, paradas, custo por unidade e cumprimento do plano.

**Evidências:** MES, SCADA, CMMS, sensores, inspeções, lotes e ordens.

**Modelo comercial:** assessment + implantação por marcos + recorrência + gain-share de economia líquida.

**Guardrails:** segurança industrial, limites de controle, validação do operador e fallback seguro.

### Educação
**Problemas:** captação, matrícula, comunicação, evasão, suporte e gestão de documentos.

**Soluções:** qualificação de interessados, atendimento, matrícula assistida, acompanhamento, alertas de risco e recuperação de alunos.

**Métricas:** conversão em matrícula, tempo de atendimento, permanência, evasão, comparecimento e pendências.

**Evidências:** CRM, SIS, matrícula, presença e histórico de contato.

**Modelo comercial:** base por unidade/ciclo + preço por matrícula válida ou processo concluído.

**Guardrails:** proteção de menores, dados educacionais, revisão humana e sazonalidade do calendário.

### Seguros
**Problemas:** cotação lenta, triagem de sinistro, documentos incompletos, fraude e renovação.

**Soluções:** captura e validação documental, triagem, extração, roteamento, acompanhamento e renovação.

**Métricas:** tempo de cotação, tempo de triagem, taxa de pendência, retrabalho, falsos positivos e renovação.

**Evidências:** apólice, sinistro, documento, vistoria e decisão.

**Modelo comercial:** preço por cotação/sinistro processado + setup + revisão humana.

**Guardrails:** decisão de cobertura, negativa e fraude com autoridade e revisão apropriadas.

### Construção e engenharia
**Problemas:** orçamento divergente, atraso, retrabalho, documentação, medição e inspeção.

**Soluções:** extração de orçamento, comparação de propostas, acompanhamento de medição, gestão documental e identificação de não conformidade.

**Métricas:** desvio de orçamento, prazo, retrabalho, produtividade, não conformidade e custo por etapa.

**Evidências:** projeto, diário de obra, medição, inspeção, nota e aceite técnico.

**Modelo comercial:** setup por obra + tarifa por medição/documento + bônus por melhoria validada.

**Guardrails:** responsabilidade técnica, segurança, aprovação de profissional habilitado e integridade dos registros.

### Marketing, mídia e vendas
**Problemas:** CAC elevado, leads ruins, campanhas sem atribuição, baixo retorno e trabalho manual.

**Soluções:** produção e adaptação de conteúdo, segmentação, qualificação, análise de campanha, otimização de funil e previsão.

**Métricas:** MQL/SQL, conversão, CAC, receita líquida incremental, ROAS incremental e retenção.

**Evidências:** CRM, analytics, plataformas de mídia, consentimento e transações.

**Modelo comercial:** base + preço por lead qualificado validado ou revenue-share sobre incremento atribuído.

**Guardrails:** consentimento, qualidade do lead, fraude, atribuição multicanal e janela de conversão.

### Serviços profissionais e operações de campo
**Problemas:** agenda, deslocamento, orçamento, ordem de serviço, execução, cobrança e pós-venda.

**Soluções:** agendamento, triagem, cotação, despacho, checklist, documentação, cobrança e follow-up.

**Métricas:** tempo até atendimento, taxa de comparecimento, serviço concluído, primeira visita resolutiva, custo por ordem e satisfação.

**Evidências:** agenda, ordem de serviço, geolocalização com base apropriada, checklist, pagamento e avaliação.

**Modelo comercial:** mensalidade + evento concluído + fee por resultado quando mensurável.

**Guardrails:** segurança do trabalhador, consentimento, disponibilidade e validação de conclusão.

## 4. Padrões específicos do varejo

Para o varejo, as oportunidades devem ser agrupadas em:
- **Descoberta:** busca semântica, recomendação, catálogo e experiência.
- **Conversão:** atendimento, recuperação de carrinho, personalização e checkout.
- **Estoque:** previsão, reposição, sortimento, ruptura e excesso.
- **Margem:** preço, elasticidade, markdown, promoção e rentabilidade.
- **Operação:** escala, auditoria de prateleira, perdas, backoffice e logística.
- **Relacionamento:** CRM, recompra, retenção, atendimento e pós-venda.
- **Expansão:** escolha de praça, canal, mix e novos pontos.

## 5. Casos e números externos citados na pesquisa exploratória

A pesquisa anterior mencionou exemplos de empresas e resultados como aumento de ticket, cliques, conversão, vendas digitais e acurácia de previsão. Esses números não foram verificados independentemente neste documento. Portanto:
- não os usar como benchmark garantido;
- não prometer que o cliente obterá resultado semelhante;
- localizar a publicação primária e validar período, amostra, população, método e contexto;
- registrar fonte e data no registro de evidência antes de qualquer uso comercial.

## 6. Ficha de oportunidade setorial

Cada oportunidade cadastrada no catálogo deve preencher:

| Campo | Exemplo |
|---|---|
| Sector / sub-sector | Varejo / supermercado |
| Customer profile | porte, unidades, canais e maturidade |
| Intent | reduzir ruptura em itens prioritários |
| Process | previsão e reposição |
| Root-cause hypothesis | atraso de reposição e previsão inadequada |
| Baseline | ruptura por SKU/loja/semana |
| Target | redução percentual acordada |
| Guardrails | margem, estoque máximo, validade |
| Data sources | ERP, WMS, POS |
| Integration complexity | baixa/média/alta com justificativa |
| Human authority | gerente aprova pedido extraordinário |
| Delivery pattern | assessment + piloto + rollout |
| Pricing pattern | base + gain-share |
| Risk | qualidade de cadastro e lead time |
| Evidence | vendas, estoque, pedidos e recebimento |
| Acceptance | janela, amostra e regra de cálculo |

## 7. Seleção de oportunidades

Priorizar pelo valor econômico, mensurabilidade, capacidade de execução, qualidade de dados, urgência, risco e dependências. Uma oportunidade de alto valor sem dados ou autoridade pode ser menos adequada para primeiro piloto do que uma oportunidade menor com evidência e execução controláveis.

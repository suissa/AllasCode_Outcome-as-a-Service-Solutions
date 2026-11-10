# Contract Playbook — Contratos, propostas e exemplos

## 1. Objetivo

Este documento define como transformar uma solução aprovada em um acordo comercial verificável. O contrato deve conectar intenção, diagnóstico, solução, execução, métricas, evidências, aceite, cobrança e responsabilidade. Não deve ser apenas um texto genérico de prestação de serviços.

O documento é um playbook de produto e negócio. A versão assinável deve ser revisada por profissional jurídico habilitado e adaptada à legislação, setor, tributação, proteção de dados e jurisdição aplicáveis.

## 2. Estrutura documental do acordo

Um contrato OaaS pode ser composto por um instrumento principal e anexos versionados:

1. **Instrumento principal:** partes, objeto, vigência, remuneração, responsabilidades, confidencialidade, proteção de dados, propriedade intelectual, responsabilidade, rescisão e foro.
2. **Anexo A — Outcome Charter:** problema, intenção aceita, resultado, baseline, meta, período, população, unidade e método.
3. **Anexo B — Scope & Deliverables:** escopo, entregáveis, exclusões, dependências, cronograma, marcos e critérios de aceite.
4. **Anexo C — Commercial Schedule:** componentes de preço, franquias, taxas, caps/floors, bônus, créditos, impostos, faturamento e vencimento.
5. **Anexo D — Measurement & Evidence Protocol:** fontes de verdade, qualidade, amostragem, atribuição, auditoria e disputa.
6. **Anexo E — Service Levels & Support:** disponibilidade, tempos de resposta/solução, severidade, manutenção, suporte e créditos.
7. **Anexo F — Data Processing & Security:** papéis de tratamento, finalidades, categorias de dados, suboperadores, retenção, controles, incidentes e descarte.
8. **Anexo G — Integration Register:** sistemas, APIs, credenciais, limites, responsáveis, ambientes, janelas e contingência.
9. **Anexo H — Change Control:** solicitações, estimativas, aprovação, efeito em prazo/preço/métrica e versionamento.
10. **Anexo I — Acceptance & Sign-off:** responsáveis, prazo de revisão, rejeição fundamentada, correção e aceite.

Nem todo projeto precisa de todos os anexos; a omissão deve ser deliberada e justificada.

## 3. Campos obrigatórios do Outcome Charter

| Campo | Definição contratual |
|---|---|
| Outcome ID | identificador imutável do resultado |
| Declaração | o que deve mudar para o cliente |
| Métrica primária | métrica que determina o aceite/fee |
| Métricas guardrail | qualidade, segurança, satisfação, risco e efeitos colaterais |
| Baseline | valor, unidade, janela, população, fonte e qualidade |
| Meta | valor, direção, prazo e tolerância |
| Método | direto, contribuição ou experimental |
| Evidência | registros necessários e fonte autoritativa |
| Elegibilidade | quais eventos/valores entram no cálculo |
| Exclusões | duplicidade, cancelamento, fraude, falha externa etc. |
| Responsável | dono de dados, processo e aprovação |
| Incerteza | amostra, intervalo de confiança e limitações |
| Revisão | frequência, janela de maturação e data de fechamento |

Se a baseline não puder ser medida com qualidade suficiente, o contrato deve estabelecer fase de instrumentação/diagnóstico antes de prometer fee por resultado.

## 4. Cláusulas comerciais essenciais

### 4.1 Objeto e escopo
Descrever o processo e resultado pretendidos, não apenas "fornecer IA". Identificar entregáveis e limites. Solução proposta pode incluir pessoas, agentes, software, integrações e processos operacionais.

### 4.2 Premissas e dependências
Listar acesso a sistemas, disponibilidade de equipe do cliente, qualidade de dados, permissões, aprovações, fornecedores externos, conectividade e prazos de terceiros. Atraso do cliente pode suspender cronograma e janela de medição sem transformar automaticamente o evento em sucesso ou fracasso da OaaS.

### 4.3 Responsabilidades
Separar quem configura, opera, aprova, fornece dados, valida exceções, mantém sistemas e toma decisões de negócio. A OaaS não deve assumir autoridade que o cliente não concedeu.

### 4.4 Baseline e mudanças
Baseline e metodologia ficam congeladas na versão assinada. Mudança de processo, sistema, mix de produtos, preço, população, política ou fonte de dados que altere comparabilidade exige análise de impacto e aditivo versionado.

### 4.5 Critério de aceite
Definir teste, amostra, evidência, prazo de revisão, rejeição fundamentada, correção e aceite parcial. Silêncio do cliente não deve ser considerado aceite automático em ações de alto risco; qualquer aceite tácito deve ser expressamente negociado e revisado juridicamente.

### 4.6 Remuneração
Cada parcela indica base de cálculo, moeda, unidade, tarifa, franquia, faixa, cap/floor, vencimento, tributos, retenções, reembolso e evento que a torna devida.

### 4.7 Outcome fee
Definir métrica, baseline, target, direção, janela, atribuição, valor elegível, percentual/tarifa, teto, piso, arredondamento, qualidade mínima e evento de pagamento. Não usar apenas "10% do resultado" sem definir o que é resultado.

### 4.8 Gain-share e revenue-share
Explicar custo/receita elegível, contrafactual, exclusões, deduções, período, recorrência, devoluções, custos incrementais e auditoria. Distinguir receita bruta, receita líquida, margem e lucro.

### 4.9 Bônus
Exemplo de estrutura exploratória: bônus de 10% da economia líquida comprovada acima de um limiar; ou bônus de 2–5% por desempenho sustentado de SLA acima da meta. Percentuais são parâmetros ilustrativos e precisam de cálculo de margem, teto e aprovação.

### 4.10 Créditos de SLA
Exemplo exploratório: crédito de 5–20% da parcela mensal afetada, sujeito a teto, janela de apuração, exclusões justificadas, prazo de correção e eventual recuperação de crédito (earn-back). O contrato deve indicar se o crédito é remédio exclusivo ou se existem outros direitos.

### 4.11 Disputas
Definir prazo para contestação, dados disponíveis, preservação de logs, auditoria independente, especialista técnico, pagamento da parcela não contestada e tratamento da parcela contestada. Resultado em disputa deve suspender a liquidação controversa, não apagar evidência.

### 4.12 Limites de responsabilidade
Definir danos diretos/indiretos, teto, exceções negociadas, obrigações de segurança, confidencialidade, dados, propriedade intelectual e dolo/culpa conforme lei aplicável. Não inserir exclusões incompatíveis com normas obrigatórias.

### 4.13 Propriedade intelectual
Separar ativos preexistentes, componentes genéricos reutilizáveis, customizações específicas, dados do cliente, prompts, modelos, configurações, conectores e entregáveis. Definir licença, titularidade, uso de feedback e restrições de reutilização.

### 4.14 Dados e IA
Descrever finalidade, base legal, papéis, suboperadores, localização, retenção, transferências, dados sensíveis, uso para treinamento (permitido ou vedado), revisão humana, incidentes e direitos. Não presumir que dados do cliente podem ser usados para treinar modelos.

### 4.15 Rescisão e transição
Definir aviso, cura de inadimplemento, suspensão segura, exportação, revogação de credenciais, assistência de transição, custos, retenção legal e encerramento de workflows ativos.

## 5. Formas de precificação no contrato

| Forma | Como escrever no contrato | Exemplo de base de cálculo |
|---|---|---|
| Fixa | valor total por escopo e entregáveis | assessment de processo |
| Setup + recorrência | implantação única + operação mensal | integração e operação contínua |
| Franquia + excedente | inclui até N unidades; excedente por unidade válida | atendimento/documentos |
| Por transação | cada evento válido com ID único | pedido conciliado |
| Por documento | documento aceito e processado | contrato/fatura |
| Por usuário/unidade | unidade ativa definida | filiais/usuários |
| Por hora/capacidade | pacote de horas ou capacidade reservada | especialistas/revisão |
| Por marco | parcela devida no aceite do marco | integração, piloto, go-live |
| Outcome fee | percentual/valor sobre resultado elegível | conversão, redução de tempo |
| Gain-share | percentual de economia líquida | desperdício, custo operacional |
| Revenue-share | percentual de receita incremental líquida | vendas/recuperação |
| Bônus | incentivo por superar meta/qualidade | meta sustentada |
| SLA credit | abatimento por falha definida | disponibilidade/tempo de resposta |
| Híbrida | soma de componentes não duplicados | base + consumo + resultado |

## 6. Exemplos de contratos por setor

Os valores são exemplos didáticos reproduzidos de uma pesquisa exploratória anterior. Não são recomendação automática nem cotação atual de mercado.

### A. Atendimento e varejo
- **Objeto:** reduzir tempo de resposta e aumentar resolução no primeiro contato.
- **Modelo possível:** mensalidade + franquia de resoluções válidas + excedente + bônus de qualidade.
- **Exemplo de preço:** Atendimento Essencial R$ 1.500/mês para 300 resoluções; Pro R$ 3.500/mês para 1.000 resoluções, com CRM e revisão humana.
- **Métricas:** resolução válida, FCR, tempo de resposta, reabertura, satisfação, escalonamento, custo por resolução.
- **Guardrails:** taxa de erro, reclamação, devolução, opt-out, transferência humana e qualidade de resposta.
- **Evidência:** ticket/CRM com ID, status, timestamps, avaliação e motivo de encerramento.

### B. Jurídico
- **Objeto:** triagem, análise e organização de contratos; apoio a revisão, nunca substituição automática de parecer profissional.
- **Modelo:** base por volume de contratos + preço por excedente + revisão humana crítica.
- **Exemplo:** R$ 3.000/mês para 50 contratos; R$ 45 por contrato excedente; R$ 150 por revisão crítica humana.
- **Métricas:** tempo por contrato, cobertura de cláusulas, taxa de falso negativo, revisão humana, retrabalho.
- **Guardrails:** nenhum envio/assinatura/decisão jurídica sem aprovação profissional autorizada.
- **Evidência:** documento, versão, cláusulas sinalizadas, revisor e trilha de aprovação.

### C. Contabilidade
- **Objeto:** reduzir tempo de conciliação/fechamento e pendências documentais.
- **Modelo:** base por faixa de lançamentos + excedente por lançamento conciliado + serviço de assistência.
- **Exemplo:** R$ 2.000/mês para 1.000 lançamentos; R$ 2 por lançamento adicional; assistência R$ 1.500/mês.
- **Métricas:** lançamentos conciliados, exceções, tempo de fechamento, retrabalho e documentos faltantes.
- **Guardrails:** divergências materiais e lançamentos fiscais/contábeis sensíveis exigem revisão.
- **Evidência:** registro no ERP/contábil, origem bancária, regra aplicada e aprovação.

### D. Saúde
- **Objeto:** melhorar acesso, agendamento, follow-up, organização documental ou fluxo administrativo.
- **Modelo:** setup + recorrência/capacidade + fee por evento administrativo concluído; resultado clínico só com governança e desenho apropriados.
- **Métricas:** tempo até agendamento, comparecimento, tempo administrativo, pendências resolvidas.
- **Guardrails:** privacidade, sigilo, segurança clínica, revisão profissional, não diagnóstico autônomo sem enquadramento apropriado.
- **Evidência:** eventos administrativos auditáveis; dados clínicos minimizados.

### E. Financeiro e cobrança
- **Objeto:** elevar recuperação líquida e reduzir custo/tempo de cobrança.
- **Modelo:** base operacional + percentual do valor efetivamente recuperado e atribuível.
- **Métricas:** valor recuperado líquido, taxa de recuperação incremental, custo por recuperação, inadimplência.
- **Guardrails:** excluir pagamento espontâneo/duplicado, respeitar políticas de cobrança e regras legais.
- **Evidência:** recebimento conciliado, título, data, origem e regra de atribuição.

### F. Logística
- **Objeto:** reduzir atraso, custo por entrega, quilômetros vazios ou falhas de roteirização.
- **Modelo:** setup + base de operação + fee por entrega elegível ou gain-share da economia líquida.
- **Métricas:** custo/entrega, OTIF, atraso, distância, reentrega, avaria.
- **Guardrails:** clima, bloqueios, indisponibilidade do cliente e força maior tratados no método.
- **Evidência:** TMS, telemetria, POD, ordem e custo conciliado.

### G. Indústria
- **Objeto:** reduzir parada não planejada, defeitos ou desperdício.
- **Modelo:** assessment + implantação por marcos + recorrência de monitoramento + gain-share com baseline.
- **Métricas:** OEE, MTBF, MTTR, scrap, rendimento, custo de parada.
- **Guardrails:** segurança industrial, aprovação de operador, limites de controle e fallback manual.
- **Evidência:** MES/SCADA/CMMS, ordens, inspeções e registros de produção.

### H. Imobiliário
- **Objeto:** qualificar leads, aumentar visitas realizadas e acelerar follow-up.
- **Modelo:** base + unidade por lead/visita válida + revenue-share quando atribuição puder ser comprovada.
- **Métricas:** lead qualificado, visita realizada, conversão, tempo de resposta, comissão líquida.
- **Guardrails:** origem do lead, consentimento, duplicidade, ciclo longo e corretores envolvidos.
- **Evidência:** CRM, agenda, visita registrada e negócio fechado.

### I. Educação
- **Objeto:** melhorar conversão de matrícula, retenção e recuperação de alunos.
- **Modelo:** base por unidade/ciclo + fee por matrícula líquida incremental ou por processo concluído.
- **Métricas:** matrícula, comparecimento, evasão, tempo de atendimento, retenção.
- **Guardrails:** sazonalidade acadêmica, bolsas, cancelamentos, privacidade de menores e decisão pedagógica humana.
- **Evidência:** CRM/SIS, matrícula efetiva e permanência após janela definida.

### J. RH
- **Objeto:** reduzir tempo de triagem/agendamento e melhorar fluxo de recrutamento.
- **Modelo:** preço por vaga/candidato processado ou base + volume.
- **Métricas:** time-to-screen, time-to-interview, tempo de contratação, taxa de abandono.
- **Guardrails:** não automatizar discriminação; critérios auditáveis; decisão final humana.
- **Evidência:** ATS, etapas, critérios, revisão e logs.

### K. Seguros
- **Objeto:** acelerar cotação, triagem de sinistro e renovação.
- **Modelo:** por apólice/sinistro processado + setup + revisão especializada.
- **Métricas:** tempo de cotação, tempo de triagem, retrabalho, detecção de inconsistências.
- **Guardrails:** decisão de cobertura/recusa e suspeita de fraude com revisão humana e regras regulatórias.
- **Evidência:** sistema de apólices/sinistros, documentos, decisão e trilha.

### L. Construção
- **Objeto:** reduzir divergência de orçamento, retrabalho, atraso ou falha documental.
- **Modelo:** setup por obra + preço por medição/documento + bônus por redução de retrabalho validada.
- **Métricas:** desvio de orçamento, prazo, retrabalho, não conformidades, produtividade.
- **Guardrails:** segurança, responsabilidade técnica, aprovação de engenheiro/arquiteto habilitado.
- **Evidência:** diário de obra, medições, projeto, inspeções e aprovações.

### M. Marketing
- **Objeto:** elevar lead qualificado/conversão e reduzir CAC.
- **Modelo:** base + fee por lead qualificado validado ou revenue-share incremental.
- **Métricas:** MQL/SQL, conversão, CAC, receita líquida, ROAS incremental.
- **Guardrails:** atribuição multicanal, janela, consentimento, fraude e qualidade do lead.
- **Evidência:** CRM, plataforma de mídia, eventos e vendas conciliadas.

## 7. Exemplo de cláusula de resultado (modelo para revisão)

> **Definição do Resultado Elegível.** Para fins exclusivamente deste Anexo, considera-se Resultado Elegível a variação positiva da métrica [NOME], medida na unidade [UNIDADE], para a população [POPULAÇÃO], durante o período [INÍCIO–FIM], comparada à baseline congelada de [VALOR], apurada pela fonte [SISTEMA/FONTE] segundo a versão [MÉTODO]. Serão excluídos [EVENTOS/VALORES], e serão considerados apenas registros com identificador único e status [STATUS]. A parcela variável será calculada pela fórmula [FÓRMULA], limitada a [CAP] e sujeita aos critérios de qualidade [GUARDRAILS]. A apuração será disponibilizada às partes com evidências e memória de cálculo. A parte contestante deverá indicar, em [PRAZO] dias úteis, os registros e fundamentos específicos da divergência. A parcela incontroversa seguirá o fluxo normal de faturamento.

Esta cláusula é apenas uma estrutura de trabalho. Deve ser completada com dados reais e revisada juridicamente.

## 8. Exemplo de anexo de precificação

| Componente | Quantidade/regra | Valor ilustrativo | Evento de cobrança |
|---|---|---:|---|
| Assessment | escopo fechado | R$ 5.000 | entrega do diagnóstico |
| Setup | 2 marcos aceitos | R$ 8.000 | aceite de cada marco |
| Operação | mensal | R$ 2.000 | início de cada ciclo |
| Franquia | 1.000 eventos/mês | incluída | no ciclo |
| Excedente | por evento válido acima da franquia | R$ 2/evento | conciliação mensal |
| Outcome fee | 8% do benefício líquido elegível | variável | após apuração e aceite |
| Bônus | meta sustentada acima do limite | até R$ 1.000 | fechamento trimestral |
| SLA credit | falha atribuível conforme tabela | até 10% da base | abatimento no ciclo seguinte |

Valores acima foram inventados como exemplo de composição contratual e não devem ser confundidos com as referências setoriais da pesquisa anterior.

## 9. Ciclo de assinatura e ativação

1. Solução selecionada e decisão registrada.
2. Proposta gerada a partir de escopo, cenário, evidências e fee components.
3. Revisão comercial, jurídica, segurança e privacidade conforme risco.
4. Cliente confirma representantes e poderes.
5. Assinaturas verificadas por mecanismo configurado.
6. Plataforma valida signatários exigidos, versão e anexos.
7. Contrato ativo; baseline, plano, orçamento e aprovações ficam congelados.
8. Alteração posterior cria nova versão/aditivo; não sobrescreve a versão assinada.

No código atual, `src/commercial/agreement.ts` já contém proposta baseada em decisão/cenário selecionado, componentes de fee fixo/uso/marco/resultado, validação básica e registro/verificação de assinaturas por adaptador. O tipo atual não representa sozinho todos os anexos e cláusulas descritos aqui.

## 10. Checklist antes de enviar qualquer proposta

- [ ] Resultado desejado está específico e aprovado.
- [ ] Baseline e fonte são confiáveis ou há fase de instrumentação.
- [ ] Meta, período, população e guardrails estão definidos.
- [ ] Solução e alternativas estão documentadas.
- [ ] Escopo, entregáveis e exclusões estão explícitos.
- [ ] Dependências e responsabilidades foram aceitas.
- [ ] Modelo de preço não cobra duas vezes o mesmo benefício.
- [ ] Custo, margem, tributos, risco e capital foram calculados.
- [ ] Métrica, atribuição, amostra e disputa estão definidas.
- [ ] Dados, segurança, privacidade e aprovações foram avaliados.
- [ ] SLA, suporte, continuidade e saída estão definidos.
- [ ] Contrato e anexos têm versão e responsáveis.

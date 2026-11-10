# Security, Trust & Platform Architecture

## 1. Objetivo

Segurança é condição de execução e de confiança comercial. A OaaS.Quest coordena dados, pessoas, agentes, APIs e sistemas de terceiros; por isso, cada ação deve ter identidade, autoridade, finalidade, escopo, aprovação e evidência.

## 2. Princípios

- Zero Trust: nenhuma rede, sessão, ferramenta, agente ou integração recebe confiança implícita.
- Tenant isolation: toda leitura, escrita, busca, cache, evento e artefato respeita tenant/workspace.
- Least privilege: cada ator recebe apenas permissões necessárias.
- Purpose limitation: dados são acessados para finalidade declarada.
- Fail closed: falha de identidade, autorização, assinatura, integridade ou política bloqueia a ação.
- Human authority: ações financeiras, irreversíveis, reguladas, externas ou de alto impacto exigem aprovação conforme risco.
- Reproducibility: decisões e cálculos apontam para versões e evidências.
- No silent healing: correção ambígua ou consequencial é submetida à pessoa responsável.
- Defense in depth: controles de aplicação, banco, rede, identidade, execução e operação se complementam.

## 3. Identidade e passwordless

A arquitetura pode oferecer login passwordless por passkeys/WebAuthn e autenticação forte. O fluxo de WhatsApp pode iniciar a conversa e entregar um link de uso único, mas o WhatsApp não deve ser tratado isoladamente como prova suficiente de autoridade para ações críticas.

Regras:
- autenticar pessoa/dispositivo;
- vincular identidade a tenant/workspace;
- verificar sessão e contexto;
- exigir step-up para ação sensível;
- verificar presença/consentimento quando aplicável;
- permitir revogação e recuperação segura;
- registrar método, timestamp e resultado;
- não armazenar segredo bruto de API key.

A implementação atual documenta adaptadores injetáveis de autenticação/autorização e API keys com digest SHA-256. Não equivale a um provedor WebAuthn/Passkey completo. Integração com identidade e gestão de credenciais ainda precisa de implementação e testes próprios.

## 4. Autorização RBAC + ABAC

A decisão considera:
- ator;
- tenant;
- workspace;
- recurso;
- ação;
- papel;
- atributos do ator/recurso;
- contexto;
- expiração/revogação;
- aprovação exigida.

Negação explícita prevalece sobre permissão. Ausência de regra significa negar. Toda decisão deve registrar motivo e referências de grants/policies. Tenant mismatch deve ser negado antes de consultar detalhes do recurso.

## 5. Autoridade de agentes

Um agente não herda autoridade ampla do usuário nem de outro agente. Cada execução deve ter:
- Actor ID;
- Agent ID/version;
- delegating principal;
- tenant/workspace;
- scope/permissions;
- purpose;
- expiration;
- tool allowlist;
- budget/limits;
- approval requirements;
- correlation/execution ID.

O agente deve receber apenas capacidades necessárias. Chamadas a sistemas externos devem passar por policy enforcement, validação de argumentos, proteção contra prompt injection, allowlist de destino e trilha de auditoria.

## 6. Isolamento de execução

Para workloads de maior risco:
- separar contextos por tenant e execução;
- limitar memória, CPU, tempo, rede e volume;
- usar sandbox/isolamento de processos ou contêineres conforme ameaça;
- restringir egress;
- separar segredos por workload;
- eliminar artefatos temporários conforme retenção;
- bloquear acesso lateral;
- aplicar kill switch e cancelamento.

Não permitir que conteúdo recuperado de documentos, páginas, e-mails ou mensagens altere políticas, permissões ou instruções de sistema. Conteúdo externo é dado não confiável.

## 7. Criptografia e postura pós-quântica

Requisitos de projeto:
- TLS moderno em trânsito;
- criptografia em repouso com gestão de chaves;
- envelope encryption e separação de chaves por finalidade/tenant conforme risco;
- rotação, revogação e trilha de acesso;
- algoritmos autenticados e bibliotecas revisadas;
- inventário criptográfico e plano de migração.

Criptografia híbrida pós-quântica pode combinar mecanismo clássico e KEM pós-quântico durante transição, quando houver suporte padronizado e interoperável. A seleção de algoritmos, parâmetros, bibliotecas, formatos e protocolo deve ser registrada em ADR e revisada por especialistas. Não declarar que a plataforma já implementa criptografia híbrida PQC apenas porque o conceito está no roadmap.

Nunca inventar ou improvisar primitivas criptográficas. Preferir implementações padronizadas, auditadas e interoperáveis. Hash de evidência não substitui criptografia, assinatura, controle de acesso ou prova de origem.

## 8. Integrações com sistemas existentes

Cada conector deve declarar:
- sistema e versão;
- tenant/conta;
- finalidade e escopo;
- autenticação e rotação;
- endpoints/eventos;
- esquema e versão;
- rate limit;
- timeout/retry;
- idempotência;
- política de reconciliação;
- dados pessoais/sensíveis;
- retenção;
- ambiente;
- owner;
- plano de falha.

Padrões:
- API síncrona para consulta/ação curta;
- webhook/evento para mudanças assíncronas;
- import/export controlado para sistemas sem API;
- fila/outbox para confiabilidade;
- reconciliação para efeitos externos;
- contract tests para mudanças de esquema.

## 9. WhatsApp como canal universal de interação

WhatsApp pode ser canal padrão de entrada, acompanhamento, notificações e aprovações de baixo risco. A disponibilidade de um canal não significa que todas as ações podem ser concluídas sem controles adicionais.

Para ação crítica:
1. apresentar resumo claro da ação;
2. identificar ator e contexto;
3. solicitar step-up/autenticação;
4. verificar autoridade e policy;
5. obter aprovação explícita;
6. executar com idempotência;
7. confirmar resultado e registrar evidência.

Áudio/imagem/documento deve ser tratado como input não confiável, sujeito a extração, validação e confirmação quando ambíguo.

## 10. Auditoria e Proof of Evolution

Cada execução relevante deve correlacionar:
- Intent ID;
- Outcome ID;
- Contract/Agreement version;
- Plan/Scenario version;
- Execution ID;
- Actor/Agent ID;
- Behavior ID;
- Evidence ID;
- Decision/Approval ID;
- Settlement ID.

A trilha deve registrar eventos, versões, decisão, ator, horário, resultado, política, evidência e motivo. "Proof of Evolution" pode ser materializado como histórico verificável de mudanças de capacidades, métricas, políticas, versões e resultados. Não confundir isso com prova matemática de que toda mudança melhorou o negócio: evolução precisa de avaliação e comparação.

## 11. Resiliência e autocorreção

Intent-based Healing e self-healing devem:
- detectar anomalia;
- classificar impacto;
- correlacionar contexto e evidência;
- propor correção;
- verificar política e autoridade;
- aplicar automaticamente somente correção segura, reversível e autorizada;
- registrar antes/depois, regra, confiança e efeito;
- validar invariantes depois;
- reverter ou escalar se não houver confirmação.

Ações irreversíveis, financeiras, externas ou reguladas exigem aprovação humana. "Anti-fragilidade" deve ser tratada como capacidade demonstrada de aprender com falhas sem aumentar risco não controlado, e não como garantia abstrata.

## 12. Privacidade e compliance

- inventário de dados e finalidade;
- minimização e classificação;
- consentimento/base legal conforme aplicável;
- acesso por função/atributo;
- retenção e descarte;
- direitos dos titulares;
- gestão de suboperadores;
- transferências internacionais;
- incidente e notificação;
- auditoria e evidências;
- avaliação de impacto conforme risco.

Para Brasil, avaliar LGPD e regulamentação setorial aplicável com assessoria competente. O documento não declara conformidade ou certificação automática.

## 13. Observabilidade e resposta operacional

Correlacionar traces, logs e métricas com tenant e execution IDs sem vazar dados pessoais ou segredos. Definir SLO, alertas, orçamento de erro, incidentes, backup, restore, DR, rotação, vulnerabilidades e revisões de acesso.

## 14. Estado de implementação versus visão

Já documentado/implementado no repositório, conforme código/ADRs atuais:
- tenant-scoped persistence e HTTP boundary com autenticação/autorização injetadas;
- RBAC/ABAC tenant-scoped com default deny e trilha de decisão;
- API key digest, expiração e revogação;
- idempotência e persistência transacional;
- snapshots de cálculo com fingerprint;
- histórico de intent imutável;
- fluxo de settlement durável com lease e chave idempotente.

Ainda não declarar como concluído:
- provedor de passkeys/WebAuthn de produção;
- autenticação passwordless via WhatsApp end-to-end;
- criptografia híbrida pós-quântica implantada;
- isolamento multi-tenant de agentes em ambiente de produção;
- todos os conectores de ERP/CRM/WMS/WhatsApp;
- outbox relay e infraestrutura completa de filas/workers;
- console completo de política, revisão e compliance;
- certificação ou conformidade legal automática.

## 15. Critério de liberação de ação

Uma ação só pode executar se:
- identidade válida;
- tenant e recurso compatíveis;
- permissão concedida;
- finalidade válida;
- política vigente;
- input/schema válido;
- dependências prontas;
- aprovação presente quando necessária;
- idempotência definida;
- destino permitido;
- limites/budget respeitados;
- auditoria disponível.

Falha em requisito obrigatório deve bloquear side effect e produzir erro explicável sem revelar dados de outro tenant.

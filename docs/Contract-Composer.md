# Contract Composer e motor de precificação

## Objetivo

O módulo transforma um acordo aprovado em minuta estruturada e reproduzível. Ele gera quadro comercial e anexos a partir dos dados do projeto; não assina, não ativa e não substitui a revisão jurídica.

## API

- `calculatePricing(lines)`: valida moedas, componentes, quantidades, limites e calcula subtotal, créditos e total.
- `priceLine(line)`: calcula uma linha individual.
- `composeContract(input, generatedAt?)`: valida acordo, partes, datas, regras de resultado e cria anexos.
- `renderContractMarkdown(contract)`: renderiza uma minuta legível com cláusulas, quadro comercial e anexos.

## Modelos de preço suportados

| Modelo | Entradas | Regra |
|---|---|---|
| fixed | amount | valor fixo |
| milestone | amount | valor de marco |
| usage | rate, quantity, includedQuantity | excedente × tarifa |
| outcome | rate, eligibleValue, progress | valor elegível × taxa × progresso |
| gain_share | rate, eligibleValue, progress | economia elegível × taxa × progresso |
| revenue_share | rate, eligibleValue, progress | receita incremental elegível × taxa × progresso |
| bonus | amount | bônus fixo condicionado a regra externa de elegibilidade |
| sla_credit | rate, eligibleValue, progress | crédito negativo sobre a base elegível |

Os cálculos não inferem baseline, elegibilidade, atribuição, impostos ou evidência. Esses dados precisam ser definidos e aprovados no contrato. Valores de outcome/gain-share/revenue-share devem chegar ao motor já apurados por uma etapa de medição confiável. Não há conversão cambial automática.

## Anexos gerados

Sempre:
- escopo, entregáveis e exclusões;
- quadro de preços e faturamento.

Condicionais:
- métrica, baseline, meta, período, fonte de verdade, atribuição, exclusões e guardrails;
- plano de execução;
- critérios de aceite;
- SLA e créditos;
- segurança;
- tratamento de dados;
- condições específicas do setor.

## Cláusulas parametrizadas

Cada cláusula possui identificador, título, template e mapa explícito de variáveis. Placeholders `{{nome}}` são substituídos somente por valores fornecidos. Variável ausente, placeholder não resolvido ou ID duplicado interrompe a geração.

## Integridade e versionamento

A minuta carrega ID derivado do acordo e versão, além de fingerprint SHA-256 determinístico dos dados gerados. Alterar os dados de entrada muda o fingerprint. Uma nova negociação deve incrementar a versão do acordo; não se deve sobrescrever documento já assinado.

## Exemplo mínimo

```ts
const draft = composeContract({
  agreement,
  parties: [
    { legalName: "Cliente Ltda.", representative: "Diretor", role: "customer" },
    { legalName: "Prestadora Ltda.", representative: "Diretora", role: "provider" }
  ],
  effectiveDate: "2026-11-10",
  jurisdiction: "Brasil",
  sector: "varejo",
  projectName: "Redução de ruptura",
  pricingLines: [
    { id: "base", label: "Operação", kind: "fixed", currency: "BRL", amount: 2000 },
    { id: "savings", label: "Economia validada", kind: "gain_share", currency: "BRL", rate: 0.08, eligibleValue: 10000, progress: 1 }
  ]
});
const markdown = renderContractMarkdown(draft);
```

## Limites atuais

- A geração produz uma minuta em memória; persistência documental e histórico de versões precisam ser conectados ao repositório de contratos.
- Assinatura eletrônica continua sob responsabilidade do adaptador/verificador já existente.
- Não há geração de PDF, cálculo tributário, assinatura ICP-Brasil, validação de poderes societários ou parecer jurídico.
- A composição de anexos setoriais depende dos dados fornecidos pelo projeto; não inventa obrigações regulatórias.
- A aprovação/ativação continua sendo uma ação separada e deve respeitar a política de assinatura configurada.

## Testes

`test/commercial/contract-composer.test.ts` cobre modelos de cobrança, créditos SLA, anexos condicionais, fingerprint, renderização, partes ausentes, placeholders incompletos, cronograma de resultado inválido, acordo ativo e divergência cambial.

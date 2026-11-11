/**
 * Apresentação interativa "Do SaaS ao OaaS".
 * Conteúdo resumido do material editorial fornecido; sem dependências externas.
 */

export const OAAAS_SLIDES = [
  {eyebrow:"A nova economia dos resultados",title:"Do SaaS ao OaaS",body:"A inteligência artificial está mudando a compra de software: de ferramentas e licenças para a garantia de resultados reais.",takeaway:"De pagar pelo acesso a pagar pelo que é efetivamente entregue."},
  {eyebrow:"O problema do modelo atual",title:"A promessa quebrada do SaaS",body:"Orçamentos de TI crescem enquanto tarefas manuais continuam consumindo a operação. Licenças podem ficar sem uso e a adoção depende da equipe.",takeaway:"No SaaS, o cliente paga pelo acesso mesmo quando o gargalo permanece."},
  {eyebrow:"O catalisador",title:"IA que executa o trabalho",body:"Agentes de IA evoluem de assistentes que sugerem respostas para sistemas capazes de executar fluxos de trabalho ponta a ponta.",takeaway:"Quando o software executa o processo, o fornecedor pode assumir compromisso com a entrega."},
  {eyebrow:"Transferência de risco",title:"A evolução do software",body:"Licenças: paga-se pela posse. SaaS: paga-se pelo acesso. OaaS: paga-se por uma métrica de resultado acordada e efetivamente atingida.",takeaway:"Quanto mais o fornecedor assume a execução, maior o alinhamento de incentivos."},
  {eyebrow:"SaaS versus OaaS",title:"O que muda na prática?",comparison:[["Compra","Ferramenta e interface","Resultado e serviço completo"],["Execução","Equipe do cliente","IA e operação do fornecedor"],["Cobrança","Assinatura por usuário","Unidade de resultado ou impacto"],["Sucesso","Adoção e uso","Eficiência e resolução verificadas"],["Risco","Principalmente do cliente","Compartilhado ou assumido pelo fornecedor"]],takeaway:"A métrica e a responsabilidade de execução passam a fazer parte do contrato."},
  {eyebrow:"Modelos comerciais",title:"Quatro formas de remunerar",items:[["Assinatura híbrida","Taxa base reduzida + success fee ligado a uma métrica."],["Baseado em output","Pagamento por unidade processada com sucesso."],["Resultado final","Pagamento condicionado ao alcance de uma meta quantitativa."],["Gain sharing","Participação na receita gerada ou na economia verificada."]],takeaway:"O modelo deve refletir o nível de controle e de risco que o fornecedor consegue assumir."},
  {eyebrow:"Regra de ouro",title:"Precifique o que você controla",body:"Conversão final depende também de preço, produto, mercado e outros fatores externos. A IA deve ser remunerada por indicadores antecedentes sob seu domínio.",takeaway:"Exemplo: interações qualificadas concluídas, em vez de vendas fechadas que dependem de outras variáveis."},
  {eyebrow:"Teoria das Restrições",title:"Encontre o gargalo que trava o crescimento",body:"Em vez de tentar melhorar centenas de problemas paralelos, identifique a restrição vinculante que limita o fluxo da operação.",takeaway:"Destrave primeiro o principal gargalo; meça o fluxo restaurado a jusante."},
  {eyebrow:"Quatro eixos operacionais",title:"Onde o resultado aparece",items:[["Crescimento","Aumentar throughput e capacidade de atender à demanda."],["Capital","Liberar caixa preso em inventário, faturamento e recebíveis."],["Asset-light","Expandir capacidade sem CAPEX ou aumento proporcional de equipe."],["Custo","Reduzir trabalho repetitivo e fricção operacional."]],takeaway:"Cada eixo exige uma linha de base e indicadores próprios."},
  {eyebrow:"Aplicações por setor",title:"Sistemas orientados a cada restrição",items:[["Saúde · ClinicOS","Reduzir fricção em agendamentos, triagem e processos burocráticos; remunerar por eventos validados."],["Imobiliário · LeaseOS","Acelerar ciclos de locação e liberação de capital."],["Logística · TugOps","Orquestrar frotas e rotas, vinculando remuneração à utilização otimizada."]],takeaway:"O sistema é desenhado em torno do gargalo, não de uma lista genérica de funcionalidades."},
  {eyebrow:"Referências citadas no material",title:"O mercado já testa remuneração por resultado",items:[["Intercom","O material cita evolução de 27% para 66% na resolução autônoma e cobrança por conversa resolvida."],["Tahto","O material cita redução de 26% no tempo médio de atendimento."],["Michelin e Rolls-Royce","Modelos de remuneração por quilômetro rodado e hora de voo, respectivamente."]],takeaway:"Os números e exemplos são os apresentados no documento de origem; não constituem validação independente."},
  {eyebrow:"Implementação",title:"Um blueprint em quatro etapas",items:[["01 · Linha de base","Medir de 1 a 2 semanas o desempenho atual e registrar o ponto zero."],["02 · Contrato","Definir métricas, success fee, janelas de medição e exclusões."],["03 · Construção e deploy","Integrar a IA à operação com acompanhamento transparente."],["04 · Medição e pagamento","Ativar remuneração após apuração e validação das evidências acordadas."]],takeaway:"Sem baseline, regras de atribuição e critérios de aceite, não há medição confiável."},
  {eyebrow:"Governança",title:"Riscos precisam de regras explícitas",items:[["Ambiguidade de métricas","Eventos e critérios binários definidos em contrato e APIs."],["Privacidade e dados","Instâncias privadas, anonimização na borda e conformidade com a LGPD."],["Orçamento variável","Transição híbrida e pilotos curtos com limites acordados."],["Rigidez contratual","Limites mensais, janelas e exclusões documentadas."]],takeaway:"Autonomia operacional exige controles, evidências e limites claros."},
  {eyebrow:"Alinhamento de incentivos",title:"Uma parceria operacional",body:"O OaaS busca conectar a remuneração do fornecedor à execução prática e aos resultados que podem ser medidos, em vez de cobrar apenas pelo acesso a uma ferramenta.",takeaway:"Cliente e fornecedor compartilham critérios, evidências e responsabilidade pelo resultado."},
  {eyebrow:"Próximo passo",title:"Pare de comprar licenças. Destrave sua operação.",body:"Mapeie a restrição mais dolorosa, estabeleça e audite sua linha de base e inicie uma jornada de Growth Discovery focada em OaaS.",takeaway:"Uma empresa deve pagar pelo sistema quando ele entrega, de forma verificável, o que foi acordado."}
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function slideMarkup(slide) {
  const body = slide.body ? `<p class="oaas-slider-body">${esc(slide.body)}</p>` : "";
  const comparison = slide.comparison ? `<div class="oaas-slider-table">${slide.comparison.map(row => `<div class="oaas-slider-table-row"><b>${esc(row[0])}</b><span>${esc(row[1])}</span><strong>${esc(row[2])}</strong></div>`).join("")}</div>` : "";
  const items = slide.items ? `<div class="oaas-slider-items">${slide.items.map((item,index) => `<article><small>${String(index+1).padStart(2,"0")}</small><div><h3>${esc(item[0])}</h3><p>${esc(item[1])}</p></div></article>`).join("")}</div>` : "";
  return `<div class="oaas-slider-slide" data-slide><p class="oaas-slider-eyebrow">${esc(slide.eyebrow)}</p><h2>${esc(slide.title)}</h2>${body}${comparison}${items}<p class="oaas-slider-takeaway">${esc(slide.takeaway)}</p></div>`;
}

export function renderOaasSlider(id = "oaas-overview") {
  return `<section class="oaas-slider" id="${esc(id)}" aria-label="Apresentação: Do SaaS ao OaaS" data-oaas-slider>
    <div class="oaas-slider-head"><div><p class="oaas-slider-kicker">DO SaaS AO OaaS</p><p class="oaas-slider-counter" data-slider-counter>01 / ${String(OAAAS_SLIDES.length).padStart(2,"0")}</p></div><div class="oaas-slider-progress" aria-hidden="true"><span data-slider-progress></span></div></div>
    <div class="oaas-slider-stage" aria-live="polite">${slideMarkup(OAAAS_SLIDES[0])}</div>
    <div class="oaas-slider-controls"><button type="button" data-slider-prev aria-label="Slide anterior" disabled>←</button><div class="oaas-slider-dots" aria-label="Selecionar slide">${OAAAS_SLIDES.map((_,index)=>`<button type="button" data-slider-go="${index}" aria-label="Ir para o slide ${index+1}" ${index===0?'aria-current="true"':""}></button>`).join("")}</div><button type="button" data-slider-next aria-label="Próximo slide">→</button></div>
  </section>`;
}

export function mountOaasSliders(root = document) {
  root.querySelectorAll("[data-oaas-slider]:not([data-slider-mounted])").forEach(slider => {
    slider.dataset.sliderMounted = "true";
    const stage = slider.querySelector(".oaas-slider-stage");
    const counter = slider.querySelector("[data-slider-counter]");
    const progress = slider.querySelector("[data-slider-progress]");
    const previous = slider.querySelector("[data-slider-prev]");
    const next = slider.querySelector("[data-slider-next]");
    const dots = [...slider.querySelectorAll("[data-slider-go]")];
    let index = 0;
    const render = nextIndex => {
      index = Math.max(0, Math.min(OAAAS_SLIDES.length - 1, nextIndex));
      stage.innerHTML = slideMarkup(OAAAS_SLIDES[index]);
      counter.textContent = `${String(index+1).padStart(2,"0")} / ${String(OAAAS_SLIDES.length).padStart(2,"0")}`;
      progress.style.width = `${((index+1)/OAAAS_SLIDES.length)*100}%`;
      previous.disabled = index === 0;
      next.disabled = index === OAAAS_SLIDES.length - 1;
      dots.forEach((dot,dotIndex) => dot.setAttribute("aria-current", dotIndex === index ? "true" : "false"));
    };
    previous.addEventListener("click", () => render(index - 1));
    next.addEventListener("click", () => render(index + 1));
    dots.forEach(dot => dot.addEventListener("click", () => render(Number(dot.dataset.sliderGo))));
    slider.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") render(index + 1);
      if (event.key === "ArrowLeft") render(index - 1);
    });
    render(0);
  });
}

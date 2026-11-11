/**
 * OaaS.Quest - movimento por scroll da pagina de Exemplos.
 *
 * GSAP + ScrollTrigger sao o dono do scroll desta pagina. O que era animacao
 * nativa do navegador (animation-timeline: view) passa a viver aqui, junto de
 * duas coisas que o CSS nao fazia: o heroi cede espaco enquanto a pagina
 * avanca e a linha de progresso acompanha a leitura.
 *
 * Um unico gesto de movimento: o conteudo sobe para o lugar quando entra na
 * viewport, sempre com o mesmo relogio (.85s, power3.out). Quem prefere menos
 * movimento nao recebe animacao nenhuma - o conteudo aparece pronto.
 *
 * O shell chama mount(page) a cada render: o modulo nao depende de
 * window.OaaSPageReady e nao duplica listeners.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Obrigatorio antes de qualquer uso do ScrollTrigger.
gsap.registerPlugin(ScrollTrigger);

const MOTION = "(prefers-reduced-motion: no-preference)";

/** O relogio unico da pagina: mesma duracao e mesma curva em tudo que sobe. */
const RISE = { duration: 0.85, ease: "power3.out" };

let media = null;

/** Encerra as animacoes e os gatilhos da renderizacao anterior. */
export function destroy() {
  if (!media) return;
  media.revert();
  media = null;
}

/** Heroi: a grade se apaga e o conteudo sobe enquanto a pagina avanca. */
function animateHero() {
  const hero = document.querySelector(".exemplos-hero");
  if (!hero) return;

  const scroll = { trigger: hero, start: "top top", end: "bottom top", scrub: true };

  const grid = document.querySelector(".exemplos-hero-grid");
  if (grid) {
    gsap.to(grid, { opacity: 0, ease: "none", scrollTrigger: { ...scroll } });
  }

  const content = document.querySelector(".exemplos-hero-content");
  if (content) {
    gsap.to(content, {
      yPercent: -12,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: { ...scroll }
    });
  }
}

/** Linha de progresso: acompanha a leitura da pagina. */
function animateProgress() {
  const bar = document.querySelector(".scroll-progress");
  if (!bar) return;
  gsap.to(bar, {
    scaleX: 1,
    ease: "none",
    scrollTrigger: {
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: true
    }
  });
}

/**
 * Sobe para o lugar ao entrar na viewport.
 * Cada bloco e o seu proprio gatilho: os alvos sao os filhos do bloco, nunca
 * os do documento inteiro - um cartao sobe quando a grade dele chega.
 */
function rise(selector, { child, y = 24, stagger = 0.08, start = "top 88%" } = {}) {
  document.querySelectorAll(selector).forEach(trigger => {
    const targets = child ? trigger.querySelectorAll(child) : [trigger];
    if (!targets.length) return;

    gsap.from(targets, {
      ...RISE,
      opacity: 0,
      y,
      stagger,
      // Devolve o elemento ao estado do CSS: o hover do cartao continua valendo.
      clearProps: "transform,opacity",
      scrollTrigger: { trigger, start, once: true }
    });
  });
}

/** As camadas da arquitetura sobem uma a uma e o circulo do numero acende. */
function animateLayers() {
  document.querySelectorAll(".exemplos-layer").forEach(layer => {
    gsap.from(layer, {
      ...RISE,
      opacity: 0,
      y: 24,
      clearProps: "transform,opacity",
      scrollTrigger: {
        trigger: layer,
        start: "top 86%",
        once: true,
        onEnter: () => layer.setAttribute("data-reached", "true")
      }
    });
  });
}

/** Os blocos de conteudo sobem para o lugar, cada um com o mesmo relogio. */
function animateContent() {
  rise(".exemplos-agents", { child: ".exemplos-agent", y: 26, stagger: 0.08 });
  rise(".exemplos-insight", { y: 18 });
  rise(".exemplos-table-wrap", { child: ".exemplos-outcome-table tbody tr", y: 12, stagger: 0.05 });
  rise(".exemplos-closing", { y: 18 });
}

/** Monta o movimento da pagina: o shell chama a cada render. */
export async function mount() {
  destroy();

  media = gsap.matchMedia();
  media.add(MOTION, () => {
    animateProgress();
    animateHero();
    animateContent();
    animateLayers();
  });

  // As posicoes dependem da fonte carregada e do layout assentado.
  await refreshTriggers();
}

/** Recalcula as posicoes dos gatilhos quando as fontes terminam de entrar. */
async function refreshTriggers() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Sem fontes carregadas: segue com o layout ja medido.
    }
  }
  ScrollTrigger.refresh();
}

/**
 * A navegacao client-side troca o conteudo sem recarregar o documento: quando
 * a pagina deixa de ser a de Exemplos, o movimento e encerrado para nao
 * deixar gatilho apontando para elemento que saiu do arvore.
 */
document.addEventListener("oaas:page-ready", event => {
  const pageId = event.detail && event.detail.pageId;
  if (pageId !== "exemplos") destroy();
});

/**
 * OaaS.Quest - movimento por scroll da pagina de Exemplos.
 *
 * GSAP + ScrollTrigger sao o dono do scroll desta pagina. O que era animacao
 * nativa do navegador (animation-timeline: view) passa a viver aqui, junto de
 * duas coisas que o CSS nao fazia: o heroi cede espaco enquanto a pagina
 * avanca e a linha de progresso acompanha a leitura.
 *
 * O gesto e lateral: cada bloco entra pela margem - esquerda, direita,
 * esquerda - e assenta no meio, compondo o layout. O titulo do bloco viaja
 * com ele (runtime/word-reveal.js nao os quebra em palavras), e o titulo da
 * secao, que fica de fora do bloco, tem a revelacao por mascara tambem
 * lateral (layouts/exemplos.css).
 *
 * Quem prefere menos movimento nao recebe animacao nenhuma - o conteudo
 * aparece pronto.
 *
 * O shell chama mount(page) a cada render: o modulo nao depende de
 * window.OaaSPageReady e nao duplica listeners.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Obrigatorio antes de qualquer uso do ScrollTrigger.
gsap.registerPlugin(ScrollTrigger);

const MOTION = "(prefers-reduced-motion: no-preference)";

/** O relogio unico da pagina: mesma duracao e mesma curva em tudo que entra. */
const RISE = { duration: 0.9, ease: "power3.out" };

let media = null;

/** Encerra as animacoes e os gatilhos da renderizacao anterior. */
export function destroy() {
  if (!media) return;
  media.revert();
  media = null;
}

/**
 * O proximo bloco entra pela margem alternada: esquerda, direita, esquerda.
 * O contador e unico para a pagina inteira, entao o ritmo de composicao nao
 * reinicia a cada secao.
 */
function nextSide(flow) {
  const side = flow.count % 2 === 0 ? -1 : 1;
  flow.count += 1;
  return side;
}

/** Heroi: a grade se apaga e o conteudo cede espaco enquanto a pagina avanca. */
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
      yPercent: -10,
      xPercent: -5,
      opacity: 0.22,
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
 * Entra pela margem lateral ao chegar na viewport.
 * Cada bloco e o seu proprio gatilho: os alvos sao os filhos do bloco, nunca
 * os do documento inteiro - um cartao sobe quando a grade dele chega.
 */
function rise(flow, selector, { child, distance = 72, stagger = 0.09 } = {}) {
  document.querySelectorAll(selector).forEach(trigger => {
    const targets = child ? trigger.querySelectorAll(child) : [trigger];
    if (!targets.length) return;
    const sides = Array.from(targets, () => nextSide(flow));

    gsap.fromTo(
      targets,
      { opacity: 0, x: index => sides[index] * distance },
      {
        ...RISE,
        opacity: 1,
        x: 0,
        stagger,
        // Devolve o transform ao CSS: o hover do cartao continua valendo.
        clearProps: "transform",
        scrollTrigger: { trigger, start: "top 88%", once: true }
      }
    );
  });
}

/** As camadas da arquitetura entram pela margem e o circulo do numero acende. */
function animateLayers(flow) {
  document.querySelectorAll(".exemplos-layer").forEach(layer => {
    const side = nextSide(flow);
    gsap.fromTo(
      layer,
      { opacity: 0, x: side * 64 },
      {
        ...RISE,
        opacity: 1,
        x: 0,
        clearProps: "transform",
        scrollTrigger: {
          trigger: layer,
          start: "top 86%",
          once: true,
          onEnter: () => layer.setAttribute("data-reached", "true")
        }
      }
    );
  });
}

/** Os blocos de conteudo entram pela margem, cada um com o mesmo relogio. */
function animateContent(flow) {
  rise(flow, ".exemplos-agents", { child: ".exemplos-agent", distance: 88, stagger: 0.09 });
  rise(flow, ".exemplos-insight", { distance: 72 });
  rise(flow, ".exemplos-table-wrap", { distance: 72 });
  rise(flow, ".exemplos-closing", { distance: 72 });
}

/** Monta o movimento da pagina: o shell chama a cada render. */
export async function mount() {
  destroy();

  media = gsap.matchMedia();
  media.add(MOTION, () => {
    // Um contador so para a pagina: a alternancia de margem nao reinicia.
    const flow = { count: 0 };
    animateProgress();
    animateHero();
    animateContent(flow);
    animateLayers(flow);
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

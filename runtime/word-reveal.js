/**
 * Revelacao por mascara de palavra — o mesmo formato do heroi do bubble.io.
 *
 * Cada palavra do titulo e envolvida por duas spans: a externa (.wm) e a mascara
 * (overflow hidden), a interna (.wm__i) e a palavra. Enquanto o bloco nao recebe
 * a classe .is-in, a palavra fica 112% abaixo da mascara; quando recebe, sobe com
 * transicao de .95s em cubic-bezier(.2,.7,.2,1), escalonada 65ms por palavra (--i)
 * e pelo atraso do bloco (--d).
 *
 * Os demais elementos do heroi (subtitulo, acoes) usam o mesmo relogio, com
 * deslocamento vertical de 28ms e atraso em milissegundos (--d).
 */

const MASK_CLASS = "wm";
const WORD_CLASS = "wm__i";

let observer = null;

const reducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wrapTextNode(node, counter) {
  const text = node.nodeValue || "";
  if (!text.trim()) return;

  const fragment = document.createDocumentFragment();

  text.split(/(\s+)/).forEach(part => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      fragment.appendChild(document.createTextNode(part));
      return;
    }
    const mask = document.createElement("span");
    mask.className = MASK_CLASS;
    const word = document.createElement("span");
    word.className = WORD_CLASS;
    word.style.setProperty("--i", String(counter.value));
    word.textContent = part;
    mask.appendChild(word);
    fragment.appendChild(mask);
    counter.value += 1;
  });

  node.parentNode.replaceChild(fragment, node);
}

function splitWords(container, counter) {
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      wrapTextNode(node, counter);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (/^(SCRIPT|STYLE|BR)$/.test(node.tagName)) return;
    Array.from(node.childNodes).forEach(walk);
  };
  Array.from(container.childNodes).forEach(walk);
}

/**
 * Prepara a revelacao: quebra as palavras, aplica os atrasos e observa a entrada
 * de cada bloco na viewport. Reexecutar desmonta a observacao anterior — a
 * navegacao client-side monta paginas novas no mesmo documento.
 */
export function initWordReveal(root = document) {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  const titles = Array.from(root.querySelectorAll("[data-words]"));
  const blocks = Array.from(root.querySelectorAll("[data-reveal]"));
  if (!titles.length && !blocks.length) return;

  const counter = { value: 0 };
  titles.forEach(title => splitWords(title, counter));

  const targets = titles.concat(blocks);
  targets.forEach(target => {
    const delay = target.getAttribute("data-delay");
    if (delay) target.style.setProperty("--d", delay);
  });

  if (reducedMotion() || typeof IntersectionObserver !== "function") {
    targets.forEach(target => target.classList.add("is-in"));
    return;
  }

  observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const target = entry.target;
        observer.unobserve(target);
        requestAnimationFrame(() => target.classList.add("is-in"));
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
  );

  targets.forEach(target => observer.observe(target));
}

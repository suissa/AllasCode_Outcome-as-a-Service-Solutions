/**
 * Revelacao por mascara de palavra — o mesmo formato do heroi do bubble.io.
 *
 * Cada palavra do titulo e envolvida por duas spans: a externa (.wm) e a mascara
 * (overflow hidden), a interna (.wm__i) e a palavra. Enquanto o bloco nao recebe
 * a classe .is-in, a palavra fica 112% abaixo da mascara; quando recebe, sobe com
 * transicao de .95s em cubic-bezier(.2,.7,.2,1), escalonada 65ms por palavra (--i)
 * e pelo atraso do bloco (--d).
 *
 * A revelacao e aplicada a TODOS os titulos (h1-h4) e a todos os semi-titulos
 * (o paragrafo que segue um titulo). Quem declara data-words/data-reveal no
 * template mantem o controle: o atributo explicito tem prioridade.
 *
 * Os blocos de texto usam o mesmo relogio, com deslocamento vertical de 28px e
 * atraso em milissegundos (--d).
 */

const MASK_CLASS = "wm";
const WORD_CLASS = "wm__i";
const PREPARED = "data-wm-prepared";
const HEADINGS = "h1, h2, h3, h4";

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

function splitWords(container) {
  const counter = { value: 0 };
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      wrapTextNode(node, counter);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (/^(SCRIPT|STYLE|BR)$/.test(node.tagName)) return;
    // Palavras ja mascaradas nao sao reprocessadas.
    if (node.classList.contains(MASK_CLASS) || node.classList.contains(WORD_CLASS)) return;
    Array.from(node.childNodes).forEach(walk);
  };
  Array.from(container.childNodes).forEach(walk);
  container.setAttribute(PREPARED, "true");
}

/** O paragrafo que acompanha um titulo e o seu semi-titulo. */
function leadOf(heading) {
  let node = heading.nextElementSibling;
  while (node && node.tagName !== "P") node = node.nextElementSibling;
  return node || null;
}

function collectTargets(root) {
  const titles = new Set();
  const texts = new Set();

  // Titulos declarados no template e todos os headings da pagina.
  root.querySelectorAll("[data-words]").forEach(element => titles.add(element));
  root.querySelectorAll(HEADINGS).forEach(element => {
    if (element.hasAttribute(PREPARED)) {
      titles.add(element);
      return;
    }
    // Heading dentro de um bloco ja declarado fica sob controle do bloco.
    if (element.closest("[data-words]")) return;
    titles.add(element);
  });

  // Semi-titulos: o paragrafo que acompanha um titulo.
  titles.forEach(title => {
    const lead = leadOf(title);
    if (lead) texts.add(lead);
  });

  root.querySelectorAll("[data-reveal]").forEach(element => texts.add(element));

  return { titles: [...titles], texts: [...texts] };
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

  const { titles, texts } = collectTargets(root);
  if (!titles.length && !texts.length) return;

  titles.forEach(title => {
    if (!title.hasAttribute(PREPARED)) splitWords(title);
    if (!title.hasAttribute("data-words")) title.setAttribute("data-words", "");
  });

  // O bloco ja preparado volta a ser observado: a observacao anterior foi
  // desmontada no inicio desta chamada.
  texts.forEach(text => {
    if (!text.hasAttribute(PREPARED)) {
      text.setAttribute(PREPARED, "true");
      if (!text.hasAttribute("data-reveal") && !text.hasAttribute("data-rise")) {
        text.setAttribute("data-rise", "");
      }
    }
  });

  const targets = titles.concat(texts);

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
    { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
  );

  targets.forEach(target => observer.observe(target));
}

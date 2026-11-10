# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary — the business owner/operator** (empresário), Brazilian, arrives with a concrete business outcome in mind (sell more, cut cost, reduce rework, respond faster). They need to understand quickly whether OaaS.Quest can deliver that outcome and then start a guided discovery. They do not arrive wanting to evaluate a product catalog.
- **Secondary — the developer**, evaluating contracts, architecture, stack and ways of working with OaaS.Quest. Reached through the "Sou desenvolvedor" path and the wiki-shaped sections of the classic page.

## Product Purpose

OaaS.Quest is an Outcome-as-a-Service platform: the client states the result they want, and OaaS.Quest investigates the context, designs the solution, executes and measures it. The classic mode is the institutional surface of that promise: it explains the method, the first 90-day cycle, the solution approach, the sectors served, the measurement model, the commercial model and the FAQ, and moves the visitor into a discovery mission.

Success for this surface means the visitor understands the method in its own vocabulary and leaves having started a discovery with a stated objective.

## Positioning

The mechanism is outcome-based delivery with an explicit first cycle: baseline, indicators, targets, data sources and acceptance conditions are defined before execution, and the client follows the decisions. The client does not buy a software license or a block of hours — a commitment to a measurable result, with the path owned by OaaS.Quest.

## Operating Context

- Brazilian business audience; all shipped copy is pt-BR and externalized in `content/*.json`.
- The product ships two experiences of the same promise — Modo Guilda (conversational journey plus the Discovery Engine) and Modo Clássico (institutional site) — and the home presents them as two ways to explore it.
- The classic page is read by decision-makers who want a credible, fast read of method, proof and commercials before committing to a conversation.
- Mission answers, conversation history and discovery answers persist per device in the browser (`localStorage`).

## Capabilities and Constraints

- Copy is externalized: `content/experience.pt-BR.json`, `content/sector-playbooks.pt-BR.json`, `content/agent-team.pt-BR.json`, `content/mission-steps.pt-BR.json`, `content/discovery.pt-BR.json`. The architecture rules forbid inserting new text or new questions inside the runtimes; a redesign reuses this content rather than rewriting it.
- Three sources are shared between the classic and guild modes (`experience`, `sector-playbooks`, `agent-team`); `mission-steps` is app-level.
- The 90-day cycle is an execution reference, not an automatic result guarantee. The existing content states this disclaimer explicitly and it must survive the redesign.
- **No real logo, photography, case studies, testimonials, client names, prices or benchmarks exist in the repository.** The user states they have a logo and photos to provide. Until those files are supplied, no commercial or factual claim may be invented to fill the gap.
- Front-end is Vite in multi-page mode with vanilla ES modules and no framework. Route names derive from the HTML entry file names (`/`, `/guilda`, `/classico`, `/descoberta`).
- Development runs on WSL over `/mnt/d` (DrvFs, no inotify), so the Vite watcher uses polling for hot reload.
- Design scope of this round: the classic page (`/classico`) and the home selector (`/`). The Modo Guilda (`/guilda`) and the Discovery Engine (`/descoberta`) keep their incumbent visual world and must not regress.

## Brand Commitments

- Name: **OaaS.Quest**. Category line: **Outcome as a Service**. Registered line: "Seu objetivo. Nossa entrega."
- The classic mode is deliberately the institutional/corporate register, distinct from the guild's fantasy register. The two modes belong to one product and must read as one company.
- Brief-pinned visual direction from the user for the classic page: **modern and corporate, with animation on hover and on scroll.** Recorded as a binding constraint, not expanded here.
- **Standing visual commitment (user, 2026-11-10):** the classic page and the home follow the conventional arrangement of the category, played straight — no irony, no smuggled quirk — executed at the craft level of **Stripe, Linear and Notion**. When the category default was offered as an explicit exit and chosen over the rolled directions, this became a brand commitment rather than a one-off selection.
- A real logo and photography will be supplied by the user and take precedence over any typographic fallback.

## Evidence on Hand

- Method, 90-day cycle, solution principles, sectors, measurement model, commercial model and FAQ copy: `content/*.json`.
- No customer logos, case studies, testimonials, photography or performance data exist anywhere in the repository. Any claim of those may not be fabricated.
- `medias/` holds Zero Trust architecture diagrams, one video and two audio files; they belong to documentation content, not to the classic page's brand.
- The Discovery Engine's own content (`content/discovery.pt-BR.json`, 19 stages / 12 solutions) is real product substance available to reference.

## Product Principles

- The objective comes first; tools, licenses and hours are implementation detail.
- Nothing is executed before baseline, indicators, targets, data sources and acceptance conditions exist.
- One first cycle of 90 days puts a measurable solution into operation before anything scales.
- The client follows the decisions and knows what is being done and why.
- Only what the objective needs gets built.

## Accessibility & Inclusion

- The surface must remain fully usable by keyboard, respect `prefers-reduced-motion`, keep contrast legible, and work down to mobile widths.

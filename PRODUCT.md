# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary — the business owner/operator** (empresário), Brazilian, arrives with a concrete business outcome in mind (sell more, cut cost, reduce rework, respond faster). They need to understand quickly whether OaaS.Quest can deliver that outcome and then start a guided discovery. They do not arrive wanting to evaluate a product catalog.
- **Secondary — the developer**, evaluating contracts, architecture, stack and ways of working with OaaS.Quest. Reached through the "Sou desenvolvedor" path and the wiki-shaped sections of the Site page.

## Product Purpose

OaaS.Quest is an Outcome-as-a-Service platform: the client states the result they want, and OaaS.Quest investigates the context, designs the solution, executes and measures it. The Site mode is the institutional surface of that promise: it explains the method, the first 90-day cycle, the solution approach, the sectors served, the measurement model, the commercial model and the FAQ, and moves the visitor into a discovery mission.

Success for this surface means the visitor understands the method in its own vocabulary and leaves having started a discovery with a stated objective.

## Surfaces

| Surface | Route | Entry | Layout | Audience | Navigation |
|---|---|---|---|---|---|
| Home | `/` | `index.html` | `chooser` | visitor choosing how to explore | client-side |
| Site | `/site` | `site.html` | `site` | decision-maker reading method, proof and commercials | client-side |
| Chat | `/chat` | `chat.html` | `chat` | visitor on a guided, conversational mission | client-side |
| Examples | `/exemplos` | `exemplos.html` | `exemplos` | visitor looking for concrete agent outcomes | client-side |
| Discovery | `/descoberta` | `descoberta/index.html` | `discovery` | visitor inside the Discovery Engine | own page |
| Proposal | `/proposta` | `proposta/index.html` | `proposal` | client reading the preliminary proposal | own page |

The Site and the Chat are two registers of the same promise: the Site is institutional and corporate, the Chat keeps the fantasy register of the guild (the Guild Master, the kingdoms and the crafts). Renaming the modes and routes did not touch the flavor of the Chat.

Each surface is reachable by link: the home presents the Chat and the Site as the two ways to explore, the Site CTAs lead into the Chat, and the Examples surface is published from the home footer (`.home-link`) and from the Site topbar (`.topbar-link`) — it is a linked surface, not an orphan route.

## Positioning

The mechanism is outcome-based delivery with an explicit first cycle: baseline, indicators, targets, data sources and acceptance conditions are defined before execution, and the client follows the decisions. The client does not buy a software license or a block of hours — a commitment to a measurable result, with the path owned by OaaS.Quest.

## Operating Context

- Brazilian business audience; all shipped copy is pt-BR and externalized in `content/*.json`.
- The product ships two experiences of the same promise — the Chat (conversational journey plus the Discovery Engine) and the Site (institutional surface) — and the home presents them as two ways to explore it. The Examples (`/exemplos`) is a third, linked surface, published from the home footer and from the Site topbar.
- The Site page is read by decision-makers who want a credible, fast read of method, proof and commercials before committing to a conversation.
- Mission answers, conversation history and discovery answers persist per device in the browser (`localStorage`). The chosen visual theme persists in the same way, under `oaas.quest.theme`.

## Capabilities and Constraints

- Copy is externalized: `content/experience.pt-BR.json`, `content/sector-playbooks.pt-BR.json`, `content/agent-team.pt-BR.json`, `content/mission-steps.pt-BR.json`, `content/discovery.pt-BR.json`, `content/exemplos.pt-BR.json`. The architecture rules forbid inserting new text or new questions inside the runtimes; a redesign reuses this content rather than rewriting it.
- Three sources are shared between the Site and the Chat (`experience`, `sector-playbooks`, `agent-team`); `mission-steps` is app-level.
- The presentation copy of the two experiences lives in `experience.presentation.site` and `experience.presentation.chat`; the interface copy of the home and the Chat lives in `ui-copy.chooser` and `ui-copy.chat`.
- The 90-day cycle is an execution reference, not an automatic result guarantee. The existing content states this disclaimer explicitly and it must survive the redesign.
- **No customer logos, case studies, testimonials, client names, prices or benchmarks exist in the repository.** The user states they have a logo and photos to provide. Until those files are supplied, no commercial or factual claim may be invented to fill the gap.
- Front-end is Vite in multi-page mode with vanilla ES modules and no framework. Route names derive from the HTML entry file names (`/`, `/site`, `/chat`, `/exemplos`, `/descoberta`).
- `page-config.js` is the single shell: it mounts the template, publishes the resolved page, runs the layout runtimes, applies the theme and wires the client-side router. Every runtime exports `mount(page)`, called on each render, so navigation never re-imports a module nor duplicates listeners.
- Navigation between the home, the Site, the Chat and the Examples happens without reloading the document, inside a View Transition. `/descoberta` and `/proposta` remain standalone pages.
- Movement is a single system orchestrated by the shell: `applyMotion` runs after the layout runtimes and only on the client-side pages, so content rendered by JavaScript still enters the reveal. No page runtime triggers the reveal on its own.
- Color comes entirely from the global theme tokens (`--oq-*`) declared in `layouts/themes.css`; each page consumes variables and declares no literal color.
- Development runs on WSL over `/mnt/d` (DrvFs, no inotify), so the Vite watcher uses polling for hot reload.
- The shared token system and the single movement system now cover the home (`/`), the Site (`/site`), the Chat (`/chat`) and the Examples (`/exemplos`): the same theme contract and the same word-mask reveal apply to all four. The Discovery Engine (`/descoberta`) and the Proposal (`/proposta`) remain standalone pages with their own visual world.

## Brand Commitments

- Name: **OaaS.Quest**. Category line: **Outcome as a Service**. Registered line: "Seu objetivo. Nossa entrega."
- The Site mode is deliberately the institutional/corporate register, distinct from the Chat's fantasy register. The two modes belong to one product and must read as one company.
- Brief-pinned visual direction from the user for the Site page: **modern and corporate, with animation on hover and on scroll.** Recorded as a binding constraint, not expanded here.
- **Standing visual commitment (user, 2026-11-10):** the Site page and the home follow the conventional arrangement of the category, played straight — no irony, no smuggled quirk — executed at the craft level of **Stripe, Linear and Notion**. When the category default was offered as an explicit exit and chosen over the rolled directions, this became a brand commitment rather than a one-off selection.
- The visual system now runs on global themes: the page wrapper (`<html>`) carries one theme class at a time — `oq-theme-abyss` (default), `oq-theme-carbon`, `oq-theme-ember` or `oq-theme-paper` — and the visitor chooses among them from a floating switcher.
- Each element carries at most one semantic class; a variant is an attribute (`data-variant`, `data-density`, `data-role`), never a modifier class.
- A real logo and photography will be supplied by the user and take precedence over any typographic fallback.

## Evidence on Hand

- Method, 90-day cycle, solution principles, sectors, measurement model, commercial model and FAQ copy: `content/*.json`.
- No customer logos, case studies, testimonials, photography or performance data exist anywhere in the repository. Any claim of those may not be fabricated.
- `medias/` holds Zero Trust architecture diagrams, one video and two audio files; they belong to documentation content, not to the Site page's brand.
- The Discovery Engine's own content (`content/discovery.pt-BR.json`, 19 stages / 12 solutions) is real product substance available to reference.

## Product Principles

- The objective comes first; tools, licenses and hours are implementation detail.
- Nothing is executed before baseline, indicators, targets, data sources and acceptance conditions exist.
- One first cycle of 90 days puts a measurable solution into operation before anything scales.
- The client follows the decisions and knows what is being done and why.
- Only what the objective needs gets built.

## Accessibility & Inclusion

- The surface must remain fully usable by keyboard, respect `prefers-reduced-motion`, keep contrast legible, and work down to mobile widths.

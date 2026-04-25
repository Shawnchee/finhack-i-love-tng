# Semak — Frontend

React 19 + Vite + Tailwind. The single-page app that stitches together the three backend services ([`mule_check_api`](../mule_check_api/), [`layer3-behavioral-fraud`](../layer3-behavioral-fraud/), [`fraud_detect_api`](../fraud_detect_api/)) into one consumer-facing scam-check flow.

For the broader project context see the [root README](../README.md). For page-level design intent see [`PAGES.md`](../PAGES.md) at the repo root.

---

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run build` typechecks (`tsc -b`) then builds. `npm run lint` runs ESLint. `npm run preview` serves the production build.

To run the whole stack (frontend + 3 backends) in one terminal, use Overmind from the repo root — see the [root README](../README.md#quickstart).

---

## Env vars

The frontend reads three Vite env vars; localhost defaults are baked in, so a `.env` file is **not** required for local dev.

```bash
VITE_MULE_API_URL=http://localhost:8000     # mule_check_api    (NFP + SemakMule)
VITE_LAYER3_API_URL=http://localhost:8083   # layer3            (transaction risk)
VITE_SCRAPE_API_URL=http://localhost:8081   # fraud_detect_api  (URL scrape)
```

---

## Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | [`Landing`](src/pages/Landing.tsx) | Hero + how-it-works + source credibility. |
| `/check` | [`Check`](src/pages/Check.tsx) | Progressive smart input — bank account, link, or chat. |
| `/checking` | [`Checking`](src/pages/Checking.tsx) | Fan-out progress (NFP, SemakMule, link scan, behavior — calls all 3 backends in parallel via `Promise.allSettled`). |
| `/report/:id` | [`Report`](src/pages/Report.tsx) | Verdict band + 2×2 signal cards + recommended next action. |
| `/transaction-check` | [`TransactionCheck`](src/pages/TransactionCheck.tsx) | Layer-3 demo: score a transaction against a persona's behavioural baseline. |
| `/about` | [`About`](src/pages/About.tsx) | Trust page — data handling, sources, disclaimer. |

---

## Project structure

```
src/
├── App.tsx                 # router + shell (TopNav, Footer)
├── main.tsx
├── index.css               # Tailwind + design tokens
├── pages/
│   ├── Landing.tsx
│   ├── Check.tsx
│   ├── Checking.tsx
│   ├── Report.tsx
│   ├── TransactionCheck.tsx
│   └── About.tsx
├── components/
│   ├── TopNav.tsx
│   ├── Footer.tsx
│   ├── BlurText.tsx        # verdict-word reveal
│   ├── CountUp.tsx         # tabular numeric tween
│   ├── Magnet.tsx          # tactile CTA wrapper
│   ├── TiltedCard.tsx      # how-it-works steps
│   ├── RotatingWord.tsx    # hero rotating phrase
│   ├── ParticleNet.tsx     # hero background
│   ├── SourceMarquee.tsx
│   └── FloatingReportCard.tsx
└── lib/
    ├── api.ts              # typed clients for all 3 backends (see below)
    ├── detect.ts           # input-type sniff (account / URL / Telegram channel)
    ├── mockReport.ts       # `?mock=high|low` fixtures + `buildReportFromBackends()` (probabilistic scoring)
    ├── motion.ts           # shared framer-motion variants
    └── cn.ts               # clsx wrapper
```

---

## API client

[`src/lib/api.ts`](src/lib/api.ts) holds typed wrappers for every backend call. The three services use different wire formats — the client normalises that:

| Function | Backend | Wire format |
|---|---|---|
| `checkNFP({ idType, idNo, ... })` | `mule_check_api` | `camelCase` |
| `checkSemakMule({ bankSwiftCode, bankAccountNo, ... })` | `mule_check_api` | `camelCase` |
| `checkTransaction({ user_id, amount, ... })` | `layer3-behavioral-fraud` | `snake_case` |
| `getUserProfile(user_id)` | `layer3-behavioral-fraud` | `snake_case` |
| `scrapeUrl(url)` | `fraud_detect_api` | `snake_case` |

`BANK_SWIFT_CODES` maps the 13 supported Malaysian bank short codes (MBB, CIMB, PBE, RHB, …) to SWIFT/BIC codes for `checkSemakMule`. `idSignature(idNo)` derives the SHA-256 hash that `mule_check_api` expects.

Every request and response is `console.log`-ed — open DevTools during the demo to see the wiring.

---

## Design system

Defined in [`src/index.css`](src/index.css) and documented in detail in [`PAGES.md`](../PAGES.md).

- **Tokens** — `--bg`, `--surface`, `--ink`, `--ink-muted`, `--rule`, `--blue`, `--blue-soft`, `--yellow`, `--green`, `--red`. The yellow (`#FFCD00`) is reserved for **alert semantics only** — never decoration, never primary buttons.
- **Type** — Instrument Serif (display), Inter (body, tabular figures), JetBrains Mono (account numbers).
- **Motion** — enter 200–260 ms, exit 140 ms, `ease-out-quart`. Respects `prefers-reduced-motion` everywhere.

---

## Stack

- React 19 + React Router 7
- Vite 8
- Tailwind CSS 3 (with PostCSS + Autoprefixer)
- Framer Motion 12
- Three.js 0.184 (particle backgrounds)
- Lucide React icons
- TypeScript 6

ESLint config: [`eslint.config.js`](eslint.config.js). Type-aware rules can be enabled by switching `tseslint.configs.recommended` → `recommendedTypeChecked` (or `strictTypeChecked`); see the [tseslint docs](https://typescript-eslint.io/getting-started/typed-linting).

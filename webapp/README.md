# One WSO2 Webapp

Internal cross-persona portal for WSO2. React 19 + TypeScript + Vite SPA that ports `prototype/index.html` into a real webapp. Follows the same conventions as `cs-tools/apps/customer-portal/webapp` — same Asgardeo auth pattern (runtime `window.config`), same Oxygen-UI theme, same route-guard structure.

## Tech Stack

- **Core**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Library**: [Oxygen UI](https://github.com/wso2/oxygen-ui) (WSO2's MUI-based design system)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest) (React Query)
- **Authentication**: [Asgardeo](https://wso2.com/asgardeo/) via [`@asgardeo/react`](https://www.npmjs.com/package/@asgardeo/react)
- **Routing**: [React Router](https://reactrouter.com/) v7

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20.19 (Vite 7 requires `crypto.hash`; Node 22 LTS recommended)
- npm (bundled with Node) — pnpm/yarn also work but the checked-in lockfile is `package-lock.json`

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the runtime config template:

   ```bash
   cp public/config.js.example public/config.js
   ```

3. Fill in the `ONE_WSO2_*` values in `public/config.js` (Asgardeo tenant + client ID from your Asgardeo application registration, and the people-app backend URL — see [Configuration](#configuration) below).

`public/config.js` is git-ignored — never commit env-specific values. At deploy time, Choreo (or whatever hosts the static bundle) injects a fresh `config.js` per environment; the same build serves any env.

### Development

```bash
npm run dev            # → http://localhost:3000
```

### Build

```bash
npm run build          # tsc -b && vite build → dist/
```

Preview the production build:

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Configuration

Runtime config is read from `window.config` set by `public/config.js`. Build-time env vars are prefixed `ONE_WSO2_` (see `vite.config.ts`).

### Runtime Config Keys (public/config.js)

| Key | Description | Example |
|---|---|---|
| `ONE_WSO2_AUTH_BASE_URL` | Asgardeo tenant base URL | `https://api.asgardeo.io/t/wso2` |
| `ONE_WSO2_AUTH_CLIENT_ID` | Asgardeo SPA application client ID | `<client-id>` |
| `ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL` | Sign-in callback URL (must match Asgardeo app registration) | `http://localhost:3000` |
| `ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL` | Sign-out callback URL | `http://localhost:3000` |
| `ONE_WSO2_PEOPLE_BACKEND_URL` | people-ops-suite people-app backend base URL (Choreo gateway) — powers the live My profile page | `<people-app-backend-url>` |
| `ONE_WSO2_MENU_BACKEND_URL` | Cafeteria menu backend — daily menu, lunch feedback, dinner orders (Workspace → Menu) | `<menu-app-backend-url>` |
| `ONE_WSO2_PURCHASING_BACKEND_URL` | purchasing-app backend base URL (Choreo gateway) — powers the Procurement perspective. Unlike the Ballerina backends it verifies the Asgardeo token itself and enforces its own CORS allowlist, so **two** entries are needed on that backend: this app's client ID in `oidc.additional_client_ids` (else every request is rejected as `invalid token`) and this app's origin in `cors.allowed_origins`, which is matched exactly unless it is `*` (else the browser blocks every request before auth is reached, and the UI can only report "couldn't reach the backend"). Optional — when absent, the Procurement screens show a "not connected" state | `<your-purchasing-backend-url>` |
| `ONE_WSO2_PURCHASING_WEB_APP_URL` | purchasing-app frontend base URL (not its backend) — deep-links to a purchase request's detail view, which this app doesn't host yet (Phase 1 ports the list screens only). Optional — when absent, a request reference renders as plain text instead of a link | `<your-purchasing-web-app-url>` |
| `ONE_WSO2_LEAVE_WEB_APP_URL` | leave-app frontend base URL (not its backend) — deep-links into flows this webapp doesn't replicate (e.g. sabbatical requests). Optional — when absent, that link is hidden | `<your-leave-app-frontend-url>` |
| `ONE_WSO2_THEME` | Theme name (`oneWso2` / `acrylicOrange`, `classic`, `highContrast`) — default `oneWso2` (the one-wso2 palette overlay on top of AcrylicOrange; `acrylicOrange` is an alias for the same theme) | `oneWso2` |
| `ONE_WSO2_DEV_BYPASS_AUTH` | Dev-only escape hatch — when `true`, AuthGuard renders without ever calling Asgardeo. **Never** set in prod. | `false` |

### Import Aliases

Use `@`-prefixed aliases instead of relative imports beyond one level (defined in `vite.config.ts` and mirrored in `tsconfig.app.json`):

| Alias | Points to |
|---|---|
| `@components` | `src/components` |
| `@config` | `src/config` |
| `@constants` | `src/constants` |
| `@context` | `src/context` |
| `@features` | `src/features` |
| `@hooks` | `src/hooks` |
| `@layouts` | `src/layouts` |

## Directory Layout

```
webapp/
├── public/
│   ├── config.js.example    → template (copy to config.js, fill values)
│   ├── favicon.svg          → WSO2 logomark
│   └── wso2-logo-*.svg      → wordmarks for light/dark headers
├── src/
│   ├── main.tsx             → React root
│   ├── AppWithConfig.tsx    → provider tree (Asgardeo, Router, Oxygen theme, Query)
│   ├── App.tsx              → routes
│   ├── config/              → runtime config resolution (authConfig, apiConfig, themeConfig)
│   ├── constants/           → perspective registry (single source of truth for waffle + rail)
│   ├── context/             → PerspectiveContext, ThemeModeContext
│   ├── layouts/             → AuthGuard, AppLayout (shell)
│   ├── components/          → shell chrome (TopBar, SideRail, WaffleOverlay, AskNoveraPalette)
│   └── features/            → feature-sliced folders
│       ├── people-ops/      → flagship perspective (hiring, candidates, performance, ops)
│       ├── my/              → profile perspective (live data via people-app backend)
│       ├── service-requests/→ cross-cutting requests catalog
│       └── debug/           → dev-only AuthDebugPanel (JWT decoder)
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

## Perspective Model

The waffle switcher (top-right) is the primary persona selector. Each perspective is registered in `src/constants/perspectives.ts` with `access` and `sections`:

- **Functional perspectives** — CSM · People Ops · Sales · Rev Ops · Marketing · Finance · Leadership. Only **People Ops** is unlocked; the rest render as 🔒 in the waffle.
- **Cross perspectives** — My · Service Requests. Always accessible, and shown in the rail's "For you" group on every page.

The left rail derives from the active perspective's `sections` list; each entry smoothly scrolls the canvas to a matching `id`. Change what's in the rail by editing the perspective's `sections` array — no code changes elsewhere.

### Adding a New Perspective

1. Add an entry to `PERSPECTIVES` in `src/constants/perspectives.ts` (with `access: true`, a `path`, and its `sections`).
2. Create `src/features/<key>/pages/<Key>Page.tsx`.
3. Add a matching `<Route>` in `src/App.tsx`.
4. Give each section on the page an `id` matching what you registered.

The waffle and rail pick it up automatically.

## Auth Flow

`<AuthGuard>` wraps every route. On mount:

1. If Asgardeo says signed in → render children.
2. If not → stash the intended URL in `sessionStorage.one_wso2_post_login_redirect` and call `signIn()`. After the redirect completes, the guard restores the original URL.

The access_token is available anywhere via `useAsgardeo().getAccessToken()` — same interface as customer-portal. It's attached as `Authorization: Bearer <accessToken>` on API calls; Choreo's gateway rewrites it to `x-jwt-assertion` for the backend Ballerina services. The id_token (`getIdToken()` / `getDecodedIdToken()`) is kept separately for identity — the `email`/`groups` claims backends check are id_token-scoped, per the OIDC spec.

For local UI iteration before a real Asgardeo app registration exists, set `ONE_WSO2_DEV_BYPASS_AUTH: true` in `public/config.js` — the guard will render every route without ever calling Asgardeo.

## Auth Debug Panel

In dev, a floating **🔐 auth** pill appears at the bottom-right of every authenticated page. Clicking it decodes both the current `id_token` and `access_token` and shows their claims — useful for diagnosing why a downstream backend rejects a token (missing `email`/`groups` on the id_token, wrong audience/expiry on the access_token actually sent as the Bearer credential, etc.). It's stripped from production builds via `import.meta.env.DEV`.

## Ask Novera Palette

`⌘K` (or clicking the top-bar Ask Novera bar) opens the palette. Currently a UI-only mock — wire it to a Novera backend (or a Choreo gateway `/query` endpoint) when the integration lands.

## Live Data

- **Cafeteria menu** — `Workspace → Menu` fires `/user-info`, `/menu`, `/dinner` and, when the gateway
  publishes it, `/meta-info` against `ONE_WSO2_MENU_BACKEND_URL`. Ported from the standalone menu app;
  the functional specification, the API contract, a hand-executable test checklist and every
  deliberate difference from the original are in `docs/ported-apps/menu-app.md`. Two behaviours worth
  knowing: both time windows are evaluated on the cafeteria's clock (IST) to match the server rather
  than the browser, and privileges are fetched but nothing branches on them — the standalone app
  rendered identical UI for its admin and employee roles, so this feature has no capability gate by
  design. When the key isn't set the screen shows a "not connected" notice and makes no requests.
- **My profile** — fires `/user-info` → `/employees/{id}` + `/employees/{id}/personal-info` against `ONE_WSO2_PEOPLE_BACKEND_URL`. Contract types are mirrored from people-app in `src/features/my/api/types.ts`. When `ONE_WSO2_PEOPLE_BACKEND_URL` isn't set, the profile page shows a "not configured" banner instead of failing silently.
- **Everything else** — every card in `features/*/constants/` still holds mocked data ported from the prototype. Swap each constants module for a React Query hook (`useOpenRequisitions`, `useRecentJoiners`, …) once the backends exist. The TanStack React Query provider is already wired in `AppWithConfig.tsx`.

## Branching

This webapp lives in the `wso2-open-operations/one-wso2` repo under `webapp/`. Work on a feature branch off `main` (never commit directly to `main`). Rebase on `origin/main` before opening a PR.

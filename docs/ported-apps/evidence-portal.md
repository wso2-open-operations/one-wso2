# Evidence Portal — functional specification

**Status:** written from the source implementation, after the port. This is the reference for
verifying the port and for writing test cases against it.

**Source of truth for behaviour:** `grc-tools/apps/evidence-app/webapp`, lifted page-for-page, and
its backend (`grc-tools/apps/evidence-app/backend`) for the server rules — `app/auth.py`,
`app/rbac.py` and the `app/api/routes/*` handlers. Where a UI comment and the backend disagree,
the backend is authoritative.

**In One WSO2:** `webapp/src/features/security/evidence-portal/`, mounted at `/security/evidence`
and shown as the **Evidence Portal** app under the **Security and Compliance** perspective, after
Risk Hub. It is a separate lift from a separate source: Risk Hub, Audit Hub and Admin Console come
from `grc-tools/apps/grc-platform`; Evidence Portal comes from `grc-tools/apps/evidence-app`, a
different service with its own backend, its own identity endpoint, and its own role scheme. Backend
reached via `ONE_WSO2_EVIDENCE_PORTAL_BACKEND_URL`.

---

## 1. Purpose and users

Evidence Portal collects the compliance evidence an audit needs — screenshots an automated agent
captured, or files someone uploaded by hand — and lets it be reviewed, linked to a control, and
handed off.

Two kinds of people use it:

- **SRE Engineers** — collect and submit evidence, start agent runs, and review the Evidence list.
- **SRE Admins** — do everything an engineer can, plus manage the Framework/Product/Control
  catalogue and see what the agent runs have cost.

There is no third role. Anyone else signed in to One WSO2 who reaches an Evidence Portal URL is
refused by the backend.

---

## 2. Screens and features

### 2.1 Dashboard — `/security/evidence/dashboard`

An overview of evidence, submissions and pending reviews — coverage, what's waiting on review, and
recent activity. A summary and a set of entry points, not a second source of evidence data.

### 2.2 Evidence — `/security/evidence/evidence`

Every Evidence item, with its screenshots or uploaded files, filters by product, framework and
review status (pending, approved, rejected), and row actions to approve, reject, download or
delete. Screenshots render as thumbnails straight from Azure Blob Storage (see §7).

The old standalone app's `/history` route redirects here — a bookmark of that URL still lands on
this list.

### 2.3 Submit Evidence — `/security/evidence/submit`

Upload up to four files by hand and link them to a Product, Framework and Control. The limit is a
timeout budget, not a preference: **four files and 20 MB combined**, checked in the browser before
the request goes out and enforced identically by the backend, so a doomed upload never starts.

### 2.4 Agent Runner — `/security/evidence/agent`

Start an automated run against a target and watch its progress stream live, no page refresh needed.
Progress arrives over a raw SSE fetch straight to the backend (it cannot go through the shared axios
client's interceptors), with a REST poll as a fallback once the stream has gone quiet for a while —
so a dropped connection degrades to polling rather than going silent.

### 2.5 Cost — `/security/evidence/cost` (admin only)

Agent run spend over time: total, last 7 and 30 days, today, and a breakdown by model. **Reset**
records a new cutoff and filters every report to runs after it — it never deletes a usage row. The
figures before a reset stay in the database for the record; the screen just stops counting them.

### 2.6 Catalogue — `/security/evidence/catalogue` (admin only)

Frameworks, Products and Controls — the reference data evidence is submitted against. Admins can
create, edit and delete each, and can bulk-import Controls under a Framework from a CSV: the server
checks every row before writing any of them and reports what was created, what was skipped as a
duplicate, and what was rejected, with a reason per row.

---

## 3. Routes

| Route | Screen | Who |
|---|---|---|
| `/security/evidence` | redirects to Dashboard | — |
| `/security/evidence/dashboard` | Dashboard | engineer, admin |
| `/security/evidence/evidence` | Evidence | engineer, admin |
| `/security/evidence/submit` | Submit Evidence | engineer, admin |
| `/security/evidence/agent` | Agent Runner | engineer, admin |
| `/security/evidence/cost` | Cost | admin only |
| `/security/evidence/catalogue` | Catalogue | admin only |
| `/security/evidence/history` | redirects to Evidence | — |

A non-admin who reaches `/cost` or `/catalogue` directly is bounced to Dashboard once their role has
loaded — never before, so an admin whose role is still resolving is never bounced off their own page.

---

## 4. Roles and the access rule

The backend's `GET /api/me` decides everything; there is no separate privilege list to keep in
step with it.

- **Engineer** sees every Evidence Portal item except Cost and Catalogue.
- **Admin** sees all of them.
- A **403** from `/api/me` — signed in, but holding neither role — hides the whole app: the rail
  drops every Evidence item, and a direct link (a bookmark, a URL typed by hand) shows the
  backend's own explanation instead of the app shell.
- **While `/api/me` is still resolving**, the rail hides every Evidence item and a direct visit
  shows a spinner — never the app and never a denial, so a slow round trip is never mistaken for a
  refusal.
- **No request is made at all** while `ONE_WSO2_EVIDENCE_PORTAL_BACKEND_URL` is unset. Both the
  rail's gate and the route layout check the same "configured" flag before calling `/api/me`.

This rule is asked once and shared. The Security rail's gate (`useSecurityGate`) and the module's
own route layout (`EvidencePortalLayout`) both fold in the same `useCurrentUser` hook, under the
same react-query key, so the rail and the pages it links to can never disagree about who may see
what — whichever one asks `/api/me` first, the other reuses that answer instead of asking again.

A 403 is final for the life of the current sign-in: the role is carried inside the access token
itself, so retrying the same token can never succeed. The only cure is signing out and back in,
which is why the denied-access page offers Sign out and nothing else. A 500 or a dead backend is
treated differently — that falls through to the app, which shows its own per-screen error, rather
than telling someone they lack access when the server is merely down.

---

## 5. The backend and its runtime setting

Backend base URL: **`ONE_WSO2_EVIDENCE_PORTAL_BACKEND_URL`**, set in `public/config.js`. It is its
own key, separate from `ONE_WSO2_GRC_PLATFORM_BACKEND_URL` (Risk Hub, Audit Hub, Admin Console) —
Evidence Portal is a different service.

When the key is absent, the module renders an informational notice naming the missing key instead
of the app, and makes no request of any kind — no `/api/me`, no evidence, no catalogue.

---

## 6. Auth

Evidence Portal sends **One WSO2's own access token**, the same one every other backend here
authorizes with — not an id token, and not a token minted by a gateway in front of the backend.

The lifted source keeps its own small auth seam: an axios instance whose request interceptor
attaches a token and whose response interceptor, on a 401, forces one silent refresh and retries
once; and a raw SSE fetch (Agent Runner) that reads the same token directly, since it cannot use
axios interceptors at all. One WSO2 wires both of these, once, from `useEvidencePortalAuth`
(mounted by the route layout): it hands the lifted client One WSO2's `useAccessToken` to read a
fresh token on every call, and One WSO2's own `refreshAccessToken` to satisfy that 401 retry —
forcing one silent re-auth of the underlying session, after which the retried call picks up
whatever fresh token that re-auth produced. If the refresh itself fails, nothing extra happens
here: One WSO2's own app-wide session-expired watcher already turns a dead session into the same
"please sign in again" dialog every other backend's dead session raises, so a second path to that
same dialog would be redundant.

Every lifted call site — the axios client, the SSE fetch — is unedited; only this registration is
new.

---

## 7. Backend environment prerequisites

Standing this backend up behind One WSO2 needs four things set correctly on the backend's own side,
none of which the frontend can fix:

1. **`ASGARDEO_WEBAPP_CLIENT_ID` must be One WSO2's own Asgardeo client ID.** The backend checks a
   token's audience against this value (and a separate Runner client ID) before it will grant
   admin, and before it will accept the token at all — a token issued to any other application is
   rejected outright.
2. **`ASGARDEO_ENGINEER_ROLE` and `ASGARDEO_ADMIN_ROLE` must be the exact role names Asgardeo puts
   in One WSO2's token's `roles` claim.** That claim is organisation-wide, not scoped to the
   application, so these names have to match whatever the tenant actually issues, not a name picked
   for convenience.
3. **`CORS_ORIGINS` must include One WSO2's own origins.** Without them the browser's preflight
   fails before the request is even attempted.
4. **The backend must be reached with the user's own real Asgardeo token**, not a token a gateway
   minted on the way in. A gateway-issued JWT is not one this backend's own JWKS-based verification
   will accept, since it was never signed by Asgardeo for this user.

---

## 8. The Content Security Policy change

Evidence screenshots render straight from Azure Blob Storage: the backend hands out short-lived
signed (SAS) URLs pointing directly at blob storage rather than streaming file bytes through a
route of its own — it has no such route. `img-src` in `webapp/vite.config.ts`'s CSP therefore
allows `https://*.blob.core.windows.net`, alongside every other origin the built app already needs.

---

## 9. Known limits

- **A role granted after sign-in does not take effect immediately.** `/api/me`'s answer is cached
  for 5 minutes and a failed (403) answer is never retried on its own — a person just given the
  engineer or admin role has to wait out that cache or reload before the app notices.
- **The Cost Reset button is not a data-retention control.** It only moves the cutoff every report
  filters by; every usage row before it stays in the database. Anyone who reads the raw table still
  sees the full history.
- **Agent Runner's live stream can go quiet without saying so on the wire** — a gateway or proxy can
  close a long-lived SSE connection silently. The page's own 15-second silence threshold and REST
  fallback exist because of that, not because the backend stops sending updates.
- **Evidence screenshots have no access control of their own beyond the SAS URL's short expiry.**
  Anyone who has a link before it expires can view the image without hitting the backend again.

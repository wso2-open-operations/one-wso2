# Procurement (purchasing-app) — functional specification

**Status:** written from the source implementation and its backend, not from any prior document. This
is the reference for verifying the port and for writing test cases against it. It covers **Phase 1**
— the three screens every employee needs. Phases 2–4 (the procurement queue, quotations, contracts,
GRNs, invoices, analytics, administration) are registered in the rail but unrouted, and are out of
scope here.

**Source of truth for behaviour:** the `purchasing-app` repo — `webapp/src/pages/{HomePage,
MyRequestsPage,ApprovalsListPage}.tsx` and `webapp/src/lib/nav/navModel.ts` for the UI rules;
`backend/internal/` (Go) for the server rules, principally `handler/{home,users,purchase_requests}.go`,
`repository/{repository,home}.go` and `middleware/auth.go`. Where the two disagreed the server is
authoritative, and the difference is recorded in §7.

**In One WSO2:** a perspective of its own at `/procurement`, with `/procurement/my-requests` and
`/procurement/approvals`. Backend reached via `ONE_WSO2_PURCHASING_BACKEND_URL`; the existing service
is reused unchanged. `ONE_WSO2_PURCHASING_WEB_APP_URL` optionally deep-links a request to its detail
view in the standalone app, which this phase does not port.

**Not a move.** The standalone app keeps running. Both front ends talk to the same backend and the
same database, so anything done in one is visible in the other immediately.

---

## 1. Purpose and users

The tool WSO2 uses to raise and approve purchasing requests. Phase 1 ports the part every employee
touches: a role-based overview, the requests you submitted, and the requests waiting on your
decision. All three are **read-only** — raising a request, approving one, and every procurement
action stay in the standalone app for now.

**Who can open it:** every signed-in WSO2 employee. There is no membership to hold. The backend
self-provisions any authenticated caller with the `staff` role on first contact
(`GrantDefaultRoleIfNone`), so **a 200 from `/api/v1/me` is the authorization**. What varies between
people is which screens their roles unlock, not whether they may enter.

There is exactly one way to be refused entry: a user marked inactive in the purchasing app gets
`403 account deactivated` from every endpoint, `/me` included — the check sits in the tail both
credential paths share, before any handler runs. They keep their data and their identity link; they
simply cannot enter.

**Where roles come from.** Purchasing keeps its roles in its **own** database (`users` /
`user_roles`), granted and revoked by its admins inside that app, and re-read on every request. They
have no relationship to the people-app privilege numbers the rest of One WSO2 gates on. This is why
the rail dispatches to `useProcurementGate` rather than reading the registry's `requires` — see §4
and §8.1.

The seven roles: `staff`, `procurement`, `procurement_admin`, `admin`, `legal`, `security`,
`compliance`.

---

## 2. Screens and features

### 2.1 Overview — `/procurement`

One section per role group the caller belongs to, each a row of count tiles plus a feed of the eight
most recent events. **The backend decides which sections apply** — `/api/v1/home` returns only the
blocks that do — so there is no client-side role logic here duplicating that decision.

| Section | Present when | Tiles |
|---|---|---|
| My requests | always | My requests, Completed |
| Approvals | the caller approves any PR they did not submit | Pending approvals, Completed approvals |
| Procurement queue | the caller holds `procurement`, `procurement_admin` or `admin` | Pending requests, Awaiting delivery, Completed |

The first two sections' tiles navigate — to My requests and to Approvals respectively. The
procurement queue's tiles are **figures only**, because its screens land in Phase 2; a tile that
navigated nowhere would be worse than one that doesn't offer.

Each section's feed lists, newest first: what happened, the request's reference, its title, the
actor's email, and a relative timestamp (`just now`, `12m ago`, `3h ago`, `5d ago`, then an absolute
date past 30 days) carrying the full local timestamp as its tooltip. The reference is the only link
in a row — see §7.4. An unrecognised action degrades to humanised text rather than disappearing, so
a newer backend's vocabulary still reads.

### 2.2 My requests — `/procurement/my-requests`

Everything the caller submitted, newest first, whatever its state. Open to everyone; for someone who
has never raised a request it is simply empty.

Seven columns, in this order:

| Column | Contents |
|---|---|
| Ref | `PR-YYYY-NNNNNNN`, or `#<id>` for requests predating the reference column. Links out — §7.3 |
| Title | The request title, em dash when blank |
| Priority | `P1` (red) / `P2` (amber) / `P3` (green) outlined chip. Absent priority reads as P3 |
| Status | See the status table below |
| Assignee | "Assigned to you" when it is the caller; else the assignee's name (email as fallback); else an amber "Unassigned" chip **once the team lead has approved**; else an em dash |
| Approvals | "Awaiting you" (amber) when the caller's own decision is pending; else `2/3 approved`; else an em dash |
| Created | Local date |

The eight statuses and their chips:

| Status | Label | Colour |
|---|---|---|
| `submitted` | Submitted | info |
| `under_review` | Under review | warning |
| `vendor_selected` | Vendor selected | secondary |
| `contract_prepared` | Contract prepared | secondary |
| `order_signed` | Order signed | success |
| `completed` | Completed | success |
| `rejected` | Rejected | error |
| `cancelled` | Cancelled | default |

The empty state names the screen's own condition ("You haven't submitted any requests yet") and says
where requests are raised for now. No "create one" button: the requisition form is Phase 2, and
saying where to go beats a button that goes nowhere.

### 2.3 Approvals — `/procurement/approvals`

Purchase requests awaiting the caller's decision, across **all three** approval systems (§3.1). Open
to everyone, and for the same reason as My requests: whether you approve anything is a property of
the requests, not of your roles. A budget owner and a named approver hold no distinguishing role, so
gating this screen would hide it from exactly the people who need it.

Six columns: Ref, Title, Requester (name, email as fallback), Status, **Your decision**, Created.
"Your decision" reads the caller's unified state — "Awaiting you" (amber), "Approved" (green),
"Rejected" (red), or an em dash.

Two independent checkbox filters, applied client-side: **Pending** (on by default) and **Reviewed**
(off). The server returns every request the caller approves, decided or not, so without the filters
a long-serving approver would open the screen onto their whole history. A row is shown when its
state is pending and Pending is checked, or when it is anything else and Reviewed is checked — so
clearing both shows nothing, and the empty state distinguishes "nothing is awaiting you" from "your
filters exclude everything".

### 2.4 Page-level states

Every screen goes through one shell, which owns five states in this order. The order is the point:
each rung leaves the caller without permissions, so a later rung reached early reports a gateway
failure as a missing role and sends someone chasing access they already hold.

1. **Backend not configured** — names `ONE_WSO2_PURCHASING_BACKEND_URL` and the file to set it in.
2. **Access check in flight** — a spinner. Never a premature denial: rendering "no access" and
   correcting it a moment later would flash a refusal at everyone, on every load.
3. **Access check failed** — an error with a Retry. Not a denial.
4. **Identity unresolved** — `/api/v1/me` neither answered nor failed. Reported as an unresolved
   lookup with a Retry, **not** as a refusal, because every employee is authorized here.
5. **Permission missing** — only for a screen that requires one (none in Phase 1), and it says that
   purchasing roles are granted inside the purchasing app, which is the actionable half.

A failed data read (as opposed to a failed access check) is reported in place with its own Retry.
These lists poll every five seconds, so the commonest cause is transient.

---

## 3. Business rules

### 3.1 Three approval systems, one answer

A request can be waiting on the caller in three unrelated ways, and the screens present them as one:

1. **Team-lead approval** — `purchase_requests.team_lead_email` matched case-insensitively against
   the caller's email; `team_lead_status` is `pending` / `approved` / `rejected`. This is the gate
   that lets procurement see and act on the request at all.
2. **Named approvers** — rows in `pr_approvals` keyed by user id, each `pending` / `approved` /
   `rejected`. The requester names them.
3. **Recommendation cards** — on the procurement recommendation. The legal, security and compliance
   cards are actionable by **role**; the budget card by **email**, matched against the request's
   free-text comma-separated `budget_approver_email` list. Additional budget steps
   (`pr_recommendation_budget_steps`) are matched by email too, and carry their own decision.

`my_approval_state` collapses all three, and the precedence is **pending → rejected → approved**: any
outstanding obligation makes it pending; failing that, any rejection makes it rejected; otherwise
approved. Note that recommendation **cards cannot be rejected** — a rejected state always comes from
a team-lead decision, a named row, or a budget step.

`my_approval_status` is a narrower field, used by the Approvals column of the list: the caller's
named-row status, falling back to `team_lead_status` when the caller is the team lead. It ignores
cards entirely. The two fields are not interchangeable.

### 3.2 The visibility gate

A request is broadly visible only **once its team lead has approved it**. Before that, only the
requester, the named team lead, and admins can see it — not procurement, not named approvers, not
card actors. This is why the Assignee column shows "Unassigned" only after team-lead approval: before
it, being unassigned is not yet a fact about the request that anyone is waiting on.

### 3.3 What each scope returns

| Scope | Rows |
|---|---|
| `?scope=mine` | `requester_id` = caller, any status |
| `?scope=approvals` | not the caller's own, and either the caller is the team lead (any status) or the request is team-lead-approved and the caller is an approver on it |
| omitted | admin: everything. `procurement`: own + team-lead-of + any team-lead-approved. Otherwise: own + team-lead-of + team-lead-approved-and-approvable |

Phase 1 uses only `mine` and `approvals`. The default scope is the Phase 2 procurement queue.

Note that `approvals` is "requests you approve", not "requests still awaiting you" — decided ones
come back too. That is what the Pending / Reviewed filters exist for.

### 3.4 How the overview's numbers are computed

- **My requests** — every request the caller submitted. **Completed** — those at `order_signed` or
  `completed`.
- **Pending approvals** / **Completed approvals** — the `?scope=approvals` set bucketed by
  `my_approval_state`: pending, versus everything else.
- **Pending requests** — `submitted`, `under_review`, `vendor_selected` or `contract_prepared`.
  **Awaiting delivery** — `order_signed` or `completed` and not fully paid. **Completed** — the same
  statuses and fully paid, where fully paid means the request has at least one invoice and no invoice
  that isn't `paid`. Rejected and cancelled requests are excluded from all three. Admins count over
  every request; other procurement users only over team-lead-approved ones.
- Every activity feed is capped at **8** events and ordered newest first.

### 3.5 Freshness

All three reads poll every **5 seconds**, as the source does, because approvals move while you watch.
`/api/v1/me` is not polled — it is cached for five minutes and keyed on the Asgardeo `sub`, so
switching user cannot serve another person's roles. A role granted in the purchasing app therefore
takes up to five minutes to change what the rail shows. The server enforces regardless.

---

## 4. Role matrix

What Phase 1 actually gates. Everything here is UX only — every endpoint is enforced server-side.

| | staff | procurement | procurement_admin | admin | legal / security / compliance |
|---|---|---|---|---|---|
| Overview | yes | yes | yes | yes | yes |
| — My requests section | yes | yes | yes | yes | yes |
| — Approvals section | if approving | if approving | if approving | if approving | if approving |
| — Procurement queue section | no | yes | yes | yes | no |
| My requests | yes | yes | yes | yes | yes |
| Approvals | yes | yes | yes | yes | yes |

"If approving" is server-computed (`is_approver` / the presence of the `approvals` block), not
derived from roles — a budget owner or named approver holds no distinguishing role, and `legal` /
`security` / `compliance` hold theirs whether or not a card is currently open for them.

The eleven Phase 2–4 rail items are **hidden from everyone, admins included**, because they have no
route yet. Permission is not the constraint; existence is. Their role rules are already written down
(`ITEM_PERMISSION`) and tested against the standalone app's, so each becomes visible by adding a
route:

| Items | Requires |
|---|---|
| Purchase requests, Quotations, Contracts, GRNs, Invoices | `procurement` — i.e. `procurement`, `procurement_admin` or `admin` |
| Analytics · Purchase requests | `admin` or `procurement_admin` |
| Vendors | `admin` or `procurement_admin` |
| Business units, Settings | `admin` or `procurement_admin` |
| Audit log | `admin` or `procurement_admin` |
| Users | `admin` |

---

## 5. API contract

Three reads, all `GET`, all under `/api/v1` (the Choreo proxy preserves the prefix).

| Endpoint | Returns |
|---|---|
| `/api/v1/me` | `{id, sub, email, name, roles[], is_approver}` |
| `/api/v1/home` | `{staff?, approvals?, procurement?}` — each block `{…counts, recent_activity[]}` |
| `/api/v1/purchase-requests?scope=mine\|approvals` | the list projection, newest first |

The list projection carries, per request: `id`, `reference`, `title`, `status`, `priority`,
`created_at`, `requester`, `assignee_id`, `assignee`, `team_lead_status`, `approvals_total`,
`approvals_approved`, `my_approval_status`, and — on `scope=approvals` — `my_approval_state`. The
detail read returns considerably more; those fields arrive with the detail screen.

Only the fields these screens read are mirrored into `purchasingTypes.ts`. The source interface has
roughly forty. **The contract is owned by the backend, and both front ends must be updated in the
same PR when it changes** — there is no shared package, because they are separate builds in separate
repos.

### 5.1 Authentication — the one that differs

Unlike every Ballerina backend this app talks to, the purchasing backend **verifies the Asgardeo
token itself** rather than trusting the gateway's `x-jwt-assertion`: its roles are its own, and all
it needs from the token is an identity. So the standard `authedGet` helper works unmodified, with no
per-backend header quirk.

The cost is two deployment-side entries on that backend, which fail differently and neither of which
the UI can diagnose:

- this app's **client ID** in `oidc.additional_client_ids` — otherwise every request is rejected as
  `invalid token`, which the backend's own logs name precisely, printing the token's `aud` next to
  the accepted list;
- this app's **origin** in `cors.allowed_origins`, matched exactly unless the list is `*` —
  otherwise the browser blocks the request before it reaches the backend, so there is no server-side
  log line at all and the only thing the shell can report is that it couldn't reach the backend.

The backend also has a cookie-session path, checked before the Bearer path. This app mints no cookie
and sends none (`fetch` defaults to `same-origin` credentials), so that check finds nothing and falls
through to Bearer, which is the intended path for it.

---

## 6. Test checklist

### Access

- [ ] An employee who has never opened the purchasing app can open all three screens; the backend
      self-provisions them as `staff`.
- [ ] A user marked inactive in the purchasing app sees the access-check failure, not a blank page.
- [ ] With `ONE_WSO2_PURCHASING_BACKEND_URL` unset, every screen names that key and no request is
      made.
- [ ] With the client ID missing from `oidc.additional_client_ids`, the shell reports a failure with
      a Retry — never a missing permission.
- [ ] With the portal origin missing from `cors.allowed_origins`, likewise.
- [ ] Retry on the access-check failure re-requests `/api/v1/me`.

### Overview

- [ ] A plain employee with no requests and no approvals sees the My requests section only.
- [ ] An employee who approves something also sees the Approvals section.
- [ ] A `procurement` user also sees the Procurement queue section; a `legal` user does not.
- [ ] The My requests and Approvals tiles navigate; the procurement queue tiles do not.
- [ ] Counts match the rules in §3.4 — in particular that Completed counts `order_signed` as well as
      `completed`, and that rejected/cancelled are excluded from the queue tiles.
- [ ] Each feed shows at most 8 events, newest first.
- [ ] An action the backend has added but the front end does not know still renders as readable text.
- [ ] Relative timestamps cross each boundary correctly, and the tooltip carries the full timestamp.

### My requests

- [ ] Lists only the caller's own submissions, whatever their status.
- [ ] A request with no reference shows `#<id>`.
- [ ] A request with no priority shows P3.
- [ ] The Assignee cell shows each of its five outcomes, including "Unassigned" appearing only after
      team-lead approval.
- [ ] The Approvals cell prefers "Awaiting you" over the tally.
- [ ] The empty state appears for someone who has submitted nothing, and says where requests are
      raised.
- [ ] A failed load offers a Retry that works.

### Approvals

- [ ] A team lead sees requests awaiting them at any status.
- [ ] A named approver sees requests only after team-lead approval.
- [ ] A budget approver named by email — including with odd casing and spacing in the
      comma-separated list — sees theirs.
- [ ] A legal / security / compliance role holder sees requests with an open card of their type.
- [ ] Someone who approves nothing sees "No purchase requests are awaiting your approval."
- [ ] Pending is checked on arrival; a decided request appears only once Reviewed is checked.
- [ ] Clearing both checkboxes shows the filters-excluded message, not the nothing-awaiting one.
- [ ] "Your decision" shows pending / approved / rejected, and the precedence in §3.1 holds for
      someone waiting in two systems at once.
- [ ] The caller's own submissions never appear here.

### Cross-cutting

- [ ] All three screens refresh within ~5 seconds of a change made in the standalone app.
- [ ] A role granted in the standalone app changes the rail within ~5 minutes (the `/me` staleTime).
- [ ] Switching user does not serve the previous user's roles or lists.
- [ ] The rail shows an Overview row and a Requests group holding My requests and Approvals —
      and nothing else, for any role.
- [ ] "Overview" appears exactly once in the rail.
- [ ] Every reference link opens the standalone app in a new tab when
      `ONE_WSO2_PURCHASING_WEB_APP_URL` is set, and renders as plain text when it is not. **No click
      anywhere in this perspective may navigate to `/procurement/requests/…`** — that route does not
      exist and the catch-all would redirect the user out of Procurement.
- [ ] Wide tables scroll inside their own container; the page body never scrolls horizontally.
- [ ] Each screen's `h1` is its title, so heading navigation lands somewhere.

---

## 7. Deviations from the source app, and why

1. **Routes are namespaced under `/procurement`.** The standalone app owns its whole origin, so its
   routes are top-level (`/requests`, `/approvals`, `/vendors`, …) and would collide with the
   portal's namespace. `procurementRoutes.p()` exists so the prefix is one edit rather than thirty.
2. **The rail gates on purchasing's own roles.** Reading the registry's `requires` against One WSO2
   capabilities would show a people-app admin every procurement screen and hide them from an actual
   procurement admin. `SideRail` dispatches to `useProcurementGate`, exactly as it already does for
   finance and marketing ops.
3. **A request reference links out of the app.** The detail view is Phase 2, so there is no in-app
   destination. Linking to `/procurement/requests/:id` anyway would hit App.tsx's catch-all and
   redirect the user to their landing perspective — a click that reads as the app ejecting them from
   Procurement for no reason. Where `ONE_WSO2_PURCHASING_WEB_APP_URL` is unset the reference is plain
   text: it still names the request, it just stops promising a destination.
4. **The overview's activity row is no longer a whole-row link.** With the destination now outside
   the app, a whole row that silently opens a new tab is a worse surprise than a linked reference.
   Restore the row link in Phase 2, when there is an in-app destination for it.
5. **The procurement queue tiles are figures, not links** — their screens land in Phase 2. The source
   links them to `/requests`.
6. **The "Welcome back, <name>" banner is dropped.** The portal already greets the user on the Me
   perspective; greeting them again per perspective reads oddly inside a shell that has one identity.
7. **The reviewed-rows checkbox is labelled "Reviewed", not "Approved".** It covers rejected rows
   too, and always has — the source's label was simply wrong about its own filter.
8. **Page chrome comes from `ProcurementShell`.** Each page's own title block is gone, and the shell
   owns the five degraded states so no screen has to remember them. Modelled on `MarketingOpsShell`.
9. **The list's `toolbar` / `filtersActive` props are not carried over.** Nothing in Phase 1 filters
   anything, so they were an unreachable prop and an unreachable empty state. The Phase 2 queue can
   introduce the filter UI it actually needs.
10. **Polling is stated per query.** The portal's `QueryClient` disables `refetchOnWindowFocus` and
    `refetchOnMount` globally, so the source's 5-second interval has to be declared rather than
    inherited.
11. **The perspective overview is not a registry item.** `SideRail` renders an Overview row from the
    perspective's own path, so registering `/procurement` again showed the row twice — with the
    nested copy winning the active highlight. A test asserts no item claims the perspective root.

---

## 8. Notes on the port's structure

### 8.1 Why the policy is a separate module

`procurementPermissions.ts` holds the role rules as pure functions over the `/api/v1/me` payload,
with no React and no `@asgardeo/*` imports. These rules are **duplicated** from the standalone app's
`lib/nav/navModel.ts` by necessity — two front ends, two repos, no shared package — so they are the
part of this port most in need of tests, and keeping them free of an auth SDK is what makes them
testable at all.

Its tests also pin registry invariants — ids unique and namespaced, every route under `/procurement`,
the routed set derived from actual paths, no item claiming the perspective root, every item
permissioned or explicitly open — because those are what an upstream rebase is most likely to break
quietly.

### 8.2 Fail-closed in two directions

The gate answers yes only when an item is both **routed** and **permitted**. Dropping the routing
half would render the eleven unbuilt items as rows that navigate nowhere; a pathless rail item falls
through to `scrollToSection`, which from a sub-route bounces the user to the overview. Dropping the
permission half is the obvious leak. An unrecognised id that looks like one of this perspective's
fails closed, so a typo in the registry hides a screen (visible, reported) rather than opening a
restricted one (invisible, not reported).

### 8.3 Known dead code in the port

The overview's "Nothing to show yet" fallback — rendered when none of the three blocks is present —
is **currently unreachable**: the backend always sets the `staff` block. It is defensive against a
contract the backend owns (every block is `omitempty` on the wire) rather than a state you can reach
today.

---

## 9. Unverified — questions for a live tenant

- **Token audience.** This app sends an Asgardeo **access** token; the backend runs it through an
  ID-token verifier, which requires an audience match. A backend comment records this working against
  a real One WSO2 token on 2026-08-30, but this port has not confirmed it end to end.
- **Prefix preservation.** That the deployed Choreo proxy really does preserve `/api/v1` rather than
  stripping it.
- **Name claims.** Asgardeo access tokens carry `given_name` / `family_name` and omit `name`, where
  the standalone app's ID token has `name`. The backend reads both, so a portal-provisioned user
  should get a populated name — worth confirming on a first-contact user rather than an existing one.
- **Budget approver matching** against the free-text, comma-separated `budget_approver_email` list,
  with real-world casing and spacing.

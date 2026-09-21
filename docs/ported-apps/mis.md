# Finance MIS — functional specification

**Status:** written ahead of the port, from the source implementation rather than from any prior
document. There is no prior document: nothing in this repo, and nothing in the vision doc, mentions a
Finance MIS.

**Source of truth for behaviour:** `digiops-finance/apps/mis/webapp` (23,457 lines of production
JavaScript, plus 3,602 lines of tests) and the three Ballerina services under
`digiops-finance/apps/mis/backend`. Where the two disagree, the server is authoritative and the
divergence is recorded in §8.

**In One WSO2:** one `MenuApp` under the existing **Finance** perspective, at `/finance/mis/*`. Its
module is `src/features/finance/mis/`. Three backend URLs — `ONE_WSO2_MIS_ARR_BACKEND_URL`,
`ONE_WSO2_MIS_FLASH_BACKEND_URL`, `ONE_WSO2_MIS_ADMIN_BACKEND_URL`.

> **Amended during ticket 01.** This section originally said the `MenuApp` goes *in*
> `FINANCE_PERSPECTIVE_APPS`. It cannot: that constant feeds `FINANCE_ITEM_IDS`, which is how
> `SideRail` decides to ask `useFinanceGate` — the gate for the three claim backends, which knows
> nothing of MIS privileges and would answer for every MIS id by falling through to its open
> default. The registry lives in its own `constants/misApps.ts` with its own `MIS_ITEM_IDS`, and is
> spread into the Finance perspective's sections where it is surfaced. Same shape as
> `marketingOpsApps.ts`, and the same reason.

It sits under Finance rather than becoming its own perspective because the audience split that would
justify a sixth perspective — company revenue reporting for leadership, a P&L working surface for
finance — has no home to split *into*: the vision doc's Leadership view is unnamed and unbuilt. When
Leadership ships, surfacing ARR into it is additive; fragmenting MIS now is not. The cost is
acknowledged: the Finance rail will carry "company ARR" next to "file a claim".

The backends are not touched — see [ADR 0001](../adr/0001-mis-backends-untouched.md). The port
re-thinks the IA narrowly rather than transcribing — see
[ADR 0002](../adr/0002-rethink-ia-rather-than-transcribe.md). Behaviour that looks wrong is kept while
both apps run — see [ADR 0003](../adr/0003-bug-for-bug-parity-during-the-parallel-period.md).

---

## 1. Purpose and users

WSO2's internal finance reporting app. It shows recurring revenue moving from an opening balance to a
closing balance over a Period, breaks current ARR down by partner model, region, industry and
customer lifetime, and hosts the Flash P&L. All amounts are USD. Pacific Time is the canonical
business timezone for every Period boundary.

| Who | What they see |
|---|---|
| ARR privilege (`987` from the ARR backend) | ARR Build, QRR Build, MRR Build, and ARR Analysis when its flag is on |
| Flash privilege (`789` from the ARR backend) | Flash Dashboard, including comment and budget/forecast editing |
| Both | All five screens |
| Signed in, neither privilege | No MIS entries in the Finance rail, no MIS overview card, and a direct URL renders the module's not-authorized state |
| Not signed in | `AuthGuard` redirects to Asgardeo before any MIS code runs |

**`987` does not mean here what it means elsewhere in this app.** One WSO2's own `PRIVILEGE.EMPLOYEE`
is also `987` and means "every authenticated user". The two numbers come from different `/user-info`
endpoints and must never be read from the same array. `useMisGate` calls the ARR backend itself,
following `useMarketingOpsGate`, and carries the fail-closed `RESTRICTED_IDS` idiom.

## 2. Screens

Period lives in the path. Everything else that defines a view lives in the query string (§4).

### 2.1 ARR Build — `/finance/mis/arr-build`

The annual recurring-revenue Build: Opening balance, then New, Expansions, Reductions and Lost, to a
Closing balance, with one column per Annual Period and multi-level collapsible row sections. Four
Tables are reachable from here via `?table=`: Subscription (the default), Software/Cloud Customers,
Exit ARR by Region, Exit ARR by Business Unit. Row drill-down opens a customer dialog.

Rendered as a hand-rolled `Table size="small" stickyHeader` inside an `overflowX: "auto"` container
with an explicit `minWidth`, a sticky first column, and hand-computed total rows — not the DataGrid.
See §7 for why.

**The filter surface above it** — settled by the line-by-line read of the source's 1,823-line
`arrDashboard/components/FilterBar.js` that §11.9 asked for. Four groups of control, and the
difference that matters is *when each takes effect*, because they are not all the same kind of thing:

| Group | Controls | When it takes effect |
|---|---|---|
| Period control | Annually, TTM — the Window, which reaches the reader as a Period option, not a control of its own (CONTEXT.md). Quarterly and Monthly are their own routes. | at once — it is a different cut |
| Unit | BU / Software / Cloud / Custom, and the unit within it; Custom unlocks two mutually exclusive lists | at once — it is a different report |
| Filters | View, the region list that View uses, Type, Channel/Direct, Forecast Type, Ending Month, the six account and geography lists, Country by Sales Region, Years Back, YTD, Cumulative | on **Apply** |
| Scale | units / thousands | at once, and remembered across screens (§4) |

The filter group is **pending** until Apply: the bar holds what the reader is choosing, the URL holds
what the grid is showing, and the gap between them is what Apply closes. That is the source's model
(`hasPendingChanges`, `lastAppliedPending`) and it is kept, for the reason the source presumably had
it — one Build is one `POST /arr-summary` per column, so a bar that applied as you typed would ask the
backend five times to set one filter. Dismissing a chip is the exception: it is an Apply of exactly
one change, and it leaves any other unapplied edit pending.

Four controls appear and disappear, each because its value would otherwise mean nothing: the region
list only under the View that uses it, Forecast Type only under a Forecasted type, Years Back only
where there are years to go back over, and YTD only on a window that is a year to a date. Seven
controls stay in view and the rest sit behind **More**.

The unit selection is **not** a filter-bar control in the source either — it lives in
`TableNavigation.js`, and the bar carries a comment where its control used to be. It is described here
with the bar because a reader does not care which file it came from.

**Three more controls belong to a Table rather than to the bar**, and none of them is in the URL. They
commit on click, they are not part of the Applied set, and they die with the screen — which the source
does too, and which means a shared link does not carry them (§11.11).

| Table | Control | What it chooses |
|---|---|---|
| Software/Cloud Customers | Breakdown | **BU only** — six business units and a total — or Software / Cloud, the twelve-column split across the two books. BU only is the default, in the source and here. Both read one `POST /accounts` response, so switching costs no request. |
| Exit ARR by Region | View | **Exit ARR**, each region's balance split by business unit, or **All ARR Metrics**, each region's movement over the column. Two endpoints and two questions, not two arrangements of one answer. Exit ARR is the default. |
| Exit ARR by Region | Region Type | Sales Region or Sub Region. Travels in the body, so the two cuts are two cache entries. Returns to Sales Region whenever the View changes. |

All ARR Metrics is the one Build surface where the unit tabs above narrow the figures rather than
being ignored; the source instead gives it a second unit control of its own (§7).

**One source control is not ported at all.** A `Totals only` checkbox on Software/Cloud Customers and
on Exit ARR by Region (`DataGrid.js:368`, rendered at `:1110`) strips every Period group down to its
Total column. It hides figures rather than changing any, so nothing disagrees while it is off, which
is how it is safe to leave for later — recorded here so it is a known gap rather than a discovery
during §10.37.

### 2.2 QRR Build — `/finance/mis/qrr-build`

The same Build, quarterly, plus a Cumulative toggle Annually does not have. No TTM Window.

One screen serves all three Periods: `MisArrBuildPage` takes its Period as a prop, and what differs
between the routes is a name and a gate id. Everything else — the type key, the cumulative flag, the
type values, the Years Back default, the unavailable-filter set — was already a function of the
Period.

Columns are every quarter of the prior Years Back years plus the quarters of the current year that
have started, oldest first. So **Years Back 1 is two calendar years of quarters**, seven columns as
at September, because the source's loop runs `-max(1, yearsBack)` to 0 inclusive. The quarter still
running closes **today** rather than at quarter end and is headed `As of {today}` rather than named —
the rest of it has not happened. Years Back defaults to 1 here, not 5.

### 2.3 MRR Build — `/finance/mis/mrr-build`

The same Build, monthly, plus a Cumulative toggle. No TTM Window.

Columns are `Years Back × 12` months ending at the current one — which is **thirteen at Years Back 1,
not twelve** (§7). The current month closes today, on the same rule as the quarter above.

### 2.4 ARR Analysis — `/finance/mis/analysis`

Current ARR by partner model (Channel/Direct), by region and industry, and by customer lifetime, over
an account-level table. Feature-flagged server-side: `productsUsageEnabled` from `GET /app-configs`.
When off, the rail entry and the overview card are both absent and the route redirects to ARR Build.

The account table is the one screen that takes the community `DataGrid` — it is flat, sortable and
wants CSV, which is precisely the condition `LeaveReportsPage.tsx:315-318` documents. Charts are
recharts: the partner-model pie, and region and industry bars, which are this codebase's first
cartesian charts. Every chart ships a companion table beneath it, per the house convention.

### 2.5 Flash Dashboard — `/finance/mis/flash`

The monthly P&L flash: Revenue, Cost of Sales with sub-levels, Gross Profit, Gross Margin, and ARR and
Booking per business unit. **The only screen in MIS that writes.** Two write paths:

- **Comments** — create, edit and delete against the admin backend. ⚠ **Resolve before building
  this.** The Choreo component behind `ADMIN_API_URL` is named "MIS Admin Backend - DEPRECATED", its
  Production deployment is **suspended**, and its last commit is over two years old — yet the live MIS
  config still points at it. Either comments are already broken in production, or they have moved and
  the config is stale. Porting a feature against a dead backend would be the most expensive possible
  way to discover which.
- **Budget and forecast values** — inline cell edits against the flash backend, rejected server-side
  after the monthly cutoff (§3).

Excel export is a hand-built ExcelJS workbook, ported as pure functions (§7).

## 3. Business rules

**The monthly editing cutoff.** Budget and forecast edits are refused by the flash backend after the
**15th of the month** (`dateCutoff`, configurable). The frontend does not pre-empt the cutoff; it
surfaces the rejection. Port that behaviour exactly — a client-side guess at the date would disagree
with the server the moment the config changes.

**Pacific Time is canonical.** Every Period boundary, and the Period label itself, is computed in
`America/Los_Angeles`, not the viewer's zone and not UTC. The screen renders a permanent
`Pacific Time (PST|PDT)` chip. Pacific observes DST, so the fixed-offset trick in
`features/menu/util/menuTime.ts` is not reusable; this needs `Intl.DateTimeFormat` with
`timeZone: "America/Los_Angeles"` and `formatToParts`.

**Scale never scales counts.** The units/thousands control divides currency rows only. Counts and
percentages are never scaled. Enforce this in the formatter, not at call sites.

**Years Back defaults vary by Table and Period.** Annually starts at 5 years, except Exit ARR by
Region which starts at 2; Quarterly and Monthly start at 1. Valid range is 1–10.

**Type options vary by Table.** Summary tables offer Total and Closed Won only; Software/Cloud
Customers has no Renewal; Build has no Delayed. Selecting a Forecasted or Renewal type turns forecast
mode on; anything else turns it off.

**Summary tables mirror the Period type into `arrType`.** On Quarterly and Monthly, the Exit ARR
summaries fetch by `arrType` regardless, so the Period's type value is copied there.

**TTM is Annually-only.** Switching Calendar → TTM coerces a Forecasted or Renewal type back to
Total, resets YTD, and remembers the previous YTD and Ending Month to restore on the way back.

## 4. The URL contract

MIS is the first route in One WSO2 to carry filter state in the query string.
`features/pinned/pinnableRoute.ts` already anticipates it: *"No route here carries filter state in the
URL yet; this is the seam that will already be correct for the first one that does."* This contract is
therefore built as a shared convention — pure serialise/deserialise functions in a `util/` module with
their own tests, and a separate hook binding them to `useSearchParams`.

Rules carried over from the source verbatim, because bookmarked links must keep working:

- **Defaults are omitted.** A default view serialises to an empty query string.
- **Unrecognised or malformed values are ignored**, so a bad link degrades to defaults rather than
  erroring.
- **A filter the Table does not offer is dropped**, so a link cannot narrow a view by something no
  control on it can show or clear. A **deviation** — see §7.
- Human-readable parameter names, not internal filter keys.

| Param | Meaning | Notes |
|---|---|---|
| `table` | `customers`, `region-summary`, `bu-summary` | Subscription is the default and is never written |
| `window` | `ttm` | Annually only |
| `unit` | business-unit / product selection, lower-kebab | `custom` unlocks the two below |
| `customBu`, `customProduct` | comma-separated lists | Only read when `unit=custom` |
| `years` | Years Back | Integer 1–10; anything else ignored |
| `ytd` | `1`/`0` | Suppressed while `window=ttm`; also accepts `true`/`false` |
| `endingMonth` | `Today` or a month name | Dropped if not a legal TTM ending month |
| `type` | the Period's ARR/QRR/MRR type | Validated against the Table's allowed list |
| `view` | `Global`, `Sales Region`, `Sub Region` | |
| `confidence` | forecast confidence level | |
| `channel` | `All`, `Channel`, `Direct` | |
| `cumulative` | `1`/`0` | Quarterly and Monthly only |
| `scale` | `k` | Thousands; units is the default |
| `region`, `subRegion`, `billingCountry`, `shippingCountry`, `industry`, `subIndustry`, `owner`, `techOwner`, `channelMgr` | applied list filters | Comma-separated |

**Scale is the one ambiguity to settle in review.** The source writes `scale=k` to the URL but
deliberately does not count it when deciding whether a link carried view state — its comment reads
*"Scale is session state, not filter hydration"* — while also holding Scale as a cross-page preference.
In One WSO2 that preference becomes a `ScalePreferenceContext` over `one-wso2.scale`. The port keeps
`scale=k` in the URL and gives it precedence over the stored preference when present, so a shared link
renders as the sender saw it without permanently changing the recipient's preference.

## 5. Role matrix

| Who | ARR Build / QRR / MRR | ARR Analysis | Flash Dashboard | Flash editing |
|---|---|---|---|---|
| ARR privilege | Yes | Yes, when the flag is on | No | No |
| Flash privilege | No | No | Yes | Yes, before the cutoff |
| Both | Yes | Yes, when the flag is on | Yes | Yes, before the cutoff |
| Neither | Not in the rail; direct URL shows not-authorized | Same | Same | — |

The real LDAP groups behind `987` and `789` are `configurable` values in the ARR backend and are not
in either repo — see §11.

## 6. API contract

Read endpoints marked POST take a filter body rather than a query string, which affects React Query
key construction: the key must include the serialised body, not just the URL.

| Call | Service | Notes |
|---|---|---|
| `GET /user-info` | ARR | Privileges. Drives `useMisGate`. |
| `GET /app-configs` | ARR | Filter option lists and `productsUsageEnabled`. |
| `POST /arr-summary` | ARR | The Build table. |
| `POST /arr-summary/customers` | ARR | Customer drill-down dialog. |
| `POST /arr-summary/region-exit` | ARR | Exit ARR by Region. |
| `POST /arr-summary/bu-exit` | ARR | Exit ARR by Business Unit. |
| `POST /arr-summary/region-metrics` | ARR | The Region Summary's **All ARR Metrics** view — each region's movement over the column, narrowed to one Business Unit. The one summary whose body carries the reader's unit selection. |
| `POST /exit-arr/search` | ARR | **ARR Analysis only** — the summary metric above its table, the Channel/Direct split (two calls, one per book) and the industry breakdown (one call per industry). Nothing under `arrDashboard/` calls it, so it backs no Build screen. |
| `POST /accounts` | ARR | Accounts by date range. |
| `GET /opportunities` | ARR | Opportunities for an account. |
| `GET /balance-statement` | Flash | The P&L. |
| `POST /customer-summary`, `POST /account-summary` | Flash | Flash detail views. |
| `GET /sub-regions` | Flash | Sub-region list. |
| `GET`, `PATCH /income-accounts` | Flash | Revenue budget/forecast. **Write.** |
| `GET`, `PATCH /cost-of-sales-accounts` | Flash | Cost-of-sales budget/forecast. **Write.** |
| `GET /comments/all`, `GET`/`POST`/`PATCH`/`DELETE /comments` | Admin | Flash comments. **Write.** ⚠ The Admin component is named "DEPRECATED" and its Production deployment is **suspended** — see §2.5. |

Each service gets its own `isMisArrConfigured()` / `isMisFlashConfigured()` / `isMisAdminConfigured()`
guard rather than one combined check, so the ARR screens still work when the Admin comments URL is
unset. That is not hypothetical: the Admin backend is deprecated and suspended in Production (§2.5),
and its staging URL is on a CSP-blocked domain (§11.2), so leaving `ONE_WSO2_MIS_ADMIN_BACKEND_URL`
empty and letting the comments screens report "not connected" is the correct configuration today.

Base URLs differ by environment in both host *and* path — `apis.wso2.com/.../v1` in production,
`apis-stg.wso2.com/.../v1.0` in staging — so the version segment is part of the configured URL rather
than something the client appends.

**Rollout.** Both live One WSO2 configs carry an `ONE_WSO2_PREVIEW_FEATURES` object (currently
`{ expenseSubmitter: true }`) that is absent from `public/config.js.example`. It is the established
way to land a screen for some users before all of them, and is the mechanism to reach for if MIS ships
to Finance ahead of general availability.

## 7. Deviations from the source, and why

**Structural.** MIS's shell is deleted, not ported: its login screen and OIDC callback, the
module-level mutable token globals, the fetch wrapper and its 401 refresh queue, the 30-minute idle
timer, the sidebar and nav rail, the banner system, the Redux store, and all three nested
`BrowserRouter`s. One WSO2 already provides every one of these.

**Tables.** ag-Grid and MUI X DataGrid are both dropped. The community DataGrid this app ships cannot
express the Build: `pageSize > 100` throws, column pinning is absent, `GridPinnedRows` returns `null`,
and row grouping, tree data and aggregation are not in the package at all. Rather than add a
dependency — which `AttendeeGrid.tsx:46-64` records this codebase deciding against once already — the
Build and Flash tables are hand-rolled on `Table`, following the existing precedents for sticky first
columns, three-level collapsible sections, hand-computed totals and horizontal overflow. ARR
Analysis's flat account table does take the DataGrid. A three-variant prototype confirmed this is
achievable — see [ADR 0004](../adr/0004-arr-build-tables-are-hand-rolled.md), which also records the
two things it obliges: **row windowing must be written** (there is no virtualization, and the real
Build is thousands of rows) and **an export path must be built** (a hand-rolled table gets no CSV,
and Finance's workflow is to paste the grid into a spreadsheet). Both are in scope for this port, not
deferrable.

**Charts.** `@mui/x-charts` is dropped for recharts, per the one existing chart implementation.

**Excel.** The bespoke ExcelJS workbook is kept, but restructured into pure builder functions with the
blob download isolated, so it can finally be tested. `exceljs` is dynamically imported at the call
site, as everywhere else in this repo. Built in ticket 11; three things about it are decisions rather
than transcription:

- **A figure in the file is a NUMBER, where the source writes a string.** `generateAnnualSheet.js`
  puts `formatNumber(item.iam)` into every figure cell — `Intl.NumberFormat` output, so `"1,234.50"`
  — which means no column in the workbook Finance opens today can be summed, averaged or charted
  without being retyped. The port writes the figure and puts the presentation in the cell's number
  format, where Excel applies it to a live number.
- **An export is always at units, and says so.** Spec §10.18 allowed either that or carrying the
  reader's Scale in the file; units is chosen, and the caption says `All amounts in USD` as well, so
  the answer is taken both ways. It matches the decision already made one screen down: the
  drill-down's Amount column hard-codes `MIS_SCALES.UNITS`, and the source's own test asserts the
  thousands rendering does not appear there.

  **That is enforced at the sheet layer and only there.** `misBuildSheet` has no Scale parameter, so
  nothing inside it can scale anything. What it cannot enforce is its `value` callback: a call site that handed it an already-divided figure would
  compile. The reason none does is that each table's raw reader is the SAME function its on-screen
  `cell` calls, and the division happens after that, inside `formatMisValue`. So the guarantee rests
  on four call sites, and §10.18 is therefore asked of each of the four tables separately rather than
  of the Build alone.
- **The filename is dated in Pacific Time, where the source uses UTC.**
  `ArrSummaryCustomersDialog.js:191-216` stamps `new Date().toISOString()`, so an export taken on a
  Pacific evening is filed under tomorrow. Its two clean-up rules ARE kept, including the fact that
  there are two of them: a row label loses its hyphens and a Period column keeps them, so a range
  survives as `20250903_-_20260903` rather than collapsing into one unreadable number.

The customer drill-down is a consumer of these same builders. The source's dialog has its own Export
CSV button; porting that as a second, bespoke CSV path is what ticket 11 exists to prevent, so the
dialog writes a workbook through `misDrillDownSheet` — a `misBuildSheet` with no Periods in it, the
same degenerate case `BuildTable` already renders it in.

Three of the decisions above change what the source does — **the filename's date, a figure's cell
type, and the drill-down's CSV becoming an .xlsx** — and all three are **knowing exceptions to
[ADR 0003](../adr/0003-bug-for-bug-parity-during-the-parallel-period.md), not cases the ADR fails to
reach.** (The fourth, always exporting at units, deviates from nothing: the source has no Build
export at all.)

They are taken because none of them reaches what that ADR protects. ADR 0003 exists so that finance
signing off figures from both apps never has to investigate a disagreement, and §10.37 compares the
FIGURES ON EACH SCREEN. A filename, a cell's type and a file's extension are all outside that, and
the figures inside the exported sheet are the same numbers the screen is showing — so the parallel
period sees no disagreement it has to explain. Each is also a defect that would otherwise be
preserved in a file outliving the parallel period: an export filed under tomorrow's date, and a
column of figures that cannot be summed.

**Routes.** `/finance-mis/*` becomes `/finance/mis/*`. Keeping the old prefix would break the shell:
`findPerspectiveByPath` matches with a bare `pathname.startsWith`, so `/finance-mis` resolves to the
`finance` perspective and renders the wrong rail.

**Browser title.** MIS drives sidebar label, app bar and browser title from one table. One WSO2 writes
`document.title` nowhere. A shared per-route title mechanism is added rather than a MIS-local one.

**Minimum width.** MIS shows a dismissible notice below 1024px. `AppShellLayout` deliberately makes
the main column shrinkable and there is no notice component. Resolved as a shared one — see §11.

**Pacific Time is injected, not imported.** The URL contract's `hydrateAppliedFilters` and
`applyWindow` take the Annually column-range computer as an argument rather than importing it — the
same move the Build table makes with formatting (ticket 03), for the same reason. Pacific Time is the
easiest rule in this port to get silently wrong, so it is built once and handed in, which also keeps
the URL contract testable and shippable without a timezone in it. The source always computes the
ranges; here a caller that supplies no computer gets no `columnDateRanges`.

**Period boundaries are civil-date arithmetic, not `Date` arithmetic.** The source reduces an
instant to a Pacific calendar date correctly, and then builds every boundary with
`new Date(year, 0, 1)` and reads Pacific parts back out of it. That is a LOCAL midnight, so for a
viewer east of California every annual column opens and closes a day early — `2025/12/31` where the
column is 2026's. The port does the arithmetic on the three numbers instead, and the boundaries stop
depending on where the reader is sitting (§10.8).

**This is a knowing exception to [ADR 0003](../adr/0003-bug-for-bug-parity-during-the-parallel-period.md),
not a case the ADR fails to reach.** The team reconciling the two apps is in Colombo, so this is not a
difference confined to some hypothetical remote viewer: through the whole parallel period the old
frontend and the port will disagree about every Annually boundary, for exactly the people signing off
the figures. It is taken anyway, because §3 settled it before the ADR could apply — "Every Period
boundary, and the Period label itself, is computed in `America/Los_Angeles`, not the viewer's zone and
not UTC" — and §10.8 states it as a test rather than a preference. The source's behaviour here is not
a business rule anyone agreed to; it is a bug that makes one saved link report different revenue to
two people. Reproducing it would mean shipping a port that fails its own spec's test suite.
**§10.37's parity check must expect this difference** and reconcile against Pacific-dated ranges
rather than against whatever the old frontend happens to render in Colombo.

The same correction reaches one more date, and it is worth naming because it is not a Period boundary.
The leftmost Build column has no column to its left, so its y/y rows are compared against **the same
range a year earlier**, which the source computes with `new Date(startDate)` — a UTC instant — and
then `setFullYear`, which operates in LOCAL time (`useArrTableSummary.js`). East of California that
lands a day early, so in Colombo the source compares the first column against a range one day short.
The port shifts the civil date instead. Same reasoning, same exception, same note for §10.37.

One further case differs, and only on one day in four years: **a 29 February as-of is clamped into a
common year rather than rolled forward.** `new Date(2025, 1, 29)` is 1 March, so the source's
year-to-date "as at 29 February" silently includes a day of March in three years out of four. The port
ends those years on the 28th. Flagged rather than reproduced because the parallel period contains no
29 February — the next one is in 2028 — so there is no reconciliation this can break.

**The Build's columns are fetched in parallel, one query each.** `POST /arr-summary` answers one
column, so a Build is one call per column — five at the default Years Back. The source runs them in a
sequential loop guarded by a request-id ref, so a stale run cannot finish after a fresh one. The port
gives each column its own React Query entry keyed by its own request body. Three things follow:
widening Years Back re-asks only for the columns whose body actually changed (the new one, and the
one that stopped being leftmost — `isFirstColumn` is positional); a column that fails blanks itself
and the rest of the Build still reads; and the request-id ref is not ported, because Query owns the
races. The cost is six concurrent reads where the source made six consecutive ones. **Ticket 06 is
the ticket that measures real volume — if the gateway objects to the concurrency, this is the
decision to revisit**, and `useArrSummary` is the one place it lives.

**The TTM Type list is part of the URL contract, not only of the filter bar.** A trailing window
offers Total, Closed Won and Delayed — it ADDS Delayed to the Build and REMOVES Forecasted and Renewal
from every table. The source keeps that rule in the bar alone (`FilterBar.js:493`, `arrTypeOptionsUI`)
and its `allowedTypeValues` never learned it, so the control and the address disagree in **both**
directions: choosing Delayed on a TTM Build moves the grid and is then dropped from the link, and a
link carrying `window=ttm&type=Forecasted ARR` hydrates a forecast the bar has no option for. The port
gives `allowedTypeValues` the Window, so one function answers for the menu and for the link and they
cannot drift. The two summary tables are deliberately **not** widened: §3 states their list as a
business rule, and the source's blanket TTM branch reaching them looks like the accident rather than
the intent.

**One rule for whether a view uses Years Back.** The source asks that question twice and gets two
answers: the Build's control hides on a Forecasted type (`FilterBar.js:1745`), while its chip hides on
Forecasted *or* Delayed whatever the table (`appliedFilterChips.js:81`). A Delayed Build — reachable
on a trailing window, per the deviation above — therefore shows a Years Back of 3 with no chip saying
so, which reads as a filter that was not applied. Asked once in the port (`usesYearsBack`), with the
Table as part of the question, and both the control and the chip read it.

**The apply stamp.** The source puts `_applyId: Date.now()` on every Applied filter set, as a token
its hand-rolled fetch effects compare to decide whether to refetch
(`arrDashboard/hooks/useExitArrByBU.js:170`). It is not ported. TanStack Query already does that job
from the query key, which §6 requires to carry the serialised filter body — and a timestamp inside
that key would make every key unique, miss the cache on every apply, and refetch on every hydrate.
Dropping it changes no behaviour; keeping it would.

**The Software/Cloud Customers table loses the source's Software/Cloud header row.** The source heads
that table with THREE rows — the Period, then a `Software` group spanning four columns and a `Cloud`
group spanning seven, then the product — and `BuildTable` renders two. Adding a third generalises the
measured sticky offset that [ADR 0004](../adr/0004-arr-build-tables-are-hand-rolled.md) records as the
mechanism with no MUI precedent, so it was taken as its own decision and not folded into ticket 10.
The grouping therefore lives in the labels: the three columns the source can afford to label plainly
`Total` are **Software Total**, **Cloud Total** and **Total** here. Everything else keeps the source's
wording, which already names its own half of the book. No figure changes; only the header does.

**The customers table does not fetch the year it never shows.** The source is inconsistent with
itself here: `useCustomerAccounts.js` fetches `generateFullYearRanges(-yearsBack, 0)` while the same
table's column definition (`tableUtils.js:1091`) is `-(yearsBack - 1)`, identical to Subscription's. So
it asks the backend for one year more than it renders and throws the answer away. The port renders
what the source renders — the last `yearsBack` columns, via `buildColumnRanges` — and does not make
the wasted call. Figures on screen are unchanged; one request per view is saved.

**Delayed Day Count appears only on a Delayed type**, matching `tableUtils.js:753`, so the customers
table is seventeen identity columns by default and eighteen on Delayed ARR/QRR/MRR.

**A confidence level is decided per Period key, not off the collapsed type.** For `/accounts` the
source reads `filters?.forecastType || filters?.confidenceLevel` against a `unifiedArrType` collapsed
with `arrType || qrrType || mrrType`. The port asks each Period's own key independently
(`carriesConfidence`), the same rule `/arr-summary` already follows. It matters only on the summary
tables, which mirror a Quarterly or Monthly type into `arrType` — collapsing there reads the mirror and
silently drops the confidence off a Forecasted QRR. Both endpoints now answer the question the same
way, which they did not in the source.

**A failed drill-down says so.** The source cannot: its error is discarded three times over —
`http.js:64` hands the failure callback a STRING, `useArrSummaryCustomers.js:52` reads `err?.message`
off it and always falls through to the literal `'Failed'`, and `DataGrid.js:911` never destructures
`error` at all, so the dialog has no error prop and no error state. A failed drill-down there renders
an EMPTY GRID, indistinguishable from "no customers matched" — on a screen whose whole purpose is to
explain a figure, that reads as "this number is made of nobody". The backend does send a usable
message (`service.bal:187`). The port surfaces it, with a retry.

**The drill-down dialog's columns do not sort, filter or resize.** The source's grid sets
`defaultColDef={{ resizable: true, sortable: true, filter: true, ... }}`
(`ArrSummaryCustomersDialog.js:314-324`), so every one of its eleven or thirteen columns is sortable
and filterable. `BuildTable` offers none of that. It matters most where this dialog is largest:
`/arr-summary/customers` takes no limit and no offset, so a Closing drill-down across every business
unit returns the whole customer book — and a list that long with no sort-by-Amount is a materially
weaker tool than the source's. The biggest single gap in the drill-down port; not a blocker for the
parallel period, but the first thing to fix if Finance notices.

**A drillable figure is visibly drillable, and reachable from the keyboard.** The source hangs the
whole drill-down off `onCellClicked` (`DataGrid.js:604`) — an invisible, mouse-only cell handler with
no styling and no focusable element, so a figure that opens a dialog looks exactly like one that does
nothing. The port renders an openable figure as a real button with a dotted underline. A deliberate
addition: a drill-down only a mouse can reach is one half the readers of a finance report cannot use,
and an affordance nobody can see is one most readers never find.

**Account ID is frozen in the port and is not in the source.** `salesforceIdColumn`
(`drillDownTitle.js:27-37`) pins only the column's WIDTH — 188px, sized for an 18-character
Salesforce id on one line — and the source's grid pins no column at all, scrolling all thirteen
together. The port freezes it, because at thirteen columns the identity of the row scrolls away first.

**Lost Reason does not wrap.** The source lets that one column wrap and grows the row to fit it
(`wrapText`/`autoHeight` plus a per-row height estimate, `ArrSummaryCustomersDialog.js:117-133` and
:161-189). This port cannot: `BuildTable`'s row windowing measures one row and assumes every other
matches, so a variable-height row would break the scroll extent it reports. The column keeps the
source's generous 320px and carries its full text on the cell's `title`, so a long reason is reachable
rather than clipped to a fragment. The honest fix is per-row heights in the window, which is a ticket
of its own.

**The empty state is worded rather than inherited.** The source's dialog sets no
`overlayNoRowsTemplate` and does not spread `AG_GRID_CONFIG`, so an empty drill-down falls through to
ag-grid's default "No Rows To Show". The port says "No customers behind this figure." — which, with
the error notice above, is what makes "failed" and "empty" tell each other apart at all.

**The drill-down dialog has no CSV button.** The source has one. This port's export story is ticket 11
— one set of shared ExcelJS builders, written once and consumed by the Build and by Flash — and a
bespoke CSV here would be the second export path that ticket exists to prevent. Carried to ticket 11
rather than dropped. (The source's own filename is also stamped in UTC while the rest of the app is
Pacific, so an export taken on a Pacific evening carries tomorrow's date; worth not reproducing.)

**The drill-down keys on row IDs where the source keys on row LABELS.** `DataGrid.js:646-647` tests
the clicked row's header TEXT against a Set of fourteen strings. That works there only by luck: the
Build carries FOUR rows labelled `y/y growth`, so a label is not an identity. The port's rows have
stable ids, and both the drillable set and the Lost-columns rule key on those.

**The customers table does not blank itself while refetching.** `useCustomerAccounts.js` calls
`setData([])` at the top of every run — "Clear previous data immediately to show loading state" — which
on a table of hundreds of customer rows empties and re-paints the whole grid on every filter change.
React Query holds the previous answer until the next lands, so the figures go stale for a moment
instead of going away.

**The two Exit ARR summaries are ported against a source that currently THROWS.** This is the one
deviation where there is nothing on the other side to reconcile against. Both
`useExitArrByRegion.js` and `useExitArrByBU.js` build every column's payload through
`ttmOpeningSql(endDate, filters.annuallyDateRanges)`, which matches a range by its end date and then
reads `match.opening`. A TTM range carries an `opening`; a **Calendar** range — `getAnnualPeriods`,
`{start, end}` — does not. So on a Calendar window, which is the default, the first column's payload
raises `TypeError: Cannot read properties of undefined (reading 'replace')`, the `for` loop over the
columns aborts inside the hook's outer `try`, and the table renders that message instead of figures.
Verified by running `ttmOpeningSql` verbatim against the two range shapes.

The port does not reproduce it. `openingDateFor` gives a Calendar column the previous 31 December —
which is exactly what the source's own `${endDate year - 1}-12-31` fallback was written to produce,
and never reaches. **The consequence for the parallel period: these two screens cannot be reconciled
against the live app on a Calendar window, because the live app shows no figures there.** Reconcile
them on TTM, where the source works, or against the backend directly.

**The Region Summary's total row is drawn last, whatever order the regions arrive in — in BOTH of its
views.** On Exit ARR the source appends that row while mapping the FIRST column and pushes regions
found only in later columns in after it; on All ARR Metrics it appends while mapping whichever column
it is on (`useArrSummaryRegionMetrics.js:245-249`). Either way a region can render BELOW the total
that counts it. The arithmetic is unaffected — the total is recomputed across every region row on
every column — so this is ordering alone.

The row itself is built **unconditionally, over an empty book too**, which is the source's behaviour
in both views: its guard asks whether a total row already exists, not whether any region does. The
port kept that, and the grid reads a lone total as "no regions came back" and shows its empty state
instead, so the bare row never reaches a reader. Worth stating because the two builders are
near-identical and this is the one line they are most likely to drift on; `exitArrRows.test.ts` and
`regionMetricsRows.test.ts` pin it on both sides.

**Region names are not re-cased word by word.** `formatRegionLabel` uppercases every word of two to
four letters so that unmapped acronyms come out as acronyms; applied per word it also shouts ordinary
ones, and the function's own comment names "Middle East", which it renders **"Middle EAST"**. The
port applies that rule only when the whole key IS one short word — which is when it is an acronym —
and title-cases a multi-word key instead, leaving capitals the wire already sent alone. Labels only;
no figure moves.

**The summaries do not carry the source's five-shape response reader.** `pickBuNumbers` tries four key
spellings (`apim`, `apimBuTotal`, `APIM`, then nested under `bu` or `businessUnit`) and accepts the
body as an array or under `data`, `result` or `payload`. The service returns `map<BuType>` and
`BuType`. A reader that accepts five shapes cannot tell a changed contract from an empty answer —
every wrong guess lands on the same silent zeroes — so the port reads the contract, and a body that is
not it renders nothing rather than nothing-shaped-like-figures.

**The source's All ARR Metrics throws on a Calendar window too, for the same reason the two Exit ARR
summaries do.** `useArrSummaryRegionMetrics.js:102` reaches the column's opening through the same
`ttmOpeningSql(endDate, filters?.annuallyDateRanges)`, which reads `match.opening` off a range that
has none on a Calendar cut. So the third of the three Region Summary surfaces has nothing to
reconcile against on the default window either — reconcile it on TTM, or against the backend.

**No Annually table draws forecast columns yet — Subscription, Customers, and now both summaries.**
Found reviewing the Exit ARR slice, and it is NOT new to it. Under a Forecasted or Renewal type the
source changes the column list itself: the Subscription Build takes `generateTwoForecastRanges`, and
the two summaries take `generateFullYearRanges(0, 2, true, …)` — the current year plus two future
ones. `pacificColumnRanges` branches on the Window and never on forecast, so the port draws the same
calendar columns it draws for Total. The Type control still offers Forecasted, the request still
carries `forecastType`, and the figures still come back — they are just read at calendar dates rather
than forecast ones, which is wrong without looking wrong. **Needs its own ticket**, covering all three
tables at once, since the fix is one branch in `pacificColumnRanges`.

**Ticket 12 widened that gap rather than closing it, deliberately.** Quarterly and Monthly have
forecast branches of their own — `generateQuarters(yearsBack, true)` is eight FUTURE quarters
(`tableUtils.js:264-278`) and `generateMonths(…, true)` twenty-four future months (`:206-214`), both
triggered by a Forecasted or Renewal QRR/MRR type. `getQuarterlyPeriods` and `getMonthlyPeriods`
ignore forecast exactly as the annual generator does, so the same defect now exists on three Periods
instead of one. Left to the same ticket on purpose: the fix is one branch in one function for all of
them, and splitting it across two tickets would mean writing that branch twice.

**All ARR Metrics binds to the unit tabs rather than growing a second unit control.** The source
gives the Region Summary's second view a pill row of its own — API Platform, IAM, Integration, Choreo,
Agent Platform, Moesif, All BU, Custom Product Selection — held in `RegionSummaryTabs.js`'s component
state, with its own custom-selection chip panel and Reset, sitting *below* the unit tabs the screen
already carries. Two unit controls on one screen that can disagree, only one of them in a shared link.
The port drops the pills and reads `businessUnitsFor(filters)`, so the tabs above the grid are the one
unit selection, it is in the address, and the custom panel is the one `MisUnitTabs` already has.

This is the first thing on a Build screen to make those tabs mean something on the Region Summary, and
it narrows §8's note about them: they are still ignored by the Exit ARR view — correctly, since the
per-unit split IS its columns — and they now drive All ARR Metrics, which is the view where a unit
genuinely narrows the question.

**Two consequences that change figures, so §10.37 has to expect them.** The source's pills go through
`toProductCode`, which can only ever produce one of seven codes and silently maps everything else to
`ALL_BU`; the tabs offer all seventeen of `BACKEND_UNIT_CODES`, so this view can now be asked for
`ALL_SOFTWARE` or `APIM_CLOUD`, which the source cannot ask for at all. And the source's pills always
start at **All BU** however the tabs above them are set, where the port inherits the tab — so opening
the view on a narrowed unit shows the live app's All BU figures beside the port's narrowed ones. Both
follow from having one unit control instead of two; both are worth knowing before a figure is called
a discrepancy.

**The Software/Cloud Customers Total row is omitted over an empty book.** `useCustomerAccounts.js`
sets `shouldAddTotalRow` to the literal `true`, so a book with nobody in it still renders a Total row
of zeroes. The port shows its empty state instead: a row of zeroes reads as a company that earned
nothing, where "no customers to show" says what actually happened. Every other case — including a
column that failed, which totals blank rather than zero — is the source's.

**The Monthly Build draws THIRTEEN columns at Years Back 1, and so does the source.**
`generateMonths` walks `i <= totalMonths` where `totalMonths` is `yearsBack * 12`
(`tableUtils.js:228`), so a year back is twelve months plus the current one — September 2025 through
September 2026. Reproduced rather than corrected: it is a column of real figures rather than a
duplicate, and a port showing twelve where the live app shows thirteen is the first thing Finance
would trip over reconciling the two apps column by column. Quarterly has the same shape for the same
reason — `-max(1, yearsBack)` to 0 inclusive, so Years Back 1 spans two calendar years.

**The `As of` prefix belongs to the TABLE, not to the column.** The Subscription Build passes
`includePrefix: false` (`tableUtils.js:646` and `:678`) so its Q/M headers read `2026 Q2`; the two
summaries take the default and read `As of 2026 Q2`. One range, two labels, on one screen — so a
range carries its `periodKey` and `buildColumnLabel` / `asOfColumnLabel` each decide. The first draft
of ticket 12 baked `As of ` into the range and got the Build wrong on every Q/M column.

**A month is written year-first and spelled out: `2026 September`, not `Sep 2026`.** `generateMonths`
KEYS a column `Sep 2026`, but nothing shows that string — `toAsOfMonthlyText` maps it through
`monthFullNames` before it reaches a header (`tableUtils.js:50-80`). The abbreviation is internal to
the source, so this port skips it and stores the spelling a reader sees. Quarterly needs no such
mapping: `2026 Q2` is both key and label.

**Cumulative moves where a column OPENS, not what it closes at.** `computePrevDateFor`
(`useArrTableSummary.js:159-193`) is the whole of it: with the flag on, every quarter or month of a
year opens at that year's previous 31 December instead of at the previous period's close, so the
figures accumulate from 1 January rather than rolling forward one period at a time. It is the
COLUMN's own previous year end, not today's, so a Build spanning two years accumulates within each of
them. The customers table's Delayed window ignores the flag, as the source does.

**The leftmost column is compared against three different things, one per Period.** It has no column
to its left and the y/y rows still need one, and the source answers differently for each
(`useArrTableSummary.js:476-507`): Annually takes the same window a year earlier, Quarterly the
previous QUARTER (the column's own opening, and the balance three months before it), Monthly the
previous MONTH — the column's own opening paired with the FIRST day of the month it falls in. That
last is an asymmetry worth naming: every other range in this port is two balance dates.

**The Years Back column slice does not apply off Annually.** §9 describes the source computing annual
bounds with two generators that disagree by one, with the Subscription grid reading the shorter;
`buildColumnRanges` reproduces that by dropping the oldest range. `generateQuarters` and
`generateMonths` have no such twin — one generator feeds both the columns and the fetch — so the
slice returns early on Quarterly and Monthly. Left in place it would have cut seven quarters to one
and thirteen months to one, at the default Years Back.

**A Period switch navigates to the bare path, carrying no query string.** The Period control is the
one control on the bar that leaves the screen, and it drops the view rather than translating it. Not
laziness about preserving it: the three Builds do not agree about what their filters mean — `Total
QRR` is not a type Annually has, and Years Back defaults to 1 off Annually and 5 on it — so carrying
the old query across would hand the arriving screen values it has to discard. It hydrates from its
own defaults and the bar's mount effect seeds Years Back back out of the session, which is what that
session is for. TTM is the exception and stays put: it is Annually cut differently rather than a
fourth Period.

**An ignored parameter is not a scrubbed one.** Arriving on `/mrr-build?window=ttm` leaves
`window=ttm` in the address, because nothing has WRITTEN a view yet — this app only re-serialises
when it navigates. The parameter is genuinely ignored (no TTM button lights, no trailing columns) and
it disappears the first time anything writes, because the serialiser emits `window` on Annually
alone. Worth stating because "ignored, not errored" reads as though the address is cleaned on
arrival, and it is not.

**A link cannot carry a filter the Table does not offer; the source's can.** The source greys these
out in the BAR — `UNAVAILABLE_BUILD_FILTERS` keeps the View and the seven account and geography
filters on screen, disabled, on Customers and the two summaries; Customers loses Channel/Direct too,
and on Quarterly and Monthly all three lose the Cumulative flag — but its URL contract never learned
the rule. So `?table=customers&industry=SaaS` opens the source on a customer book narrowed by an
Industry the reader can neither see, change, nor clear, with no chip and no control saying so. The
port asks one function, `unavailableFilters`, in both places: the bar greys the control out, and
`hydrateAppliedFilters` drops the value. Same arrangement as `allowedTypeValues`, and for the same
reason — a menu and a link that answer separately drift.

**Why this one is taken despite ADR 0003.** It is the rare deviation that CHANGES a figure: the two
apps show different numbers for such a link, which is exactly what §10.37's parity check is for. It is
taken anyway because no such link can be produced by either app's own UI — the source's bar clears
these filters on every Table switch, so only a hand-edited address reaches the state, and a
hand-edited address is not what Finance is reconciling.

**A region list outside its own View is dropped on hydration too.** The same hole reached by another
route: the filter bar's `normalisePending` has always cleared a Sales Region list on a Sub Region view
for a reader changing controls, but a hand-written `?view=Global&region=EMEA` went straight through to
the wire. Now closed for links as well, on every Table including the Build, where nothing is greyed
out at all.

## 8. Source behaviour reproduced deliberately, though it looks wrong

Kept because the two apps run side by side during the parallel period and must agree.

1. **The cutoff is not pre-empted client-side.** The edit is attempted and the server's rejection is
   surfaced, even though the date is knowable locally.
2. **`hasViewState` ignores `scale`.** A link carrying only `?scale=k` counts as having no view state.
3. **Customers + Delayed silently resets Years Back to 1** unless the link sets `years` explicitly.
4. **The email-domain check on the backend accepts `ws02.com` as well as `wso2.com`.** Backend
   behaviour, untouched, noted so nobody reports it as a port defect.
5. **Both country filters offer the SHIPPING countries.** `GET /app-configs` answers with
   `billingCountries` and `shippingCountries`; the source builds one list out of `shippingCountries`
   (`ArrDashboard.js:52`) and hands it to both the Billing Country and the Country by Sales Region
   control. `billingCountries` is fetched and never read. Reproduced, because a Billing Country menu
   offering a country the other app does not would make one filter mean two things depending on which
   app you opened. **Worth raising with Finance** — it is the kind of thing that is either a known
   shortcut or a real defect, and the two apps running side by side is the wrong time to find out.
6. **`BFSI` is added to the industry list client-side.** The backend has never sent it
   (`ArrDashboard.js:54`). Kept, because Finance filters by it today.

**The drill-down dialog renders a missing value two different ways, and the port keeps both.** Seven
of its columns fall back to the literal `N/A`; four render an empty cell. The four are exactly the
fields the backend declares non-nullable — except `amount`, which is also non-nullable and DOES get
the placeholder. So an unexpected null shows as `N/A` in the Amount column and as a blank in Sales
Region two columns along. Reproduced rather than unified: it is the source's inconsistency, the
figures are unaffected, and the already-ported Software/Cloud Customers table renders blanks
throughout — so unifying would mean choosing which of two shipped surfaces to change, which is a
decision about the whole feature rather than about this dialog.

**Both balances ask the backend for `Closing`.** An Opening ARR drill-down and an Ending ARR
drill-down send the same `customerArrType`, and only the DATE differs — the opening one is read at the
opening snapshot and sends no `startDate` at all. It looks like a bug on first reading and is not: the
question "who was in the book" is the same at either end of a Period.

**The Region Summary's total does not foot against its own rows.** A region's Total column is
whatever the backend sent as `all`; the Total Exit ARR row's Total is the five business units added
down the regions **without Moesif** — `useExitArrByRegion.js`'s own arithmetic, under a comment
reading "Total for region table intentionally excludes Moesif". If `all` includes Moesif, the bottom
line reads lower than the rows above it add to. Reproduced: a port whose total differs from the live
app's is the one disagreement that would stop the figures being trusted. **Worth raising with
Finance** alongside §8.5.

**The summaries ignore the reader's Unit selection.** Both payloads hard-code
`businessUnits: ["ALL_BU"]`, so choosing Choreo above the table changes nothing in it. That is the
right answer rather than an oversight — the per-unit split IS these tables' columns and rows — but the
control stays enabled and says otherwise, which is what makes it worth writing down. **Still open
after the placeholder controls landed**: those grey out the FILTER BAR's controls, and the unit tabs
are not one of them — they sit above the bar, commit on click, and the source leaves them enabled on
the summaries too (`TableNavigation.js` has no such branch). Reproduced.

**Narrowed by All ARR Metrics.** The tabs are ignored by the Exit ARR view and by Exit ARR by Business
Unit, which is the correct answer for both; on the Region Summary's other view they now genuinely
narrow the figures (§7). So the control promises something it does not do on two screens rather than
on every screen carrying it, and on the Region Summary it depends which view is open — which is
better than before and is still worth writing down.

**All ARR Metrics writes five of the seven movements differently from the Build.** Its headers are
`Expansion`, `Reduction`, `Loss`, `First Sale` and `Closing ARR` where the Subscription Build writes
`Expansions`, `Reductions`, `Lost`, `New` and `Ending ARR` — the source disagreeing with itself across
two of its own screens. Reproduced rather than harmonised: finance reconciles the two apps column by
column for a full reporting cycle, and a renamed column is a disagreement somebody has to investigate
before the figures can be trusted. Two of the five are words [`CONTEXT.md`](../../CONTEXT.md) does not
use — the glossary's terms are **Lost** and **New** — so harmonising the two screens is a decision for
after the parallel period rather than a rename in one file. The glossary records the carve-out.

**The customers table's Total column means two different things depending on the breakdown.** Both
read `arrGrandTotal` and both fall back when it is absent — to different sums, under different
conditions, in different places:

| | Rule | Falls back when | Falls back to | Where it lives |
|---|---|---|---|---|
| Software/Cloud | `arrGrandTotal \|\| soft + cloud \|\| 0` | falsy — `0`, `undefined`, `NaN` | the two books | the data field, `useCustomerAccounts.js:386` |
| BU only | `_bu_total > 0 ? _bu_total : the six BU fields` over a `_bu_total` that is itself `arrGrandTotal \|\| 0` | not strictly POSITIVE | the six business units | the column's `valueGetter`, `tableConstants.js:474-489` |

So a **negative** grand total renders as itself in one breakdown and is replaced by a sum of units in
the other, and a missing one resolves to two different figures. Reproduced, which is why the port
keys these rules on the COLUMN rather than on the field they share.

**And the BU-only Total is the TOTAL ROW's rule, not the sum of the cells above it.** Its fallback is
in a `valueGetter`, so ag-Grid applies it to the total row as a row in its own right, over a
`_bu_total` the source had already summed raw down the book. Summing each customer's own answer gives
a different number: with `{grand: 0, units: 100}` and `{grand: 50}` the source reads 50 and a
per-customer sum reads 150. Every other column on the table does foot against its cells.

**Switching to Customers clears the unit selection; switching to any other Table does not.**
`FilterBar.js:606` resets `businessUnit` to `['All']` in the Customers branch of the Table-switch
reset and nowhere else. It reads like a leftover — every other Table carries the reader's units across
— and it is reproduced anyway, because a custom book on that screen would put a different customer
list on screen from the app Finance is reconciling against.

## 9. Dead code in the source — do not port

`APP_CONFIG.PAGES` entries `HOME`, `MANAGE`, `PROFILE`, `PREFERENCES` (never routed);
`components/searchBar/SearchBar.js`; `pages/AuthError.js`; `components/launchpad/*` (commented out,
flag off, empty item list); `getPrivilegesByRoles` (exported, never called); and the declared but
never-imported dependencies `react-csv`, `react-number-format`, `styled-jsx`.

The source directory `components/flashConsole/tableView.js/` is a directory whose name ends in `.js`.
It is renamed on port.

**The sixth Annual Period, on the Subscription table only.** On a Calendar Window the source computes
Annually column bounds with two generators that disagree by one:

- `annuallyDateRanges` is `getAnnualPeriods({yearsBack})`, which counts PRIOR years and adds the
  current one on top — six ranges at Years Back 5 (`arrDashboard/utils/viewState.js:267`).
- The Subscription grid builds its own with `generateFullYearRanges(-(yearsBack - 1), 0, …)`, which
  is five (`arrDashboard/utils/tableUtils.js`, `case 'subscription'`).

**Only the Subscription table reads the shorter one.** Every other Annually table takes its columns
straight from `annuallyDateRanges` and therefore draws six. So the extra oldest range is not dead in
general — it is dead on this one table, where it is recomputed on every apply and never drawn and
never fetched. A TTM Window has no split at all: there the columns *are* `annuallyDateRanges`.

The port keeps the distinction where the source puts it. `pacificColumnRanges` — the shared
`columnRangesFor` seam that fills `columnDateRanges` — stays faithful, so the tables in tickets 10
and 13 still get their six. `buildColumnRanges` takes the last `yearsBack` of them for this
table. `getAnnualPeriods` itself is untouched; it is the function the source's own tests pin.
Nothing user-visible changes: Years Back 5 draws five Subscription columns in both apps.

> **One name differs between the two apps on purpose.** The source's field is `annuallyDateRanges`
> and the port's is **`columnDateRanges`**, renamed in ticket 12 when it began carrying quarterly and
> monthly ranges as well — at which point the old name described one of the three Periods it held.
> Every `annuallyDateRanges` in this document is the SOURCE's field, quoted as it is written there;
> the port's is always `columnDateRanges`. The field is derived and internal — never a URL
> parameter — so nothing a reader holds depends on either spelling.

**Nothing in the Subscription Build is totalled client-side.** ADR 0004 obliges hand-computed totals
because the community grid cannot aggregate, and that obligation is real for the summary tables — but
not here. `Ending ARR`, `Net New`, `Total New ARR` and `Total Churn ARR` all arrive on the response
(`useArrTableSummary.js`, the row mapper), so the port adds no arithmetic of its own and must not: a
client-side total would be a second opinion about a figure the backend already has one about, and the
two would diverge the first time a filter changed the backend's definition.

**The Subscription Build's row count is fixed, not measured.** Ticket 06 owed ticket 07 a row count.
For this table the answer is a property of the code: every row is a named metric line, so the grid is
**34 rows** (**38** when Channel or Direct narrows it, which adds the four transfer rows) whatever the
backend returns — the figures arrive as columns, never as rows. Windowing (ticket 07) is therefore a
question about Software/Cloud Customers (ticket 10) and the account table (ticket 13), which ARE
per-customer, and not about this one. The count is pinned by a test in `arrBuildRows.test.ts`.

Ticket 07 acted on that: `BuildTable` windows only above `ROW_WINDOW_THRESHOLD` (150 rows), so the
Subscription Build takes the plain path and pays nothing for a mechanism it will never need, while the
per-customer tables in tickets 10 and 13 get it for free the moment they arrive.

`isAllowedTtmEndingMonth`'s second parameter. `viewState.js:173` and `:245` both pass `asOf` to it and
`ttmPeriods.js:58` declares no second parameter, so it has never been read. The ported signature takes
one argument.

`applyWindow`'s call to `mirrorsTypeToArrType` in `arrDashboard/utils/viewState.js` cannot fire: the
mirror is a Quarterly/Monthly rule, and both of those Periods have already returned from the guard at
the top of the same function. On Annually the mirror would be a no-op anyway, because `arrType` *is*
that Period's type key. The mirror is ported where it is reachable, in `hydrateAppliedFilters`.

**One piece of source dead code is kept rather than dropped.** `applyWindow` remembers the Ending
Month across a Calendar → TTM switch, and restores it on the way back, only when the month is *not*
legal on TTM — and `isAllowedTtmEndingMonth` admits every month and Today, so neither branch can run.
It stays because, unlike the mirror above, it is not unreachable by construction: it hangs off a rule
that exists to be narrowed, and dropping it would move the cost of narrowing that rule from nowhere to
there. §10.6's "restores the previous YTD **and Ending Month**" is therefore live on YTD only.

`lastKeyRef` in `useArrSummaryCustomers.js:18,49` — written on every successful fetch and never read.
The effect's dependency on `key` (:55) is what actually prevents refetching. Not ported.

`lostDate` and `deactivationDate` on the drill-down's response record (`types.bal:335-338`) — returned
by the backend, rendered by nothing in the entire source webapp. They sit beside `lostReason`, which
IS rendered, so the record looks designed for a Lost view that was never finished. Not ported.

`openBankingSoftwareTotal`, in the customers table. `transformApiData` writes an `open_banking` value
onto every account row from it, and no column definition in `tableConstants.js` reads that key. Not
ported.

## 10. Test checklist

### The URL contract
1. A default view serialises to an empty query string on each of the three Periods.
2. Every parameter in §4 round-trips: serialise → parse → identical applied filters.
3. `?years=0`, `?years=11`, `?years=x`, `?type=Nonsense`, `?view=Nonsense` each degrade to the default
   rather than erroring.
4. `?ytd=false` and `?ytd=0` both parse; `ytd` is ignored while `window=ttm`.
5. `window=ttm` on QRR or MRR is ignored.
6. Switching Calendar → TTM with a Forecasted type coerces to Total and restores YTD on the way back.
7. A URL `scale=k` wins over a stored `one-wso2.scale` preference without overwriting it.

### Pacific Time
8. Period boundaries are identical when the suite runs under `TZ=UTC` and `TZ=Asia/Colombo`.
   **Write these with an explicit non-Pacific TZ** — `src/test/setup.ts` pins the suite to
   `America/Los_Angeles`, so a PT-vs-local confusion passes silently by default.
9. The PT/PDT chip label is derived from the same source as the boundaries, across a DST transition.

### Access
10. ARR privilege only: no Flash entry in the rail, and `/finance/mis/flash` renders not-authorized.
11. Flash privilege only: no Build entries, and `/finance/mis/arr-build` renders not-authorized.
12. Neither privilege: no MIS entries and no MIS overview card.
13. A new restricted rail item added without a gate mapping is hidden, not shown (fail-closed).

### Flash writes
14. A comment can be created, edited and deleted, and the list reflects each without a manual refresh.
15. A budget edit after the cutoff surfaces the server's rejection and leaves the displayed value
    unchanged.
16. A failed PATCH does not leave an optimistic value on screen.

### Excel
17. The generated workbook loads back via `wb.xlsx.load` with the expected sheet names, cell values and
    number formats. Nothing else in this repo asserts workbook formatting; this test is the only guard.
    **Closed by ticket 11** (`misWorkbook.test.ts`), and deliberately asserted on the FILE rather than
    on the spec that produced it: a spec is the builders' own vocabulary and a test over it would agree
    with them by construction, where the bytes are what Finance opens.
18. An export taken while Scale is "Values in '000" is either exported in units, or carries the scale in
    the file. The prototype found this exact foot-gun in the DataGrid's CSV, which silently inherits the
    display formatter — a finance export that is 1000x off with nothing in it saying so.
    **Closed by ticket 11**, taken BOTH ways — see §7. Pinned once per table, not once per port: each
    of the four tables builds its own raw-figure reader, so each is exported at `?scale=k` with the
    screen reading `All amounts in USD '000` and the cell still holding the unscaled figure under a
    caption reading `All amounts in USD`. The drill-down needs no such test and has none — its Amount
    column takes no Scale at any setting — so what is asserted there is that the cell holds the figure
    rather than the dialog's formatted string, which is the same guarantee arrived at differently.
    Worth knowing that the source has the same defect in a second form: its Flash workbook writes every
    figure as a formatted STRING, so the file cannot be computed on at all.

### The hand-rolled Build table
19. The Build renders at 5, 8 and 12 Period groups without the layout collapsing, and the row-label
    column stays readable when scrolled fully right.
20. The Period group header stays aligned above its Amount / % Open pair after a window resize and at
    browser zoom levels other than 100% — the second header row's offset is measured at runtime.
21. Row hover reads across the whole row, including under the pinned first column.
22. With windowing in place, a Build of several thousand rows scrolls without dropping frames, and
    collapsing a section releases its rows. **Half-closed by ticket 07.** What is pinned in the suite:
    a 3,000-row Build renders 48 rows rather than 3,000, pads the rest so the scrollbar still
    describes the whole table, asks its formatter under 1,000 times instead of 30,000, and keeps the
    sticky header, the pinned column and the `headers` wiring while it does. Collapsing has always
    released its rows — `visibleRows` never rendered a closed subtree. What is **not** pinned is the
    frame rate: jsdom has no layout and no frames. That needs a browser and real per-customer volume,
    which arrives with **ticket 10**.

### The Exit ARR summaries
23. The Region Summary's rows match the regions the live tenant reports, under both Sales Region and
    Sub Region, and switching between the two actually re-reads rather than regrouping.
24. Its Total Exit ARR row is compared against the source's **on a TTM window**. It cannot be compared
    on a Calendar one: the source throws there (§7), so there is no figure on the other side.
25. Region names arriving from the live tenant render the way Finance writes them. The label rules
    here are exercised against invented keys; only a live tenant says what the keys actually are.
25a. **All ARR Metrics** agrees with the source figure for figure on the same region, unit and column
    — **on a TTM window**, for the reason §24 gives: the source throws on a Calendar one there too
    (§7). Its Total row foots against the rows above it, unlike Exit ARR's (§8). Check at a unit other
    than All, since that is the whole point of the view — and expect the source to be showing All BU
    there whatever its tabs say, which is the §7 deviation rather than a discrepancy.
25b. The **Software/Cloud Customers Total row** matches the source's, in BOTH breakdowns. The Total
    column differs between them by design (§8), so a check in one says nothing about the other.

### The filter bar
26. A control changed but not applied leaves the address alone, enables Apply, and says so in a live
    region; Apply then puts the whole view in the address and the bar reads clean again.
27. Choosing a value back at its default takes the parameter out of the address rather than pinning
    the default into it.
28. A control whose value would mean nothing is absent: the region list outside its own View, Forecast
    Type outside a Forecasted type, Years Back under a forecast, YTD on a trailing window.
29. Every filter with a control has a chip and vice versa — the two are driven by one rule, and the
    Delayed Build in §7 is the case that catches them drifting.
30. Dismissing a chip applies that one filter's default at once and leaves any other unapplied edit
    still pending.
31. The unit tabs, the Period control and the Scale toggle each take effect without an Apply; Clear All
    clears the filters and leaves the unit selection alone.
32. A TTM Build offers Delayed, carries it in the address, and survives a reload — the §7 deviation,
    stated as the test that would have caught the source's version.
33. With `GET /app-configs` failing, the written-down controls (Type, View, Years Back, YTD, Channel,
    Scale) all still work and the bar says which menus are missing.
34. A filter a Table does not offer stays on screen greyed out, names that Table on hover and on
    focus, and is dropped from a link that carried it anyway.
35. A Years Back the reader applied carries to the next Table and the next Period, and back to a
    Build they return to mid-session; a link's own Years Back is adopted the same way; the Table's own
    default applies until they set one; Clear All forgets it; and it dies with the tab AND with a
    reload, unlike Scale.
36. A Table or Period switch resets the filters to the new one's defaults and says which defaults in
    the same live region the pending-changes message uses — silently when the bar was already at its
    defaults, and cleared by the next Apply.

### Parity
36a. Both new routes render the Build at their own granularity, appear in the Finance rail under the
    same `MenuApp`, and are gated by the ARR privilege alone — one privilege opens all three Builds.
36b. A default view serialises to an empty query string on **each of the three** Periods, not just
    Annually; the Cumulative toggle exists on Quarterly and Monthly and serialises as
    `cumulative=1`/`0`; and `window=ttm` on either is ignored rather than errored (§7).
36c. The Software/Cloud Customers table shows **two historic quarters plus today** on Delayed QRR and
    **six historic months plus today** on Delayed MRR, and the whole Period on every other type. A
    Delayed ANNUALLY type has no such narrowing — the source's branch names quarterly and monthly
    only — so check all three rather than generalising from one.
36d. The Monthly Build draws thirteen columns at Years Back 1 and the Quarterly Build seven, matching
    the source column for column (§7). This is the check most likely to look like a bug in the port.
36e. Column HEADERS match: `2026 Q2` and `2026 September` on the Subscription Build, `As of 2026 Q2`
    and `As of 2026 September` on the two summaries, and the period still running named by its date
    on both. Check a Build and a summary side by side — the prefix differs by table (§7).
36f. **Cumulative changes the figures**, not just the address: with it on, every column of a year
    reads an opening balance at that year's previous 31 December, so each column is larger than the
    one before within a year and resets across the year boundary (§7).
36g. The leftmost column's y/y row agrees with the source on all three Periods — annual, previous
    quarter and previous month are three different comparisons (§7), so checking one says nothing
    about the others.
37. For one closed month, every figure on each ported screen matches the running MIS app, at both
    Scale settings, with filters at defaults and with a non-trivial applied filter set.

## 11. Unverified — questions for a live tenant

Worked over with the Choreo CLI on 2026-09-12: **item 2 is answered and closed**, item 1 is
substantially de-risked but not proven, and item 3 is confirmed still open. Item 5 is new, and is the
one that most changes the plan. The full record — production URLs, component states, probe results —
is in the gitignored `My Findings Finance MIS.md` at the repo root.

**Ticket 01 (the shell wiring) is built.** It did not close item 1 or 4 — neither can be closed by
code — but it *instruments* both: `/finance/mis/arr-build` now renders the raw `privileges` array
`GET /user-info` returned and what it resolved to, so one signed-in visit answers both at once. That
visit is the only thing standing between this spec and a settled premise. It needs
`http://localhost:3000` registered as an allowed redirect on the One WSO2 **staging** Asgardeo app,
or a live session at `https://one.wso2.com`.

1. **Can One WSO2's Asgardeo token reach the three MIS services at all?** They sit behind Choreo's
   gateway expecting `x-jwt-assertion` and enforce a WSO2 email-domain regex. Same tenant? Same
   Choreo project, or Project-scoped visibility? **Largely de-risked, not proven.** MIS and One WSO2
   are separate SPA clients in the *same* Asgardeo tenant (`api.asgardeo.io/t/wso2`); all three MIS
   endpoints declare Visibility **Public**; and MIS sits in Choreo project **Finance Web** — the same
   project as the OPD, CC and expense-claims backends One WSO2 already calls in production.
   Unauthenticated probes return `401` on all three, identical to those known-good backends, so DNS,
   TLS, gateway and paths are all correct and only the token is untested. **One authenticated call
   still settles it**, and One WSO2 is live at `https://one.wso2.com` to get a token from.
2. ~~**Are the three gateway hostnames under `*.wso2.com`?**~~ **ANSWERED, and the answer differs by
   environment.**

   *Production* is clean: all three are `https://apis.wso2.com/dvig/mis-{arr,flash,admin}-backend/endpoint-9090-803/`**`v1`**,
   inside the existing `connect-src` allowlist, matching all nine of One WSO2's own backend URLs.

   *Staging is not.* MIS's `Stage` config-map points ARR and Flash at
   `https://apis-stg.wso2.com/...` (fine) but Admin at the raw
   `https://<uuid>-az-stg.prod.wdt.choreoapis.dev/...` — **which the CSP blocks**. Configure One WSO2
   against staging with that URL and the comments calls fail silently in a production build, with no
   console error. Choreo advertises a `*.choreoapis.dev` URL for every endpoint alongside the vanity
   one; **always take the `*.wso2.com` form**, and treat a `choreoapis.dev` URL appearing in any
   config as a defect.

   Also note the paths disagree across environments: **production ends `/v1`, staging ends `/v1.0`**.
   That belongs in configuration, never in code.
3. **What are the real LDAP groups behind `987` and `789`?** `arrDashboardUserRoles` and
   `flashDashboardUserRoles` are `configurable string[] = ?` supplied from Choreo config. **Confirmed
   still open**: both are declared in the component's Ballerina schema but read "(not set)" there,
   because their values arrive from a *secret* file mount, and the Choreo CLI does not return secret
   contents. Read them from the Choreo console or via `scripts/mis-port-facts.sh` stage 5.
4. **Does `GET /user-info` return 200 with empty privileges for a non-MIS employee, or 403?** This
   decides whether the gate can show an honest locked state or must treat a denial as absence.
   **Probably 200-with-empty, on the source's evidence.** `arr-backend/service.bal:55-69` builds
   `int[] privileges = []` and pushes each number only if the caller's groups match, then returns the
   record unconditionally — there is no 403 branch on that path. The gate is therefore built for an
   honest locked state, and `useMisGate` distinguishes "no privileges" from "the call failed"
   regardless, so a 403 would surface as an error with a retry rather than a wrong message. Still
   worth confirming against the live gateway, which may answer before the service does.
5. **Is the Flash comments backend alive?** `mis-admin-backend` is deprecated and suspended in
   Production while the live MIS config still points at it (§2.5). Establish whether comments work in
   production today before porting them — and if they moved, to what.
6. **Which of the five screens is actually used, and by how many people?** It changes what the tracer
   bullet should prove first and what may not need porting at all.
7. **Who signs off the re-placed screens**, per [ADR 0002](../adr/0002-rethink-ia-rather-than-transcribe.md)?
8. **Is a minimum-width notice acceptable** in a shell that otherwise promises every screen works at
   every width, or should the Build degrade some other way below 1024px? The prototype's Variant C — one
   Period at a time, rendered vertically — worked at 400px with no horizontal scroll and is the
   candidate answer, at the cost of making period-over-period comparison impossible. It is kept on the
   prototype branch rather than discarded, for exactly this question.
9. **Per-screen control detail.** ~~The individual controls of the 1,823-line FilterBar~~ **and** the
   2,254-line ARR Analysis page need a line-by-line read before their sections in §2 are complete.
   **The FilterBar half is done** — read for ticket 09, and §2.1 now carries the ARR Build's control
   detail. The read produced three findings, all recorded rather than left in the code: the TTM Type
   list and the Years Back rule are in §7, and the two country/industry list quirks are in §8.

   What the read did **not** settle, because it is a question for Finance rather than for the source:
   whether the `billingCountries` list the backend sends was ever meant to be used (§8.5).

   ARR Analysis is still unread. Its section in §2.4 is routes and flags only.
10. ~~**Is `987` the only privilege number that collides?**~~ **ANSWERED, and no — `789` collides
    too.** Found while building ticket 01. MIS's Flash privilege `789` is also leave-app's
    `LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM` (`features/leave/api/leaveTypes.ts:58-63`), so *both* MIS
    numbers are already spoken for in this app. Recorded in `CONTEXT.md` under **Privilege**. It
    changes nothing in the design — the gate was always going to read MIS's own `/user-info` — but it
    removes the temptation to treat 987 as the single special case.
11. **Does the Region Type cut belong in the address bar?** Exit ARR by Region is cut by Sales Region
    or Sub Region, the backend computes it (`isSalesRegionSummary`), and the source keeps the toggle
    in the Region Summary's own component state — so it dies with the table, is not in the Applied
    set, and is in no link anyone holds. The port reproduces that, which means **a reader who shares
    a Sub Region view sends a Sales Region one**. Putting it in the query string is a one-parameter
    change here but an extension of the URL contract ticket 02 pinned — what an unrecognised value
    degrades to, whether it is suppressed on the other three Tables, what a stale link means — so it
    is a decision to take rather than a side effect of building the table. **The same question has now
    arrived again, and half of it is answered.** The Region Summary's `All ARR Metrics` view is
    component state here as it is in the source, so a shared link opens on Exit ARR whichever view the
    sender was reading; its BU pills are NOT, having been bound to the unit tabs and therefore to the
    address (§7). So the open half is two controls rather than three, and they are the same decision:
    whether a Region Summary link should carry the view and the cut it was shared from.

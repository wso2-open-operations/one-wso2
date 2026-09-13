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

### 2.2 QRR Build — `/finance/mis/qrr-build`

The same Build, quarterly, plus a Cumulative toggle Annually does not have. No TTM Window.

### 2.3 MRR Build — `/finance/mis/mrr-build`

The same Build, monthly, plus a Cumulative toggle. No TTM Window.

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
| `POST /arr-summary/region-metrics` | ARR | Region metrics. |
| `POST /exit-arr/search` | ARR | Exit ARR search. |
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
site, as everywhere else in this repo.

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
ranges; here a caller that supplies no computer gets no `annuallyDateRanges`.

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
**§10.31's parity check must expect this difference** and reconcile against Pacific-dated ranges
rather than against whatever the old frontend happens to render in Colombo.

The same correction reaches one more date, and it is worth naming because it is not a Period boundary.
The leftmost Build column has no column to its left, so its y/y rows are compared against **the same
range a year earlier**, which the source computes with `new Date(startDate)` — a UTC instant — and
then `setFullYear`, which operates in LOCAL time (`useArrTableSummary.js`). East of California that
lands a day early, so in Colombo the source compares the first column against a range one day short.
The port shifts the civil date instead. Same reasoning, same exception, same note for §10.31.

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

The port keeps the distinction where the source puts it. `pacificAnnualRanges` — the shared
`annualRangesFor` seam that fills `annuallyDateRanges` — stays faithful, so the tables in tickets 10
and 13 still get their six. `subscriptionColumnRanges` takes the last `yearsBack` of them for this
table. `getAnnualPeriods` itself is untouched; it is the function the source's own tests pin.
Nothing user-visible changes: Years Back 5 draws five Subscription columns in both apps.

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
18. An export taken while Scale is "Values in '000" is either exported in units, or carries the scale in
    the file. The prototype found this exact foot-gun in the DataGrid's CSV, which silently inherits the
    display formatter — a finance export that is 1000x off with nothing in it saying so.

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

### The filter bar
23. A control changed but not applied leaves the address alone, enables Apply, and says so in a live
    region; Apply then puts the whole view in the address and the bar reads clean again.
24. Choosing a value back at its default takes the parameter out of the address rather than pinning
    the default into it.
25. A control whose value would mean nothing is absent: the region list outside its own View, Forecast
    Type outside a Forecasted type, Years Back under a forecast, YTD on a trailing window.
26. Every filter with a control has a chip and vice versa — the two are driven by one rule, and the
    Delayed Build in §7 is the case that catches them drifting.
27. Dismissing a chip applies that one filter's default at once and leaves any other unapplied edit
    still pending.
28. The unit tabs, the Period control and the Scale toggle each take effect without an Apply; Clear All
    clears the filters and leaves the unit selection alone.
29. A TTM Build offers Delayed, carries it in the address, and survives a reload — the §7 deviation,
    stated as the test that would have caught the source's version.
30. With `GET /app-configs` failing, the written-down controls (Type, View, Years Back, YTD, Channel,
    Scale) all still work and the bar says which menus are missing.

### Parity
31. For one closed month, every figure on each ported screen matches the running MIS app, at both
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

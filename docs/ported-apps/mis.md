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
When off, the rail entry is absent and the route redirects to ARR Build.

The account table is the one screen that takes the community `DataGrid` — it is flat, sortable and
wants CSV, which is precisely the condition `LeaveReportsPage.tsx:315-318` documents. There are **two**
charts, both recharts rather than `@mui/x-charts`, and both with a companion table beneath them per
the house convention: the partner-model split, and ARR by industry.

> **Corrected by the read.** This paragraph said "the partner-model pie, and region and industry
> bars". There is no region chart in the source — `ArrAnalysisDashboard.js` renders exactly two, the
> partner-model `PieChart` (`:1863`) and the `ARR by Industry` `BarChart` (`:2034`), and Sales Region
> appears only as a filter — and neither of the two is drawn the way the sentence assumed. Ticket 14
> built the two that exist and the region bars are dropped: a new chart during the parallel period is
> one Finance cannot reconcile against the running app, and it is ADR 0002's kind of decision rather
> than a port's. §7 has the two form changes.

| Chart | Form | Colour |
|---|---|---|
| ARR by partner model | one horizontal proportion bar, Channel and Direct, direct-labelled | two categorical slots, fixed per model |
| ARR by industry | horizontal bars, six named industries and Other | ONE hue for every bar |

**Ten reads per filter change**, which is what the panel's debounce is for. One `POST /accounts`, one
`POST /exit-arr/search` for the headline, two more for the partner split (one when the reader has
already narrowed to a model), and **one per industry** over the six. See §7.

**The flag decides whether the screen EXISTS; the privilege decides who may read it**, and the two
refusals are deliberately different. Flag off is a fact about the app, so the route redirects and the
rail carries no entry. No ARR privilege is a fact about the reader, so a direct URL says so where they
are, like every other MIS URL. Which leaves the two states where the flag is not yet KNOWN — the call
in flight, or failed — able to be neither: a redirect there would bounce a bookmarked link on every
cold load, or relocate someone because of a gateway blip and tell them nothing. Both hold instead, on
`MisShell`'s prerequisite rung. `useMisGate` folds the flag into `canSee("mis-analysis")` so the rail
and the shell cannot forget it; the route reads it separately because one boolean cannot carry the
distinction above.

**The controls above the table** — settled by the line-by-line read of the source's 2,254-line
`arrAnalysis/ArrAnalysisDashboard.js` that §11.9 asked for. Ten of them, in one collapsible panel,
and unlike the Build's bar they **apply at once**:

| Control | Kind | Sends |
|---|---|---|
| Sales Region | multi-select | `salesRegions` |
| Sub Region | multi-select | `subRegions` |
| Country | multi-select | `billingCountries` — BILLING, unlike the Build's region cut (§7) |
| Business Units | multi-select over six written-down names | `businessUnits`, as wire codes |
| Lifetime | multi-select, 0–20 years | `customerLifetime`, as strings |
| Partner Type | single segment, with All | `partnerType` |
| First Sale | two segments, neither pressed meaning every account | `isFirstSale` true / false / absent |
| # Products In Use | multi segment, 1–5 with 4 meaning "4 or more" | `numberOfProductsInUse`, as numbers |
| ARR Range | two number fields | `arrRange.lowerBoundary` / `.upperBoundary` |
| As Of Date | date | `endDate`, and the span's `startDate` is derived from it |

No Apply, because nothing here reaches the address (§4 covers the Build screens only, and this screen
is component state in the source too — §11.12). The exception is the ARR Range's two number fields,
which commit on blur or Enter: a number field sets state per keystroke and each change here is two
reads. The source absorbs that with a 250ms debounce over *every* filter, which delays every
deliberate click to smooth over two text boxes.

**Two controls constrain each other.** Choosing more Business Units raises the lowest product count
worth offering — an account cannot run fewer distinct products than the units it has been narrowed to
— and a count already chosen that the new selection rules out is dropped rather than left as a pair
that can match nothing. And **Moesif and the API Platform BU cannot be asked for together**: Moesif's
ARR is already counted inside that BU, so the pair double-counts it. The panel refuses the second and
says why.

**Two figures sit above the table.** Total ARR, from `POST /exit-arr/search` — a year-to-date reading
rather than a balance, because the span it asks for opens at the end of the previous calendar year —
and the number of accounts, which is the row count rather than a figure from the backend. That is the
source's behaviour and there is no alternative: `fetchSummaryMetrics` asks for `logoCount` and
hard-codes the answer to `0` (§9).

### 2.5 Flash Dashboard — `/finance/mis/flash`

The monthly P&L flash: Revenue, Cost of Sales with sub-levels, Gross Profit, Gross Margin, and ARR and
Booking per business unit. **The only screen in MIS that writes.** Two write paths:

- **Comments** — create, edit and delete against the admin backend. ⚠ **Resolve before building
  this.** The Choreo component behind `ADMIN_API_URL` is named "MIS Admin Backend - DEPRECATED", its
  Production deployment is **suspended**, and its last commit is over two years old — yet the live MIS
  config still points at it. Either comments are already broken in production, or they have moved and
  the config is stale. Porting a feature against a dead backend would be the most expensive possible
  way to discover which.
- **Forecasts** (the tickets' "budget and forecast values" — one value, `CONTEXT.md`) — against the
  flash backend, rejected server-side after the monthly cutoff (§3). **Not inline on the P&L**,
  whatever this line said before ticket 16: a figure is a sum of GL accounts, and the only write the
  backend has is a forecast against ONE account, by its id (`PATCH` with `{id, value, comment}`). So,
  as in the source, a figure in a business unit's monthly view opens the **Account View** — the GL
  accounts behind it for that unit and month — and each account there has an Edit button opening a
  Value + Comment form. The figures that open one are
  Revenue's Recurring, Non-Recurring/PSO and Cloud lines, and Cost of Sales' sub-categories under
  Recurring, Non-Recurring/PSO and Public Cloud; never the WSO2 column. Edit is offered on the account
  views of one month only — see §3. Built as `MisFlashAccountsDialog` (ticket 16).

Excel export is a hand-built ExcelJS workbook, ported as pure functions (§7). The source's Export menu
is kept whole: **Full Report** (an Annual Summary sheet plus one monthly sheet per business unit) and
**Annual Report** (the Annual Summary alone), and a monthly view's own Export writes that unit's sheet.
Built in ticket 18, on ticket 11's builders — §7, "The Flash's Excel export".

## 3. Business rules

**The monthly editing cutoff.** Forecast edits — the tickets' "budget and forecast", which is one value
(`CONTEXT.md`) — are refused after the **15th of the month**.
The frontend does not pre-empt the cutoff; it surfaces the rejection. Port that behaviour exactly — a
client-side guess at the date would disagree with the server the moment its rule changes.

> **Corrected by ticket 16.** This said the cutoff was the flash backend's `dateCutoff`, configurable.
> That variable is declared (`flash-backend/modules/compute/utils.bal:10`) and **never read**. The
> check that applies is in the finance entity service the flash backend writes through:
> `isCutoffDatePassed()` refuses once the **UTC** day of the month exceeds `DATE_CUTOFF = 15`, a
> compile-time constant (`entity-service/modules/database/transaction.bal:408-418`,
> `constants.bal:21`) — so the 15th itself is allowed, and changing the rule is a redeploy of a
> different service. None of which changes what the port does, and all of which strengthens the
> reason not to copy it.

**Which month's forecasts can be written.** The source offers Edit on the account views of ONE month —
the one before the current one, by the viewer's LOCAL clock (`AccountViewTable.js:53-64`) — and the
port keeps the rule. It is a different rule from the cutoff: the server never checks the month (its
UPDATE is `WHERE id = ?`), but that month is the one its P&L reads forecasts for, so without the rule
the port would let Finance write forecasts into months the source has never let anyone touch. (The
entity service does carry a month check — `getIncomeRecordMonthByIdQuery` and its cost-of-sales twin,
`query_builder.bal:411-425`, and its cutoff message mentions "the past month" — but nothing calls
either query. A redeploy that wired them in would make the server enforce this rule as well, which
the port would then agree with rather than contradict.) **It is computed in UTC, the one
MIS month that is not Pacific**, because it is the server's month: the P&L's
`DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 1 MONTH, '%Y-%m')`, and the server's clock is the only one
that decides whether a write lands. A Pacific rule would offer the wrong month for the first seven or
eight hours of every month, while the server's day is the 1st and it accepts anything.
`util/misFlashForecastMonth.ts`.

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
| `GET`, `PATCH /income-accounts` | Flash | Revenue budget/forecast. **Write.** The GET lists the GL accounts behind one Revenue line (`accountCategory`, `businessUnit`, `month`); the PATCH writes one account's forecast, `{id, value, comment}`, and answers an empty 200. |
| `GET`, `PATCH /cost-of-sales-accounts` | Flash | Cost-of-sales budget/forecast. **Write.** The GET also REQUIRES `accountSubCategory`, which the source does not send — §7, §11.18. Every failure the service itself reports on either PATCH, the cutoff's included, arrives as a bare 500 with no body; a body that does not bind is a 400 and a bad token a 401, both before the service runs. |
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

**The Flash's two dialogs become one, and the P&L's own rows (ticket 15).** The source reaches its
sub-levels through a separate `MultiLevelViewDialog` opened from the Cost of Sales and Expense
headings, and reaches a business unit's monthly view through `MonthlyViewDialog` on each column
header — and the monthly view it opens depends on which of the two you came from, because the first
passes `isSubLevel: true` and the P&L passes `false`. Here the sub-levels are the collapsible rows
`BuildTable` already provides, so there is one monthly view rather than two and it asks the richer
question (`isSubLevel: true`, which is purely additive at the backend —
`balance_statement.bal:312-325` attaches `subLevel` to the Cost of Sales and Expense lines and
changes nothing else).

**Gross Margin renders `77.50` where the source renders `78 %` (ticket 15).** `DataTable.js:83-88`
does `` `${Math.round(params.value)} %` ``. The port routes every percentage through ticket 05's
`formatMisValue`, which gives two decimals and no unit marker — the same as the Build's own retention
rows, so this is a port-wide convention rather than a Flash decision. More precision than the source,
not a different figure, and the section heading plus the units caption carry the meaning. Worth
knowing for §10.37 because a reconciler diffing the two screens sees both a different rounding and a
different string on those rows; adding the marker would mean changing the shared formatter and every
Build percentage with it, which is a decision for after the parallel period.

**The Flash's month pickers are native inputs (ticket 15).** The source uses
`@mui/x-date-pickers`, which this repo does not ship; `<input type="month">` is the browser's own
picker, holds `yyyy-MM`, and never puts a month through a `Date` — which is most of §3's rule on this
screen. Same reasoning as the ag-Grid and DataGrid decisions above: a dependency is not added for one
control.

**The Flash shares the Scale preference rather than defaulting to thousands (ticket 15).**
`TableView.js` opens this one screen at `useState(true)` — thousands — where every other MIS screen
opens at units. The port carries the one cross-screen `ScalePreferenceContext` §4 settled, so
switching to the Flash does not switch units under the reader. The caption beside the table says
which magnitude is on screen either way.

**Routes.** `/finance-mis/*` becomes `/finance/mis/*`. Keeping the old prefix would break the shell:
`findPerspectiveByPath` matches with a bare `pathname.startsWith`, so `/finance-mis` resolves to the
`finance` perspective and renders the wrong rail.

**Browser title.** MIS drives sidebar label, app bar and browser title from one table. One WSO2 writes
`document.title` nowhere. A shared per-route title mechanism is added rather than a MIS-local one.

**Minimum width.** MIS shows a dismissible notice below 1024px. `AppShellLayout` deliberately makes
the main column shrinkable and there is no notice component. Resolved as a shared one — see §11.
The port compares the viewport against the TABLE'S OWN computed width rather than a fixed 1,024,
because the Build is not one width (§11.8). Dismissal persisting across visits is a **deviation**:
the source records only that the notice is dismissible, not whether the dismissal survives a
reload.

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

### The Opportunities dialog (ticket 10, reopened)

`GET /opportunities` was on ticket 13's checklist and belongs to the Build: its only caller in the
source is the Software/Cloud Customers table's row dialog. Three deviations, all from the same fact
— the port knows the clicked column's date, and the source has to go looking for it.

**The date is taken from the column, not recovered from its header.** The source reaches `endDate`
through two layers: `extractDateRangeFromColumn(params.column)` (`DataGrid.js:611`), and then, when
that comes back empty, `OpportunitiesDialog` runs two REGEXES over the column's rendered header text
— matching `as of 2025-06-30`, then `as of Jun 30, 2025`. Reading a date back out of a string the
component just printed is a round trip through the presentation layer, and it fails silently: no
match means no `endDate`, which means a 400 the dialog reports as its generic error. `BuildTable`
hands the cell's own `MisDateRange` to `onActivate`, so the port has the date structurally and none
of that is ported.

**Only a FIGURE cell opens it.** The source's `onCellClicked` tests nothing but the table type, so
clicking an account's name or its owner opens the dialog too — from a column that has no date, which
is one of the two paths the header-scraping exists to rescue. Here only a figure cell opens it,
because only a figure cell belongs to a Period. The Total row opens nothing, having no account.

**The failure says what went wrong.** `useOpportunities.js` reads `error?.message` off a value
`http.js:65` passes as a STRING, so it is always `undefined` and always falls through to
`'Failed to fetch data. Select an account under a date range to view opportunities.'` — a sentence
that blames the reader for a gateway timeout. The port surfaces the backend's own, as the drill-down
beside it does.

**Its twenty columns are flat**, where the source nests the figures under `Software` and `Cloud`
group headers. `BuildTable`'s groups are Periods and its sub-columns are shared across them, so two
groups of four and seven cannot be expressed; the drill-down dialog beside this one is flat for the
same reason. Nothing is lost that the headers do not carry — `API Platform Private Cloud + Bjira`
says which book it is without a group above it.

### ARR Analysis (ticket 13)

Five deviations, all from the line-by-line read. None of them moves a figure; three fix a control that
cannot do its job, one fixes a sort order, and one fixes what a reader is told about an export.

**Its four list menus are built four different ways, and two of them are broken. The port uses one
rule.** The source's:

| Menu | Source | Effect |
|---|---|---|
| Sales Region | a hard-coded `["APAC", "EMEA", "Americas", "North America"]`, else the loaded rows | ignores `salesRegions`, which `GET /app-configs` sends and the Build's own bar uses. The list carries both "Americas" and "North America", which is what a stopgap looks like |
| Sub Region | `appConfigs.subRegions`, else the loaded rows | correct |
| Country | `appConfigs.billingcountrys`, else the loaded rows | **that key is never on the response** — the backend declares `billingCountries` (`types.bal`, `MetaData`). The branch is dead, so the menu is ALWAYS the row scrape |
| Partner Type | `["Channel", "Direct"]` merged with the loaded rows | correct; the backend sends no list for it |

One rule here: the backend's list, else what the loaded accounts show. The scrape stays as the
fallback it was always meant to be — `GET /app-configs` failing must not leave every control on a
screenful of data unable to narrow it — and it accumulates across fetches rather than being rebuilt,
so a menu never narrows to the one value the reader just picked and traps them there. That last part
is the source's own `mergeUniqueOptions` behaviour, and it is the reason the Country menu is usable at
all despite the typo.

Fixing the key is not an ADR 0003 breach. That ADR protects behaviour someone chose and Finance
reconciles against; a menu built from a key the response has never carried is a typo, its effect is a
menu missing options rather than a figure reading differently, and no figure moves either way.

**It also answers §8.5.** That entry asks whether the `billingCountries` list the backend sends was
ever meant to be used. It was: ARR Analysis's Country control SENDS `billingCountries`, so that list
is exactly the menu that answers it. The Build's substitution still stands as reproduced — the two
screens filter on different fields, so they are entitled to different menus — but the list is no
longer discarded on the way past. `misFilterOptions` now shapes both.

**Lifetime sorts as a number.** `customerLifetime` is `string` on the wire and the source leaves the
column at the grid's default string type, so its Lifetime sorts lexicographically and "10 yrs" lands
above "2 yrs". A sort order is not a figure Finance reconciles, so ADR 0003 does not reach it.

**The count of narrowings can reach zero.** The source pushes a `Partner Type` tag unconditionally
and an `As of Date` tag whenever a date is set — which it is by default — so a screen narrowing
nothing reads "2 active" and offers "Clear all" with nothing to clear. A count that cannot reach zero
cannot answer the one question it is on the page for. Here a tag appears only for a control away from
its default, so the count IS the number of narrowings.

The chip also reads `3 filters` rather than the source's `3 active`. CONTEXT.md bans "active filter",
and **Applied filter** is no better on this screen — that term is defined as a filter serialised into
the query string, and nothing here is. Neither contested word fits, so the chip counts and says
nothing else.

**Its CSV carries figures a spreadsheet reads as numbers.** This is §10.18's criterion, met at the
same standard ticket 11 set for the workbook, and it took more than declining to add a formatter. The
DataGrid's CSV exporter takes each cell's `formattedValue` (`csvSerializer.js:24-44`), and a column
typed `number` arrives with `value.toLocaleString()` already fitted (`gridNumericColDef.js:12`). So
the money columns format in `renderCell` for the screen AND pin `valueFormatter` to the identity for
the file: the reader's Scale never reaches the export, and neither do the locale's thousands
separators, which turn a figure into text everywhere the separator is not a comma. The source's export
is in units and comma-grouped; this one is in units and plain.

**And the filter panel applies at once rather than on Apply** — see §2.4, which also carries the one
exception and why the source's 250ms debounce over every filter is not ported.

Two smaller consequences of the above, recorded so they are not discovered during §10.37:

- A `customerLifetime` the backend sends as something unparseable reads as `0 yrs` where the source
  renders the raw string. It follows from typing the column as a number; the wire type is `string`
  and the only values seen are integers.
- The CSV's Products in Use cell carries NORMALISED spacing — `IAM,Choreo` for a field reading
  `IAM, Choreo`. The cell is built from the parsed list rather than the raw field, so the chips on
  screen and the text in the file cannot disagree; taking the field raw would export an empty cell
  for an account whose products arrived as an array, which is the one shape the parse exists to
  survive.

**Product chips are Oxygen's outlined chips rather than the source's per-product colours.** The
source assigns each product a colour (`PRODUCT_STYLES`) used in both the chips and the charts. Not
carried: the colour vocabulary is ticket 14's to establish against the Oxygen theme, in light and
dark, and inventing a second one here would leave two to reconcile. ADR 0002.

### ARR Analysis, the charts (ticket 14)

Several deviations. Two are chart FORM — no figure moves, and the companion tables carry every
amount to the cent — and the rest are claims the source makes that the data does not support.

**The partner-model split is a proportion bar, not a two-slice pie.** The `dataviz` skill names a
2-slice pie outright as a thing not to draw, and routes part-to-whole to a stacked bar. Two segments
in a circle make a reader compare angles to answer a question one bar answers by length. It is also
the shape the source itself falls back to: when one model holds all the ARR its pie is replaced by
hand with a single labelled bar (`ArrAnalysisDashboard.js:1901-1929`), so this generalises a form the
screen already had rather than inventing one.

**The industry chart is horizontal, and every bar is one hue.** Horizontal because the categories
have long names — "Health Care and Social Assistance" does not fit under a vertical bar, which is
why the source ships a hand-rolled `wrapAxisLabel` that breaks them at sixteen characters. That is a
workaround for the axis being the wrong one. One hue because these are nominal categories and the
measure is magnitude: colouring each bar by its own value would double-encode what bar length already
shows, which the skill also names outright. One series also means no legend — the title names it.

**A zero and an absence are different answers, and there are THREE states rather than two.** `POST
/exit-arr/search` is asked once per industry, but only for industries `GET /app-configs` offers; the
rest are reported as `revenue: 0` with no request made (`arrAnalysisApi.js:266-299`). So a zero bar
in the source can mean any of:

| State | What it means | What the port draws |
|---|---|---|
| asked, answered `0` | this industry holds no ARR | a bar of no length, and a `0` in the table — the honest reading |
| never asked | this tenant does not track it | no bar; *"Not reported by this tenant"* |
| asked, read FAILED | we do not know | no bar; *"Didn't load"* |

(When EVERY industry answers zero — reachable by over-narrowing, an ARR Range no account falls in —
the chart says *"No industry figures in this view"* rather than drawing seven bars of no length, which
reads as a chart that failed. The partner chart beside it already said so in that case, and two
charts on one screen must not disagree about what an empty view looks like.)

The third is the one that is easy to miss, and the first version of this port missed it: carrying
"was it asked" separates the first two and leaves the third filed under whichever branch the
coercion happens to take — which was `0`, the very claim the distinction exists to refuse. Both
absent states must stay absent; only the sentence the reader gets differs.

**Other is withheld in either absent case.** It is the total less the six, so a six missing one of
its members hands that member's ARR to Other and overstates it. An un-asked industry and a failed
read do that equally.

The same three states reach the partner split, where the failure mode is worse because there are only
two bars. The source reports the side it did not ask about as `0`, which is right for a filtered view
and indistinguishable from a read that failed — and `isError` does not help, because one read
succeeding means the pair did not wholly fail. So a failed Channel read renders **Direct at 100%**: a
confident statement about a book half of which never answered. The port refuses to draw a split at
all when a model was asked and did not answer, and says so; a model that was never asked about still
leaves the survivor at a true 100%.

**A failing call costs one bar, not the whole breakdown.** The source's `Promise.allSettled` is over
its FOUR fetches (`ArrAnalysisDashboard.js:770-777`), so a chart failing while the table survives is
its behaviour and is kept. But INSIDE each breakdown it is `Promise.all`
(`arrAnalysisApi.js:254`, `:299`), so one failing industry read rejects the whole breakdown:
`setIndustryBreakdown([])` leaves all six reading as ZERO under an error banner. Six industries
silently worth nothing because one request fell over is the same false claim this screen is built to
refuse, one level up. Here the five that answered keep their figures and the one that did not says
so.

**A partner type that is neither Channel nor Direct asks for nothing.** The Partner Type menu offers
whatever the loaded accounts report, so a third value is reachable. The source still fires both calls
— and `buildBasePayload`'s `partnerType` is OVERRIDDEN by `"Channel"`/`"Direct"`
(`arrAnalysisApi.js:254-257`), so it draws the whole UNFILTERED Channel/Direct split beside a table
narrowed to that third type: two figures on one screen answering different questions. The port asks
for neither and says the split does not apply. Eight reads instead of ten, and one fewer way to
misread the screen.

**Industry shares are of the rows shown, not of the summary figure.** Identical whenever the six fit
inside the total — Other is exactly the difference — and different when they EXCEED it, because Other
floors at zero. Dividing by the summary figure there gave shares summing to 180%. The source divides
by its rows (`ArrAnalysisDashboard.js:878-882`) and so does this.

**What is ON a chart is never scaled; what is in its table always is.** The axis ticks and the
tooltips go through `misHeadlineAmount` — compact, in dollars, no Scale — because everything on a
chart is a **Headline** (CONTEXT.md), and the source states the same rule for cards and charts
together. The companion table below each chart goes through `formatMisValue` at the reader's Scale,
like every other table on the screen. So a chart reading `$1.2M` above a table row reading `1,234.57`
is the two surfaces doing their own jobs, not a disagreement: the chart is for the shape, the table
is for the figure. The one thing that would be a defect is a chart disagreeing with ITSELF, which is
why the tooltip takes the axis's formatter rather than the table's.

**The palette is computed, not chosen.** Both slots are documented steps from the `dataviz`
reference palette, run through its validator against THIS app's surfaces (`#FFFFFF` and `#141417`
from `brandTheme.ts`) rather than the skill's, and passing every check in both modes. The values and
the commands to re-run live in `src/components/charts/chartPalette.ts`. Colour is assigned by ENTITY
— Channel is always slot 1 whichever model is larger — so two screenshots stay comparable.

**And the debounce comes back.** Ticket 13 dropped the source's 250ms debounce on the reasoning that
the table was two reads and delaying every deliberate click to smooth over two number fields was the
wrong trade. These charts make it ten reads per filter change, so a reader stepping through four
Sales Regions would fire forty. Reinstated in ONE place, over the filter state, so all four reads
move together — staggering them would leave the table and the charts above it briefly answering
different questions.

### A rule the source states and this port makes structural (ticket 13)

Not a deviation — the opposite. `ArrAnalysisDashboard.js:695` carries one line above its grid
formatter: *"Grid amounts follow the shared Scale and drop cents; **cards and charts keep the full
currency format**."* So the source's headline card is `compactCurrencyFormatter` — `$63.3M`, compact,
in dollars, and **never scaled** — while every grid cell below it follows the reader's Scale.

That division is right, and it is worth saying why so ticket 14 keeps it. A grid is a working
surface: Scale is the reader narrowing a wall of figures to the magnitude they are thinking in, and
every column sits under one caption saying which. A card is a single number, read at a glance, first
on the screen and the thing quoted out of it — so a headline that silently divides by a thousand
because of a toggle further down the page is §10.18's foot-gun with no file involved.

In the source the rule is a comment. Here it is `misHeadlineAmount`, which has **no `scale`
parameter at all** — the same enforcement `misBuildSheet` uses for the export, and for the same
reason: there is no argument a call site could pass to break it, so none can. Charts take it too.

The rule is not "Scale is ignored above the table". The account count beside the card DOES go
through `formatMisValue` with the reader's live Scale, and is unaffected because the formatter reads
Scale in the currency branch and nowhere else — §3's "Scale never scales counts", exercised on screen
rather than only asserted.

### Flash budget and forecast editing (ticket 16)

**Cost of Sales account views ask for the sub-category by the name the backend declares.** The flash
backend renamed its required parameter `expenseType` → `accountSubCategory` on 2023-11-20
(`ec5cfa857`, `service.bal:95-96`), and the source's `MonthlyViewTable.js:440-445` still sends
`expenseType` — so a Ballerina resource missing a required query parameter answers its Cost of Sales
account view with a 400, and Cost of Sales forecasts have, on the evidence, not been writable from the
source since. (It also double-encodes: `encodeURI` over a query `URLSearchParams` has already encoded
turns `Infra/IT`'s `%2F` into `%252F`.) The port sends `accountSubCategory`, encoded once. The two apps
cannot disagree about a figure because of it — both read the same P&L, which the forecast feeds — so
ADR 0003 does not reach it; what differs is that one of them can write. **Unverified against a live
tenant**, §11.18.

**Expense sub-levels open nothing.** The source opens an account view on the Expense section's
sub-levels too, against `/cost-of-sales-accounts` with an Expense category — the cost-of-sales table,
searched for accounts it does not hold, and refused with the same 400 besides. The flash backend's
only writes are the income and cost-of-sales books, which is this ticket's scope.

**Which lines open an account view is decided by NAME**, where the source reads position (`obj.id ===
"2"` is Recurring). A renamed or reordered line then stops opening anything, rather than opening some
other category's accounts under this one's figure. The one positional rule kept is the source's own
for a sub-level's heading, `id === "1"`: under Public Cloud the heading and a sub-category are both
called "Public Cloud". `flashDetailRows`' `accountsBehind`.

**The refused edit stays in the form.** The source shuts its form on submit and reports a refusal in
a snackbar — *"Error occurred when updating the account! This may be due to the Cutoff date (15th) is
already passed…"* (`Config.js:112-113`), which names a day the server has never said and states a
guess as the cause. Here the form stays open with what was typed and says *"Not saved — the Flash
backend refused the change (HTTP 500). It refuses every edit after the monthly cutoff, and doesn't
say which refusal this was."* That is all the 500 establishes: the flash backend turns every failure
of its own into one (`service.bal:139-143`, `:154-158`). A refusal with any other status — a 400 for
a body that does not bind, a 401 from the interceptor — is not called a possible cutoff, and reads
`Not saved — <the backend's or gateway's message>`.

**After a save, the P&L refreshes too.** The source re-reads the account list at once, the monthly
view when the account view is shut, and the P&L not at all until the next Search. Here all three are
re-read as soon as the server has taken the write — and nothing is written into any of them first
(§10.16).

**The editable month is the server's, in UTC, and January has one.** The source's rule (§3) reads the
viewer's local month and compares the year as well, so in January — whose month before is last
December — it offers no Edit at all, although the server takes December's forecasts on 1–15 January
like any other month's. The port offers December, and computes the month on the server's UTC clock,
read when an Account View opens (`util/misFlashForecastMonth.ts`). From Colombo the two rules differ
only between 18:30 UTC on the last day of a month and midnight, when the server refuses everything
anyway; from California a Pacific or local rule would offer the wrong month for the first seven or
eight hours of every month, while the server accepts writes.

**Four smaller ones in the account view.** A forecast nobody has written is blank, where the source
prints `$0.00` (`Number(null)`) — a forecast of nought and no forecast are different things to the P&L,
which uses the forecast only in place of a missing amount. The form opens pre-filled and sends as soon
as the value is a number, where the source seeds its Update button from a field the record does not
have (`mis_updated_value`), so changing only the comment meant retyping the value. The source's ID
column, a database key, is not carried over. And the title names the sub-category and the month as
its column is headed — *"Account View — Recurring Revenue COS › Infra/IT of Integration for Aug
2026"* — where the source's is *"<category> of <BU_LIST name> for yyyy-MM"* and names no
sub-category, so two Cost of Sales lines' views were titled alike (`MonthlyViewTable.js:388`,
`:446`).

**The account view is in units, whatever the Scale.** The form takes units — the PATCH's `value` is
dollars — and a list in thousands beside it invites a forecast a thousand times off. The source's
account view ignores its thousands toggle too. The one MIS grid that does not follow Scale; recorded
in `CONTEXT.md`.

### The Flash's Excel export (ticket 18)

The source's three exports are all kept — its Export menu's **Full Report** and **Annual Report**, and
the monthly view's **Export** — and so is the workbook's shape: an "Annual Summary" sheet, one sheet
per business unit, the titles word for word (sub-regions and range included), "Generated on", the
title sizes, the merged title rows and the header colours. Every sheet is a `misBuildSheet`
(`export/misFlashWorkbook.ts`); nothing is a second implementation. Ticket 18 found the builders one
case short — given `subColumns: []`, the shape of every Flash table, `misBuildSheet` wrote no figure
column at all — and fixed them rather than forking, as the ticket required. It also added the three
fields ticket 11 listed as additive (a row's `fontSize`, a cell's `fill`, a sheet's `merges`), and a
`heading` and `headerFill` on `misBuildSheet`, so the builder that knows the sheet's width is the one
that merges across it.

What the file contains is decided differently from the source's, and six things follow. All are
**knowing exceptions to [ADR 0003](../adr/0003-bug-for-bug-parity-during-the-parallel-period.md)**
of the kind ticket 11 took — a file's layout and a cell's type, not a figure on a screen.

- **The rows are the screen's.** Each sheet is built from the tree its screen draws (`flashPnlRows`,
  `flashDetailRows`) — its sections, order and labels, and the P&L's business units in the screen's
  order — read through the SAME raw-figure function the screen's cell calls (`flashPnlFigure`,
  `flashDetailFigure`). The source's sheets were written from a third list of their own, and it had
  drifted, which is the defect this fixes by construction:
  - `generateMonthlySheet.js` reads Revenue from `bu.financialAccountStatistics`, and both of its
    callers pass `financialStatistics` — so **no monthly sheet the source has ever written contains
    Revenue**;
  - it heads the `otherIncome` figures "Other Expenses", and never writes `otherExpenses` at all;
  - the monthly view's export hands it no Other Income, Other Expenses, Net Other Income or Net
    Profit/Loss, so those four are absent from that file entirely.

  The cost is that the file no longer matches today's layout where the source's own screen and file
  disagree: the Annual Summary's units run Integration, IAM, APIM, Choreo, Corporate, WSO2 as the
  screen does (the source's file puts Corporate fourth), the label column is headed "Line" rather
  than "Title", the monthly sheets carry the dialog's section order and labels ("Expense",
  "Stock Compensation/Gratuity"), and the sheet for the WSO2 column is named "WSO2" rather than the
  source's `BU_LIST` name "All". A colour stays with its unit rather than its position. §11.19 asks
  whether anything downstream reads the file by position.
- **Every figure is a number**, as in the Build's export — the source writes `formatNumber(value)`,
  text, into every cell.
- **Every percentage is Excel's own.** Gross Margin — the backend's `HUNDRED_PERCENT * (rev − cos) /
  rev`, so 77.5 means 77.5% — goes in as 0.775 under `0.00%` and shows "77.50%". The source's file
  carried the text "77.50". The rule lives in `misBuildSheet`'s `figureCell`, keyed on the kind of
  number, so it **reaches the Build's percentage rows too** (Net Dollar Retention, y/y growth, the %
  rows): ticket 11 had written those as a bare 98.25 under money's format. One rule, chosen so that a
  formula multiplying by the cell is right; `MIS_NUMBER_FORMATS.PERCENTAGE` says why.
- **A monthly sheet has the dialog's twelve months**, not the thirteen fetched. The source's sheet
  writes all thirteen, and the oldest lies outside the P&L's own range (§8, "What a Flash detail
  column asks for"); the dialog does not draw it either.
- **The order of the sheets is fixed.** The source collects the Full Report's six answers in the order
  they RESOLVE (`results[bu] = …` inside `.then`), so within each batch of three its sheets can come
  out in a different order from one export to the next — and its filename is taken from whichever unit's sheet was written last,
  because `downloadExcel.js` overwrites `reportTitle` per sheet. Here the sheets follow the screen's
  columns, and the name is the report and the day: `flash_full_report_2026-09-23.xlsx`,
  `flash_annual_report_…`, `flash_monthly_iam_…`.
- **Dates are Pacific.** "Generated on" and the filename share `misExportDate`, where the source
  writes a local `toLocaleDateString()` inside. The range in each title is written as the screen
  writes it — the P&L's status line, and the dialog's span — rather than as a third description of
  the same range.

**The Full Report fails whole, and says so.** The source's never finishes at all: each read is
wrapped as `new Promise((res) => handleRequest(url, "POST", body, res))` with no failure callback,
and `useHttp`'s `handleRequest` calls only the callbacks it is given (`utils/http.js:61-72`) — so one
failed read leaves its promise unsettled, `Promise.all` waits on it for good, and the `finally` that
lowers the full-screen "Preparing download... This may take a few minutes" backdrop (`zIndex: 9999`)
never runs. No file, and a screen that has to be reloaded. (Its `results[bu] = { error: true }`
branch, which reads like dropping a failed unit, is reached only when both answers are falsy, and
`handleRequest` answers `{}` rather than nothing.) Here any failed read, after the one retry every
Flash read gets, fails the export and the reader is told ("Couldn't write the file."); the button is
usable again at once. Writing the rest instead — a workbook read as complete with a unit missing —
would be the believed-but-wrong kind of export §10.18 exists for. The six
units are read three at a time, as the source reads them (`CONCURRENCY_LIMIT`), and through the query
cache under the dialog's own keys (`api/flashDetailQueries.ts`), so a unit whose dialog was opened is
not asked for again.

**The Full Report narrows every unit**, and that is reproduced — §8.

## 8. Source behaviour reproduced deliberately, though it looks wrong

Kept because the two apps run side by side during the parallel period and must agree.

1. **The cutoff is not pre-empted client-side.** The edit is attempted and the server's rejection is
   surfaced, even though the date is knowable locally. Ticket 16: Edit is offered on the right
   month's account views on every day of that month, and nothing in `MisFlashAccountsDialog` reads
   the date — pinned by a test run on the 22nd. What IS kept from the source is its other date rule,
   which month is editable (§3); that one the server does not apply, and the port has to.
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

### The Flash's date range depends on which picker the reader moved (ticket 15)

**The date each end of the range sends depends on whether THAT PICKER was moved — decided per
picker, not per Search.** `FlashConsole.js`'s mount seeds `startMonthFilter` and `endMonthFilter`
with first-of-month strings. `DateFilter.js` calls `onDateChange` from its two change handlers and
**from nowhere else**, and each writes the LAST day of the month it was handed into its own half of
the pair. `handleFilter` then sends whatever the two hold, unmodified. So one screen has several
paths and only some of them agree:

| How the screen got there | What it asks for |
|---|---|
| First load | the **first** of each month, `[M-12, M0]` |
| Search, neither picker moved | **exactly what the load asked** — nothing rewrote either half |
| Search, only Start moved | the **last** of the chosen month, and the **first** of the end month |
| Search, only End moved | the **first** of the start month, and the **last** of the chosen one |
| Search, both moved | the **last** of each |
| Reset | the **last** of each, `[M-13, M-1]` — `handleReset` writes both halves itself |

So Search on a freshly loaded screen changes nothing, moving one picker converts only that end, and
Reset does not restore the view the reader arrived on: it goes back a further month (its two
`setDate(0)` calls land on the day BEFORE the first of a month) and writes two month ends.

All of it is reproduced under
[ADR 0003](../adr/0003-bug-for-bug-parity-during-the-parallel-period.md): Finance reconciles the two
apps path by path, and a port that asked one question where the source asks several would disagree
with it on most of them. `FlashMonthFilter` in `util/misFlashPeriods.ts` is what makes the
distinction expressible — it carries the month a picker SHOWS beside the date that end SENDS, which
are two facts rather than one.

The monthly ranges behind the detail views are unaffected, and that is worth stating because it looks
as though they would be: `getMonthlyRangeObject` derives them from those date strings but reads only
the MONTH off each, so first-of-month and last-of-month produce the same list. The port takes the
months directly rather than re-deriving them, which says so.

### Five of the Flash's six monthly views ignore the sub-region filter (ticket 15)

`DataTable.js` hands the Integration column's `MonthlyViewDialog` the prop `subRegions={subRegions}`
(`:175`) and hands the other five **`subregions=`**, with a lower-case r — `:226` (IAM), `:251`
(APIM), `:276` (Choreo), `:301` (Corporate), `:326` (WSO2). `MonthlyViewDialog` destructures
`subRegions = []` (`:55`), so for those five the prop is `undefined`, the default empty list reaches
the request body, and the reader's sub-region selection is silently dropped.

So with a sub-region applied, a narrowed P&L opens an **unnarrowed** monthly view on five of its six
columns — fourteen sections across twelve months, all company-wide, under a screen that says it is
filtered.

**Reproduced**, because this is a figures disagreement and therefore squarely
[ADR 0003](../adr/0003-bug-for-bug-parity-during-the-parallel-period.md)'s subject: correcting it
would make the port and the source disagree on five of six units for every figure in the dialog,
which is precisely what the parallel period exists to prevent. Carried as
`FlashUnitColumn.sendsSubRegions`, true for Integration alone, and pinned by tests in
`flashPnlRows.test.ts` and `MisFlashPage.test.tsx` — a typo is exactly the kind of reproduction a
later reader would "fix" without one. See §11.16.

**The Full Report does not have the typo** (ticket 18). `fetchMonthlySummary` builds its six bodies
from the page's own `subRegion` state, so all six units' monthly sheets ARE narrowed — and so, with a
sub-region applied, five of the Full Report's six monthly sheets differ from what those units' own
dialogs show, in the source and therefore in the port. Reproduced for the same reason as the typo: it
is what the source's file contains. Each sheet's title names the sub-regions its reads were sent, so
the two can be told apart. A monthly view's own Export writes what its dialog shows, typo included.

### What a Flash detail column asks for, and the month ticket 15 got wrong (tickets 15, 16)

**The flash backend reads one range two ways**, and the dates a monthly range sends decide which
month's figures come back:

- **Every financial account** — Revenue, Cost of Sales and everything below them — is summed over
  `month > SUBSTRING(startDate, 1, 7) AND month <= SUBSTRING(endDate, 1, 7)`
  (`entity-service/modules/database/transaction.bal`, in every group search). So a range is its **end
  month** and never its start: `2026-09-01 → 2026-10-01` is October.
- **ARR** reads the two dates as instants — opening at the start, closing at the end
  (`flash-backend/modules/compute/arr_bookings.bal:258-275`). Booking is computed from the sales
  entity service, which is not in this tree; that it reads the dates the same way is unverified.

The source builds its ranges from local midnights (`getMonthlyRangeObject`) and heads each column
from `period.endDate` (`MonthlyViewTable.js`'s `formatHeader`), so what a column holds depends on
where it was opened:

| Opened from | Sent for the column headed Sep 2026 | Financial accounts | ARR |
|---|---|---|---|
| Colombo (UTC+5:30) | `2026-08-31 → 2026-09-30` | September | September |
| UTC, California | `2026-08-01 → 2026-09-01` | September | **August** |
| Ticket 15's port | `2026-09-01 → 2026-10-01` | **October** | September |
| This port, since ticket 16 | `2026-08-31 → 2026-09-30` | September | September |

**Ticket 15 read the backend the wrong way round.** It took `[first of M, first of M+1]` to be month M,
recorded the source's `endDate` header as a defect ("September's figures are headed Oct 2025"), and
headed each column by its start instead — which put every financial-account figure in the detail view
one month late under its own header. The source's header was right for the financial accounts in every
zone. Found by ticket 16, whose account view has to name the month a figure covers, and fixed before
it: month M now sends `[last of M−1, last of M]`, the Colombo row, from every zone — the one pair both
halves of the backend read as M. Integer arithmetic on `{year, month}` (`flashMonthlyRanges`), never a
`Date`, which is §3 and §10.8's rule and the only way to send one answer from every zone.

What is **not** reproduced, then, is the zone: from UTC or California the source puts August's ARR
under September. That stays a correction rather than an ADR 0003 reproduction, because a column of
figures under the wrong month is the two apps describing different periods while appearing to describe
the same one — not a disagreement a reconciler could settle. Colombo is where Finance works, and there
the two apps now send an identical body for any given month's column.

**Which months the view opens on is a different question, and still open** — see §11.17. On a first
load from Colombo the source's detail view spans a month earlier than the port's, because its load
range does; once a picker has been moved, or Reset pressed, the two agree.

### An account view ignores the sub-region filter (ticket 16)

Neither account GET takes sub-regions (`service.bal:95-96`, `:117`), so on a narrowed P&L the accounts
listed behind a figure are the whole unit's, and need not add up to the figure they were opened from.
On five of the six units that is already true of the figure itself (§8, the lower-case `subregions=`),
and on Integration it is not. Reproduced by construction — there is no parameter to send — and worth
knowing before anyone reports it as a port defect.

### The Flash's Sub Region chips cannot be cleared (ticket 15)

`SubRegionFilter.js` holds the EXPANDED sub-region list as its state and derives which region chips
are showing from it — a region counts as picked when every one of its sub-regions is in the list. Its
chip delete then removes ONE STRING from that list, the region's own name: deleting the `EU` chip
removes a sub-region literally called `"EU"` and leaves `"EU : EU 1"`, `"EU : EU 2"` and `"EU : EU 3"`
filtering the P&L, with the chip still on screen.

The port holds the REGIONS as its state and expands them on the way into the request, so every
selection a reader can reach sends exactly what the source sends and the states its broken delete
could reach are not reachable. A **deviation** rather than a reproduction, on the same reading as
above: this is a filter that cannot be cleared, not a figure the two apps disagree about.

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

**The oldest monthly range, on the Flash's detail views.** The screen asks for THIRTEEN months and
draws twelve: `MonthlyViewTable.js` declares numeric columns `"1"` through `"12"`, each reading
`summary[<its own field>]`, so `summary[0]` is fetched on every open and rendered by nothing. Its tab
label agrees, spanning `dateRangeArr[1]` to the last range.

The port keeps the distinction where the source puts it. The range is still REQUESTED — the backend
walks the list it is given in order and a month's opening figures are the previous month's closing
ones, so dropping it from the body could change the figures in the columns that ARE drawn, and
ADR 0001 does not second-guess what a backend does with a request. `flashDetailColumns` is what takes
the last twelve, and it carries each column's index into the response so a figure cannot shift by a
month. The same shape as the sixth Annual Period above.

**`integrationCloud`, on the Flash's P&L.** `DataTable.js:183-207` carries a complete column
definition for it, commented out, and `BusinessUnitSummary` has no such field for it to read. Not
ported — the six columns in `FLASH_UNIT_COLUMNS` are the six the backend sends.

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

**The Opportunities dialog's `startDate` is accepted and never sent.** `useOpportunities.js:21`
takes it, documents it as "(Deprecated/ignored)", and never puts it on the URL; the backend resource
declares `accountId` and `endDate` only (`arr-backend/service.bal:129`). The port takes the two that
exist.

**ARR Analysis asks for two figures it throws away.** `fetchSummaryMetrics` reads
`POST /exit-arr/search`, which answers with a bare `decimal`, and returns
`{ arrAsOfToday, yoyGrowth: 0, logoCount: 0 }` — both zeros hard-coded (`arrAnalysisApi.js:197-210`).
Nothing recovers them later: the screen's Logo Count card reads `accountsRows.length` instead, and no
year-on-year figure is shown anywhere. So the port reads the one figure the call actually carries. The
account count is the row count in both apps, which is also the only true answer available.

**Four fields on every ARR Analysis row are built and never read.** `toDashboardRows`
(`ArrAnalysisDashboard.js:345-368`) writes `accountId`, `businessUnits`, `industry` and
`activationDate` onto each row; no column definition reads any of them, and neither does the filter-
option scrape, which reads only `partnerType`, `region`, `subRegion` and `country`. `businessUnits`
is not even a field of `AccountDetails`, so the source's branch always yields `[]`. Not ported.

**Its Sub Region falls back through two keys that do not exist.**
`a.subRegions || a.salesSubRegions || a.subRegion` — `AccountDetails` declares `subRegion` alone, so
the first two branches are dead. Ported as the one real field.

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
    unchanged. **Ticket 16:** `MisFlashAccountsDialog.test.tsx`, "when the server refuses the edit".
16. A failed PATCH does not leave an optimistic value on screen. **Ticket 16:** the same file, and
    `useFlashAccounts.test.tsx` for the cache — nothing is ever written into it by hand, so a refusal
    has nothing to roll back.

### Excel
17. The generated workbook loads back via `wb.xlsx.load` with the expected sheet names, cell values and
    number formats. Nothing else in this repo asserts workbook formatting; this test is the only guard.
    **Closed by ticket 11** (`misWorkbook.test.ts`), and deliberately asserted on the FILE rather than
    on the spec that produced it: a spec is the builders' own vocabulary and a test over it would agree
    with them by construction, where the bytes are what Finance opens. **Extended by ticket 18** to the
    Flash's workbook (`misFlashWorkbook.test.ts`): sheet names, titles, merges, header fills, and a
    Gross Margin read back as 0.775 under `0.00%`.
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
    **Asked again by ticket 18 at the Flash's three call sites**, for the same reason: the P&L's Annual
    Summary, the Full Report's monthly sheets, and a monthly view's own Export each read through their
    screen's raw-figure function, and each is exported with the screen at `'000` and the cell holding
    the unscaled figure (`MisFlashPage.test.tsx`, `MisFlashDetailDialog.test.tsx`).

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

### The Opportunities dialog
22a. Clicking a FIGURE cell on Software/Cloud Customers opens the opportunities for that account as
    at that column's closing date, and the date on the wire is the column's own rather than one
    parsed from its header. **Closed by ticket 10 (reopened)** — asserted on the request.
22b. Clicking an identity cell opens nothing, and the Total row opens nothing. The second is enforced
    by the Total row having no account rather than by a name check, so it is pinned as behaviour.
    **Closed by ticket 10 (reopened).**
22c. A failed read shows the backend's message and a retry, not "Select an account under a date
    range to view opportunities". **Closed by ticket 10 (reopened).**
22d. The two totals agree with the columns beside them: the backend's aggregate when it sent a
    positive one, the components added otherwise. **Closed by ticket 10 (reopened)** — the source's
    rule, reproduced including its `> 0` quirk, which is harmless because both branches give zero
    where it fires.

### The narrow viewport
22e. When the table needs more width than the viewport has, the Build shows a notice saying so —
    **and still renders the table**, every figure reachable by horizontal scroll with the label
    column pinned. The comparison is against the table's own computed width, not a fixed 1,024:
    a BU Summary at `?years=1` is 380px and says nothing on a 400px phone, while Software/Cloud
    Customers at 8,170px says so on a 1,280px laptop.
    The second half is the decision; a notice that replaced the table would be Variant C, which
    §11.8 rejected. **Closed by ticket 08.**
22f. The notice is dismissible, stays dismissed across a remount, and stays dismissed after the
    viewport has been wide again. **Closed by ticket 08.**
22g. The dismissal is remembered once per READER rather than per table — what they have understood
    is "wide tables here scroll", which is not a fact about one table — and it survives a
    `localStorage` that throws: a private window with site data blocked shows it and dismisses for
    that visit.
    **Closed by ticket 08.**

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

### ARR Analysis
35a. With `productsUsageEnabled` **false**, the rail carries no ARR Analysis entry and
    `/finance/mis/analysis` redirects to ARR Build — for a reader holding the ARR privilege and for
    one holding neither, because the flag is a fact about the app rather than about the reader.
    **Closed by ticket 13** (`misRail.test.tsx`, `MisArrAnalysisPage.test.tsx`).
35b. With the flag **true** and no ARR privilege, the same URL renders the locked panel rather than
    redirecting — and the flag alone does not open it for a Flash-only reader. **Closed by ticket 13.**
35c. While `GET /app-configs` is in flight, or after it has failed, the route does NEITHER: it holds,
    then offers a retry. The distinction is the point — a flag that is false and a flag that is
    unknown are different answers, and only the first is a fact to act on. **Closed by ticket 13.**
    The state most likely to regress is the cold load, where a gate folding the flag in reports "not
    permitted" for a reader who is about to be let in.
35d. The account table's **CSV** carries every figure in units and in plain digits, at either Scale —
    §10.18's criterion for this screen. **Closed by ticket 13**, asserted on the bytes the grid's own
    exporter produces rather than on the column definitions, because the column type supplies a
    formatter nobody asked for and "we added none" is not the same claim.
35e. The whole book renders and pages without the grid throwing. The community tier throws outright
    above `pageSize` 100 rather than degrading, so this is a crash rather than a layout problem.
    Partly closed by ticket 13 (a hundred accounts, in jsdom); the real volume needs a live tenant,
    like §10.22.
35f. Choosing a second Business Unit while "1 product in use" is pressed drops the count rather than
    leaving a pair that matches nothing, and Moesif beside the API Platform BU is refused with a
    reason. **Closed by ticket 13.**
35g. With `GET /app-configs` failing, the Sales Region, Sub Region and Country menus still offer what
    the loaded accounts show, and every written-down control still works. **Closed by ticket 13** at
    the menu-resolution seam; the panel's own warning is asserted too.
35h. Every figure on the screen and in its CSV agrees with the running app for one closed month —
    this is §10.37's scope, listed here so the ARR Analysis half is not assumed to be covered by the
    Build's.
35i. **A chart states nothing it was not told.** An industry `GET /app-configs` does not offer gets no
    bar, an em dash in its companion table, and a line naming it — not a zero bar. **Other** is
    suppressed in the same case, and so are all the shares when the summary read failed. **Closed by
    ticket 14.** This is the one the source cannot pass: it reports an un-asked industry as `0` and
    draws it.
35j. Both charts' companion tables carry the amounts at the reader's Scale and the shares NOT scaled,
    at either setting. **Closed by ticket 14** — §3's rule reaches a chart's table the same way it
    reaches a grid cell.
35k. The palette passes the `dataviz` validator in BOTH modes against this app's own surfaces, and a
    change to any slot re-runs it. Commands are in `chartPalette.ts`. Colour is by entity, so a view
    where Direct overtakes Channel repaints neither.
35l. A burst of filter changes fires ONE round of reads, not one per change — the debounce. **Closed
    by ticket 14** at the hook seam; what is not pinned is the ten-read round itself against a live
    gateway (§11.14).

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
8. ~~**Is a minimum-width notice acceptable** in a shell that otherwise promises every screen works
   at every width, or should the Build degrade some other way below 1024px?~~ **ANSWERED: the notice,
   and the table still renders.** Decided in ticket 08 and built as
   `components/wide-table-notice/WideTableNotice.tsx`, shared rather than MIS-local.

   **What settled it was measuring the real tables rather than the prototype's seven fake
   customers.** Variant C — one Period at a time, rendered vertically — answers for ONE of the four:

   | Table | Natural width | Variant C, at one Period |
   |---|---|---|
   | Subscription Build | 1,138px (288 label + 5 × 170) | 458px — fits |
   | Software/Cloud Customers | 8,170px BU-only, 11,920px split | 3,970px — does not |

   The customers table carries **2,920px of identity columns before a single figure** — seventeen of
   them, and eighteen on a Delayed type, where a 200px Delayed Day Count is spread in — then seven or
   twelve sub-columns per Period at 150px each. Its width is per-Period BREADTH, not Period count, so
   the mechanism that rescues the Build does nothing for it. Shipping Variant C would mean two mechanisms on one
   screen, with period-over-period comparison vanishing on one tab and not the others — an
   inconsistency a reader would rightly report as a bug.

   So: one notice, above whichever table is showing, and **the table still renders and still
   scrolls** with its label column pinned. The tension this ticket named is not papered over — the
   shell does promise every screen works at every width, and this is an admission that the Build does
   not do so comfortably. It is true, and a reader told the truth can act on it. Dismissible, and
   remembered app-wide: what they have understood is "wide tables here scroll", which is not a fact
   about one table.

   **It compares the viewport against the table's OWN width**, which `tableMinWidth` COMPUTES from
   the column model rather than measuring off the DOM — so no layout is involved and jsdom models it
   exactly. A fixed 1,024px threshold was the first attempt and was wrong, because **the Build is not
   one width**: this same page serves QRR and MRR, where Years Back defaults to 1 and the table can
   be 1,648px or 2,498px, while Software/Cloud Customers is 8,170px and a BU Summary at `?years=1` is
   380px. A fixed threshold told a reader on a 400px screen that a 380px table was "wider than your
   screen", which is false, and said nothing at 1,100px about a table needing 8,170px.

   It therefore lives in `BuildTable` rather than on the page: that is the only place the required
   width exists, and a page mounting it itself also showed it above the loading skeleton, the error
   and the empty state — none of which is a table wider than the screen.

   Dismissal being remembered across visits is a **deviation** rather than established parity: §7
   records only that the source shows a dismissible notice below 1024px, not whether its dismissal
   survives a reload.
9. ~~**Per-screen control detail.**~~ **ANSWERED — both halves read.** The 1,823-line FilterBar was
   read for ticket 09 and the 2,254-line ARR Analysis page for ticket 13; §2.1 and §2.4 now carry
   each screen's control detail. Between them the two reads produced eleven findings, all recorded
   rather than left in the code: the FilterBar's are in §7 and §8, and ARR Analysis's are the five
   deviations in §7, the three pieces of dead code in §9, and the new §11.12.

   **§8.5 is answered as a side effect of the second read**, though it was a question for Finance.
   It asked whether the `billingCountries` list the backend sends was ever meant to be used: it was,
   by ARR Analysis's Country control, which sends `billingCountries` and is fed a menu built from a
   misspelled key that is never on the response. So the list has a reader and the reader is a typo —
   see §7. The Build's own substitution still stands as reproduced; what remains for Finance is
   whether the Build's two country controls should go on meaning the same thing.
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
12. **Should an ARR Analysis link carry the view it was shared from?** The same question as §11.11,
    one screen along and ten controls wide. Every filter on ARR Analysis is component state in the
    source, so nothing reaches the address and a shared link opens on defaults — reproduced under
    ADR 0003 rather than decided during ticket 13, for the reason §11.11 gives: extending the URL
    contract ticket 02 pinned means deciding what an unrecognised value degrades to and what a stale
    link means, which is a contract decision rather than a side effect of porting a table.

    It is a sharper question here than on the Region Summary, though, because of what the screen is
    for. A Region Summary link loses one cut; an ARR Analysis link loses the entire question — "here
    are the Channel accounts in EMEA above $50K" arrives as the whole customer book. Finance's habit
    of pasting a filtered view into a thread is exactly the workflow that breaks, and it breaks
    silently: the recipient sees a table, not an error. **Worth asking Finance whether they share
    these links today**, which decides whether this is a contract to extend or a non-issue.
13. **Does the whole customer book page and export without the community grid throwing?** §10.35e.
    `pageSize` above 100 throws outright rather than degrading, so the failure mode is a blank screen
    rather than a slow one. A hundred accounts are pinned in jsdom; the real book is not, and neither
    is the CSV's size at that volume. Same live-tenant dependency as §10.22.

14. **Does the gateway tolerate ten concurrent reads per filter change?** ARR Analysis fires one
    `POST /accounts`, one `POST /exit-arr/search` for the headline, two more for the partner split and
    **one per industry** over six — all in parallel, all on one filter change. The debounce collapses
    a burst of changes into one such round; it does nothing about the size of the round. That is the
    source's shape and presumably survives in production today, but One WSO2 reaches these services
    through a different client and §11.1's token path is still unproven, so it is worth watching on
    the first live visit rather than assuming. The one place to change it for every table at once is
    `useColumnQueries`, which already carries this note for the Build's columns (§7).

15. **Should the Flash's filters reach the URL?** Ticket 15. The same question as item 12 asks of ARR
    Analysis, and it has the same answer for now: the source keeps the two months and the sub-region
    selection in component state, so a shared Flash link opens on defaults in both apps, and the port
    reproduces that rather than extending the contract ticket 02 pinned. It is a milder case than ARR
    Analysis's — a Flash link loses a date range rather than an entire question, and the range is
    visible in the pickers the moment the screen loads — but it is the same decision and should be
    taken once, for both screens, with Finance.

16. **Do Finance want the Flash's sub-region typo fixed in the source?** Ticket 15, §8. Five of the
    six monthly views drop the sub-region filter because of a lower-case `r` in a prop name, so a
    narrowed P&L opens an unnarrowed detail view on every column but Integration. The port
    reproduces it under ADR 0003 rather than silently disagreeing with the app Finance is
    reconciling against, but it is a one-character fix in `DataTable.js` and the port would follow it
    the same day. **Worth raising**, because unlike the other reproductions this one is not a
    judgement call anybody made — and a reader comparing Integration's detail view against IAM's
    today is comparing a filtered figure with an unfiltered one.

17. **Which twelve months does the source's P&L open on in Colombo?** Found by ticket 16, left for
    ticket 19's parity check. It reaches the detail view too: the source derives its monthly ranges
    from the same load dates, so from Colombo its first-load detail view is headed Sep 2025 to Aug
    2026 where the port's is Oct 2025 to Sep 2026 — each column asking the same question as its
    namesake, and the set of columns one month apart. The P&L's load range is seeded by `FlashConsole.js`'s mount effect
    through `date.toISOString().split("T")[0]` over local midnights — the same construction §8 shows
    moving the detail view's dates — so from Colombo it sends `2025-08-31 → 2026-08-31` where the port
    sends `2025-09-01 → 2026-09-01`. The financial accounts read a range by its end MONTH (§8), so on
    the trace those two are twelve different months: September 2025 to August 2026 in Colombo, October
    2025 to September 2026 in the port and in the source from UTC or California. Ticket 15 reproduced
    the UTC/Pacific load, which §3 makes canonical, and did not know the Colombo one asked a different
    question. **One side-by-side load from Colombo settles it**: if the two P&Ls disagree by a month,
    §3 and ADR 0003 pull opposite ways and it is a decision for Finance — whose month the Flash opens
    on is not a port detail.

18. **Can Cost of Sales forecasts be written from the source at all today?** Ticket 16, §7. On the
    code, no: the source's account view sends `expenseType`, and the flash backend has required
    `accountSubCategory` in its place since 2023-11-20, so the view should be refused with a 400
    before any account is listed. Production runs a 2025 build, which includes the rename. The port
    sends `accountSubCategory`, so on a live tenant it should list accounts where the source shows
    *"Something went wrong! Couldn't fetch data."* — **one side-by-side attempt settles it**, and
    also answers whether the gateway reads the `+` the account GETs send for a space (the source's
    own wire form for them, `useFlashAccounts.ts`). If Finance have been editing Cost of Sales some
    other way, that is worth knowing before the old frontend goes dark.

19. **Does anything downstream read the Flash workbook by position?** Ticket 18, §7. The port's file
    follows the screen: the Annual Summary's units run Integration, IAM, APIM, Choreo, Corporate, WSO2
    where today's file puts Corporate fourth, the WSO2 sheet is named "WSO2" rather than "All", and the
    monthly sheets gain the Revenue and Other Expenses sections the source's never had. Its figures are
    numbers and its percentages true percentages, where today's are text. A person reading the file is
    better served by all of it; a macro, a lookup or a template filled by copying columns in position
    would not be, and nothing in either repo can say whether one exists. **Ask Finance once**, before
    the parallel period ends.

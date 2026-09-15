# One WSO2

The unified internal digital experience for WSO2 employees: a single React frontend over the many
separate internal apps that are being ported into it. This file is the shared glossary — the words
the code, the port specs and the design docs should all use for the same things.

## Language

### The platform

**Perspective**:
A role- or purpose-shaped view of One WSO2 — a curated landing page plus the navigation for one kind
of work. The answer to "which hat am I wearing?", not "which app do I open?".
_Avoid_: workspace, module, area, section, app group

**Capability**:
One of the four coarse permission strings One WSO2 itself understands — `employee`, `lead`,
`serviceDesk`, `admin` — derived from people-app privilege numbers.
_Avoid_: role, permission, scope, privilege

**Privilege**:
A numeric permission code issued by one backend's own `/user-info`. Always name the backend: the
number space is shared but the meanings are not. Both of Finance MIS's numbers are already spoken
for here, and neither collision is the safe kind:

| Number | people-app / One WSO2 | leave-app | Finance MIS |
|---|---|---|---|
| `987` | every authenticated employee (`PRIVILEGE.EMPLOYEE`) | `LEAVE_PRIVILEGE.EMPLOYEE` | may see the ARR dashboards |
| `789` | — | `LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM` | may see the Flash Dashboard |

So reading MIS access off the shared capability set grants company-wide revenue reporting to
everybody, and reading it off leave-app's array grants the P&L to People Ops. Each is only meaningful
beside the endpoint that issued it, which is why every app has its own Gate.
_Avoid_: bare "privilege" with no backend named; capability; role

**Gate**:
A per-app hook that asks that app's *own* backend what the current user may see. The authority on
access. A registry entry's `requires` is only a coarse hint and never the decision.
_Avoid_: guard, auth check, permission check — `AuthGuard` is a different thing, being the sign-in
boundary rather than an authorization decision

**MenuApp**:
A registry entry describing one ported app and the top-level menu items it contributes to a rail.
_Avoid_: app definition, manifest, plugin, feature

**App shell**:
The persistent chrome around every page — top bar, side rail, footer, overlays.
_Avoid_: layout, frame, wrapper

**Page shell**:
A `*Shell.tsx` belonging to one app family, owning that family's degraded states: not connected,
resolving, error, unauthorized.
_Avoid_: layout, container, boundary

**Port**:
Moving an existing internal app's frontend into One WSO2, replacing it. Its backend normally stays
exactly where it is.
_Avoid_: migration (reserve that for the whole programme), rewrite, integration

### Finance MIS

The internal finance reporting app being ported. "MIS" is never expanded in its own source; read it
as Management Information System.

**Build**:
The roll-forward of recurring revenue from an Opening balance, through New, Expansions, Reductions
and Lost, to a Closing balance. A finance term. **It has nothing to do with compiling the app.**
_Avoid_: waterfall, rollforward, bridge, movement table — and never write bare "build" in this repo
where a reader could hear `npm run build`

**ARR / QRR / MRR**:
Annual, Quarterly and Monthly Recurring Revenue. The three Periods the same Build is computed over.
_Avoid_: revenue, run rate, recurring

**Opening / Closing**:
The recurring-revenue balance at the start and the end of a Period.
_Avoid_: start/end balance, BoP/EoP

**Expansion / Reduction / Lost**:
The three ways existing recurring revenue moves between Opening and Closing. New business is New.
_Avoid_: upsell, downgrade, churn

One ported screen uses different words for these, and is meant to. The Region Summary's **All ARR
Metrics** view heads its columns `Expansion`, `Reduction`, `Loss`, `First Sale` and `Closing ARR`
where the Subscription Build writes `Expansions`, `Reductions`, `Lost`, `New` and `Ending ARR` — the
source is inconsistent between two of its own screens, and the port reproduces that under
[ADR 0003](docs/adr/0003-bug-for-bug-parity-during-the-parallel-period.md) so finance reconciling
column by column finds the words it expects. So `Loss` and `First Sale` in those two headers are not
glossary breaches to fix; harmonising the two screens is a decision for after the parallel period.
The carve-out reaches the column KEYS those headers derive from as well — `REGION_METRICS_SUB_COLUMNS`
names them off the label, so `loss` and `first-sale` sit there beside the wire fields `lost` and
`firstSale`, and renaming either half would only make the column disagree with itself.
Everywhere else — prose, identifiers, every other table — the words are **Lost** and **New**.

**Exit ARR**:
Recurring revenue as at the end of a Period, reported by region or business unit. A BALANCE, which is
what separates it from the **All ARR Metrics** view sharing its screen: that one reports the same
regions' MOVEMENT over the Period instead, and is narrowed to one Business Unit rather than split by
all of them.
_Avoid_: closing ARR, ending ARR

**TTM**:
Trailing Twelve Months.
_Avoid_: LTM, rolling year

**Flash**:
The monthly P&L reported ahead of a formal close — revenue, cost of sales, gross profit, gross
margin, plus ARR and booking per business unit. The only MIS surface where users write data.
_Avoid_: P&L, management accounts, monthly report

**Period**:
The time bucket a Build covers. Carried in the route path, not the query string.
_Avoid_: timeframe, range, window

**Scale**:
The display control that shows currency in units or thousands. It scales currency rows only, and
never counts or percentages.
_Avoid_: units, format, magnitude

**Applied filter**:
A filter the user has committed, and which is therefore serialised into the query string. Distinct
from a filter being edited but not yet applied.
_Avoid_: active filter, selected filter

**Years Back**:
How many Periods a view reaches back over. It has a per-Table default (5; Region Summary 2;
Quarterly and Monthly 1), and it is the one filter of the BAR's that a Table or Period switch carries
over — it is the shape of the question rather than a narrowing of one Table's answer. (The unit
selection survives a switch too, but it belongs to the tabs above the bar, not to the filters.) Held for the tab by
`YearsBackSessionContext`, provided by the `MisSession` route so that it outlives any one screen. In
memory only, so it dies with a reload — unlike Scale.
_Avoid_: history, lookback, number of years

**Business Unit (BU)**:
The product line a figure is attributed to.
_Avoid_: product, segment, division

**Channel / Direct**:
The partner model a customer was sold through.
_Avoid_: indirect/direct, reseller

**Sub Region**:
The reporting geography below Sales Region.
_Avoid_: territory, country group

**Pacific Time**:
The canonical business timezone for every MIS Period boundary. Not the viewer's timezone and not UTC.
_Avoid_: local time, PST, PDT

## Overloaded words — always qualify

**Dashboard** carries three meanings and should usually be replaced by the specific screen name.
"ARR Dashboard" is a group of three Build screens; "Flash Dashboard" is a single screen; the vision
doc's "home dashboard" is a Perspective's landing page. The inconsistency is inherited from MIS.

**Finance** is a Perspective in One WSO2, a role name (`FINANCE`) in the digiops-finance backends,
and the department who uses MIS. Name which one.

**Report** is what every MIS screen is, and also the name of an unrelated People Ops feature. Name
the app.

**Window** was a MIS filter control, dropped from the FilterBar but still present in the serialised
view-state contract. Verify which before using the word at all.

The verification is now done, by the line-by-line read of the source FilterBar for the ARR Build port.
Both halves hold, and the resolution is that they never meet:

- The dropped **control** is gone for good. The source's filter bar has no Window dropdown on any
  Table or Period, and its own test suite pins that ("has no Window dropdown on Annually, Quarterly,
  or Monthly").
- The surviving **column cut** — calendar years or trailing twelve months — is real, is what
  `?window=ttm` carries, and reaches the reader as the **fourth option on the Period control**
  (`PeriodRow.js`: Annually, Quarterly, Monthly, TTM), not as a control of its own.

So in this repo: `viewWindow`, `MIS_WINDOWS` and `?window=` are the column cut, and the thing a reader
clicks is the **Period** control — on which TTM sits beside Annually. Write "Window" for the cut and
"Period control" for the thing on screen; do not name a piece of UI "Window".

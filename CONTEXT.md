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
number space is shared but the meanings are not, so `987` is people-app's "every authenticated
employee" and Finance MIS's "may see the ARR Dashboard".
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

**Exit ARR**:
Recurring revenue as at the end of a Period, reported by region or business unit.
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

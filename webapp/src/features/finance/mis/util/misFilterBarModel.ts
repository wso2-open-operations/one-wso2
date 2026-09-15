// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// The filter bar, as rules rather than as a component.
//
// A MIS filter bar is two sets of the same filters: the **Applied** set, which
// the grid reflects and the URL carries, and the **Pending** set, which is what
// the controls are showing while the reader makes up their mind. APPLY is the
// step between them. That distinction is CONTEXT.md's, and it is the whole
// reason this module exists — everything here is a question about one of the
// two sets or about the distance between them.
//
// Ported from the state, effects and handlers of the 1,823-line
// digiops-finance `arrDashboard/components/FilterBar.js`. What changed is the
// shape, not the rules:
//
//   - Pending is ONE object, not twenty `useState`s. The source declares a
//     setter per control and a `setPending` that calls all twenty in order.
//   - Pending holds ONE type value and ONE cumulative flag, not three and two.
//     The source carries `arrType`, `qrrType` and `mrrType` simultaneously on
//     every Period and needs a coercion effect per Table to stop a Quarterly
//     choice reaching an Annually grid. `TYPE_KEY_BY_PERIOD` already answers
//     which key a Period uses, so there is nothing to cross-contaminate.
//   - The coercions are a FUNCTION, not four `useEffect`s that fire after a
//     render and set state again. The source needs `normalisePending` anyway —
//     for chip dismissal, which has to apply what the panel is about to show —
//     so it already has both, and they have to agree. Here there is one.
//   - There is no `lastAppliedPending` snapshot. The Applied set lives in the
//     URL (ticket 02), so "are there Pending changes" is a comparison against
//     the address bar rather than against a second copy held in state that has
//     to be kept in step with it.
//
// The unit selection is deliberately absent: it is not a bar control in the
// source either (`FilterBar.js:438` — "BU/Software/Cloud selection is now
// controlled in TableNavigation; no UI here"), and it commits on click rather
// than waiting for APPLY.

import { allowedTypeValues, defaultAppliedFilters, defaultYearsBack } from "./misViewState";
import {
  CUMULATIVE_KEY_BY_PERIOD,
  LIST_FILTER_PARAMS,
  MIS_PERIODS,
  MIS_PERIOD_LABELS,
  MIS_TABLES,
  MIS_TABLE_LABELS,
  MIS_WINDOWS,
  TYPE_KEY_BY_PERIOD,
  TYPE_VALUES_BY_PERIOD,
  dropRegionsOutsideTheirView,
  type MisAppliedFilters,
  type MisChannelDirect,
  type MisConfidenceLevel,
  type MisEndingMonth,
  type MisFilterControl,
  type MisListFilterKey,
  type MisPeriod,
  type MisTable,
  type MisViewType,
  type MisWindow,
} from "./misViewVocabulary";

/**
 * The controls the bar owns, as one object.
 *
 * `typeValue` and `cumulative` are single fields whatever the Period; which
 * Applied key each becomes is `TYPE_KEY_BY_PERIOD`'s and
 * `CUMULATIVE_KEY_BY_PERIOD`'s answer, asked once on the way back out.
 */
export interface MisPendingFilters {
  viewType: MisViewType;
  confidenceLevel: MisConfidenceLevel;
  channelDirect: MisChannelDirect;
  isYtd: boolean;
  endingMonth: MisEndingMonth;
  yearsBack: number;
  /** The Period's own type, as the wire carries it — `Total ARR`, not `ARR`. */
  typeValue: string;
  /** The Period's cumulative flag. Always false on Annually, which has none. */
  cumulative: boolean;
  salesRegion: string[];
  subRegion: string[];
  billingCountry: string[];
  shippingCountry: string[];
  industry: string[];
  subIndustry: string[];
  accountOwner: string[];
  technicalOwner: string[];
  channelManager: string[];
}

/**
 * What each filter is called, once.
 *
 * A control and a chip read the same filter in different places, so they are
 * allowed to name it differently — but only ONE of the seventeen actually does,
 * and hard-coding two maps to express that had them drift into being identical
 * with a comment claiming they were not. `controlLabel` and `chipLabel` below
 * are where the difference lives.
 */
export const MIS_FILTER_LABELS: Readonly<Record<MisFilterControl, string>> = {
  viewType: "View",
  salesRegion: "Sales Region",
  subRegion: "Sub Region",
  typeValue: "Type",
  channelDirect: "Channel/Direct",
  confidenceLevel: "Forecast Type",
  endingMonth: "Ending Month",
  billingCountry: "Billing Country",
  industry: "Industry",
  subIndustry: "Sub Industry",
  accountOwner: "Account Owner",
  technicalOwner: "Technical Owner",
  channelManager: "Channel Manager",
  // The wire and the URL call this one shipping; Finance has always called it
  // this, and both a filter bar and a chip strip are read by Finance.
  shippingCountry: "Country by Sales Region",
  yearsBack: "Years Back",
  isYtd: "YTD",
  cumulative: "Cumulative",
};

/**
 * `ARR` on Annually, `QRR` on Quarterly, `MRR` on Monthly.
 *
 * Exported because the three Build SCREENS name themselves with it too — one
 * spelling, so the rail entry, the heading, the browser tab and the type
 * control cannot come to disagree about what the Quarterly Build is called.
 */
export const periodInitials = (period: MisPeriod): string =>
  period === MIS_PERIODS.ANNUALLY ? "ARR" : period === MIS_PERIODS.QUARTERLY ? "QRR" : "MRR";

/**
 * The four buttons of the bar's leftmost control, which is ONE control over two
 * dimensions.
 *
 * Three of them are Periods and live in the route; the fourth, TTM, is a Window
 * and lives in the query string. The source's control is the same four and
 * navigates between screens (`FilterBar.js`'s timeframe toggle), so this is not
 * a port invention — what is new here is saying the two dimensions out loud
 * instead of leaving a reader to infer why one button behaves differently.
 *
 * Values are the Period's own, plus the Window's, so nothing has to be mapped
 * on the wire or in a link.
 */
export const MIS_PERIOD_CHOICES = {
  ANNUALLY: MIS_PERIODS.ANNUALLY,
  QUARTERLY: MIS_PERIODS.QUARTERLY,
  MONTHLY: MIS_PERIODS.MONTHLY,
  TTM: MIS_WINDOWS.TTM,
} as const;
export type MisPeriodChoice = (typeof MIS_PERIOD_CHOICES)[keyof typeof MIS_PERIOD_CHOICES];

/** The four, in the order the source's control offers them. TTM last. */
export const MIS_PERIOD_CHOICE_ORDER: readonly MisPeriodChoice[] = [
  MIS_PERIOD_CHOICES.ANNUALLY,
  MIS_PERIOD_CHOICES.QUARTERLY,
  MIS_PERIOD_CHOICES.MONTHLY,
  MIS_PERIOD_CHOICES.TTM,
];

/** What each button reads. TTM is an acronym Finance uses; the rest are words. */
export const MIS_PERIOD_CHOICE_LABELS: Readonly<Record<MisPeriodChoice, string>> = {
  [MIS_PERIOD_CHOICES.ANNUALLY]: MIS_PERIOD_LABELS[MIS_PERIODS.ANNUALLY],
  [MIS_PERIOD_CHOICES.QUARTERLY]: MIS_PERIOD_LABELS[MIS_PERIODS.QUARTERLY],
  [MIS_PERIOD_CHOICES.MONTHLY]: MIS_PERIOD_LABELS[MIS_PERIODS.MONTHLY],
  [MIS_PERIOD_CHOICES.TTM]: "TTM",
};

/**
 * Which button is lit, given where the reader is.
 *
 * The Window is only consulted on Annually, because only Annually HAS one. A
 * `window=ttm` that rode a link onto a Quarterly route is a parameter already
 * being ignored — `allowedTypeValues` ignores it there too — and lighting TTM
 * on a screen with no TTM would be the control lying about the view.
 */
export const periodChoiceOf = (period: MisPeriod, viewWindow: MisWindow): MisPeriodChoice =>
  period === MIS_PERIODS.ANNUALLY && viewWindow === MIS_WINDOWS.TTM
    ? MIS_PERIOD_CHOICES.TTM
    : (period as MisPeriodChoice);

/**
 * Where a button goes.
 *
 * A Period is a NAVIGATION and carries no Window, so the arriving screen reads
 * its own default rather than inheriting a cut that does not apply there.
 * Annually and TTM are the same route and differ only by the Window, which is
 * why those two name one and the three name none.
 */
export function periodChoiceTarget(choice: MisPeriodChoice): {
  period: MisPeriod;
  viewWindow?: MisWindow;
} {
  if (choice === MIS_PERIOD_CHOICES.TTM) {
    return { period: MIS_PERIODS.ANNUALLY, viewWindow: MIS_WINDOWS.TTM };
  }
  if (choice === MIS_PERIOD_CHOICES.ANNUALLY) {
    return { period: MIS_PERIODS.ANNUALLY, viewWindow: MIS_WINDOWS.CALENDAR };
  }
  return { period: choice };
}

/**
 * What a filter is called ON THE BAR.
 *
 * Two are said with the Period in them, because the control sits among sixteen
 * others and "Type" alone would not say type of what. The source words them the
 * same way (`ARR Type`, `Cumulative Quarterly`).
 */
export function controlLabel(control: MisFilterControl, period: MisPeriod): string {
  if (control === "typeValue") return `${periodInitials(period)} Type`;
  if (control === "cumulative") return `Cumulative ${cumulativePeriodWord(period)}`;
  return MIS_FILTER_LABELS[control];
}

/**
 * What a filter is called IN A CHIP.
 *
 * The one divergence from the bar: a chip already carries its value, so
 * "Type: Forecasted ARR" says the Period twice if the label does too.
 */
export function chipLabel(control: MisFilterControl, period: MisPeriod): string {
  if (control === "cumulative") return `Cumulative ${cumulativePeriodWord(period)}`;
  return MIS_FILTER_LABELS[control];
}

/** Annually has no cumulative flag, so it never reaches either label function. */
const cumulativePeriodWord = (period: MisPeriod): string =>
  period === MIS_PERIODS.MONTHLY ? "Monthly" : "Quarterly";

/**
 * The order the source lays the Build's controls out in
 * (`FilterBar.js:1412-1780`), which is also the order they collapse behind
 * "More" — so the seven a reader sees first are the seven the source shows.
 */
export const MIS_FILTER_CONTROL_ORDER: readonly MisFilterControl[] = [
  "viewType",
  "salesRegion",
  "subRegion",
  "typeValue",
  "channelDirect",
  "confidenceLevel",
  "endingMonth",
  "billingCountry",
  "industry",
  "subIndustry",
  "accountOwner",
  "technicalOwner",
  "channelManager",
  "shippingCountry",
  "yearsBack",
  "isYtd",
  "cumulative",
];

/** How many controls stay in view when the bar is collapsed. `FilterBar.js:1785`. */
export const MIS_COLLAPSED_CONTROL_COUNT = 7;

/**
 * Whether a Forecasted type is steering a confidence level.
 *
 * Renewal is deliberately not one: it turns forecast COLUMNS on without
 * carrying a confidence, which is the same rule `misArrSummaryRequest`'s
 * `carriesConfidence` applies on the wire. The two have to agree, or the bar
 * offers a control whose value is never sent.
 */
export const usesConfidence = (typeValue: string | undefined): boolean =>
  /^Forecasted/.test(typeValue ?? "");

/**
 * Whether a view has years to go back over.
 *
 * A forecast is about what has not happened yet, so it has none. On Customers a
 * Delayed type has none either — the source hides the control there
 * (`FilterBar.js:964`) and drops Years Back to 1 behind it, which spec §8.3
 * reproduces.
 *
 * ---- why this is one function and not two ---------------------------------
 *
 * The source asks this question in two places that disagree. The Build's
 * CONTROL hides on Forecasted alone (`FilterBar.js:1745`), while its CHIP hides
 * on Forecasted or Delayed whatever the Table (`appliedFilterChips.js:81`). So a
 * Delayed Build — reachable on a trailing window — shows a Years Back control
 * whose value has no chip, which reads as the filter not having been applied.
 * Asked once here instead, and the Table is part of the question.
 */
export const usesYearsBack = (typeValue: string | undefined, table: MisTable): boolean => {
  if (/^Forecasted/.test(typeValue ?? "")) return false;
  return !(table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS && /^Delayed/.test(typeValue ?? ""));
};

/**
 * What a type is called on screen.
 *
 * The wire says `Total ARR` and Finance says `ARR`; the wire says
 * `Closed Won ARR` and the control says `Only Closed Won ARR`. The source keeps
 * both vocabularies in state at once and translates on every apply
 * (`API_TO_DISPLAY_TYPE` one way, `arrTypeApiMapping` the other, plus three
 * hand-written ternary chains for the summaries). Here the state is the wire
 * value throughout and this is a rendering detail — so there is one vocabulary
 * to be wrong about, and a label can never be sent to a backend.
 */
export function typeLabel(typeValue: string): string {
  const match = /^(Total|Closed Won|Delayed) ([QM]?RR|ARR)$/.exec(typeValue);
  if (!match) return typeValue;
  const [, prefix, period] = match;
  return prefix === "Total" ? period : `Only ${prefix} ${period}`;
}

/** The one confidence level whose wire value is an abbreviation. */
const CONFIDENCE_LABELS: Readonly<Record<string, string>> = { GM: "GM's Commit" };

export const confidenceLabel = (value: string): string => CONFIDENCE_LABELS[value] ?? value;

/**
 * The confidence levels in the order the source offers them
 * (`FilterBar.js:445-450`) — which is NOT the order `MIS_CONFIDENCE_LEVELS`
 * declares them in, because that list is the URL's vocabulary and this is the
 * menu. GM's Commit sits second, beside plain Commit, rather than last.
 */
export const MIS_CONFIDENCE_OPTIONS: readonly string[] = [
  "Commit",
  "GM",
  "Commit + Best Case",
  "Commit + Best Case + Upside",
];

/** The nine list filters, named once, in the URL contract's own order. */
const LIST_KEYS: readonly MisListFilterKey[] = LIST_FILTER_PARAMS.map(([key]) => key);

/** The controls, seeded from the Applied set the grid is currently showing. */
export function pendingFromApplied(
  applied: MisAppliedFilters,
  period: MisPeriod,
): MisPendingFilters {
  const cumulativeKey = CUMULATIVE_KEY_BY_PERIOD[period];
  return {
    viewType: applied.viewType,
    confidenceLevel: applied.confidenceLevel,
    channelDirect: applied.channelDirect,
    isYtd: applied.isYtd,
    endingMonth: applied.endingMonth,
    yearsBack: applied.yearsBack,
    typeValue: applied[TYPE_KEY_BY_PERIOD[period]] ?? TYPE_VALUES_BY_PERIOD[period][0],
    cumulative: cumulativeKey ? (applied[cumulativeKey] ?? false) : false,
    ...copyLists(applied),
  };
}

/**
 * The nine list filters, copied.
 *
 * Driven off `LIST_FILTER_PARAMS` rather than written out, so a tenth list
 * filter is added in the URL contract's vocabulary and nowhere else. Copied and
 * not shared, because the Pending set is edited in place by the controls and
 * must not reach into the Applied set the grid is drawn from.
 */
const copyLists = (from: Pick<MisAppliedFilters, MisListFilterKey>): Pick<MisPendingFilters, MisListFilterKey> =>
  Object.fromEntries(LIST_KEYS.map((key) => [key, [...from[key]]])) as Pick<
    MisPendingFilters,
    MisListFilterKey
  >;

/**
 * The Applied set a Pending one commits to, over the set already on screen.
 *
 * Over, rather than instead of: the unit selection and the custom lists belong
 * to the unit tabs, which commit on click, and an APPLY that replaced them
 * would undo whatever the reader picked there since.
 *
 * Two fields are deliberately NOT set here — `forecast` and
 * `columnDateRanges`. Both are derived, and `hydrateAppliedFilters` derives
 * them on the way back out of the URL, which every applied set passes through.
 * Deriving them here as well would be a second opinion about the same question.
 */
export function appliedFromPending(
  pending: MisPendingFilters,
  applied: MisAppliedFilters,
  period: MisPeriod,
): MisAppliedFilters {
  const cumulativeKey = CUMULATIVE_KEY_BY_PERIOD[period];
  const next: MisAppliedFilters = {
    ...applied,
    viewType: pending.viewType,
    confidenceLevel: pending.confidenceLevel,
    channelDirect: pending.channelDirect,
    isYtd: pending.isYtd,
    endingMonth: pending.endingMonth,
    yearsBack: pending.yearsBack,
    ...copyLists(pending),
  };
  // Exactly one type key is ever set. The other two are cleared rather than
  // carried, because a stale `qrrType` on an Annually view is the source's
  // cross-contamination bug waiting to be re-introduced.
  delete next.arrType;
  delete next.qrrType;
  delete next.mrrType;
  next[TYPE_KEY_BY_PERIOD[period]] = pending.typeValue;
  if (cumulativeKey) next[cumulativeKey] = pending.cumulative;
  return next;
}

/**
 * Which view the rules are being asked about.
 *
 * These three travel together everywhere — every rule in this file, and the chip
 * strip's, is a question about one Period, one Table and one Window — so they
 * are one type rather than three parameters repeated at each call.
 */
export interface MisFilterView {
  period: MisPeriod;
  table: MisTable;
  /** Omitted is Calendar. */
  viewWindow?: MisWindow;
}

/**
 * What a Pending set becomes once every control has had its say about the
 * others.
 *
 * Four rules, and they run in this order because the later ones read what the
 * earlier ones decided:
 *
 *   1. A View keeps only the region list it uses — `dropRegionsOutsideTheirView`,
 *      which the URL contract applies to a link for the same reason.
 *   2. A type the view does not offer becomes Total. This is where the Table
 *      rules and the TTM rule both land — `allowedTypeValues` is the one place
 *      that knows them, and it is the same function the URL validates against,
 *      so a control can never hold a type the address would drop.
 *   3. A Confidence that is no longer steering anything goes back to Commit.
 *      Reads the type rule 2 may have just changed.
 *   4. On Customers, a type the reader has just CHANGED re-pins Years Back.
 *      Only on a change: see `customersYearsBack`.
 */
export function normalisePending(
  pending: MisPendingFilters,
  { period, table, viewWindow = MIS_WINDOWS.CALENDAR }: MisFilterView,
  { typeChanged = false }: { typeChanged?: boolean } = {},
): MisPendingFilters {
  const next = { ...pending };
  dropRegionsOutsideTheirView(next);

  const allowed = allowedTypeValues(period, table, viewWindow);
  if (!allowed.includes(next.typeValue)) {
    next.typeValue = allowed[0] ?? TYPE_VALUES_BY_PERIOD[period][0];
  }
  if (!usesConfidence(next.typeValue)) next.confidenceLevel = "Commit";
  if (typeChanged && table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS) {
    const pinned = customersYearsBack(next.typeValue, period);
    if (pinned !== null) next.yearsBack = pinned;
  }
  return next;
}

/**
 * The Years Back a Customers type drags with it.
 *
 * Spec §8.3 from the other side. `hydrateAppliedFilters` already drops a
 * Customers + Delayed view to one year when the link did not say otherwise; this
 * is the same rule reached by changing the control instead of by opening a link,
 * and without it the two disagree — the reader picks Delayed, Applies, and the
 * address comes back saying one year while the controls still say five, so APPLY
 * never goes quiet again.
 *
 * Three types and no others, which is the source's own list
 * (`FilterBar.js:539-541`): every other type leaves Years Back where the reader
 * had it. On Customers that means Forecasted alone, since `allowedTypeValues`
 * offers no Renewal there. Annually only, like §8.3: the source writes it
 * against the ARR values and the other two Periods start at one anyway.
 */
function customersYearsBack(typeValue: string, period: MisPeriod): number | null {
  if (period !== MIS_PERIODS.ANNUALLY) return null;
  if (typeValue === "Delayed ARR") return 1;
  return typeValue === "Total ARR" || typeValue === "Closed Won ARR" ? 5 : null;
}

/**
 * The controls as a Table opens them, which is what Clear All returns to and
 * what a reset is measured against.
 *
 * One function because the bar and the notice have to agree on it: a Clear All
 * that landed anywhere other than where `filterResetNotice` calls the defaults
 * would announce a reset the reader had just performed themselves.
 */
export const defaultPending = ({ period, table }: MisFilterView): MisPendingFilters =>
  pendingFromApplied(defaultAppliedFilters(period, table), period);

/**
 * Whether two Pending sets say the same thing — which is how APPLY knows
 * whether it has anything to do.
 *
 * Lists compare by content **in order**, not as sets. Order is what the reader
 * picked and what the URL carries, so two lists holding the same names in a
 * different order are two different links, and calling them equal would leave
 * APPLY disabled over a change the address would have recorded.
 */
export function samePending(a: MisPendingFilters, b: MisPendingFilters): boolean {
  if (
    a.viewType !== b.viewType ||
    a.confidenceLevel !== b.confidenceLevel ||
    a.channelDirect !== b.channelDirect ||
    a.isYtd !== b.isYtd ||
    a.endingMonth !== b.endingMonth ||
    a.yearsBack !== b.yearsBack ||
    a.typeValue !== b.typeValue ||
    a.cumulative !== b.cumulative
  ) {
    return false;
  }
  return LIST_KEYS.every(
    (key) => a[key].length === b[key].length && a[key].every((item, i) => item === b[key][i]),
  );
}

/**
 * Which controls this view puts on screen.
 *
 * A set rather than a list, so the bar keeps `MIS_FILTER_CONTROL_ORDER` as the
 * single statement of order and this stays the single statement of presence.
 *
 * Every control not named here is unconditional on the Build. The conditional
 * ones each hide because their value would mean nothing: a region list outside
 * its own View, a Confidence outside a Forecasted type, Years Back where there
 * are no years, YTD on a window that is not a year to a date, and the two
 * Period-specific ones — Ending Month and the cumulative flag — off the Period
 * that has them.
 */
export function misFilterBarControls(
  pending: MisPendingFilters,
  { period, table, viewWindow = MIS_WINDOWS.CALENDAR }: MisFilterView,
): ReadonlySet<MisFilterControl> {
  const shown = new Set<MisFilterControl>(MIS_FILTER_CONTROL_ORDER);
  if (pending.viewType !== "Sales Region") shown.delete("salesRegion");
  if (pending.viewType !== "Sub Region") shown.delete("subRegion");
  if (!usesConfidence(pending.typeValue)) shown.delete("confidenceLevel");
  if (!usesYearsBack(pending.typeValue, table)) shown.delete("yearsBack");
  // A trailing twelve months is not a year to a date, so there is nothing for
  // YTD to say about it — and `serializeViewState` drops the parameter there
  // for the same reason.
  if (period !== MIS_PERIODS.ANNUALLY || viewWindow === MIS_WINDOWS.TTM) shown.delete("isYtd");
  // Ending Month is Annually's; the other two Periods end where their own
  // buckets end.
  if (period !== MIS_PERIODS.ANNUALLY) shown.delete("endingMonth");
  if (!CUMULATIVE_KEY_BY_PERIOD[period]) shown.delete("cumulative");
  return shown;
}

/**
 * The Years Back a session should carry forward, given the one just applied.
 *
 * `null` at the Table's own default, because a reader who never touched the
 * control has not chosen anything for the next Table to inherit — and a session
 * that recorded 5 merely because they opened a Build would then show five years
 * on a Region Summary that starts at two.
 */
export function yearsBackToRemember(
  yearsBack: number,
  { period, table }: MisFilterView,
): number | null {
  return yearsBack === defaultYearsBack(period, table) ? null : yearsBack;
}

/**
 * The Applied set a Table or Period switch lands on.
 *
 * A different Table is a different report, so the filters that narrowed the last
 * one do not travel: the source resets them and applies the new Table's defaults
 * at once (`FilterBar.js:556-624`), and a Region Summary still showing the
 * Build's EMEA filter would be narrowed by something its own bar cannot show.
 *
 * Two things do survive:
 *
 *   Years Back      through the session (`startingYearsBack`). It is the shape
 *                   of the question rather than a narrowing of one Table.
 *   the unit tabs   which commit on their own and are not the bar's to reset —
 *                   EXCEPT on the way into Customers, where the source clears
 *                   them (`FilterBar.js:606`). Reproduced under ADR 0003: a
 *                   custom book there would put figures on screen that the app
 *                   Finance is reconciling against does not show.
 */
export function filtersAfterSwitch(
  applied: MisAppliedFilters,
  to: MisFilterView,
  sessionYearsBack: number | null,
): MisAppliedFilters {
  const next = defaultAppliedFilters(to.period, to.table);
  // The session's Years Back, or this Table's own where the reader has set none.
  next.yearsBack = sessionYearsBack ?? defaultYearsBack(to.period, to.table);
  if (to.table !== MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS) {
    next.buProductSelection = applied.buProductSelection;
    next.customBusinessUnits = [...applied.customBusinessUnits];
    next.customProductUnits = [...applied.customProductUnits];
  }
  return next;
}

/**
 * What the bar says about a switch that dropped the reader's filters.
 *
 * Takes the PENDING controls, not the Applied set: an edit the reader had not
 * applied yet is lost by the switch too, and the source's own suite pins that —
 * it picks a type without applying and still expects the notice
 * (`FilterBar.test.js:222-233`). It is also the only set that is certainly
 * current at the moment of a switch; the Applied one on screen has already been
 * replaced by the navigation that caused it.
 *
 * Empty when there was nothing to lose — a bar still at its defaults resets
 * silently, because announcing a reset of nothing teaches a reader to ignore the
 * line. Years Back is not counted: it carries over, so it was not lost.
 *
 * The Table is named in preference to the Period when both moved, matching the
 * source's own order (`FilterBar.js:566-569`). Both cannot move on a Build
 * screen today — the Period is the route — but ticket 12 adds the Period
 * control, and a reset that named the wrong one would be worse than silence.
 */
export function filterResetNotice(
  before: MisPendingFilters,
  from: MisFilterView,
  to: MisFilterView,
): string {
  const switchedTo =
    from.table !== to.table
      ? MIS_TABLE_LABELS[to.table]
      : from.period !== to.period
        ? MIS_PERIOD_LABELS[to.period]
        : "";
  if (!switchedTo) return "";

  // The defaults the reader was sitting on, at whatever Years Back they had, so
  // that the one filter the switch carries over cannot count as one it dropped.
  const untouched = defaultPending(from);
  untouched.yearsBack = before.yearsBack;
  return samePending(before, untouched) ? "" : `Filters reset to the ${switchedTo} defaults`;
}

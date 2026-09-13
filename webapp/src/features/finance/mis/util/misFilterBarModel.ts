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

import { allowedTypeValues } from "./misViewState";
import {
  CUMULATIVE_KEY_BY_PERIOD,
  LIST_FILTER_PARAMS,
  MIS_PERIODS,
  MIS_TABLES,
  MIS_WINDOWS,
  TYPE_KEY_BY_PERIOD,
  TYPE_VALUES_BY_PERIOD,
  type MisAppliedFilters,
  type MisChannelDirect,
  type MisConfidenceLevel,
  type MisEndingMonth,
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

/** `ARR` on Annually, `QRR` on Quarterly, `MRR` on Monthly. */
const periodInitials = (period: MisPeriod): string =>
  period === MIS_PERIODS.ANNUALLY ? "ARR" : period === MIS_PERIODS.QUARTERLY ? "QRR" : "MRR";

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

/** Every control this module names, in the order the bar lays them out. */
export type MisFilterControl =
  | "viewType"
  | "salesRegion"
  | "subRegion"
  | "typeValue"
  | "channelDirect"
  | "confidenceLevel"
  | "endingMonth"
  | "billingCountry"
  | "industry"
  | "subIndustry"
  | "accountOwner"
  | "technicalOwner"
  | "channelManager"
  | "shippingCountry"
  | "yearsBack"
  | "isYtd"
  | "cumulative";

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
 * `annuallyDateRanges`. Both are derived, and `hydrateAppliedFilters` derives
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
 * Three rules, and they run in this order because the later ones read what the
 * earlier ones decided:
 *
 *   1. A View keeps only the region list it uses. Sending a Sub Region filter
 *      on a Sales Region view asks the backend to narrow by something the
 *      reader cannot see they narrowed by.
 *   2. A type the view does not offer becomes Total. This is where the Table
 *      rules and the TTM rule both land — `allowedTypeValues` is the one place
 *      that knows them, and it is the same function the URL validates against,
 *      so a control can never hold a type the address would drop.
 *   3. A Confidence that is no longer steering anything goes back to Commit.
 *      Reads the type rule 2 may have just changed.
 */
export function normalisePending(
  pending: MisPendingFilters,
  { period, table, viewWindow = MIS_WINDOWS.CALENDAR }: MisFilterView,
): MisPendingFilters {
  const next = { ...pending };
  if (next.viewType !== "Sales Region" && next.salesRegion.length) next.salesRegion = [];
  if (next.viewType !== "Sub Region" && next.subRegion.length) next.subRegion = [];

  const allowed = allowedTypeValues(period, table, viewWindow);
  if (!allowed.includes(next.typeValue)) {
    next.typeValue = allowed[0] ?? TYPE_VALUES_BY_PERIOD[period][0];
  }
  if (!usesConfidence(next.typeValue)) next.confidenceLevel = "Commit";
  return next;
}

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

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

// A Finance MIS Build view, as a query string.
//
// The Period lives in the route path (arr-build / qrr-build / mrr-build).
// Everything else that defines a view — Table, Unit, Scale, Window and the
// Applied filters — goes in the query string, so that changing a filter,
// copying the address and sending it to someone else shows them what you saw.
// This module is the only place that knows both the URL vocabulary and the
// internal filter keys.
//
// The mechanics it is built on — omit defaults, ignore anything unrecognised,
// count what was recognised — are shared, in `@utils/queryState`. What is here
// is only MIS's own vocabulary and its conditional rules.
//
// ---- why the rules are copied rather than improved ------------------------
//
// Every rule below comes over verbatim from
// digiops-finance/apps/mis/webapp/src/components/arrDashboard/utils/viewState.js.
// The two apps run side by side through the parallel period (ADR 0003), and
// people hold links already. Two apps, one URL shape. Where this port does
// depart, the comment says so and names the reason; there are two such places,
// `_applyId` and the summary mirror inside `applyWindow`, both marked below.

import {
  booleanParam,
  integerParam,
  listParam,
  oneOfParam,
  queryReader,
  queryWriter,
  type QueryParamCodec,
  type QueryParamReader,
} from "@utils/queryState";
import {
  CUMULATIVE_KEY_BY_PERIOD,
  CUSTOM_UNIT,
  ENDING_MONTH_TODAY,
  ENDING_MONTH_VALUES,
  FORECAST_STATES,
  FORECAST_TYPE_VALUES,
  LIST_FILTER_PARAMS,
  MIS_CHANNEL_DIRECT,
  MIS_CONFIDENCE_LEVELS,
  MIS_PERIODS,
  MIS_SCALES,
  MIS_TABLES,
  MIS_VIEW_TYPES,
  MIS_WINDOWS,
  TYPE_KEY_BY_PERIOD,
  TYPE_VALUES_BY_PERIOD,
  UNIT_CODE_PATTERN,
  YEARS_BACK_RANGE,
  dropRegionsOutsideTheirView,
  isAllowedTtmEndingMonth,
  isSummaryTable,
  mirrorsTypeToArrType,
  type MisAppliedFilters,
  type MisDateRange,
  type MisEndingMonth,
  type MisFilterControl,
  type MisPeriod,
  type MisScale,
  type MisTable,
  type MisWindow,
} from "./misViewVocabulary";

/**
 * Subscription is the implicit default Table, so it has no slug: it is never
 * written, and `table=subscription` reads as unrecognised like any other value
 * this app never wrote.
 */
const TABLE_SLUGS: Partial<Record<MisTable, string>> = {
  [MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS]: "customers",
  [MIS_TABLES.EXIT_ARR_BY_REGION]: "region-summary",
  [MIS_TABLES.EXIT_ARR_BY_BU]: "bu-summary",
};
const TABLE_BY_SLUG: Record<string, MisTable> = Object.fromEntries(
  Object.entries(TABLE_SLUGS).map(([table, slug]) => [slug, table as MisTable]),
);

/**
 * Read-side only: Subscription's "slug" is the absence of the parameter, which
 * no `format` can express. `serializeViewState` writes the Table itself.
 */
const tableSlugParam: QueryParamReader<MisTable> = { parse: (raw) => TABLE_BY_SLUG[raw] };

/** A BU or product selection, readable in a URL: `SW_APIM` ⇄ `sw-apim`. */
const unitParam: QueryParamCodec<string> = {
  parse: (raw) => {
    const code = raw.toUpperCase().replace(/-/g, "_");
    return UNIT_CODE_PATTERN.test(code) ? code : undefined;
  },
  format: (code) => code.toLowerCase().replace(/_/g, "-"),
};

/** The only Scale that reaches a URL; units is the default and is never written. */
const SCALE_THOUSANDS = "k";

/**
 * Read-side only, both of them: each has exactly one value worth writing, so
 * the writer sets the literal and omits the parameter otherwise. A `format`
 * here would have to ignore its argument and return that literal regardless —
 * a lie about `scale=units` and `window=calendar` that the type could not catch.
 */
const scaleParam: QueryParamReader<MisScale> = {
  parse: (raw) => (raw === SCALE_THOUSANDS ? MIS_SCALES.THOUSANDS : undefined),
};
const windowParam: QueryParamReader<MisWindow> = {
  parse: (raw) => (raw === MIS_WINDOWS.TTM ? MIS_WINDOWS.TTM : undefined),
};

/**
 * One codec per parameter, used in BOTH directions.
 *
 * Sharing them is what keeps serialise and parse from drifting: a value the
 * writer can produce is by construction a value the reader accepts, which is
 * the whole of "every parameter round-trips".
 *
 * Two of them depend on the view — the type values a Table offers differ, and
 * on a TTM window they differ again — so this is a function of the Period, the
 * Table and the Window rather than a constant.
 */
function codecsFor(period: MisPeriod, table: MisTable, viewWindow: MisWindow) {
  return {
    unit: unitParam,
    years: integerParam(YEARS_BACK_RANGE),
    ytd: booleanParam,
    endingMonth: oneOfParam(ENDING_MONTH_VALUES),
    type: oneOfParam(allowedTypeValues(period, table, viewWindow)),
    view: oneOfParam(MIS_VIEW_TYPES),
    confidence: oneOfParam(MIS_CONFIDENCE_LEVELS),
    channel: oneOfParam(MIS_CHANNEL_DIRECT),
    cumulative: booleanParam,
    list: listParam,
  };
}

/**
 * Years Back a Table starts on: 5 on Annually, except Exit ARR by Region at 2;
 * 1 on Quarterly and Monthly.
 */
export function defaultYearsBack(period: MisPeriod, table: MisTable): number {
  if (period !== MIS_PERIODS.ANNUALLY) return 1;
  return table === MIS_TABLES.EXIT_ARR_BY_REGION ? 2 : 5;
}

/** What a TTM window offers whatever the Table: no forecast, and Delayed is in. */
const TTM_TYPE_VALUES = /^(Total|Closed Won|Delayed)/;

/**
 * The type values a Table offers, mirroring the filter bar's option lists:
 * the summaries take Total and Closed Won only, Customers has no Renewal, and
 * the Build has no Delayed.
 *
 * Validating a link against a single global list instead would restore views
 * the filter bar cannot show — a Renewal column on a summary that has no
 * Renewal option.
 *
 * ---- the Window, and why it is here rather than in the control -------------
 *
 * A TTM window has a list of its own — Total, Closed Won, Delayed — which is
 * neither of the two above: it ADDS Delayed to the Build and REMOVES Forecasted
 * and Renewal from everything. The source keeps that rule in the filter bar
 * alone (`FilterBar.js:493`, `arrTypeOptionsUI`) and its own URL contract never
 * learned it, so the two disagree in both directions: picking Delayed on a TTM
 * Build moved the grid and was then dropped from the address, and a link
 * carrying `window=ttm&type=Forecasted ARR` hydrated a forecast the bar has no
 * option for. Ported here instead, once, so the control and the contract cannot
 * drift — spec §7. It is the one place a Window has ever had to be known.
 *
 * The summaries are deliberately NOT widened. Spec §3 states their list as a
 * business rule — a summary reports a balance, it does not cut a trailing
 * window — and the source's blanket TTM branch reaching them too looks like the
 * accident rather than the intent.
 */
export function allowedTypeValues(
  period: MisPeriod,
  table: MisTable,
  viewWindow: MisWindow = MIS_WINDOWS.CALENDAR,
): readonly string[] {
  const all = TYPE_VALUES_BY_PERIOD[period] ?? [];
  if (isSummaryTable(table)) return all.filter((value) => !/^(Delayed|Forecasted|Renewal)/.test(value));
  // Annually is the only Period with a Window, so one named on either of the
  // others is not a narrowing — it is a parameter that was already ignored.
  if (period === MIS_PERIODS.ANNUALLY && viewWindow === MIS_WINDOWS.TTM) {
    return all.filter((value) => TTM_TYPE_VALUES.test(value));
  }
  if (table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS) return all.filter((value) => !value.startsWith("Renewal"));
  return all.filter((value) => !value.startsWith("Delayed"));
}

/**
 * The filters only the Build offers — every Table keeps them on screen, but
 * three of the four will not let a reader use them.
 *
 * The source's `UNAVAILABLE_BUILD_FILTERS` (`FilterBar.js:238`), which is a list
 * of LABELS there and so cannot be asked anything; these are the filters
 * themselves. Sales Region and Sub Region are deliberately not among them: they
 * appear only under their own View, and View is here, so they are already gone
 * wherever this list applies.
 */
const BUILD_ONLY_FILTERS = [
  "viewType",
  "billingCountry",
  "shippingCountry",
  "industry",
  "subIndustry",
  "accountOwner",
  "technicalOwner",
  "channelManager",
] as const satisfies readonly MisFilterControl[];

/**
 * The filters that can ever be unavailable — narrower than `MisFilterControl`,
 * and narrower on purpose.
 *
 * Every one of these is also a key of the Applied set, which is what lets
 * `hydrateAppliedFilters` restore it by its own name. `typeValue` is the one
 * control that is not — on the wire it is `arrType` / `qrrType` / `mrrType` —
 * and it is never unavailable, because every Table offers a type. Saying that in
 * the type means the restore loop below does not have to say it in a branch that
 * can never run.
 */
type MisUnavailableFilter = (typeof BUILD_ONLY_FILTERS)[number] | "channelDirect" | "cumulative";

/**
 * The filters a Table does not offer.
 *
 * Two readers, one answer — the same arrangement `allowedTypeValues` above has,
 * and for the same reason. The BAR keeps these on screen greyed out, saying
 * which Table took them away, so that nothing vanishes silently between Tables.
 * `hydrateAppliedFilters` DROPS them, so a link cannot narrow a view by
 * something no control on it can show: without that, `?table=customers&
 * industry=SaaS` would send an Industry the reader can neither see nor clear.
 *
 * ---- what each Table takes away, and why -----------------------------------
 *
 *   Customers   is a list of accounts rather than a movement, and its backing
 *               read is `POST /accounts`: no View to cut by, none of the
 *               account or geography lists, and no Channel/Direct split.
 *   the two     ARE the per-unit split, so a View or an account list would be
 *   summaries   narrowing by the thing they are reporting. They do keep a
 *               working Channel/Direct, which Customers does not.
 *
 * The cumulative flag is named only where the Period has one; on Annually there
 * is no such control to grey out.
 */
export function unavailableFilters(
  period: MisPeriod,
  table: MisTable,
): ReadonlySet<MisUnavailableFilter> {
  if (table === MIS_TABLES.SUBSCRIPTION) return new Set();
  const unavailable = new Set<MisUnavailableFilter>(BUILD_ONLY_FILTERS);
  if (table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS) unavailable.add("channelDirect");
  if (CUMULATIVE_KEY_BY_PERIOD[period]) unavailable.add("cumulative");
  return unavailable;
}

/**
 * The Applied filters a Build screen arrives at with nothing set — which is
 * also the baseline the serialiser omits against, so this and the URL contract
 * cannot disagree about what "default" means.
 */
export function defaultAppliedFilters(period: MisPeriod, table: MisTable): MisAppliedFilters {
  const typeValue = TYPE_VALUES_BY_PERIOD[period]?.[0];
  const defaults: MisAppliedFilters = {
    viewType: "Global",
    confidenceLevel: "Commit",
    channelDirect: "All",
    isYtd: true,
    endingMonth: ENDING_MONTH_TODAY,
    yearsBack: defaultYearsBack(period, table),
    buProductSelection: "BU_ALL",
    customBusinessUnits: [],
    customProductUnits: [],
    forecast: FORECAST_STATES.DISABLE,
    salesRegion: [],
    subRegion: [],
    billingCountry: [],
    shippingCountry: [],
    industry: [],
    subIndustry: [],
    accountOwner: [],
    technicalOwner: [],
    channelManager: [],
    [TYPE_KEY_BY_PERIOD[period]]: typeValue,
  };
  if (mirrorsTypeToArrType(period, table)) defaults.arrType = typeValue;
  const cumulativeKey = CUMULATIVE_KEY_BY_PERIOD[period];
  if (cumulativeKey) defaults[cumulativeKey] = false;
  return defaults;
}

/** A view, as the screen holds it. */
export interface MisView {
  period: MisPeriod;
  table: MisTable;
  scale?: MisScale;
  viewWindow?: MisWindow;
  filters?: Partial<MisAppliedFilters>;
}

/**
 * Write a view as a query string, without the leading `?`.
 *
 * Defaults and derived fields are omitted, so a default view serialises to `''`
 * — see `@utils/queryState` for why that rule is load-bearing rather than
 * cosmetic.
 */
export function serializeViewState({
  period,
  table,
  scale = MIS_SCALES.UNITS,
  viewWindow = MIS_WINDOWS.CALENDAR,
  filters = {},
}: MisView): string {
  const defaults = defaultAppliedFilters(period, table);
  const codecs = codecsFor(period, table, viewWindow);
  const query = queryWriter();
  const isTtm = viewWindow === MIS_WINDOWS.TTM;

  const slug = TABLE_SLUGS[table];
  if (slug) query.set("table", slug);
  // TTM is a way of cutting an Annually column. The other two Periods have no
  // such cut, so writing it there would make a promise the screen cannot keep.
  if (period === MIS_PERIODS.ANNUALLY && isTtm) query.set("window", MIS_WINDOWS.TTM);

  query.setIfChanged("unit", filters.buProductSelection, defaults.buProductSelection, codecs.unit);
  // The custom lists are what "custom" means; beside any other selection they
  // describe a view no control in the app can express.
  if (filters.buProductSelection === CUSTOM_UNIT) {
    query.setIfChanged("customBu", filters.customBusinessUnits, defaults.customBusinessUnits, codecs.list);
    query.setIfChanged("customProduct", filters.customProductUnits, defaults.customProductUnits, codecs.list);
  }
  query.setIfChanged("years", filters.yearsBack, defaults.yearsBack, codecs.years);
  // A TTM window runs twelve months back from its end date, so year-to-date has
  // nothing to say about it.
  if (!isTtm) query.setIfChanged("ytd", filters.isYtd, defaults.isYtd, codecs.ytd);
  if (!isTtm || isAllowedTtmEndingMonth(filters.endingMonth)) {
    query.setIfChanged("endingMonth", filters.endingMonth, defaults.endingMonth, codecs.endingMonth);
  }

  const typeKey = TYPE_KEY_BY_PERIOD[period];
  query.setIfChanged("type", filters[typeKey], defaults[typeKey], codecs.type);
  query.setIfChanged("view", filters.viewType, defaults.viewType, codecs.view);
  query.setIfChanged("confidence", filters.confidenceLevel, defaults.confidenceLevel, codecs.confidence);
  query.setIfChanged("channel", filters.channelDirect, defaults.channelDirect, codecs.channel);
  const cumulativeKey = CUMULATIVE_KEY_BY_PERIOD[period];
  if (cumulativeKey) {
    query.setIfChanged("cumulative", filters[cumulativeKey], defaults[cumulativeKey], codecs.cumulative);
  }
  for (const [key, param] of LIST_FILTER_PARAMS) {
    query.setIfChanged(param, filters[key], defaults[key], codecs.list);
  }

  if (scale === MIS_SCALES.THOUSANDS) query.set("scale", SCALE_THOUSANDS);
  return query.toString();
}

/** What a query string turned out to say. */
export interface MisParsedView {
  /** Absent for the implicit Subscription default, and for an unknown slug. */
  table?: MisTable;
  scale?: MisScale;
  /** Absent for Calendar, which is the default. */
  viewWindow?: MisWindow;
  /** Only the filters the URL actually carried. Feed to `hydrateAppliedFilters`. */
  filters: Partial<MisAppliedFilters>;
  /**
   * Whether the link carried a view at all — which is how a screen decides
   * between hydrating from the URL and keeping its own defaults. Scale does not
   * count; see spec §8.2.
   */
  hasViewState: boolean;
}

/**
 * Read a view from a query string, with or without the leading `?`.
 *
 * Only recognised, well-formed values come back. Everything else is ignored, so
 * a link with a typo in it degrades to the default view rather than erroring.
 */
export function parseViewState(search: string, { period }: { period: MisPeriod }): MisParsedView {
  const query = queryReader(search);
  const filters: Partial<MisAppliedFilters> = {};

  function read<K extends keyof MisAppliedFilters>(
    param: string,
    key: K,
    codec: QueryParamCodec<NonNullable<MisAppliedFilters[K]>>,
  ): void {
    const value = query.read(param, codec);
    if (value !== undefined) filters[key] = value;
  }

  const table = query.read("table", tableSlugParam);
  // Which type values are legal depends on the Table, and an absent one means
  // Subscription rather than "no table".
  const effectiveTable = table ?? MIS_TABLES.SUBSCRIPTION;

  // Scale is session state, not filter hydration (spec §8.2), so it is read but
  // never counted: a link carrying only `?scale=k` carries no view.
  const scale = query.read("scale", scaleParam, { countsAsViewState: false });
  // Read before the codecs are built, not after: the Window narrows which type
  // values are legal, so a codec made without it would accept a forecast on a
  // trailing window.
  const viewWindow = period === MIS_PERIODS.ANNUALLY ? query.read("window", windowParam) : undefined;
  const isTtm = viewWindow === MIS_WINDOWS.TTM;
  const codecs = codecsFor(period, effectiveTable, viewWindow ?? MIS_WINDOWS.CALENDAR);

  read("unit", "buProductSelection", codecs.unit);
  if (filters.buProductSelection === CUSTOM_UNIT) {
    read("customBu", "customBusinessUnits", codecs.list);
    read("customProduct", "customProductUnits", codecs.list);
  }
  read("years", "yearsBack", codecs.years);
  if (!isTtm) read("ytd", "isYtd", codecs.ytd);
  read("endingMonth", "endingMonth", codecs.endingMonth);
  if (isTtm && !isAllowedTtmEndingMonth(filters.endingMonth)) delete filters.endingMonth;
  read("type", TYPE_KEY_BY_PERIOD[period], codecs.type);
  read("view", "viewType", codecs.view);
  read("confidence", "confidenceLevel", codecs.confidence);
  read("channel", "channelDirect", codecs.channel);
  const cumulativeKey = CUMULATIVE_KEY_BY_PERIOD[period];
  if (cumulativeKey) read("cumulative", cumulativeKey, codecs.cumulative);
  for (const [key, param] of LIST_FILTER_PARAMS) read(param, key, codecs.list);

  return { table, scale, viewWindow, filters, hasViewState: query.recognised > 0 };
}

/**
 * How an Annually table's column ranges are computed for a Window.
 *
 * Injected rather than imported. Those ranges are computed in Pacific Time,
 * which is ticket 05's to build and is the easiest thing in this port to get
 * silently wrong — so the URL contract is testable, and shippable, without a
 * timezone in it. Omit it and the ranges are simply not computed.
 */
export type ColumnRangesFor = (viewWindow: MisWindow, filters: MisAppliedFilters) => MisDateRange[];

export interface HydrateOptions {
  /** Omitted Window is Calendar. */
  viewWindow?: MisWindow;
  columnRangesFor?: ColumnRangesFor;
}

/**
 * Turn the partial filters a URL carried into the complete Applied set the
 * grids expect, including the fields the filter bar would have derived on
 * Apply: forecast mode, the summary `arrType` mirror, and the column ranges.
 *
 * ---- what this deliberately does NOT carry over ---------------------------
 *
 * The source stamps `_applyId: Date.now()` on every applied set, as a token its
 * hand-rolled fetch effects compare to decide whether to refetch
 * (`useExitArrByBU.js:170`). One WSO2 uses TanStack Query, where the query key
 * is built from the serialised filter body (spec §6) — so the same job is
 * already done, and a timestamp in that key would make every key unique, miss
 * the cache on every apply, and refetch on every hydrate. Dropping it is not a
 * behaviour change; keeping it would be.
 */
export function hydrateAppliedFilters(
  parsed: Partial<MisAppliedFilters>,
  period: MisPeriod,
  table: MisTable,
  { viewWindow = MIS_WINDOWS.CALENDAR, columnRangesFor }: HydrateOptions = {},
): MisAppliedFilters {
  const defaults = defaultAppliedFilters(period, table);
  const applied: MisAppliedFilters = { ...defaults, ...parsed };
  // A link cannot narrow a view by a filter the view has no control for. The
  // bar shows these greyed out at their defaults, so a link that carried one
  // would put the grid and the bar at odds — and leave the reader looking at a
  // narrowed report with nothing on screen saying what narrowed it, or how to
  // undo it. The same list the bar greys out; see `unavailableFilters`.
  for (const control of unavailableFilters(period, table)) {
    // The cumulative flag is the one whose Applied key is not its own name: it
    // is `cumulativeQuarterly` or `cumulativeMonthly`, and neither on Annually.
    if (control === "cumulative") {
      const cumulativeKey = CUMULATIVE_KEY_BY_PERIOD[period];
      if (cumulativeKey) Object.assign(applied, { [cumulativeKey]: defaults[cumulativeKey] });
      continue;
    }
    applied[control] = defaults[control] as never;
  }
  // A region list outside its own View is the same hole by another route. Here
  // rather than in the loop above because it applies on the Build too, where
  // nothing is unavailable at all — and it is the filter bar's own rule, which
  // is why both read one function.
  dropRegionsOutsideTheirView(applied);
  const typeValue = applied[TYPE_KEY_BY_PERIOD[period]];
  if (mirrorsTypeToArrType(period, table)) applied.arrType = typeValue;
  // Spec §8.3, reproduced deliberately: on Customers, a Delayed type silently
  // drops Years Back to 1 unless the link set it. Written against the Annually
  // value in the source, so it reaches only that Period — the other two already
  // start at 1, which is why nobody has noticed.
  if (table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS && typeValue === "Delayed ARR" && parsed.yearsBack == null) {
    applied.yearsBack = 1;
  }
  applied.forecast = typeValue !== undefined && FORECAST_TYPE_VALUES.has(typeValue)
    ? FORECAST_STATES.ENABLE
    : FORECAST_STATES.DISABLE;
  if (period === MIS_PERIODS.ANNUALLY && columnRangesFor) {
    applied.columnDateRanges = columnRangesFor(viewWindow, applied);
  }
  return applied;
}

/** The YTD and Ending Month a Calendar view had before the switch to TTM. */
export interface MisRememberedWindow {
  isYtd?: boolean;
  endingMonth?: MisEndingMonth;
}

export interface ApplyWindowContext {
  period: MisPeriod;
  table: MisTable;
  /** The Window before the switch. Omitted is Calendar. */
  fromWindow?: MisWindow;
  /** What the last Calendar → TTM switch saved. */
  remembered?: MisRememberedWindow;
  columnRangesFor?: ColumnRangesFor;
}

export interface MisWindowSwitch {
  filters: MisAppliedFilters;
  viewWindow: MisWindow;
  remembered: MisRememberedWindow;
}

/**
 * Switch an Annually table between Calendar and TTM.
 *
 * Calendar → TTM coerces a Forecasted or Renewal type back to Total, because a
 * TTM window has no forecast to show; resets YTD, because a trailing window is
 * not a year to date; and remembers the YTD it replaced so the way home
 * restores what the reader had chosen rather than a default.
 *
 * Quarterly and Monthly have no Window, so a call for either is a no-op that
 * reports Calendar.
 */
export function applyWindow(
  applied: MisAppliedFilters,
  nextWindow: MisWindow,
  { period, table, fromWindow = MIS_WINDOWS.CALENDAR, remembered = {}, columnRangesFor }: ApplyWindowContext,
): MisWindowSwitch {
  if (period !== MIS_PERIODS.ANNUALLY) {
    return { filters: { ...applied }, viewWindow: MIS_WINDOWS.CALENDAR, remembered: { ...remembered } };
  }

  const viewWindow = nextWindow === MIS_WINDOWS.TTM ? MIS_WINDOWS.TTM : MIS_WINDOWS.CALENDAR;
  const filters: MisAppliedFilters = { ...applied };
  const withRanges = (nextRemembered: MisRememberedWindow): MisWindowSwitch => {
    if (columnRangesFor) filters.columnDateRanges = columnRangesFor(viewWindow, filters);
    return { filters, viewWindow, remembered: nextRemembered };
  };

  if (viewWindow === MIS_WINDOWS.TTM) {
    const typeKey = TYPE_KEY_BY_PERIOD[period];
    const typeValue = filters[typeKey];
    if (typeValue !== undefined && FORECAST_TYPE_VALUES.has(typeValue)) {
      // Annually's own type key IS `arrType`, so this is also the summary
      // mirror. The source calls mirrorsTypeToArrType here as well, which can
      // never be true: it requires a Period other than Annually, and every one
      // of those has already returned above. Dropped rather than ported as a
      // line that cannot run — the mirror lives in hydrateAppliedFilters, where
      // it is reachable.
      filters[typeKey] = TYPE_VALUES_BY_PERIOD[period]?.[0];
      filters.forecast = FORECAST_STATES.DISABLE;
    }
    // Every legal Ending Month is legal on TTM today, so `endingMonthAllowed`
    // is always true and the two branches below that restore it are unreachable.
    // They are kept, unlike the dead mirror above, because they hang off a rule
    // that is designed to be narrowed — see `isAllowedTtmEndingMonth`. Dropping
    // them would move the cost of narrowing it from nowhere to here.
    const endingMonthAllowed = isAllowedTtmEndingMonth(applied.endingMonth);
    // Switching TTM → TTM must not overwrite what Calendar left behind, or the
    // way home restores the reset value instead of the reader's choice.
    const nextRemembered: MisRememberedWindow = fromWindow === MIS_WINDOWS.TTM
      ? { ...remembered }
      : { isYtd: applied.isYtd, ...(endingMonthAllowed ? {} : { endingMonth: applied.endingMonth }) };
    const defaults = defaultAppliedFilters(period, table);
    filters.isYtd = defaults.isYtd;
    if (!endingMonthAllowed) filters.endingMonth = defaults.endingMonth;
    return withRanges(nextRemembered);
  }

  if (fromWindow === MIS_WINDOWS.TTM) {
    if (remembered.isYtd != null) filters.isYtd = remembered.isYtd;
    if (remembered.endingMonth != null) filters.endingMonth = remembered.endingMonth;
    return withRanges({});
  }
  return withRanges({ ...remembered });
}


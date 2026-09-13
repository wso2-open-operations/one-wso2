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

// The words a Finance MIS view is made of, and nothing about URLs.
//
// Ported from the slice of digiops-finance
// apps/mis/webapp/src/components/arrDashboard/utils/tableConstants.js that the
// view state needs. The names follow CONTEXT.md rather than the source where
// the two disagree — Period, not Timeframe — but every VALUE is verbatim,
// because these strings go over the wire to the MIS backends and into links
// people already hold.
//
// `misViewState.ts` is the other half: which parameter each of these words
// becomes in a query string.

/**
 * The time bucket a Build covers. Carried in the route path
 * (arr-build / qrr-build / mrr-build), never in the query string.
 */
export const MIS_PERIODS = {
  ANNUALLY: "annually",
  QUARTERLY: "quarterly",
  MONTHLY: "monthly",
} as const;
export type MisPeriod = (typeof MIS_PERIODS)[keyof typeof MIS_PERIODS];

/** Which of the four grids a Build screen is showing. */
export const MIS_TABLES = {
  SUBSCRIPTION: "subscription",
  SOFTWARE_CLOUD_CUSTOMERS: "software-cloud-customers",
  EXIT_ARR_BY_REGION: "exit-arr-by-region",
  EXIT_ARR_BY_BU: "exit-arr-by-bu",
} as const;
export type MisTable = (typeof MIS_TABLES)[keyof typeof MIS_TABLES];

/**
 * How an Annually column is cut: calendar years, or trailing-twelve-month
 * windows. Not a Period and not an Applied filter.
 *
 * CONTEXT.md warns that "Window" carries two meanings in this port — it was
 * also a MIS filter control, dropped from the FilterBar. This is the other one:
 * the column cut, which survives in the serialised view-state contract.
 */
export const MIS_WINDOWS = {
  CALENDAR: "calendar",
  TTM: "ttm",
} as const;
export type MisWindow = (typeof MIS_WINDOWS)[keyof typeof MIS_WINDOWS];

/**
 * How currency figures are shown: at full value, or in thousands. It scales
 * currency rows only, and never counts or percentages — a rule the formatter
 * enforces (ticket 05), not this module.
 */
export const MIS_SCALES = {
  UNITS: "units",
  THOUSANDS: "thousands",
} as const;
export type MisScale = (typeof MIS_SCALES)[keyof typeof MIS_SCALES];

/** Ending Month's "no month chosen" value. The parenthetical is on the wire. */
export const ENDING_MONTH_TODAY = "Today (Default)";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Every value Ending Month accepts. */
export const ENDING_MONTH_VALUES = [ENDING_MONTH_TODAY, ...MONTH_NAMES] as const;
export type MisEndingMonth = (typeof ENDING_MONTH_VALUES)[number];

/** The geography a Build is cut by. */
export const MIS_VIEW_TYPES = ["Global", "Sales Region", "Sub Region"] as const;
export type MisViewType = (typeof MIS_VIEW_TYPES)[number];

/** The partner model a customer was sold through. */
export const MIS_CHANNEL_DIRECT = ["All", "Channel", "Direct"] as const;
export type MisChannelDirect = (typeof MIS_CHANNEL_DIRECT)[number];

/**
 * Whether the reader has narrowed to a single partner book.
 *
 * Two rules turn on this one question and must agree: the backend is told about
 * `partnerType` only when it is narrowed, and the transfer rows are only worth
 * showing then — with both books on screen a transfer is internal. Written once
 * so the grid cannot show transfer rows for figures the backend was never asked
 * to split.
 */
export const isOnePartnerBook = (channelDirect: string): boolean =>
  channelDirect === "Channel" || channelDirect === "Direct";

/** How much of the forecast pipeline a forecast type includes. */
export const MIS_CONFIDENCE_LEVELS = [
  "Commit",
  "Commit + Best Case",
  "Commit + Best Case + Upside",
  "GM",
] as const;
export type MisConfidenceLevel = (typeof MIS_CONFIDENCE_LEVELS)[number];

/** Whether the grids fetch forecast columns. Derived from the type, never chosen. */
export const FORECAST_STATES = { ENABLE: "Enable", DISABLE: "Disable" } as const;
export type MisForecastState = (typeof FORECAST_STATES)[keyof typeof FORECAST_STATES];

/** Years Back's legal range, on every Period and every Table. */
export const YEARS_BACK_RANGE = { min: 1, max: 10 } as const;

/**
 * A BU or product selection code, or the custom selection.
 *
 * `BU_` is a business unit, `SW_` and `CL_` the software and cloud product
 * lines. Validated by shape rather than against a list because the list comes
 * from the ARR backend's `/app-configs` at runtime — a link written today has
 * to survive a unit being added tomorrow.
 */
export const UNIT_CODE_PATTERN = /^(BU|SW|CL)_[A-Z_]+$|^CUSTOM$/;

/** The Unit selection that unlocks the two custom lists. */
export const CUSTOM_UNIT = "CUSTOM";

/** One column range of an Annually table, as the grids and the backends want it. */
export interface MisDateRange {
  /** `yyyy/MM/dd` */
  start: string;
  /** `yyyy/MM/dd` */
  end: string;
  /** TTM only: the balance the window opens from. */
  opening?: string;
  /** TTM only: the column label. */
  header?: string;
}

/**
 * The Applied filters — those the user has committed, and which therefore
 * belong in the query string.
 *
 * A field whose legal values are a closed list written down above gets that
 * list as its type. A field whose legal values are decided elsewhere keeps
 * `string`, because a union would be a compile-time promise about a runtime
 * answer: the units come from the ARR backend's `/app-configs`, so do the nine
 * list filters, and which type values are legal is a per-Table question that
 * `allowedTypeValues` answers. Those three are validated where it counts
 * instead — by the codecs in `misViewState.ts`, the only place an outside value
 * gets in.
 */
export interface MisAppliedFilters {
  viewType: MisViewType;
  confidenceLevel: MisConfidenceLevel;
  channelDirect: MisChannelDirect;
  isYtd: boolean;
  endingMonth: MisEndingMonth;
  yearsBack: number;
  /** A BU or product code from `/app-configs`, or `CUSTOM`. */
  buProductSelection: string;
  customBusinessUnits: string[];
  customProductUnits: string[];
  /** Derived from the type on every apply. Never a URL parameter. */
  forecast: MisForecastState;
  salesRegion: string[];
  subRegion: string[];
  billingCountry: string[];
  shippingCountry: string[];
  industry: string[];
  subIndustry: string[];
  accountOwner: string[];
  technicalOwner: string[];
  channelManager: string[];
  /** The Period's own type. Exactly one of these three is ever set. */
  arrType?: string;
  qrrType?: string;
  mrrType?: string;
  /** The Period's own cumulative flag. Annually has none. */
  cumulativeQuarterly?: boolean;
  cumulativeMonthly?: boolean;
  /** Derived column ranges, computed in Pacific Time. Never a URL parameter. */
  annuallyDateRanges?: MisDateRange[];
}

/** The Applied-filter key holding the Period's type. */
export const TYPE_KEY_BY_PERIOD = {
  [MIS_PERIODS.ANNUALLY]: "arrType",
  [MIS_PERIODS.QUARTERLY]: "qrrType",
  [MIS_PERIODS.MONTHLY]: "mrrType",
} as const satisfies Record<MisPeriod, "arrType" | "qrrType" | "mrrType">;

/** The Applied-filter key holding the Period's cumulative flag. Annually has none. */
export const CUMULATIVE_KEY_BY_PERIOD: Partial<
  Record<MisPeriod, "cumulativeQuarterly" | "cumulativeMonthly">
> = {
  [MIS_PERIODS.QUARTERLY]: "cumulativeQuarterly",
  [MIS_PERIODS.MONTHLY]: "cumulativeMonthly",
};

/** Every type value each Period offers, Total first. */
export const TYPE_VALUES_BY_PERIOD: Record<MisPeriod, readonly string[]> = {
  [MIS_PERIODS.ANNUALLY]: ["Total ARR", "Closed Won ARR", "Delayed ARR", "Forecasted ARR", "Renewal ARR"],
  [MIS_PERIODS.QUARTERLY]: ["Total QRR", "Closed Won QRR", "Delayed QRR", "Forecasted QRR", "Renewal QRR"],
  [MIS_PERIODS.MONTHLY]: ["Total MRR", "Closed Won MRR", "Delayed MRR", "Forecasted MRR", "Renewal MRR"],
};

/** The type values that turn forecast mode on. */
export const FORECAST_TYPE_VALUES: ReadonlySet<string> = new Set([
  "Forecasted ARR", "Renewal ARR",
  "Forecasted QRR", "Renewal QRR",
  "Forecasted MRR", "Renewal MRR",
]);

/** Applied-filter key paired with the URL parameter it is written as. */
export type MisListFilterKey =
  | "salesRegion" | "subRegion" | "billingCountry" | "shippingCountry"
  | "industry" | "subIndustry" | "accountOwner" | "technicalOwner" | "channelManager";

/**
 * The nine list filters, and the readable parameter each becomes.
 *
 * The names differ on purpose — `accountOwner` is `owner` in a link — because a
 * URL is read by people. See spec §4.
 */
export const LIST_FILTER_PARAMS: readonly (readonly [key: MisListFilterKey, param: string])[] = [
  ["salesRegion", "region"],
  ["subRegion", "subRegion"],
  ["billingCountry", "billingCountry"],
  ["shippingCountry", "shippingCountry"],
  ["industry", "industry"],
  ["subIndustry", "subIndustry"],
  ["accountOwner", "owner"],
  ["technicalOwner", "techOwner"],
  ["channelManager", "channelMgr"],
];

/** Exit ARR by Region and by Business Unit — the two summaries. */
export const isSummaryTable = (table: MisTable): boolean =>
  table === MIS_TABLES.EXIT_ARR_BY_REGION || table === MIS_TABLES.EXIT_ARR_BY_BU;

/**
 * Whether the Period's type value is also copied to `arrType`.
 *
 * The summary tables fetch by `arrType` on every Period, so on Quarterly and
 * Monthly the Period's own type has to be mirrored there or the summaries fetch
 * last year's default.
 */
export const mirrorsTypeToArrType = (period: MisPeriod, table: MisTable): boolean =>
  isSummaryTable(table) && period !== MIS_PERIODS.ANNUALLY;

/**
 * Whether an Ending Month is legal on a TTM window.
 *
 * Every named month and Today are legal, so today this admits everything the
 * parser can produce — a TTM window simply ends on the last day of the month
 * chosen. It stays a named rule rather than being folded away because the
 * serialiser applies it to Applied filters, which come from the app's own state
 * rather than from a URL, and because spec §4 documents the parameter as
 * "dropped if not a legal TTM ending month". If the legal set is ever narrowed,
 * this is the one place to narrow it.
 */
export const isAllowedTtmEndingMonth = (endingMonth?: string): boolean =>
  endingMonth == null || ENDING_MONTH_VALUE_SET.has(endingMonth);

const ENDING_MONTH_VALUE_SET: ReadonlySet<string> = new Set(ENDING_MONTH_VALUES);

/**
 * The Period's own type value, or Total when none is set.
 *
 * The fallback is not defensive tidying. The first requests of a Build fire
 * before the reader has chosen anything, and a body with no type asks a
 * different question than a body asking for the total — so the default is
 * stated rather than omitted, which is what the source does at both call sites.
 */
export const typeValueOf = (filters: MisAppliedFilters): string =>
  filters.arrType || filters.qrrType || filters.mrrType || "Total ARR";

/**
 * Whether a confidence level applies, asked of each Period's own type key.
 *
 * Three INDEPENDENT checks, not one over whichever key happens to be set. The
 * summary tables mirror a Quarterly or Monthly type into `arrType` (spec §3),
 * so a filter set can legitimately carry both — and collapsing the three with
 * `arrType || qrrType || mrrType` would read the mirror and silently drop the
 * confidence off a Forecasted QRR. Mirrors `useArrTableSummary.js:272-275`.
 *
 * Renewal is deliberately absent: it turns forecast COLUMNS on without carrying
 * a confidence.
 *
 * Lives here rather than beside one request builder because BOTH endpoints ask
 * it — `/arr-summary` for a Build column and `/accounts` for the customer list —
 * and the two must agree. A forecast filtered by a confidence in one table and
 * not the other is two different customer populations under one filter chip.
 */
export const carriesConfidence = (filters: MisAppliedFilters): boolean =>
  filters.arrType === "Forecasted ARR" ||
  filters.qrrType === "Forecasted QRR" ||
  filters.mrrType === "Forecasted MRR";

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

// The bodies ARR Analysis sends — `POST /accounts` for the table, and
// `POST /exit-arr/search` for the figure above it.
//
// Ported from digiops-finance `arrAnalysis/api/arrAnalysisApi.js`:
// `buildBasePayload`, `resolveProducts`, `buildOptionalFilters` and
// `fetchAccounts`. Pure and separate from the hooks, like `misAccountsRequest`
// and `misArrSummaryRequest` before it — this is where the decisions about what
// the backend is TOLD live, and they are testable without one.
//
// ---- why there are two builders and not one with a flag --------------------
//
// The two bodies differ in two places and the differences pull opposite ways.
// `/accounts` asks what the customer book held on ONE DAY, so it carries no
// `startDate`; `/exit-arr/search` asks for a figure over a SPAN, so it carries
// both dates. And `/accounts` omits `businessUnits` at the whole-book default
// where `/exit-arr/search` always names it — which matters for ticket 14 rather
// than here: its per-industry and per-partner-model calls are this same body
// spread over, and they are compared against each other, so every one of them
// has to carry the same unit list or the comparison is between differently
// filtered figures.
//
// Everything they DO share is `optionalFilters`, which is the reader's
// narrowing and is identical in both — asserted, so the table and the figure
// above it can never be answering different questions.
//
// ---- and why `today` is an argument ---------------------------------------
//
// `endDate` is required: the backend answers 400 without one
// (`arr-backend/service.bal:103-112`). So a dismissed As Of Date has to resolve
// to today, and in MIS "today" means Pacific Time (spec §3) rather than the
// viewer's zone, which is what the source uses. Passing it in keeps this module
// free of clocks and lets the fallback be tested on a named day.

import type { MisCivilDate } from "../util/misPacificTime";
import {
  ANALYSIS_ALL,
  ANALYSIS_FIRST_SALE,
  type MisAnalysisFilters,
} from "../util/misAnalysisFilters";
import { ANALYSIS_INDUSTRIES } from "../components/analysisBreakdowns";

/**
 * Every MIS figure is `Total ARR` on this screen.
 *
 * ARR Analysis offers no Type control — there is no Forecasted or Renewal
 * reading of "what is the book worth today" — so the field is a constant here
 * where on the Build it is the reader's.
 */
const ANALYSIS_ARR_TYPE = "Total ARR";

/** What the backend calls "every business unit". */
const ALL_BUSINESS_UNITS = "ALL_BU";

/**
 * The Business Units the control offers, in the codes the backend filters by.
 *
 * `Moesif` is the odd one: `MOESIF_CLOUD` rather than a `_BU` code, because it
 * is a cloud product counted inside the API Platform BU rather than a unit of
 * its own. That is the same fact behind the control refusing to ask for both —
 * see `analysisBusinessUnitsConflict`.
 */
const WIRE_CODE_BY_BUSINESS_UNIT: Readonly<Record<string, string>> = {
  "API Platform": "APIM_BU",
  IAM: "IAM_BU",
  Integration: "INTEGRATION_BU",
  Choreo: "CHOREO_BU",
  "Agent Platform": "AGENT_PLATFORM_BU",
  Moesif: "MOESIF_CLOUD",
};

/** One `ArrFilter` body, carrying only what the reader actually narrowed. */
export interface AnalysisRequest {
  arrType: string;
  /** `yyyy-MM-dd`. The day the book is read at. Always present. */
  endDate: string;
  /** `yyyy-MM-dd`. The span's opening. `/exit-arr/search` only. */
  startDate?: string;
  businessUnits?: string[];
  partnerType?: string;
  salesRegions?: string[];
  subRegions?: string[];
  /** Where an account is BILLED — not `shippingCountries`, which is elsewhere. */
  billingCountries?: string[];
  /** Years, as strings: the backend declares `string[]`. */
  customerLifetime?: string[];
  /** Counts, as numbers: the backend declares `int[]`. */
  numberOfProductsInUse?: number[];
  isFirstSale?: boolean;
  arrRange?: { lowerBoundary?: number; upperBoundary?: number };
  /** Ticket 14's industry breakdown only — one industry per call. */
  industries?: string[];
}

/**
 * The table's body: the customer book as at one day.
 *
 * `businessUnits` is omitted at the whole-book default, following the source.
 * Sending `["ALL_BU"]` would narrow nothing, but it would make this body differ
 * from the one the running app sends — which is the kind of difference someone
 * reconciling the two apps finds and has to explain.
 */
export function analysisAccountsRequest(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
): AnalysisRequest {
  const units = wireBusinessUnits(filters.businessUnits);
  return {
    arrType: ANALYSIS_ARR_TYPE,
    endDate: wireDate(filters.asOf ?? today),
    ...(isWholeBook(units) ? {} : { businessUnits: units }),
    ...optionalFilters(filters),
  };
}

/**
 * The summary figure's body: the same narrowing, over a span.
 *
 * The span opens at the END of the previous calendar year, which is what makes
 * the figure a year-to-date reading rather than a balance — a January day reads
 * back to the December before it. `arrAnalysisApi.js:41-46`.
 */
export function analysisExitArrRequest(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
): AnalysisRequest {
  const asOf = filters.asOf ?? today;
  return {
    arrType: ANALYSIS_ARR_TYPE,
    businessUnits: wireBusinessUnits(filters.businessUnits),
    startDate: wireDate({ year: asOf.year - 1, month: 12, day: 31 }),
    endDate: wireDate(asOf),
    ...optionalFilters(filters),
  };
}

/**
 * The reader's narrowing, in the backend's vocabulary — shared by both bodies
 * and by every call ticket 14 adds.
 *
 * Absent rather than empty throughout. A `salesRegions: []` is a filter that
 * matches no region, and the backend would be right to answer with nothing.
 */
function optionalFilters(filters: MisAnalysisFilters): Partial<AnalysisRequest> {
  const optional: Partial<AnalysisRequest> = {};

  if (filters.partnerType && filters.partnerType !== ANALYSIS_ALL) {
    optional.partnerType = filters.partnerType;
  }
  if (filters.salesRegions.length > 0) optional.salesRegions = [...filters.salesRegions];
  if (filters.subRegions.length > 0) optional.subRegions = [...filters.subRegions];
  if (filters.countries.length > 0) optional.billingCountries = [...filters.countries];
  if (filters.lifetimeYears.length > 0) {
    optional.customerLifetime = filters.lifetimeYears.map(String);
  }
  if (filters.productCounts.length > 0) {
    optional.numberOfProductsInUse = [...filters.productCounts];
  }
  if (filters.firstSale === ANALYSIS_FIRST_SALE.ONLY) optional.isFirstSale = true;
  else if (filters.firstSale === ANALYSIS_FIRST_SALE.EXCLUDE) optional.isFirstSale = false;

  const range = arrRange(filters);
  if (range) optional.arrRange = range;

  return optional;
}

/**
 * The ARR Range, with only the ends that were set.
 *
 * `!= null` rather than truthiness, because `0` is a boundary someone might
 * genuinely set and `!value` would silently drop it.
 */
function arrRange(filters: MisAnalysisFilters): AnalysisRequest["arrRange"] {
  const { lower, upper } = filters.arrRange;
  if (lower == null && upper == null) return undefined;
  return {
    ...(lower != null ? { lowerBoundary: lower } : {}),
    ...(upper != null ? { upperBoundary: upper } : {}),
  };
}

/**
 * The chosen Business Units as wire codes, or the whole book.
 *
 * A name that maps to nothing collapses the WHOLE selection back to the whole
 * book rather than narrowing by the rest, which is the source's behaviour and
 * the safer of the two: the alternative is an empty `businessUnits`, a filter
 * matching no unit at all, so a backend that renamed one unit would empty the
 * entire table rather than widen it.
 */
function wireBusinessUnits(businessUnits: readonly string[]): string[] {
  const codes = businessUnits
    .map((unit) => WIRE_CODE_BY_BUSINESS_UNIT[unit])
    .filter((code): code is string => Boolean(code));
  return codes.length > 0 ? [...new Set(codes)] : [ALL_BUSINESS_UNITS];
}

const isWholeBook = (units: readonly string[]): boolean =>
  units.length === 1 && units[0] === ALL_BUSINESS_UNITS;

/** `yyyy-MM-dd` — the shape this endpoint wants, hyphens rather than slashes. */
const wireDate = ({ year, month, day }: MisCivilDate): string =>
  `${year}-${pad(month)}-${pad(day)}`;

const pad = (value: number): string => String(value).padStart(2, "0");


// ---- ticket 14: the two breakdowns ----------------------------------------
//
// Both are `POST /exit-arr/search` again — the same endpoint as the summary
// figure, asked repeatedly with one field varied. Each body is
// `analysisExitArrRequest` with that one field added, which is what makes the
// figures comparable: they answer the same question about the same book, cut
// one way each.
//
// This is also where the request count on this screen comes from. One filter
// change is 1 (accounts) + 1 (summary) + up to 2 (partner models) + up to 6
// (industries) = up to **ten** reads. That is the source's shape, and it is why
// the page debounces its filter state before any of them fire — see
// `useDebouncedFilters`. Ticket 13 had two reads and dropped the debounce; ten
// earns it back.

/** The two partner models the split is between, in the chart's fixed order. */
const PARTNER_MODELS = ["Channel", "Direct"] as const;
export type AnalysisPartnerModel = (typeof PARTNER_MODELS)[number];

/** One call of the partner-model split: which model, and the body asking for it. */
export interface AnalysisPartnerModelRequest {
  model: AnalysisPartnerModel;
  body: AnalysisRequest;
}

/**
 * One call per partner model — or ONE call when the reader has already narrowed
 * to a model, because the other side would return a figure for a book the
 * filter has already excluded (`arrAnalysisApi.js:212-264`).
 *
 * A Partner Type that is neither model asks for neither. The Partner Type menu
 * offers whatever the loaded accounts report, so a third value is reachable, and
 * asking both sides of a split the reader has left is two calls for one answer.
 */
export function analysisPartnerModelRequests(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
): AnalysisPartnerModelRequest[] {
  const base = analysisExitArrRequest(filters, today);
  const chosen = filters.partnerType?.trim().toLowerCase();

  const wanted =
    !chosen || chosen === ANALYSIS_ALL
      ? PARTNER_MODELS
      : PARTNER_MODELS.filter((model) => model.toLowerCase() === chosen);

  return wanted.map((model) => ({ model, body: { ...base, partnerType: model } }));
}

/** One call of the industry breakdown: which industry, and its body. */
export interface AnalysisIndustryRequest {
  industry: string;
  body: AnalysisRequest;
}

/**
 * One call per industry — and **only for industries the backend actually
 * offers**.
 *
 * The source does the same and then reports the rest as `revenue: 0`
 * (`arrAnalysisApi.js:266-299`), which states "this industry holds no ARR" on
 * the strength of a question nobody put. The port carries the asked-about set
 * forward instead, and `industrySeries` draws no bar for the others. So this
 * function's RETURN is the honest record of what was asked, not just a list of
 * bodies.
 *
 * `offered` is `GET /app-configs`'s industry list, which is longer than the
 * chart's six and varies; an industry it offers that the chart has no bar for
 * is the Industry FILTER's business.
 */
export function analysisIndustryRequests(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
  offered: readonly string[],
): AnalysisIndustryRequest[] {
  const available = new Set(offered);
  const base = analysisExitArrRequest(filters, today);

  return ANALYSIS_INDUSTRIES.filter((industry) => available.has(industry)).map((industry) => ({
    industry,
    body: { ...base, industries: [industry] },
  }));
}

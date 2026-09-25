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

// What the reader has narrowed ARR Analysis to, and the rules its ten controls
// obey.
//
// Ported from the `filters` state in digiops-finance
// `arrAnalysis/ArrAnalysisDashboard.js:118-131` and the handlers over it.
//
// ---- these are NOT the Build's filters, and not its `MisAppliedFilters` -----
//
// Different set, different endpoints, different lifetime. The Build's applied
// set is serialised into the query string under the contract ticket 02 pinned;
// this one is component state and reaches no address, exactly as in the source.
// A shared ARR Analysis link therefore opens on defaults. That is reproduced
// under ADR 0003 rather than fixed here: extending the URL contract is a
// contract decision — what an unrecognised value degrades to, what a stale link
// means — and not a side effect of porting a table. It is recorded as an open
// question in spec §11, beside the identical one already standing for the
// Region Summary's cut (§11.11).
//
// ---- on the two words that look interchangeable and are not -----------------
//
// **Business Unit** is the product line a figure is attributed to (CONTEXT.md),
// and it is what the Business Units control selects. **Products in use** is how
// many distinct products an account actually runs, which is a property of the
// ACCOUNT rather than of the figure — the backend sends it as `productsInUse`
// per account and takes `numberOfProductsInUse` as a filter. The source keeps
// them apart in its labels and runs them together in its state, calling the
// first one `products`. This keeps the labels' distinction and drops the
// state's confusion.

import { misHeadlineAmount } from "./misMoney";
import { pacificCivilDate, type MisCivilDate } from "./misPacificTime";

/**
 * The value every "no narrowing" control carries, verbatim from the source.
 *
 * A literal rather than `undefined` because the source SENDS it to be compared
 * against — `partnerType !== "all"` is what decides whether the field reaches
 * the body — and because the Partner Type control shows an "All" segment that
 * has to have a value to be pressed.
 */
export const ANALYSIS_ALL = "all";

/**
 * First Sale is three-valued and reads as two toggles: neither pressed counts
 * every account, `ONLY` counts first sales alone, `EXCLUDE` counts everything
 * else. The two wire values are `true` and `false` on `isFirstSale`, and "all"
 * omits the field.
 */
export const ANALYSIS_FIRST_SALE = {
  ALL: ANALYSIS_ALL,
  ONLY: "include",
  EXCLUDE: "exclude",
} as const;
export type MisAnalysisFirstSale =
  (typeof ANALYSIS_FIRST_SALE)[keyof typeof ANALYSIS_FIRST_SALE];

/**
 * The Business Units the control offers, in the source's order
 * (`PRODUCT_FILTER_OPTIONS`). Written down rather than read from
 * `GET /app-configs`: the backend's `businessUnits` list is the Build's unit
 * vocabulary (`BU_IAM`, `SW_ALL`…) and does not answer this question.
 */
export const ANALYSIS_BUSINESS_UNITS = [
  "API Platform",
  "IAM",
  "Integration",
  "Choreo",
  "Agent Platform",
  "Moesif",
] as const;

/**
 * Moesif's ARR is already counted inside the API Platform BU, so asking for
 * both double-counts it. The source refuses the combination and says so in a
 * snackbar rather than silently de-duplicating, which is the right way round:
 * the reader asked two questions that cannot both be answered.
 */
export const ANALYSIS_API_PLATFORM = "API Platform";
export const ANALYSIS_MOESIF = "Moesif";

/** `1`–`5`, with 4 rendered `4+`. The source's `PRODUCT_COUNT_FILTER_OPTIONS`. */
export const ANALYSIS_PRODUCT_COUNTS = [1, 2, 3, 4, 5] as const;

/** `0`–`20` years of customer lifetime. */
export const ANALYSIS_LIFETIME_YEARS: readonly number[] = Array.from({ length: 21 }, (_, i) => i);

/** A customer lifetime in years, pluralised — `1 yr`, `2 yrs`. */
export const analysisYearsLabel = (years: number | string): string =>
  `${years} ${Number(years) === 1 ? "yr" : "yrs"}`;

/** How a product count reads on its segment: `4` is the open-ended one. */
export const analysisProductCountLabel = (count: number): string =>
  count === 4 ? "4+" : String(count);

/** The lower and upper ends of the ARR Range control; either may be open. */
export interface MisAnalysisArrRange {
  lower: number | null;
  upper: number | null;
}

/** Everything the ten controls hold between them. */
export interface MisAnalysisFilters {
  /** `ANALYSIS_ALL`, or one partner model the accounts actually report. */
  partnerType: string;
  firstSale: MisAnalysisFirstSale;
  /** Display names from `ANALYSIS_BUSINESS_UNITS`, mapped to wire codes on send. */
  businessUnits: string[];
  /** How many distinct products an account runs — `numberOfProductsInUse`. */
  productCounts: number[];
  salesRegions: string[];
  subRegions: string[];
  countries: string[];
  lifetimeYears: number[];
  arrRange: MisAnalysisArrRange;
  /**
   * The date the customer book is read at. `null` is a real state — the As Of
   * Date chip is dismissable — and means "today", which is resolved in Pacific
   * Time where the source resolves it in the viewer's zone. Spec §3.
   */
  asOf: MisCivilDate | null;
}

/**
 * The view ARR Analysis opens on: no narrowing at all, as at today.
 *
 * `today` is a parameter rather than a call to `pacificCivilDate()` inside,
 * because the source's equivalent is a module-level `new Date()` frozen at
 * import — a tab left open overnight keeps yesterday's default. Taking it as an
 * argument fixes that and makes the default testable on a named day.
 */
export function defaultAnalysisFilters(today: MisCivilDate = pacificCivilDate()): MisAnalysisFilters {
  return {
    partnerType: ANALYSIS_ALL,
    firstSale: ANALYSIS_FIRST_SALE.ALL,
    businessUnits: [],
    productCounts: [],
    salesRegions: [],
    subRegions: [],
    countries: [],
    lifetimeYears: [],
    arrRange: { lower: null, upper: null },
    asOf: today,
  };
}

/**
 * The smallest product count worth offering, given how many Business Units are
 * selected.
 *
 * An account cannot run fewer distinct products than the number of Business
 * Units it has been narrowed to, so those options would return nothing. Capped
 * at 4 because 4 means "4 or more" — `PRODUCT_COUNT_FILTER_OPTIONS` has no 6.
 * (`ArrAnalysisDashboard.js:1079-1084`.)
 */
export function minimumProductCount(businessUnits: readonly string[]): number {
  return businessUnits.length <= 1 ? 1 : Math.min(4, businessUnits.length);
}

/** The counts the control may offer for this Business Unit selection. */
export function analysisProductCountOptions(businessUnits: readonly string[]): number[] {
  const minimum = minimumProductCount(businessUnits);
  return ANALYSIS_PRODUCT_COUNTS.filter((count) => count >= minimum);
}

/**
 * Whether these two Business Units may be asked for together.
 *
 * Only one pair cannot: Moesif's ARR is already inside the API Platform BU.
 */
export const analysisBusinessUnitsConflict = (units: readonly string[]): boolean =>
  units.includes(ANALYSIS_API_PLATFORM) && units.includes(ANALYSIS_MOESIF);

/**
 * The Business Unit selection, with any product count it has made impossible
 * dropped.
 *
 * The source runs this as an effect watching `minimumProductCountOption`
 * (`ArrAnalysisDashboard.js:1090-1101`); here it is part of the change itself,
 * so the two can never be observed out of step. The half that is easy to leave
 * out is the dropping: choosing a second Business Unit while "1 product in use"
 * is pressed leaves a pair that can match no account, and the control has just
 * stopped offering the option that would clear it.
 *
 * Returns the SAME `productCounts` array when nothing had to go, so a change
 * that affects only the units does not re-render the counts control.
 */
export function withBusinessUnits(
  filters: MisAnalysisFilters,
  businessUnits: string[],
): MisAnalysisFilters {
  const minimum = minimumProductCount(businessUnits);
  const kept = filters.productCounts.filter((count) => count >= minimum);
  return {
    ...filters,
    businessUnits,
    productCounts: kept.length === filters.productCounts.length ? filters.productCounts : kept,
  };
}

/** One dismissable tag: what it says, and what dismissing it does. */
export interface AnalysisFilterTag {
  /** Unique across the whole set — two filters can hold the same value. */
  id: string;
  label: string;
  /** The change dismissing this tag makes. */
  patch: Partial<MisAnalysisFilters>;
}

/**
 * Everything the reader has actually narrowed, one tag per value.
 *
 * ---- a DEVIATION, and why it is not pedantry -------------------------------
 *
 * The source pushes a `Partner Type` tag UNCONDITIONALLY and an `As of Date`
 * tag whenever a date is set — which it is by default. So the count it labels
 * "active" is never below two, on a screen narrowing nothing, and "Clear all"
 * is always offered with nothing to clear. A count that cannot reach zero
 * cannot answer the one question it is on the page to answer.
 *
 * (The port's chip reads "3 filters". CONTEXT.md bans "active filter", and
 * "Applied" is no better here — it is defined as a filter serialised into the
 * query string, and nothing on this screen is. See MisAnalysisFilters.)
 *
 * Here a tag appears only for a control away from its default, so the count IS
 * the number of narrowings and an empty strip means an unnarrowed view. Spec §7.
 */
export function analysisFilterTags(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
): AnalysisFilterTag[] {
  const tags: AnalysisFilterTag[] = [];

  if (filters.partnerType !== ANALYSIS_ALL) {
    tags.push({
      id: "partnerType",
      label: `Partner Type: ${filters.partnerType}`,
      patch: { partnerType: ANALYSIS_ALL },
    });
  }

  if (filters.firstSale !== ANALYSIS_FIRST_SALE.ALL) {
    tags.push({
      id: "firstSale",
      label: `First Sale: ${filters.firstSale === ANALYSIS_FIRST_SALE.ONLY ? "Only" : "Exclude"}`,
      patch: { firstSale: ANALYSIS_FIRST_SALE.ALL },
    });
  }

  // "Business Units", not "BU": the control that sets these is labelled
  // "Business Units", and a tag naming the same filter differently makes one
  // control disagree with itself.
  listTags(tags, "businessUnits", "Business Unit", filters.businessUnits, (without) => ({
    // Through `withBusinessUnits`, so dismissing a BU tag re-opens the product
    // counts it had ruled out — the same rule as changing the control itself.
    ...withBusinessUnits(filters, without),
  }));
  listTags(tags, "productCounts", "# Products In Use", filters.productCounts, (without) => ({
    productCounts: without,
  }), analysisProductCountLabel);
  listTags(tags, "salesRegions", "Sales Region", filters.salesRegions, (without) => ({
    salesRegions: without,
  }));
  listTags(tags, "subRegions", "Sub Region", filters.subRegions, (without) => ({
    subRegions: without,
  }));
  listTags(tags, "countries", "Country", filters.countries, (without) => ({
    countries: without,
  }));
  listTags(tags, "lifetimeYears", "Lifetime", filters.lifetimeYears, (without) => ({
    lifetimeYears: without,
  }), analysisYearsLabel);

  // Each end separately, because they are two questions: a reader who set a
  // floor and a ceiling may well want to lift only one.
  if (filters.arrRange.lower != null) {
    tags.push({
      id: "arrRange.lower",
      label: `ARR from ${misHeadlineAmount(filters.arrRange.lower)}`,
      patch: { arrRange: { ...filters.arrRange, lower: null } },
    });
  }
  if (filters.arrRange.upper != null) {
    tags.push({
      id: "arrRange.upper",
      label: `ARR to ${misHeadlineAmount(filters.arrRange.upper)}`,
      patch: { arrRange: { ...filters.arrRange, upper: null } },
    });
  }

  // Today is the default, so it is not a narrowing — and the card above the
  // table already heads itself with the date either way.
  if (filters.asOf && !isSameCivilDate(filters.asOf, today)) {
    tags.push({
      id: "asOf",
      label: `As Of: ${isoCivilDate(filters.asOf)}`,
      // Back to today rather than to `null`. `null` also means today (the
      // request builder resolves it), but it would leave the date control
      // empty, which reads as "no date" on a screen where there is always one.
      patch: { asOf: today },
    });
  }

  return tags;
}

/** One tag per value of a list filter, each dismissing only its own value. */
function listTags<T extends string | number>(
  into: AnalysisFilterTag[],
  id: string,
  name: string,
  values: readonly T[],
  patchFor: (without: T[]) => Partial<MisAnalysisFilters>,
  format: (value: T) => string = String,
): void {
  for (const value of values) {
    into.push({
      id: `${id}:${value}`,
      label: `${name}: ${format(value)}`,
      patch: patchFor(values.filter((other) => other !== value)),
    });
  }
}

/** `2026-03-01` — a date on a tag, in the shape the wire uses. */
export const isoCivilDate = ({ year, month, day }: MisCivilDate): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const isSameCivilDate = (a: MisCivilDate, b: MisCivilDate): boolean =>
  a.year === b.year && a.month === b.month && a.day === b.day;

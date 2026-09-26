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

// `POST /accounts` as ARR Analysis reads it: one row per account, and the
// option lists the loaded accounts can supply when the backend's cannot.
//
// Ported from digiops-finance `arrAnalysis/ArrAnalysisDashboard.js` —
// `toDashboardRows` (:345-368), `parseProductsInUse` (:283-300) and the
// `allFilterOptions` effect (:806-830).
//
// ---- this is the SAME endpoint the Build's customers table reads -----------
//
// And a different reading of it. `customerAccountRows.ts` groups accounts into
// a Build column's software and cloud books and foots a Total row; this is a
// flat list with a row per account and no total anywhere. Same response, two
// tables that share nothing but the wire type — which is why the type lives
// here rather than being imported from there, where it carries the other
// table's fields.
//
// ---- four fields the source builds and nothing reads -----------------------
//
// `toDashboardRows` also writes `accountId`, `businessUnits`, `industry` and
// `activationDate` onto every row. No column definition reads any of them, and
// neither does the filter-option scrape. Not ported — spec §9.
// (`businessUnits` is not even on `AccountDetails`, so the source's branch
// always yields `[]`.)

/**
 * One account, as the ARR backend sends it
 * (`arr-backend/modules/types/types.bal`, `AccountDetails`).
 *
 * Every field optional and the figures widened to `number | string`, because
 * this is the client boundary: a Ballerina `decimal` can arrive as a JSON
 * string when precision matters, and a gateway can truncate anything. A row
 * builder that trusted the declaration would put `undefined` into a column
 * typed `number` and leave it sorting as text.
 */
export interface AnalysisAccountsResponse {
  id?: string;
  name?: string;
  /** A comma-separated list. `string?` on the wire. */
  productsInUse?: string | string[] | null;
  partnerType?: string;
  /** Plural on the wire, singular in meaning — one region per account. */
  salesRegions?: string;
  subRegion?: string;
  billingCountry?: string;
  /** Years, as a string. */
  customerLifetime?: string;
  apimBuTotal?: number;
  iamBuTotal?: number;
  integrationBuTotal?: number;
  choreoBuTotal?: number;
  agentPlatformBuTotal?: number;
  moesifBuTotal?: number;
  arrGrandTotal?: number;
}

/** One row of the account table. */
export interface AnalysisAccountRow {
  /** Unique within the grid — see `analysisAccountRows`. */
  id: string;
  accountName: string;
  /** The parsed product names, which the chips render. */
  products: string[];
  /**
   * The same products as one comma string, which the CSV carries.
   *
   * Both readings are held because the column shows one and exports the other:
   * a `renderCell` of chips has no text for the exporter to take, so the cell's
   * VALUE has to be a string. See `analysisAccountColumns`.
   *
   * Built from `products` rather than taken raw, so the two cannot disagree —
   * including for an account whose products arrived as an array. The cost is
   * that the CSV carries the NORMALISED spacing rather than the backend's, e.g.
   * `IAM,Choreo` for a field reading `IAM, Choreo`. Worth it: the alternative
   * is an export that is blank exactly where the chips are populated.
   */
  productsInUse: string;
  partnerType: string;
  salesRegion: string;
  subRegion: string;
  country: string;
  /**
   * A NUMBER, where the wire sends a string — a deliberate deviation. The
   * source leaves the column at the default string type, so its Lifetime sorts
   * lexicographically and "10 yrs" lands above "2 yrs". Spec §7.
   */
  lifetimeYears: number;
  apimBu: number;
  iamBu: number;
  integrationBu: number;
  choreoBu: number;
  agentPlatformBu: number;
  moesifBu: number;
  totalArr: number;
}

/** The four menus the loaded accounts can supply between them. */
export interface AnalysisScrapedOptions {
  partnerTypes: string[];
  salesRegions: string[];
  subRegions: string[];
  countries: string[];
}

export const EMPTY_SCRAPED_OPTIONS: AnalysisScrapedOptions = {
  partnerTypes: [],
  salesRegions: [],
  subRegions: [],
  countries: [],
};

/**
 * The products an account runs, from the field the backend sends them in.
 *
 * Declared `string?` and handled as either, because the array branch costs two
 * lines and the failure it prevents is silent: a gateway that JSON-decoded the
 * list would blank every row's chips with nothing reporting why.
 */
export function parseProductsInUse(value: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(parts.map((part) => String(part ?? "").trim()).filter(Boolean))];
}

/**
 * One row per account, in the order the backend listed them.
 *
 * The `id` is the account's own suffixed with its position, following the
 * source. Two accounts sharing an id is not hypothetical — the grid would
 * render one of them and drop the other with no error — and an account with no
 * id at all still has to get a row.
 */
export function analysisAccountRows(
  accounts: readonly AnalysisAccountsResponse[] | undefined,
): AnalysisAccountRow[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.map((account, index) => ({
    id: `${account?.id || "account"}-${index}`,
    accountName: account?.name ?? "",
    products: parseProductsInUse(account?.productsInUse),
    // Built from the PARSED list rather than taken raw, so the chips and the
    // CSV cannot disagree. Taking the raw field would give an empty CSV cell
    // for an account whose products arrived as an array — which is the branch
    // `parseProductsInUse` exists to survive, so leaving the export blind to it
    // would defend one reading and not the other.
    productsInUse: parseProductsInUse(account?.productsInUse).join(","),
    partnerType: account?.partnerType ?? "",
    salesRegion: account?.salesRegions ?? "",
    subRegion: account?.subRegion ?? "",
    country: account?.billingCountry ?? "",
    lifetimeYears: figure(account?.customerLifetime),
    apimBu: figure(account?.apimBuTotal),
    iamBu: figure(account?.iamBuTotal),
    integrationBu: figure(account?.integrationBuTotal),
    choreoBu: figure(account?.choreoBuTotal),
    agentPlatformBu: figure(account?.agentPlatformBuTotal),
    moesifBu: figure(account?.moesifBuTotal),
    totalArr: figure(account?.arrGrandTotal),
  }));
}

/**
 * What the loaded accounts can offer each list menu.
 *
 * The FALLBACK half of every menu — `GET /app-configs` answers for three of the
 * four, and this covers the fourth (Partner Type, which it does not send) and
 * all of them while that call is in flight or has failed.
 */
export function analysisScrapedOptions(
  rows: readonly AnalysisAccountRow[],
): AnalysisScrapedOptions {
  return {
    partnerTypes: distinctSorted(rows.map((row) => row.partnerType)),
    salesRegions: distinctSorted(rows.map((row) => row.salesRegion)),
    subRegions: distinctSorted(rows.map((row) => row.subRegion)),
    countries: distinctSorted(rows.map((row) => row.country)),
  };
}

/**
 * The scraped menus, widened by what this fetch showed — never narrowed.
 *
 * The source's `mergeUniqueOptions` over the previous set, and it is
 * load-bearing rather than an optimisation: a menu built from the CURRENT rows
 * offers only the values that survived the current filter, so narrowing to EMEA
 * leaves a Sales Region menu offering EMEA alone and the reader cannot switch
 * to APAC without first clearing the very filter they want to change.
 *
 * Returns the held set unchanged when nothing new arrived, so a re-fetch that
 * adds no options does not hand React a new object and re-render every menu.
 */
export function mergeScrapedOptions(
  held: AnalysisScrapedOptions,
  arrived: AnalysisScrapedOptions,
): AnalysisScrapedOptions {
  const merged: AnalysisScrapedOptions = {
    partnerTypes: distinctSorted([...held.partnerTypes, ...arrived.partnerTypes]),
    salesRegions: distinctSorted([...held.salesRegions, ...arrived.salesRegions]),
    subRegions: distinctSorted([...held.subRegions, ...arrived.subRegions]),
    countries: distinctSorted([...held.countries, ...arrived.countries]),
  };
  const unchanged = (Object.keys(merged) as (keyof AnalysisScrapedOptions)[]).every(
    (key) => merged[key].length === held[key].length,
  );
  return unchanged ? held : merged;
}

/**
 * A figure, however it arrived.
 *
 * Zero for anything unreadable rather than `NaN`: these feed columns typed
 * `number`, and a `NaN` there sorts unpredictably and renders as "NaN" in the
 * CSV Finance opens.
 */
const figure = (value: number | string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const distinctSorted = (values: readonly (string | undefined)[]): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );

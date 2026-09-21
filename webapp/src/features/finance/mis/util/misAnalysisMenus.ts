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

// What each of ARR Analysis's four list controls offers.
//
// ---- one rule, where the source has four ------------------------------------
//
// A DEVIATION, recorded in spec §7. The source's four sibling menus are built
// four different ways, and two of them are wrong:
//
//   Sales Region  a hard-coded `["APAC", "EMEA", "Americas", "North America"]`
//                 or the scrape (`REGION_OPTIONS_FALLBACK`) — although
//                 `GET /app-configs` answers with `salesRegions` and the Build's
//                 own bar uses it. The list even carries both "Americas" and
//                 "North America", which is what a stopgap looks like.
//   Sub Region    `appConfigs.subRegions`, else the scrape. Correct.
//   Country       `appConfigs.billingcountrys`, else the scrape — and that key
//                 is NEVER on the response, which declares `billingCountries`
//                 (`arr-backend/.../types.bal`, `MetaData`). So the branch is
//                 dead and the menu is always the scrape, offering only the
//                 countries that survived the current filter.
//   Partner Type  `["Channel", "Direct"]` merged with the scrape.
//
// Here all four read: the backend's list, else what the loaded accounts show.
// That drops the hard-coded regions, fixes the misspelled key, and keeps the
// scrape as the fallback it was always meant to be — which is load-bearing
// rather than decorative, because `GET /app-configs` failing must not leave
// every control on a screenful of data unable to narrow it.
//
// Partner Type keeps its floor of two, because Channel and Direct are the model
// rather than data — CONTEXT.md names them — so the control can offer them
// before an account has loaded. They are a floor and not a ceiling: an account
// reporting something else is a fact about the book, and a menu that hid it
// would leave rows nothing on the screen can select.
//
// Fixing the country key is not a breach of ADR 0003. That ADR protects
// behaviour someone chose and Finance reconciles against; a menu built from a
// key the response has never carried is a typo, its effect is a menu missing
// options rather than a figure reading differently, and no figure moves either
// way.

import type { AnalysisScrapedOptions } from "../components/analysisAccountRows";

/** The two partner models, which are the model rather than data. */
const PARTNER_MODELS = ["Channel", "Direct"] as const;

/** What the four list controls offer. */
export interface AnalysisMenus {
  partnerTypes: string[];
  salesRegions: string[];
  subRegions: string[];
  countries: string[];
}

export const EMPTY_ANALYSIS_MENUS: AnalysisMenus = {
  partnerTypes: [],
  salesRegions: [],
  subRegions: [],
  countries: [],
};

/**
 * The lists `GET /app-configs` can answer these controls with.
 *
 * `billingCountries` rather than `countries`: the Build's `countries` is the
 * SHIPPING list under the substitution ADR 0003 reproduces, and this screen's
 * Country control filters on `billingCountries` — so the Build's list would
 * make the menu and the request disagree about which country a country is.
 */
export interface AnalysisBackendMenus {
  salesRegions?: string[];
  subRegions?: string[];
  billingCountries?: string[];
  /** Present so a caller can hand over the whole options object; unread. */
  countries?: string[];
}

export function analysisMenus(
  backend: AnalysisBackendMenus,
  scraped: AnalysisScrapedOptions,
): AnalysisMenus {
  return {
    partnerTypes: distinctSorted([...PARTNER_MODELS, ...scraped.partnerTypes]),
    salesRegions: either(backend.salesRegions, scraped.salesRegions),
    subRegions: either(backend.subRegions, scraped.subRegions),
    countries: either(backend.billingCountries, scraped.countries),
  };
}

/**
 * The backend's list when it sent one, else what the accounts show.
 *
 * Non-EMPTY rather than merely present: a backend that answers with `[]` for a
 * list has told us nothing, and falling through to the scrape there is the
 * difference between a usable control and an empty menu.
 */
const either = (backend: string[] | undefined, scraped: string[]): string[] =>
  backend && backend.length > 0 ? backend : scraped;

const distinctSorted = (values: readonly string[]): string[] =>
  [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );

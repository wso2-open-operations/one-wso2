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

// `GET /app-configs` — what the filter bar's menus are made of.
//
// One call answers for all nine list filters and both custom unit lists. This
// module is the shaping half: the response as the backend declares it, and the
// option lists a control can be handed. `useMisAppConfigs` is the fetch around
// it, so the translation is testable without a backend — the same split as
// `misArrSummaryRequest.ts` and the hook over it.
//
// Ported from the assembly in digiops-finance `arrDashboard/ArrDashboard.js:44-70`
// and the comparator in `arrDashboard/utils/filterOptions.js`. Two of the source's
// decisions there are reproduced deliberately rather than corrected; both are
// marked below, and both are ADR 0003's call rather than this module's.

/**
 * The `AppConfig` record, verbatim from the ARR backend
 * (`arr-backend/modules/types/types.bal:18-56`).
 *
 * Every field is optional here and non-optional there, because this is the
 * client boundary: a gateway error page, a truncated body or a service that has
 * moved on all arrive as a 200 whose shape nobody checked. A missing list has to
 * leave a menu empty, not take the screen down.
 */
export interface MisAppConfigs {
  billingCountries?: string[];
  shippingCountries?: string[];
  salesRegions?: string[];
  subRegions?: string[];
  industries?: string[];
  subIndustries?: string[];
  technicalOwners?: string[];
  channelManagers?: string[];
  /** The ONE list the backend sends as records rather than strings. */
  accountOwners?: { name?: string; email?: string }[];
  businessUnits?: string[];
  productUnits?: string[];
  helpEmail?: string;
  /** Whether the ARR Analysis screen is on. Ticket 13's, not this module's. */
  productsUsageEnabled?: boolean;
}

/**
 * The menus, in the vocabulary the controls use.
 *
 * `countries` is singular on purpose: see `misFilterOptions`.
 */
export interface MisFilterOptions {
  salesRegions: string[];
  subRegions: string[];
  countries: string[];
  /**
   * The BILLING country list, which `countries` above is not.
   *
   * Both exist because the two screens filter on different fields. The Build's
   * Billing Country control sends `billingCountries` and is fed
   * `shippingCountries` — the source's substitution, reproduced under ADR 0003
   * and described below. ARR Analysis's Country control also sends
   * `billingCountries`, and is fed THIS, which is the list that actually
   * answers it.
   *
   * That is also the evidence §8.5 was missing. It asked whether the
   * `billingCountries` list the backend sends was ever meant to be used; ARR
   * Analysis is a screen that means to use it and fails to, by a typo —
   * `appConfigs?.billingcountrys`, which is never a key of the response
   * (`ArrAnalysisDashboard.js:709`). So the list has a reader, and the reader
   * is misspelled. Spec §7.
   */
  billingCountries: string[];
  industries: string[];
  subIndustries: string[];
  accountOwners: string[];
  technicalOwners: string[];
  channelManagers: string[];
  businessUnits: string[];
  productUnits: string[];
}

/** Every menu empty — what a control offers before the call has answered. */
export const EMPTY_MIS_FILTER_OPTIONS: MisFilterOptions = {
  salesRegions: [],
  subRegions: [],
  countries: [],
  billingCountries: [],
  industries: [],
  subIndustries: [],
  accountOwners: [],
  technicalOwners: [],
  channelManagers: [],
  businessUnits: [],
  productUnits: [],
};

/**
 * An industry the source appends client-side and the backend has never sent
 * (`ArrDashboard.js:54`). Kept because Finance filters by it today; a port that
 * dropped it would take a working filter off the menu in the name of tidiness.
 */
const CLIENT_SIDE_INDUSTRY = "BFSI";

const compare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/**
 * One option list, in the single order every menu reads in.
 *
 * `numeric` is what keeps `Region 10` below `Region 2` from happening; the
 * backend's lists are free text and some of them count.
 */
export function sortFilterOptions(values: readonly string[] | undefined): string[] {
  return Array.isArray(values) ? [...values].sort(compare) : [];
}

/** The names, which is what a filter is written and sent in terms of. */
const ownerNames = (owners: MisAppConfigs["accountOwners"]): string[] =>
  Array.isArray(owners)
    ? owners.map((owner) => owner?.name).filter((name): name is string => Boolean(name))
    : [];

/**
 * The menus for one `GET /app-configs` response.
 *
 * ---- the country list, which is one list and should be two ----------------
 *
 * The bar has two country controls — Billing Country, and Country by Sales
 * Region (which is `shippingCountry`) — and the backend answers with two lists
 * to match. The source builds ONE, out of `shippingCountries`, and hands it to
 * both (`ArrDashboard.js:52`); on the Build, `billingCountries` is fetched and
 * never read.
 * Reproduced under ADR 0003: the two apps run side by side, and a Billing
 * Country menu that offered a country the other app did not would make the same
 * filter mean two different things depending on which app you opened. Worth
 * raising with Finance, not worth fixing unilaterally — spec §8.
 *
 * `billingCountries` is nonetheless SHAPED here, because ARR Analysis does read
 * it — see the field's own note. The Build's substitution stands; the list it
 * declines is simply no longer thrown away on the way past.
 */
export function misFilterOptions(configs: MisAppConfigs | undefined): MisFilterOptions {
  if (!configs) return EMPTY_MIS_FILTER_OPTIONS;
  const industries = sortFilterOptions(configs.industries);
  return {
    salesRegions: sortFilterOptions(configs.salesRegions),
    subRegions: sortFilterOptions(configs.subRegions),
    countries: sortFilterOptions(configs.shippingCountries),
    billingCountries: sortFilterOptions(configs.billingCountries),
    // Appended before the sort, and only when the backend has not started
    // sending it — a day that would otherwise show it twice.
    industries: industries.includes(CLIENT_SIDE_INDUSTRY)
      ? industries
      : sortFilterOptions([...industries, CLIENT_SIDE_INDUSTRY]),
    subIndustries: sortFilterOptions(configs.subIndustries),
    accountOwners: sortFilterOptions(ownerNames(configs.accountOwners)),
    technicalOwners: sortFilterOptions(configs.technicalOwners),
    channelManagers: sortFilterOptions(configs.channelManagers),
    businessUnits: sortFilterOptions(configs.businessUnits),
    productUnits: sortFilterOptions(configs.productUnits),
  };
}

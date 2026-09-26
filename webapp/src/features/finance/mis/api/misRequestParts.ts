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

// The parts every MIS request body is built from.
//
// Three endpoints now ask the ARR backend the same questions about the reader's
// Applied set — `/arr-summary` for a Build column, `/accounts` for the customer
// book, `/arr-summary/customers` for the drill-down — and two of them forward
// the identical filter block and the identical unit translation. Written once
// here so they cannot drift: a figure and the customer list behind it must be
// read under the same filters, or the list does not add up to the figure it was
// opened from.
//
// `/accounts` deliberately uses none of this — see `misAccountsRequest`, which
// records why that table sends three fields and nothing else.

import { columnOpeningDate } from "../util/misPeriods";
import {
  CUSTOM_UNIT,
  LIST_FILTER_PARAMS,
  carriesConfidence,
  isOnePartnerBook,
  type MisAppliedFilters,
  type MisDateRange,
} from "../util/misViewVocabulary";

/**
 * The unit code each `buProductSelection` becomes on the wire.
 *
 * The two vocabularies are reversed — `BU_APIM` in a link, `APIM_BU` in a
 * request — so this is a translation and not a pass-through, and a missing
 * entry has to fall back rather than send a code the backend will not know.
 * Verbatim from `useArrTableSummary.js`.
 */
const BACKEND_UNIT_CODES: Readonly<Record<string, string>> = {
  BU_ALL: "ALL_BU",
  BU_APIM: "APIM_BU",
  BU_IAM: "IAM_BU",
  BU_INTEGRATION: "INTEGRATION_BU",
  BU_CHOREO: "CHOREO_BU",
  BU_AGENT_PLATFORM: "AGENT_PLATFORM_BU",
  SW_ALL: "ALL_SOFTWARE",
  SW_APIM: "APIM_SOFTWARE",
  SW_IAM: "IAM_SOFTWARE",
  SW_INTEGRATION: "INTEGRATION_SOFTWARE",
  SW_CHOREO: "CHOREO_SOFTWARE",
  CL_ALL: "ALL_CLOUD",
  CL_APIM: "APIM_CLOUD",
  CL_IAM: "IAM_CLOUD",
  CL_INTEGRATION: "INTEGRATION_CLOUD",
  CL_CHOREO: "CHOREO_CLOUD",
  CL_AGENT_PLATFORM: "AGENT_PLATFORM_CLOUD",
  CL_MOESIF: "MOESIF_CLOUD",
};

/** Every business unit, which is what an unrecognised selection falls back to. */
const ALL_BUSINESS_UNITS = "ALL_BU";

/** The wire name each list filter is sent under. `accountOwner` is `accountOwners`. */
const LIST_FILTER_WIRE_NAMES: Readonly<Record<string, string>> = {
  salesRegion: "salesRegions",
  subRegion: "subRegions",
  billingCountry: "billingCountries",
  shippingCountry: "shippingCountries",
  industry: "industries",
  subIndustry: "subIndustries",
  accountOwner: "accountOwners",
  technicalOwner: "technicalOwners",
  channelManager: "channelManagers",
};

/**
 * Which units to ask for, or `null` when the reader has asked for none.
 *
 * A custom selection sends the chosen list itself rather than a code. Business
 * units win over product units when both are set, which is the source's
 * precedence.
 */
export function businessUnitsFor(filters: MisAppliedFilters): string[] | null {
  if (filters.buProductSelection !== CUSTOM_UNIT) {
    return [BACKEND_UNIT_CODES[filters.buProductSelection] ?? ALL_BUSINESS_UNITS];
  }
  const units = filters.customBusinessUnits?.filter(Boolean) ?? [];
  if (units.length) return units;
  const products = filters.customProductUnits?.filter(Boolean) ?? [];
  return products.length ? products : null;
}

/**
 * The filters the reader actually narrowed, under their wire names.
 *
 * An unset filter is OMITTED rather than sent empty. `salesRegions: []` is a
 * different claim from saying nothing — one asks for no regions, the other for
 * all of them — and which of those a backend means by an empty array is not
 * something to find out from a revenue report.
 */
export function narrowedFilters(filters: MisAppliedFilters): Record<string, string[] | string> {
  const narrowed: Record<string, string[] | string> = {};
  for (const [key] of LIST_FILTER_PARAMS) {
    const values = filters[key];
    if (values?.length) narrowed[LIST_FILTER_WIRE_NAMES[key]] = values;
  }
  // The same question the transfer ROWS turn on — see `isOnePartnerBook`. They
  // have to agree, or the grid shows a split the backend was never asked for.
  if (isOnePartnerBook(filters.channelDirect)) narrowed.partnerType = filters.channelDirect;
  // Only a Forecasted type carries one. Renewal enables forecast columns without
  // a confidence, and sending one there would filter a renewals figure by a
  // pipeline stage it has nothing to do with.
  if (carriesConfidence(filters) && filters.confidenceLevel) {
    narrowed.forecastType = filters.confidenceLevel;
  }
  return narrowed;
}

/** The date a column's opening balance is read at, on the wire. */
export const openingDateFor = (range: MisDateRange): string => toWireDate(columnOpeningDate(range));

/** `2026/09/12` → `2026-09-12`. */
export const toWireDate = (date: string): string => date.replace(/\//g, "-");


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

// The Software/Cloud Customers table: what its rows are, what its columns are,
// and which field each figure is read from.
//
// Ported from digiops-finance `arrDashboard/hooks/useCustomerAccounts.js`
// (`transformApiData`) and `arrDashboard/utils/tableConstants.js`
// (`generateCloudBusinessUnitColumns`).
//
// ---- this table is the Subscription Build turned on its side ---------------
//
// The Subscription Build is 34 rows whatever the backend returns: every row is
// a named metric line and the figures arrive as COLUMNS. Here the rows ARE the
// data — one per account in the customer book, hundreds per business unit — and
// the metric breakdown is what arrives as columns. So this is the table ADR
// 0004's row windowing was actually written for, and the first one where the
// row count is a question about the data rather than about the code.
//
// ---- the port does NOT keep the source's flattened field names -------------
//
// The source flattens everything onto one wide object per account, keyed by a
// string built from the period label: `2025_01_01___2025_12_31_cloud_total`.
// That is how ag-grid wants its rows, and it means a renamed column header
// silently renames a data key. Here the column identity is a `key` on the
// sub-column and the figure is looked up by it, so the header text and the data
// path are separate things and a relabelled column cannot lose its figures.
//
// One dead field is deliberately not ported: `transformApiData` writes an
// `open_banking` value from `openBankingSoftwareTotal`, and no column
// definition anywhere reads it. Porting it would carry a column the source has
// not shown for as long as its own header list has existed.

import type { BuildLeadColumn, BuildRow } from "./buildTableModel";

/**
 * One account as `POST /accounts` returns it — the fields this table reads.
 *
 * The first block is what the identity columns show and the second is the
 * revenue breakdown. Field names are the wire's, not the header's: `name` is
 * headed "Account Name", `naicsIndustry` is "Industry", `partnerType` is
 * "Source", `delayedDateCount` is "Delayed Day Count (From Current Date)".
 */
export interface AccountsResponse {
  id: string;
  name: string;
  accountOwnerName?: string;
  partnerType?: string;
  primaryPartnerName?: string;
  primaryPartnerRole?: string;
  delayedDateCount?: number;
  billingCountry?: string;
  shippingCountry?: string;
  naicsIndustry?: string;
  subIndustry?: string;
  salesRegions?: string;
  subRegion?: string;
  activationDate?: string;
  churnDate?: string;
  lostReasonCategory?: string;
  accountRating?: string;
  employeeCount?: number;
  apimSoftwareTotal?: number;
  iamSoftwareTotal?: number;
  integrationSoftwareTotal?: number;
  arrSoftwareTotal?: number;
  apimCloudTotal?: number;
  iamCloudTotal?: number;
  integrationCloudTotal?: number;
  choreoCloudTotal?: number;
  agentPlatformCloudTotal?: number;
  moesifBuTotal?: number;
  arrCloudTotal?: number;
  arrGrandTotal?: number;
}

/** One identity column, and how to read its value off an account. */
export interface CustomerLeadColumn extends BuildLeadColumn {
  value: (account: AccountsResponse) => string;
}

/** Blank for a fact the backend did not send; `0` is a fact and survives. */
const text = (value: string | number | undefined): string =>
  value === undefined || value === null || value === "" ? "" : String(value);

/**
 * The identity columns before the first figure, in the source's order.
 *
 * This is the table that made `BuildTable` take a LIST of identity columns
 * rather than one pinned label: the Subscription Build says which movement a
 * row is and stops, and this one has to say which ACCOUNT a row is — who owns
 * it, where it bills, when it activated and when it churned.
 *
 * Only Account Name is frozen, which is what the source freezes. Freezing more
 * would eat the width the sixty figure columns need, and `leadColumnOffsets`
 * only honours a contiguous run from the left in any case.
 *
 * The header and the wire disagree on four of these — "Source" is
 * `partnerType`, "Industry" is `naicsIndustry`, "Sales Region" is the plural
 * `salesRegions`, "Delayed Day Count" is `delayedDateCount` — so, as with the
 * figure columns, the mapping is data here and pinned field by field in tests.
 */
const IDENTITY_COLUMNS: readonly CustomerLeadColumn[] = [
  // `value` is unread for this one: `BuildTable` renders the row's own label in
  // the first identity column, because that is the cell carrying the tree
  // toggle and naming the row for a screen reader. Stated so the list reads as
  // eighteen columns rather than seventeen plus a special case.
  { key: "name", label: "Account Name", width: 280, pinned: true, value: (a) => text(a.name) },
  { key: "id", label: "Account ID", width: 180, value: (a) => text(a.id) },
  { key: "owner", label: "Account Owner", width: 180, value: (a) => text(a.accountOwnerName) },
  { key: "source", label: "Source", width: 150, value: (a) => text(a.partnerType) },
  {
    key: "partner-name",
    label: "Primary Partner Name",
    width: 200,
    value: (a) => text(a.primaryPartnerName),
  },
  { key: "partner-role", label: "Partner Role", width: 160, value: (a) => text(a.primaryPartnerRole) },
  { key: "billing-country", label: "Billing Country", width: 160, value: (a) => text(a.billingCountry) },
  {
    key: "shipping-country",
    label: "Shipping Country",
    width: 160,
    value: (a) => text(a.shippingCountry),
  },
  { key: "industry", label: "Industry", width: 170, value: (a) => text(a.naicsIndustry) },
  { key: "sub-industry", label: "Sub Industry", width: 170, value: (a) => text(a.subIndustry) },
  { key: "sales-region", label: "Sales Region", width: 160, value: (a) => text(a.salesRegions) },
  { key: "sub-region", label: "Sub Region", width: 160, value: (a) => text(a.subRegion) },
  { key: "activation-date", label: "Activation Date", width: 150, value: (a) => text(a.activationDate) },
  { key: "churn-date", label: "Churn Date", width: 150, value: (a) => text(a.churnDate) },
  {
    key: "lost-reason",
    label: "Lost Reason Category",
    width: 190,
    value: (a) => text(a.lostReasonCategory),
  },
  { key: "rating", label: "Account Rating", width: 150, value: (a) => text(a.accountRating) },
  { key: "employees", label: "Employee Count", width: 150, value: (a) => text(a.employeeCount) },
];

/** Shown only on a Delayed type — `tableUtils.js:753` spreads it in there alone. */
const DELAYED_DAY_COUNT: CustomerLeadColumn = {
  key: "delayed-days",
  label: "Delayed Day Count (From Current Date)",
  width: 200,
  value: (a) => text(a.delayedDateCount),
};

/**
 * The identity columns for one type value: seventeen, or eighteen on a Delayed
 * type.
 *
 * Not a constant, because the source's list is not one. `tableUtils.js:753`
 * spreads Delayed Day Count in only when the type is Delayed ARR, Delayed QRR
 * or Delayed MRR, and it sits directly after Partner Role. Showing it always
 * would put a column of zeroes in front of every reader who is not looking at
 * delayed revenue; showing it never would drop the one figure a Delayed view
 * exists to show.
 *
 * The type is passed rather than the whole filter set because that is all this
 * decision turns on, and `typeValueOf` has already collapsed the three Period
 * keys into it by the time a caller has one.
 */
export function customerLeadColumns(typeValue: string): readonly CustomerLeadColumn[] {
  if (!typeValue.startsWith("Delayed ")) return IDENTITY_COLUMNS;
  const afterPartnerRole = IDENTITY_COLUMNS.findIndex((one) => one.key === "partner-role") + 1;
  return [
    ...IDENTITY_COLUMNS.slice(0, afterPartnerRole),
    DELAYED_DAY_COUNT,
    ...IDENTITY_COLUMNS.slice(afterPartnerRole),
  ];
}

/** One figure a customer's revenue is broken down into, within one Period. */
export interface CustomerSubColumn {
  /** Stable identity, and what the figure is looked up by. Not the label. */
  key: string;
  /** The header text. Self-describing — see the note on grouping below. */
  label: string;
  /** The response field the figure is read from. */
  field: keyof AccountsResponse;
}

/**
 * The twelve figures, in the source's reading order.
 *
 * Software's three products then its total, Cloud's five then Moesif then its
 * total, and the overall total that is both.
 *
 * ---- the grouping lives in these labels, because there is no row for it -----
 *
 * The source renders THREE header rows: the Period, then a Software/Cloud
 * grouping spanning 4 and 7 columns, then the product. `BuildTable` renders
 * two, and ADR 0004 records the measured two-row header as the mechanism with
 * no MUI precedent — a third row generalises that measurement and was taken as
 * its own decision rather than folded in here.
 *
 * So the grouping has to survive in the labels or not at all. The source can
 * afford to label three separate columns plainly "Total" because the row above
 * says which total each one is; here they are "Software Total", "Cloud Total"
 * and "Total". Everything else keeps the source's wording, which already
 * carries its own half of the book ("API Platform Private Cloud + Bjira" is
 * unmistakably the cloud one). Recorded as a deviation in mis.md §7.
 *
 * The wire names and the headers disagree almost everywhere — `apimCloudTotal`
 * is headed "API Platform Private Cloud + Bjira" — so this is the one place a
 * figure can land under the wrong product silently and plausibly, which is why
 * the mapping is data here and pinned field by field in the tests.
 */
export const CUSTOMER_SUB_COLUMNS: readonly CustomerSubColumn[] = [
  { key: "software-apim", label: "API Platform", field: "apimSoftwareTotal" },
  { key: "software-iam", label: "IAM", field: "iamSoftwareTotal" },
  { key: "software-integration", label: "Integration", field: "integrationSoftwareTotal" },
  { key: "software-total", label: "Software Total", field: "arrSoftwareTotal" },
  { key: "cloud-apim", label: "API Platform Private Cloud + Bjira", field: "apimCloudTotal" },
  { key: "cloud-iam", label: "IAM Private Cloud + Asgardeo", field: "iamCloudTotal" },
  {
    key: "cloud-integration",
    label: "Integration Private Cloud + Devant",
    field: "integrationCloudTotal",
  },
  { key: "cloud-choreo", label: "Choreo", field: "choreoCloudTotal" },
  { key: "cloud-agent-platform", label: "Agent Platform", field: "agentPlatformCloudTotal" },
  // Moesif is appended to the Cloud group rather than being one of the five
  // CLOUD_BUSINESS_UNITS, exactly as the source appends it. Its figure is a
  // `BuTotal` and not a `CloudTotal`, which is the wire being inconsistent
  // rather than this column meaning something different.
  { key: "cloud-moesif", label: "Moesif", field: "moesifBuTotal" },
  { key: "cloud-total", label: "Cloud Total", field: "arrCloudTotal" },
  { key: "grand-total", label: "Total", field: "arrGrandTotal" },
];

/** By key, so a cell looks its column up once rather than scanning twelve. */
export const CUSTOMER_SUB_COLUMN_BY_KEY: ReadonlyMap<string, CustomerSubColumn> = new Map(
  CUSTOMER_SUB_COLUMNS.map((column) => [column.key, column]),
);

/**
 * One row per customer, unioned across every column, in first-appearance order.
 *
 * The union is the point. Each column is its own `POST /accounts` read at that
 * column's closing date, so a customer won in the second year is missing from
 * the first response and a churned one is missing from the last. Taking any
 * single column's list would drop precisely the customers a Build is read to
 * find.
 *
 * Order is first appearance, oldest column first — the source's `Map` keyed by
 * id, which is insertion-ordered, filled by iterating the periods in order. It
 * matters more here than it looks: an unstable order reshuffles hundreds of
 * rows under the reader every time a filter changes.
 */
export interface CustomerRows {
  /** One per customer, in first-appearance order. */
  rows: BuildRow[];
  /**
   * The account each row was built from, for the identity columns.
   *
   * Those columns show facts about the ACCOUNT — its owner, region, industry,
   * activation and churn dates — not about any one column's reading of it, so
   * they come from one base record rather than being re-read per Period. The
   * source calls this `baseAccount` and fills it the same way.
   */
  accountById: ReadonlyMap<string, AccountsResponse>;
}

export function customerAccountRows(
  columns: readonly (readonly AccountsResponse[])[],
): CustomerRows {
  const rows: BuildRow[] = [];
  const accountById = new Map<string, AccountsResponse>();
  for (const accounts of columns) {
    for (const account of accounts) {
      // First appearance wins, for the name and for every other fact. The
      // alternative — the newest column's — would rewrite history every time a
      // customer is renamed or moves region, so a Build read beside last
      // quarter's would not agree with it about who was in it.
      if (accountById.has(account.id)) continue;
      accountById.set(account.id, account);
      rows.push({ id: account.id, label: account.name });
    }
  }
  return { rows, accountById };
}

/**
 * The figure for one customer in one column, or `undefined` when they are not
 * in that column's book at all.
 *
 * The undefined matters and is not tidiness. A customer absent from a column
 * has NO figure; a customer present with nothing owing has zero. Rendering the
 * first as `0` invents a data point, and on this table it reads as a customer
 * who churned to nothing rather than one who had not been won yet.
 */
export function customerFigure(
  account: AccountsResponse | undefined,
  subColumn: CustomerSubColumn,
): number | undefined {
  if (!account) return undefined;
  // The overall total alone is read the source's way:
  // `arrGrandTotal || arrSoftwareTotal + arrCloudTotal || 0`. That `||` means a
  // grand total of ZERO falls through to the two halves rather than being
  // reported as zero — which is the behaviour worth having, because the case it
  // fires on is a backend that sent the breakdown and no total. Kept under
  // ADR 0003: it is the source's arithmetic, and a customer with revenue whose
  // Total column reads 0 is the failure this avoids. The cost is that a
  // genuine zero total beside non-zero halves cannot be told apart from an
  // absent one — a state that would mean the backend disagreed with itself.
  if (subColumn.field === "arrGrandTotal") {
    return account.arrGrandTotal || (account.arrSoftwareTotal ?? 0) + (account.arrCloudTotal ?? 0);
  }
  const value = account[subColumn.field];
  return typeof value === "number" ? value : undefined;
}

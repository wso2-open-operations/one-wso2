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

// `GET /opportunities` — the opportunities behind ONE account on the
// Software/Cloud Customers table.
//
// Ported from digiops-finance `arrDashboard/components/OpportunitiesDialog.js`
// and `arrDashboard/hooks/useOpportunities.js`.
//
// ---- this endpoint was on ticket 13's checklist and belongs to ticket 10 ----
//
// Its only caller in the whole source webapp is `DataGrid.js:1192` →
// `OpportunitiesDialog`, rendered for `normalizedTableType ===
// 'software-cloud-customers'` alone. Nothing under `arrAnalysis/` touches it.
// The mirror of the `/exit-arr/search` correction, in the other direction —
// see the reopened section of ticket 10.
//
// ---- the twenty columns are flat, where the source groups them -------------
//
// The source nests its figure columns under two ag-Grid group headers,
// `Software` and `Cloud`. `BuildTable` cannot express that: its groups are
// Periods and its sub-columns are shared across all of them, so two groups of
// four and seven do not fit. The columns are therefore lead columns in the
// source's order, which is what the drill-down dialog beside this one already
// does. Nothing is lost that the headers do not carry: `API Platform Private
// Cloud + Bjira` says which book it is without a group header above it.

import type { BuildLeadColumn } from "./buildTableModel";

/**
 * One opportunity, as the ARR backend sends it
 * (`arr-backend/modules/types/types.bal`, `OpportunityPerAccount`).
 *
 * Every field optional and the figures widened, for the reason every MIS wire
 * type is: a Ballerina `decimal` can arrive as a string, and a gateway can
 * truncate anything.
 */
export interface OpportunityResponse {
  id?: string;
  name?: string;
  stageName?: string;
  /** A string on the wire, and shown as one. */
  confidence?: string;
  partnerType?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  apimArr?: number;
  iamArr?: number;
  integrationArr?: number;
  apimCloudArr?: number;
  iamCloudArr?: number;
  integrationCloudArr?: number;
  choreoArr?: number;
  agentPlatformArr?: number;
  moesifArr?: number;
  /** The backend's SOFTWARE aggregate. Read only when positive — see below. */
  arr?: number;
  /** The backend's CLOUD aggregate. Same rule. */
  cloudArr?: number;
}

/** The account a dialog was opened for. The response does not carry it. */
export interface OpportunityAccount {
  id: string;
  name: string;
}

/** One row of the dialog's table. */
export interface OpportunityRow {
  /** Unique within the table — the opportunity id is not reliably unique. */
  rowId: string;
  accountId: string;
  accountName: string;
  id: string;
  name: string;
  stageName: string;
  confidence: string;
  partnerType: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  apimArr: number;
  iamArr: number;
  integrationArr: number;
  apimCloudArr: number;
  iamCloudArr: number;
  integrationCloudArr: number;
  choreoArr: number;
  agentPlatformArr: number;
  moesifArr: number;
  arr: number;
  cloudArr: number;
}

/**
 * One row per opportunity, with the account stamped on.
 *
 * The account is carried onto every row because the backend's response does
 * not contain it — the request asks by `accountId` — and the table's first two
 * columns show it. The source does the same in `useOpportunities.js:56-58`.
 */
export function opportunityRows(
  opportunities: readonly OpportunityResponse[] | undefined,
  account: OpportunityAccount,
): OpportunityRow[] {
  if (!Array.isArray(opportunities)) return [];
  return opportunities.map((opportunity, index) => ({
    rowId: `${opportunity?.id || "opportunity"}-${index}`,
    accountId: account.id,
    accountName: account.name,
    id: opportunity?.id ?? "",
    name: opportunity?.name ?? "",
    stageName: opportunity?.stageName ?? "",
    confidence: opportunity?.confidence ?? "",
    partnerType: opportunity?.partnerType ?? "",
    subscriptionStartDate: opportunity?.subscriptionStartDate ?? "",
    subscriptionEndDate: opportunity?.subscriptionEndDate ?? "",
    apimArr: figure(opportunity?.apimArr),
    iamArr: figure(opportunity?.iamArr),
    integrationArr: figure(opportunity?.integrationArr),
    apimCloudArr: figure(opportunity?.apimCloudArr),
    iamCloudArr: figure(opportunity?.iamCloudArr),
    integrationCloudArr: figure(opportunity?.integrationCloudArr),
    choreoArr: figure(opportunity?.choreoArr),
    agentPlatformArr: figure(opportunity?.agentPlatformArr),
    moesifArr: figure(opportunity?.moesifArr),
    arr: figure(opportunity?.arr),
    cloudArr: figure(opportunity?.cloudArr),
  }));
}

/**
 * The software total: the backend's aggregate when it sent a positive one,
 * otherwise the three components added.
 *
 * `> 0` rather than `!= null` is the source's test (`OpportunitiesDialog.js`,
 * the `softwareTotal` valueGetter), and it makes a genuine zero aggregate fall
 * through to the sum. Harmless, because an opportunity whose software really is
 * zero sums to zero as well — the two branches agree wherever the quirk can
 * fire. Reproduced rather than tidied: this is a figure Finance reconciles.
 */
export const opportunitySoftwareTotal = (row: OpportunityRow): number =>
  row.arr > 0 ? row.arr : row.apimArr + row.iamArr + row.integrationArr;

/** The cloud total, by the same rule over the six cloud products. */
export const opportunityCloudTotal = (row: OpportunityRow): number =>
  row.cloudArr > 0
    ? row.cloudArr
    : row.apimCloudArr +
      row.iamCloudArr +
      row.integrationCloudArr +
      row.choreoArr +
      row.agentPlatformArr +
      row.moesifArr;

/** A column of the dialog's table, and how to read it off a row. */
export interface OpportunityColumn extends BuildLeadColumn {
  /** Currency columns go through the formatter; the rest are text. */
  isFigure?: boolean;
  read: (row: OpportunityRow) => string | number;
}

/**
 * The twenty columns, in the source's order and with its headers verbatim.
 *
 * The cloud headers carry their product tails — `API Platform Private Cloud +
 * Bjira` — because those name the books Finance reconciles against
 * (`tableConstants.js`, `CLOUD_BUSINESS_UNITS`). `Source` heads the partner
 * type for the same reason: it is the word on the running app's screen, and
 * §8's carve-out for the Region Summary's `Loss` and `First Sale` is the same
 * argument.
 */
export const OPPORTUNITY_COLUMNS: readonly OpportunityColumn[] = [
  { key: "accountId", label: "Account ID", width: 150, read: (row) => row.accountId },
  { key: "accountName", label: "Account Name", width: 220, read: (row) => row.accountName },
  { key: "id", label: "Opportunity Id", width: 150, read: (row) => row.id },
  { key: "name", label: "Opportunity Name", width: 320, read: (row) => row.name },
  { key: "stageName", label: "Stage Name", width: 150, read: (row) => row.stageName },
  { key: "confidence", label: "Confidence", width: 120, read: (row) => row.confidence },
  { key: "partnerType", label: "Source", width: 140, read: (row) => row.partnerType },
  {
    key: "subscriptionStartDate",
    label: "Subscription Start Date",
    width: 180,
    read: (row) => row.subscriptionStartDate,
  },
  {
    key: "subscriptionEndDate",
    label: "Subscription End Date",
    width: 180,
    read: (row) => row.subscriptionEndDate,
  },

  figureColumn("apimArr", "API Platform", 150, (row) => row.apimArr),
  figureColumn("iamArr", "IAM", 150, (row) => row.iamArr),
  figureColumn("integrationArr", "Integration", 150, (row) => row.integrationArr),
  figureColumn("softwareTotal", "Software Total", 170, opportunitySoftwareTotal),

  figureColumn("apimCloudArr", "API Platform Private Cloud + Bjira", 250, (row) => row.apimCloudArr),
  figureColumn("iamCloudArr", "IAM Private Cloud + Asgardeo", 250, (row) => row.iamCloudArr),
  figureColumn(
    "integrationCloudArr",
    "Integration Private Cloud + Devant",
    250,
    (row) => row.integrationCloudArr,
  ),
  figureColumn("choreoArr", "Choreo", 150, (row) => row.choreoArr),
  figureColumn("agentPlatformArr", "Agent Platform", 170, (row) => row.agentPlatformArr),
  figureColumn("moesifArr", "Moesif", 150, (row) => row.moesifArr),
  figureColumn("cloudTotal", "Cloud Total", 170, opportunityCloudTotal),
];

function figureColumn(
  key: string,
  label: string,
  width: number,
  read: (row: OpportunityRow) => number,
): OpportunityColumn {
  return { key, label, width, isFigure: true, read };
}

/** A figure, however it arrived. Zero for anything unreadable, never `NaN`. */
const figure = (value: number | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

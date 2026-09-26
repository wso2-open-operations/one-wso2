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

// The shape of a Subscription Build, and which figure each of its rows reads.
//
// Ported from `COMMON_ROW_HEADERS`, `TRANSFERRED_IN_TRANSFERRED_OUT_ROW_HEADERS`,
// `ROW_SECTIONS` and the response mapper in digiops-finance's
// `useArrTableSummary.js` — four places in the source, one here, because they
// are four halves of a single fact: this row, that label, that field.
//
// ---- why the source needed four, and this needs one -----------------------
//
// The source describes a table as a FLAT LIST OF LABELS, so a row has no
// identity beyond the words in it — and four different rows are all labelled
// "y/y growth". Its mapper therefore tells them apart by looking at the row
// ABOVE (`prevHeader === ROW_HEADERS.ENDING_ARR ? resp.endingArrYoyGrowth : …`),
// which means re-ordering the list silently re-points the figures.
//
// Here a row is an id, a label and a field, declared together. The four growth
// rows are four rows that happen to read alike, the label stops being load-
// bearing, and `BuildTable`'s tree gives the sections somewhere to live rather
// than encoding them as blank separator rows.
//
// Every row LABEL comes from `MIS_ROW_LABELS`, and has to: those strings are
// wire values, and ticket 05's `misValueTypeForRow` looks a row up BY LABEL to
// decide whether Scale may touch it — defaulting to currency on a miss.
// Retyping them here would mean one character of drift silently scales a
// headcount by a thousand, which is the one rule spec §3 exists for. The five
// SECTION labels are this module's own words and are written out.

import { MIS_ROW_LABELS } from "../util/misMoney";
import { isOnePartnerBook, type MisChannelDirect } from "../util/misViewVocabulary";
import type { BuildRow } from "./buildTableModel";

/**
 * One column of a Subscription Build, as `POST /arr-summary` answers it.
 *
 * Every field is optional: the source blanks a column whose request failed and
 * renders the rest, and a backend that has nothing for a row simply omits it.
 */
export interface ArrSummaryResponse {
  openingArr?: number | string | null;
  newArr?: number | string | null;
  transferredIn?: number | string | null;
  expansions?: number | string | null;
  reductions?: number | string | null;
  transferredOut?: number | string | null;
  lost?: number | string | null;
  endingArr?: number | string | null;
  endingArrYoyGrowth?: number | string | null;
  netNew?: number | string | null;
  netNewYoyGrowth?: number | string | null;
  totalNewArr?: number | string | null;
  totalNewArrYoyGrowth?: number | string | null;
  totalChurnArr?: number | string | null;
  totalChurnArrYoyGrowth?: number | string | null;
  grossDollarRetention?: number | string | null;
  netDollarRetention?: number | string | null;
  dollarRetentionLostOnly?: number | string | null;
  dollarRetentionReductionAndLost?: number | string | null;
  dollarRetentionReductionAndIncreases?: number | string | null;
  dollarRetentionIncreasesReductionAndLost?: number | string | null;
  percentNewTotal?: number | string | null;
  percentIncreasesUpsellsTotal?: number | string | null;
  percentReductionsTotal?: number | string | null;
  percentLostTotal?: number | string | null;
  openingSubscriptionCustomers?: number | string | null;
  newCustomers?: number | string | null;
  transferredInCount?: number | string | null;
  lostCustomers?: number | string | null;
  transferredOutCount?: number | string | null;
  closingSubscriptionCustomers?: number | string | null;
  percentNewLogos?: number | string | null;
  percentLostLogos?: number | string | null;
}

type ResponseField = keyof ArrSummaryResponse;

interface RowSpec {
  id: string;
  label: string;
  field: ResponseField;
  /** A balance line: emphasised and tinted. */
  emphasis?: boolean;
  /** The rule an accountant draws above a total. */
  ruleAbove?: boolean;
  /** Shown only when one partner book is on screen by itself. */
  transfersOnly?: boolean;
}

interface SectionSpec {
  id: string;
  label: string;
  rows: readonly RowSpec[];
}

const SECTIONS: readonly SectionSpec[] = [
  {
    id: "arr-movement",
    label: "ARR movement",
    rows: [
      { id: "opening-arr", label: MIS_ROW_LABELS.OPENING_ARR, field: "openingArr", emphasis: true },
      { id: "new-arr", label: MIS_ROW_LABELS.NEW, field: "newArr" },
      {
        id: "transferred-in",
        label: MIS_ROW_LABELS.TRANSFERRED_IN,
        field: "transferredIn",
        transfersOnly: true,
      },
      { id: "expansions", label: MIS_ROW_LABELS.EXPANSIONS, field: "expansions" },
      { id: "reductions", label: MIS_ROW_LABELS.REDUCTIONS, field: "reductions" },
      {
        id: "transferred-out",
        label: MIS_ROW_LABELS.TRANSFERRED_OUT,
        field: "transferredOut",
        transfersOnly: true,
      },
      { id: "lost", label: MIS_ROW_LABELS.LOST, field: "lost" },
      {
        id: "ending-arr",
        label: MIS_ROW_LABELS.ENDING_ARR,
        field: "endingArr",
        emphasis: true,
        ruleAbove: true,
      },
      { id: "ending-arr-yoy", label: MIS_ROW_LABELS.YOY_GROWTH, field: "endingArrYoyGrowth" },
      { id: "net-new", label: MIS_ROW_LABELS.NET_NEW, field: "netNew" },
      { id: "net-new-yoy", label: MIS_ROW_LABELS.YOY_GROWTH, field: "netNewYoyGrowth" },
      { id: "total-new-arr", label: MIS_ROW_LABELS.TOTAL_NEW_ARR, field: "totalNewArr" },
      { id: "total-new-arr-yoy", label: MIS_ROW_LABELS.YOY_GROWTH, field: "totalNewArrYoyGrowth" },
      { id: "total-churn-arr", label: MIS_ROW_LABELS.TOTAL_CHURN_ARR, field: "totalChurnArr" },
      {
        id: "total-churn-arr-yoy",
        label: MIS_ROW_LABELS.YOY_GROWTH,
        field: "totalChurnArrYoyGrowth",
      },
    ],
  },
  {
    id: "dollar-retention",
    label: "Dollar retention",
    rows: [
      {
        id: "gross-dollar-retention",
        label: MIS_ROW_LABELS.GROSS_DOLLAR_RETENTION,
        field: "grossDollarRetention",
      },
      {
        id: "net-dollar-retention",
        label: MIS_ROW_LABELS.NET_DOLLAR_RETENTION,
        field: "netDollarRetention",
      },
      {
        id: "dollar-retention-lost-only",
        label: MIS_ROW_LABELS.DOLLAR_RETENTION_LOST_ONLY,
        field: "dollarRetentionLostOnly",
      },
      {
        id: "dollar-retention-reduction-and-lost",
        label: MIS_ROW_LABELS.DOLLAR_RETENTION_REDUCTION_AND_LOST,
        field: "dollarRetentionReductionAndLost",
      },
      {
        id: "dollar-retention-reduction-and-increases",
        label: MIS_ROW_LABELS.DOLLAR_RETENTION_REDUCTION_AND_INCREASES,
        field: "dollarRetentionReductionAndIncreases",
      },
      {
        id: "dollar-retention-all",
        label: MIS_ROW_LABELS.DOLLAR_RETENTION_ALL,
        field: "dollarRetentionIncreasesReductionAndLost",
      },
    ],
  },
  {
    id: "movement-percentages",
    label: "Movement percentages",
    rows: [
      {
        id: "percent-new-total",
        label: MIS_ROW_LABELS.PERCENT_NEW_TOTAL,
        field: "percentNewTotal",
      },
      {
        id: "percent-increases-upsells-total",
        label: MIS_ROW_LABELS.PERCENT_INCREASES_UPSELLS_TOTAL,
        field: "percentIncreasesUpsellsTotal",
      },
      {
        id: "percent-reductions-total",
        label: MIS_ROW_LABELS.PERCENT_REDUCTIONS_TOTAL,
        field: "percentReductionsTotal",
      },
      {
        id: "percent-lost-total",
        label: MIS_ROW_LABELS.PERCENT_LOST_TOTAL,
        field: "percentLostTotal",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    rows: [
      {
        id: "opening-customers",
        label: MIS_ROW_LABELS.OPENING_CUSTOMERS,
        field: "openingSubscriptionCustomers",
      },
      { id: "new-customers", label: MIS_ROW_LABELS.NEW_CUSTOMERS, field: "newCustomers" },
      {
        id: "transferred-in-customers",
        label: MIS_ROW_LABELS.TRANSFERRED_IN_CUSTOMERS,
        field: "transferredInCount",
        transfersOnly: true,
      },
      { id: "lost-customers", label: MIS_ROW_LABELS.LOST_CUSTOMERS, field: "lostCustomers" },
      {
        id: "transferred-out-customers",
        label: MIS_ROW_LABELS.TRANSFERRED_OUT_CUSTOMERS,
        field: "transferredOutCount",
        transfersOnly: true,
      },
      {
        id: "closing-customers",
        label: MIS_ROW_LABELS.CLOSING_CUSTOMERS,
        field: "closingSubscriptionCustomers",
      },
    ],
  },
  {
    id: "logo-percentages",
    label: "Logo percentages",
    rows: [
      {
        id: "percent-new-logos",
        label: MIS_ROW_LABELS.PERCENT_NEW_LOGOS,
        field: "percentNewLogos",
      },
      {
        id: "percent-lost-logos",
        label: MIS_ROW_LABELS.PERCENT_LOST_LOGOS,
        field: "percentLostLogos",
      },
    ],
  },
];

/** The five sections, in reading order. A screen opens all of them. */
export const ARR_BUILD_SECTION_IDS: readonly string[] = SECTIONS.map((section) => section.id);

const FIELD_BY_ROW_ID: ReadonlyMap<string, ResponseField> = new Map(
  SECTIONS.flatMap((section) => section.rows.map((row) => [row.id, row.field] as const)),
);

/** Which response field the row with this id reads. */
export const arrBuildFieldFor = (rowId: string): ResponseField | undefined =>
  FIELD_BY_ROW_ID.get(rowId);

/**
 * The Build's rows for the partner book currently on screen.
 *
 * A transfer between the Channel and Direct books earns a row only when ONE of
 * them is on screen. With both together a transfer is internal — it leaves one
 * book and arrives in the other — so a row for it would report a movement that,
 * at the level being reported, did not happen.
 */
export function arrBuildRows(channelDirect: MisChannelDirect): BuildRow[] {
  const transfers = isOnePartnerBook(channelDirect);
  return SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    children: section.rows
      .filter((row) => transfers || !row.transfersOnly)
      .map(({ id, label, emphasis, ruleAbove }) => ({ id, label, emphasis, ruleAbove })),
  }));
}

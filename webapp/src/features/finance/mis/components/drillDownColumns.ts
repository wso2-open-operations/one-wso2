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

// The columns of the customer drill-down dialog — the customers behind one
// figure in the Build.
//
// Ported from digiops-finance
// `arrDashboard/components/ArrSummaryCustomersDialog.js`:41-152, which keeps
// them as three arrays and concatenates two or three of them per render.
//
// Eleven columns on an ordinary movement and THIRTEEN on a Lost row. The two
// extra ones are INSERTED after the amount rather than appended, so the reason
// a customer left sits beside how much left with them.

import { MIS_SCALES } from "../util/misViewVocabulary";
import { MIS_VALUE_TYPES, formatMisValue } from "../util/misMoney";
import type { BuildLeadColumn, BuildRow } from "./buildTableModel";

/** One customer behind a figure, as `POST /arr-summary/customers` returns them. */
export interface DrillDownCustomer {
  /** The Salesforce id. Non-nullable on the wire. */
  accountId: string;
  /** Non-nullable on the wire. */
  name: string;
  /** Non-nullable on the wire. */
  salesRegion: string;
  /** Non-nullable on the wire. */
  subRegion: string;
  /** Non-nullable on the wire. The share of the clicked figure this customer is. */
  amount: number;
  activationDate?: string;
  churnDate?: string;
  lostReasonCategory?: string;
  lostReason?: string;
  accountRating?: string;
  customerLifetime?: string;
  technicalOwner?: string;
  accountOwner?: string;
}

/**
 * What the source writes where a value is missing.
 *
 * Only in SOME columns — see `blank` below. The inconsistency is the source's
 * and is reproduced under ADR 0003 rather than tidied; recorded in
 * `docs/ported-apps/mis.md` §8.
 */
export const DRILL_DOWN_NOT_AVAILABLE = "N/A";

/** One column of the dialog, and how to read its value off a customer. */
export interface DrillDownColumn extends BuildLeadColumn {
  value: (customer: DrillDownCustomer) => string;
}

/** Falls back to the placeholder — the seven columns the source guards. */
const withPlaceholder =
  (read: (c: DrillDownCustomer) => string | number | undefined) => (customer: DrillDownCustomer) => {
    const value = read(customer);
    return value === undefined || value === null || value === "" ? DRILL_DOWN_NOT_AVAILABLE : String(value);
  };

/** Renders empty — the four columns the source gives no formatter at all. */
const blank =
  (read: (c: DrillDownCustomer) => string | undefined) => (customer: DrillDownCustomer) =>
    read(customer) ?? "";

/**
 * The amount, at UNITS whatever the reader's Scale says.
 *
 * The source hard-codes `SCALES.UNITS` here and its own test asserts that the
 * thousands rendering does not appear. That is right and is kept: the header
 * reads "Amount (USD)", so a figure quietly divided by a thousand under it
 * would be wrong rather than merely scaled — and this dialog is opened from a
 * Build that may well be showing thousands at the time.
 */
const amount = (customer: DrillDownCustomer) => {
  // The source guards TWICE — `== null || === ""` before formatting, and the
  // formatted result again afterwards. `amount` is a non-nullable decimal on
  // the wire, so both are defensive; but this is the money column, and
  // `formatMisValue` passes a string straight through, so an empty one would
  // render a blank cell under a header reading "Amount (USD)".
  const raw = customer.amount;
  if (raw === undefined || raw === null || (raw as unknown) === "") return DRILL_DOWN_NOT_AVAILABLE;
  const formatted = formatMisValue(raw, MIS_VALUE_TYPES.CURRENCY, { scale: MIS_SCALES.UNITS });
  return formatted === "" ? DRILL_DOWN_NOT_AVAILABLE : formatted;
};

/**
 * Account ID, Account Name, Amount.
 *
 * Account ID is frozen and fixed at 188px — wide enough for an 18-character
 * Salesforce id on one line, which is why the source pins the width rather than
 * letting it flex.
 */
const BASE: readonly DrillDownColumn[] = [
  { key: "accountId", label: "Account ID", width: 188, pinned: true, value: blank((c) => c.accountId) },
  { key: "name", label: "Account Name", width: 220, value: blank((c) => c.name) },
  { key: "amount", label: "Amount (USD)", width: 140, value: amount },
];

/** Shown only on a Lost row, between the amount and the churn date. */
const LOST: readonly DrillDownColumn[] = [
  {
    key: "lostReasonCategory",
    label: "Lost Reason Category",
    width: 220,
    value: withPlaceholder((c) => c.lostReasonCategory),
  },
  // The source lets this ONE column wrap and grows the row to fit it
  // (`wrapText`/`autoHeight` plus a per-row height estimate). This port cannot:
  // `BuildTable`'s row windowing measures one row and assumes every other
  // matches it, so a variable-height row would break the scroll extent. So the
  // column keeps the source's generous width and the full text is carried on
  // the cell's `title` instead of being silently clipped to a fragment — a free
  // -text lost reason is the whole point of the two Lost columns. Deviation in
  // mis.md §7.
  { key: "lostReason", label: "Lost Reason", width: 320, value: withPlaceholder((c) => c.lostReason) },
];

/** The eight columns every drill-down ends with, whichever row was opened. */
const INTERMEDIATE: readonly DrillDownColumn[] = [
  { key: "churnDate", label: "ARR Churn Date", width: 160, value: withPlaceholder((c) => c.churnDate) },
  // Sales Region and Sub Region get NO placeholder in the source, though they
  // are declared non-nullable exactly as Account ID and Account Name are. So an
  // unexpected empty renders blank here and "N/A" one column to the left.
  { key: "salesRegion", label: "Sales Region", width: 160, value: blank((c) => c.salesRegion) },
  { key: "subRegion", label: "Sub Region", width: 160, value: blank((c) => c.subRegion) },
  {
    key: "accountRating",
    label: "Account Rating",
    width: 150,
    value: withPlaceholder((c) => c.accountRating),
  },
  {
    key: "activationDate",
    label: "Activation Date",
    width: 160,
    value: withPlaceholder((c) => c.activationDate),
  },
  {
    key: "customerLifetime",
    label: "Customer Lifetime (Years)",
    width: 180,
    value: withPlaceholder((c) => c.customerLifetime),
  },
  {
    key: "technicalOwner",
    label: "Technical Owner",
    width: 180,
    value: withPlaceholder((c) => c.technicalOwner),
  },
  {
    key: "accountOwner",
    label: "Account Owner",
    width: 180,
    value: withPlaceholder((c) => c.accountOwner),
  },
];

/** The two rows whose customers left, and which therefore carry a reason. */
const LOST_ROWS: ReadonlySet<string> = new Set(["lost", "lost-customers"]);

/**
 * The dialog's columns for the row that was opened.
 *
 * Keyed on the row ID rather than on its label. The source compares the label
 * text against 'Lost' and 'Lost Customers'; the port has stable ids, and a
 * Build carrying four rows labelled "y/y growth" is the reason a label is not
 * an identity here.
 */
export const drillDownColumns = (rowId: string): readonly DrillDownColumn[] =>
  LOST_ROWS.has(rowId) ? [...BASE, ...LOST, ...INTERMEDIATE] : [...BASE, ...INTERMEDIATE];

/**
 * One row per customer, in the order the backend listed them.
 *
 * Deliberately NOT sorted. The order is the order the figure was summed in, and
 * re-sorting would quietly assert an order the backend did not send.
 *
 * The id is the account id, SUFFIXED on a repeat. The backend aggregates per
 * account, so a repeat should not happen — but `BuildRow.id` is not merely a
 * React key here: `buildTableIds` stamps it into a DOM `id` that every cell in
 * the row points at through `headers`. A duplicate would therefore give two
 * rows the same DOM id and break the wiring a screen reader follows for both,
 * which is a worse failure than the rows being indistinguishable.
 */
export function drillDownRows(customers: readonly DrillDownCustomer[]): BuildRow[] {
  const seen = new Map<string, number>();
  return customers.map((customer) => {
    const repeat = seen.get(customer.accountId) ?? 0;
    seen.set(customer.accountId, repeat + 1);
    return {
      id: repeat === 0 ? customer.accountId : `${customer.accountId}#${repeat}`,
      label: customer.accountId,
    };
  });
}

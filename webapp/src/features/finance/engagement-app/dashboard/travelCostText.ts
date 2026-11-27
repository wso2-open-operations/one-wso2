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

import type { CostSource, NotConverted } from "../api/engagementTypes";
import { money } from "../model/format";

/** The hint beside every Travel Cost heading, (the CSVs carry a short version in their header block). */
export const USD_RATE_HINT =
  "Amounts recorded in USD, and card charges billed in USD, are used as they are. Other currencies are converted at NetSuite's month-end rate (today's rate for the current month).";

/** The hint once the Transactions widget shows each line's rate. */
export const USD_RATE_HINT_WITH_TRANSACTIONS = `${USD_RATE_HINT} Each transaction shows how it was converted.`;

/** What a cost source is called on screen. */
export const COST_SOURCE_LABEL: Readonly<Record<CostSource, string>> = {
  invoice: "Travel Invoices",
  perDiem: "Per Diems",
  card: "Credit Card Expenses",
  claim: "Expense Claims",
};

/** Every unconverted amount with its source, e.g. "AED 5,940.00 (Per Diems), BRL 712.35 (Expense Claims)". */
export function notConvertedList(rows: readonly NotConverted[]): string {
  return rows.map((r) => `${r.currency ? money(r.amount, r.currency) : `Unknown currency ${money(r.amount, undefined)}`} (${COST_SOURCE_LABEL[r.source]})`).join(", ");
}

/** The one line under the KPIs for amounts that could not be converted, or an empty string when there are none. */
export function notConvertedText(rows: readonly NotConverted[]): string {
  if (!rows.length) return "";
  return `Not converted, left out of the totals: ${notConvertedList(rows)}`;
}

/** How many amounts the rows stand for: the sum of their lines, or one per row when the backend sent no count. */
export function notConvertedLines(rows: readonly NotConverted[]): number {
  return rows.reduce((n, r) => n + (r.lines ?? 1), 0);
}

/** The one line above the figures about amounts with no exchange rate, or an empty string when there is nothing to say. */
export function notConvertedNote(rows: readonly NotConverted[], ratesPending: boolean): string {
  if (ratesPending) return "Some exchange rates are still loading, so totals may be low. Refresh in a minute.";
  if (!rows.length) return "";
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  const known = rows.filter((r) => r.currency);
  const noCurrency = notConvertedLines(rows.filter((r) => !r.currency));
  const parts: string[] = [];
  if (known.length) {
    const amounts = notConvertedLines(known);
    const currencies = new Set(known.map((r) => r.currency)).size;
    parts.push(`${plural(amounts, "amount", "amounts")} in ${plural(currencies, "currency", "currencies")} ${amounts === 1 ? "has" : "have"} no exchange rate, so ${amounts === 1 ? "it is" : "they are"} left out of the totals.`);
  }
  if (noCurrency) parts.push(`${plural(noCurrency, "amount has", "amounts have")} no currency recorded, so ${noCurrency === 1 ? "it is" : "they are"} left out of the totals.`);
  return parts.join(" ");
}

/** The rows of the "left out" table: by source, then currency. */
export function notConvertedSorted(rows: readonly NotConverted[]): NotConverted[] {
  const order = Object.keys(COST_SOURCE_LABEL);
  return [...rows].sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source) || a.currency.localeCompare(b.currency));
}

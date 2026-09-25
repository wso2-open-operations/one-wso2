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

// What kind of number a Build row holds, and how each kind is written down.
//
// The two belong together because of one rule, spec §3: **Scale never scales
// counts.** The units/thousands control divides currency rows only; a headcount
// and a retention percentage are the same number either way.
//
// The Build shows all three kinds in the same column — Opening ARR above
// Opening Customers above Net Dollar Retention — so that rule cannot be a
// caller's responsibility. The enforcement is structural rather than
// documentary: `formatMisValue` REQUIRES the kind of number it is being handed,
// and `scale` is read in the currency branch and nowhere else. There is no
// path through this module that divides a count by a thousand, and no default
// that lets a caller reach one by forgetting something.
//
// (The source defaults the kind to currency — `formatArrValue(value)` scales.
// That default is the whole foot-gun, and it is not ported.)
//
// Ported from digiops-finance `arrDashboard/utils/valueFormat.js` and
// `rowHeaders.js`. Every label is verbatim: they are what the ARR backend sends
// back as a row's `rowHeader`, so they are wire values, not display strings.

import { MIS_SCALES, type MisScale } from "./misViewVocabulary";

/** Every figure on every MIS screen is US dollars. There is no other currency. */
const CURRENCY_CODE = "USD";

/**
 * The row labels the Build and the Analysis grids share.
 *
 * Three keys say words CONTEXT.md tells us to avoid — `ENDING_ARR` (the
 * glossary's term is Exit ARR), `TOTAL_CHURN_ARR` (Lost) and
 * `PERCENT_INCREASES_UPSELLS_TOTAL` (Expansion). They keep them because a key
 * here names its own VALUE, and the value is what the ARR backend sends as a
 * row's `rowHeader`: renaming the key to the glossary's word would leave a
 * `EXIT_ARR: "Ending ARR"` that nobody can check against the source at a
 * glance. The glossary governs prose and new names; this map is a transcript.
 */
export const MIS_ROW_LABELS = {
  OPENING_ARR: "Opening ARR",
  NEW: "New",
  TRANSFERRED_IN: "Transferred In (included in new)",
  EXPANSIONS: "Expansions",
  REDUCTIONS: "Reductions",
  TRANSFERRED_OUT: "Transferred Out (included in lost)",
  LOST: "Lost",
  ENDING_ARR: "Ending ARR",
  YOY_GROWTH: "y/y growth",
  NET_NEW: "Net New",
  TOTAL_NEW_ARR: "Total New ARR",
  TOTAL_CHURN_ARR: "Total Churn ARR",
  /** The blank line between sections. */
  EMPTY: "",
  GROSS_DOLLAR_RETENTION: "Gross Dollar Retention",
  NET_DOLLAR_RETENTION: "Net Dollar Retention",
  DOLLAR_RETENTION_LOST_ONLY: "Dollar Retention (lost only)",
  DOLLAR_RETENTION_REDUCTION_AND_LOST: "Dollar Retention (reduction and lost)",
  DOLLAR_RETENTION_REDUCTION_AND_INCREASES: "Dollar Retention (reduction and increases)",
  DOLLAR_RETENTION_ALL: "Dollar Retention (increases and reduction and lost)",
  PERCENT_NEW_TOTAL: "% New Total",
  PERCENT_INCREASES_UPSELLS_TOTAL: "% Increases/Upsells Total",
  PERCENT_REDUCTIONS_TOTAL: "% Reductions Total",
  PERCENT_LOST_TOTAL: "% Lost Total",
  OPENING_CUSTOMERS: "Opening Customers",
  NEW_CUSTOMERS: "New Customers",
  TRANSFERRED_IN_CUSTOMERS: "Transferred In Customers (included in new)",
  LOST_CUSTOMERS: "Lost Customers",
  TRANSFERRED_OUT_CUSTOMERS: "Transferred Out Customers (included in lost)",
  CLOSING_CUSTOMERS: "Closing Customers",
  CLOSING_SUB_CUSTOMERS: "Closing Subscriptions Customers",
  PERCENT_NEW_LOGOS: "% New Logos",
  PERCENT_LOST_LOGOS: "% Lost Logos",
} as const;

/** What kind of number a row holds — which decides whether Scale touches it. */
export const MIS_VALUE_TYPES = {
  CURRENCY: "currency",
  COUNT: "count",
  PERCENTAGE: "percentage",
} as const;
export type MisValueType = (typeof MIS_VALUE_TYPES)[keyof typeof MIS_VALUE_TYPES];

// Only the exceptions are listed. Everything absent is money — see below.
const VALUE_TYPE_BY_ROW: ReadonlyMap<string, MisValueType> = new Map([
  [MIS_ROW_LABELS.OPENING_CUSTOMERS, MIS_VALUE_TYPES.COUNT],
  [MIS_ROW_LABELS.NEW_CUSTOMERS, MIS_VALUE_TYPES.COUNT],
  [MIS_ROW_LABELS.TRANSFERRED_IN_CUSTOMERS, MIS_VALUE_TYPES.COUNT],
  [MIS_ROW_LABELS.LOST_CUSTOMERS, MIS_VALUE_TYPES.COUNT],
  [MIS_ROW_LABELS.TRANSFERRED_OUT_CUSTOMERS, MIS_VALUE_TYPES.COUNT],
  [MIS_ROW_LABELS.CLOSING_CUSTOMERS, MIS_VALUE_TYPES.COUNT],
  [MIS_ROW_LABELS.CLOSING_SUB_CUSTOMERS, MIS_VALUE_TYPES.COUNT],

  [MIS_ROW_LABELS.YOY_GROWTH, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.GROSS_DOLLAR_RETENTION, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.NET_DOLLAR_RETENTION, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.DOLLAR_RETENTION_LOST_ONLY, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.DOLLAR_RETENTION_REDUCTION_AND_LOST, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.DOLLAR_RETENTION_REDUCTION_AND_INCREASES, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.DOLLAR_RETENTION_ALL, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.PERCENT_NEW_TOTAL, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.PERCENT_INCREASES_UPSELLS_TOTAL, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.PERCENT_REDUCTIONS_TOTAL, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.PERCENT_LOST_TOTAL, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.PERCENT_NEW_LOGOS, MIS_VALUE_TYPES.PERCENTAGE],
  [MIS_ROW_LABELS.PERCENT_LOST_LOGOS, MIS_VALUE_TYPES.PERCENTAGE],
]);

/**
 * What kind of number the row labelled `rowLabel` holds.
 *
 * Currency is the answer for anything unlisted, and that default is the right
 * way round: the rows this cannot know about are business units, regions and
 * account names — rows the backend names at runtime — and every one of them
 * holds money. The count and percentage rows, by contrast, are a closed list
 * the grids define. So an unrecognised row is scaled, which for a currency row
 * is correct, and there is no row it can wrongly refuse to scale.
 */
export function misValueTypeForRow(rowLabel: string): MisValueType {
  return VALUE_TYPE_BY_ROW.get(rowLabel) ?? MIS_VALUE_TYPES.CURRENCY;
}

export interface FormatMisValueOptions {
  /** Units unless stated. Read on currency and nowhere else. */
  scale?: MisScale;
  /** Currency only, and 2 unless stated. */
  fractionDigits?: number;
}

/**
 * One figure, as it goes on screen.
 *
 * `valueType` is required rather than defaulted, and that is the whole point of
 * this signature: it is the one parameter that decides whether Scale applies,
 * so a caller has to have thought about it. `misValueTypeForRow` is what
 * answers it for a Build row.
 *
 * A string passes through untouched — the ARR backend answers `"N/A"` and `"%"`
 * in cells it cannot compute, and those are already the display value. Anything
 * that is not a number at all renders as empty rather than as `NaN`.
 */
export function formatMisValue(
  value: number | string | null | undefined,
  valueType: MisValueType,
  { scale = MIS_SCALES.UNITS, fractionDigits = 2 }: FormatMisValueOptions = {},
): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "";

  switch (valueType) {
    case MIS_VALUE_TYPES.COUNT:
      return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    case MIS_VALUE_TYPES.PERCENTAGE:
      return value.toLocaleString("en-US", fixed(2));
    default: {
      // The ONLY division by a thousand in the port.
      const scaled = scale === MIS_SCALES.THOUSANDS ? value / 1000 : value;
      return scaled.toLocaleString("en-US", fixed(fractionDigits));
    }
  }
}

const fixed = (digits: number): Intl.NumberFormatOptions => ({
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

/**
 * A HEADLINE figure — the one on a summary card, above a table rather than in
 * one. Compact, in dollars, and **never scaled**.
 *
 * The rule is the source's, stated in one line above its own grid formatter
 * (`arrAnalysis/ArrAnalysisDashboard.js:695`): *"Grid amounts follow the shared
 * Scale and drop cents; cards and charts keep the full currency format."* It is
 * a coherent division rather than an oversight. A grid is a working surface,
 * where Scale is the reader narrowing a wall of figures to the magnitude they
 * are thinking in, and every column sits under one caption saying which. A card
 * is a single number read at a glance, usually the first thing on the screen
 * and the thing quoted out of it — so a headline that silently divides by a
 * thousand because of a toggle somewhere below is the §10.18 foot-gun with no
 * file involved.
 *
 * Enforced by having **no `scale` parameter at all**, the same way
 * `misBuildSheet` has none: there is no argument a call site could pass to
 * scale a headline, so none can. Ticket 14's charts take this one too.
 *
 * `$1.2M`, `$63.3K`, `$950`.
 */
export function misHeadlineAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return HEADLINE_FORMAT.format(value);
}

// `minimumFractionDigits: 0` is not a default being restated. For a currency,
// engines disagree on what a lone `maximumFractionDigits: 1` implies: Node 24's
// V8 writes `$950`, while Node 22's — the version this repo pins — takes the
// currency's two minimum digits, clamps them to one, and writes `$950.0`. A
// browser splits the same way by engine version. Saying both ends makes it one
// answer everywhere.
const HEADLINE_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY_CODE,
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/**
 * What the caption above a grid says its figures are in.
 *
 * It sits with the grid rather than with the control, because Finance's
 * workflow is to crop a table into a slide deck: a figure that has left the
 * screen it was set on has to carry its own units, or a reading a thousand
 * times out is a screenshot away.
 */
export function amountUnitCaption(scale: MisScale): string {
  return scale === MIS_SCALES.THOUSANDS
    ? `All amounts in ${CURRENCY_CODE} '000`
    : `All amounts in ${CURRENCY_CODE}`;
}

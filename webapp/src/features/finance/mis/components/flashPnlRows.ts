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

// The monthly P&L, as a table rather than as a response.
//
// Ported from the assembly in digiops-finance's `FlashConsole.js` (`fetchData`)
// and the grid in `flashConsole/tableView.js/DataTable.js` — two files, one
// here, because they are two halves of one fact: this section, those lines,
// those six columns.
//
// ---- what the source does, and why none of it survives the port ------------
//
// `fetchData` builds its table by MUTATING the response it was handed:
//
//   * fourteen `unshift`es push a synthetic `{id: 0, title, isTitle: true}` row
//     onto the front of each section, so a heading is a row in the same flat
//     list as the figures and is told apart by a flag;
//   * `data.grossMargin.forEach(obj => Object.assign(obj, {isPresentage: true}))`
//     marks the percentage rows, in a second pass over a list it has already
//     walked;
//   * the fourteen are concatenated and then RENUMBERED — `tableData[i].id = i`
//     — which throws away every `id` the backend sent and replaces it with a
//     position;
//   * the grid's `expandTable` then splices a clicked row's `subLevel` INTO the
//     same array at `params.id + 1`, assigning those rows ids from 100 upward
//     and never removing them on a second click.
//
// So the row identities move whenever the response changes shape, the heading
// rows and the figure rows share a namespace, and the tree is a flat list
// pretending. Here a section is a row with children, a sub-level is those
// children's children, and `BuildTable` already knows how to collapse both. The
// response is read, never written.
//
// ---- and where the percentage rule is enforced -----------------------------
//
// `misValueTypeForRow` (ticket 05) answers by LABEL, and cannot answer here:
// these labels are GL account categories the backend names at runtime, so every
// one of them would fall through to its currency default — Gross Margin
// included, which is the one row spec §3 says Scale must not touch. The section
// a row arrived in is what knows, so the section is what decides.

import { MIS_VALUE_TYPES, type MisValueType } from "../util/misMoney";
import {
  flashAmount,
  flashRowsIn,
  type FlashBalanceStatement,
  type FlashBusinessUnitSummary,
} from "../api/misFlashTypes";
import type { BuildColumnGroup, BuildRow } from "./buildTableModel";
import { flashRowId } from "./flashRowIds";

/** One business-unit column of the P&L. */
export interface FlashUnitColumn extends BuildColumnGroup {
  /** The response field this column reads. */
  key: keyof FlashBusinessUnitSummary & string;
  /** The column heading. */
  label: string;
  /**
   * What the detail views call this unit when they ask the backend for it.
   *
   * NOT the heading, and the difference is not cosmetic: `BU_LIST`
   * (`Config.js:95-103`) calls the WSO2 column `"All"` and the Integration one
   * `"Integration-Software"`. Carried beside the column because the column
   * header is what opens the detail view, so this is the one place both names
   * are known at once.
   */
  businessUnit: string;
  /**
   * Whether this column's monthly view is told about the reader's sub-regions.
   *
   * **True for Integration alone**, and that is a typo being reproduced rather
   * than a rule. `DataTable.js` hands the Integration column's dialog
   * `subRegions={subRegions}` (`:175`) and hands the other five
   * **`subregions=`** with a lower-case r (`:226`, `:251`, `:276`, `:301`,
   * `:326`). `MonthlyViewDialog` destructures `subRegions = []`
   * (`MonthlyViewDialog.js:55`), so for those five the prop is `undefined` and
   * an EMPTY list reaches the request body — the filter is silently dropped.
   *
   * Reproduced under ADR 0003, because it changes figures: with a sub-region
   * applied, five of the six monthly views show company-wide numbers in both
   * apps. Correcting it here would make the port disagree with the source on
   * fourteen sections across twelve months, which is exactly the disagreement
   * the parallel period exists to avoid. Spec §8 records it, and §11 asks
   * Finance whether they want the one-line fix in the source instead.
   */
  sendsSubRegions: boolean;
}

/** How wide one business-unit column is. Six of them and a label column fit a laptop. */
const UNIT_COLUMN_WIDTH = 132;

/**
 * The six columns, in the source's order.
 *
 * `integrationCloud` is absent because it does not exist: the backend record
 * has no such field and the source's column definition for it is commented out
 * (`DataTable.js:183-207`). Spec §9 — dead code in the source is not ported.
 */
export const FLASH_UNIT_COLUMNS: readonly FlashUnitColumn[] = [
  {
    key: "integrationSoftware",
    label: "Integration",
    businessUnit: "Integration-Software",
    width: UNIT_COLUMN_WIDTH,
    // The only column whose prop the source spells correctly — see the field.
    sendsSubRegions: true,
  },
  {
    key: "iam",
    label: "IAM",
    businessUnit: "IAM",
    width: UNIT_COLUMN_WIDTH,
    sendsSubRegions: false,
  },
  {
    key: "apim",
    label: "APIM",
    businessUnit: "APIM-Software",
    width: UNIT_COLUMN_WIDTH,
    sendsSubRegions: false,
  },
  {
    key: "choreo",
    label: "Choreo",
    businessUnit: "Choreo",
    width: UNIT_COLUMN_WIDTH,
    sendsSubRegions: false,
  },
  {
    key: "corporate",
    label: "Corporate",
    businessUnit: "Corporate",
    width: UNIT_COLUMN_WIDTH,
    sendsSubRegions: false,
  },
  {
    key: "wso2",
    label: "WSO2",
    businessUnit: "All",
    width: UNIT_COLUMN_WIDTH,
    sendsSubRegions: false,
  },
];

/** Which response field a column reads. */
export type FlashUnitKey = FlashUnitColumn["key"];

/** One section of the statement: where its lines come from and what they mean. */
export interface FlashSection {
  /** Stable, and the prefix of every row id beneath it. */
  id: string;
  /** The heading, verbatim from the source's `unshift`. */
  label: string;
  /** The response field holding this section's lines. */
  field: keyof FlashBalanceStatement;
  /**
   * What kind of number the lines hold. Currency everywhere but Gross Margin,
   * which is a rate — so Scale must not divide it. Spec §3.
   */
  valueType: MisValueType;
}

/**
 * The fourteen sections, in the order the source concatenates them
 * (`FlashConsole.js`, the `tableData` literal).
 *
 * All fourteen, not the six §2.5 names in prose: the backend sends them, the
 * source draws them, and ticket 19 reconciles the two screens figure by figure.
 * A section dropped here would be a line Finance could not find.
 */
export const FLASH_PNL_SECTIONS: readonly FlashSection[] = [
  { id: "arr", label: "ARR", field: "arr", valueType: MIS_VALUE_TYPES.CURRENCY },
  { id: "booking", label: "Booking", field: "booking", valueType: MIS_VALUE_TYPES.CURRENCY },
  { id: "revenue", label: "Revenue", field: "revenue", valueType: MIS_VALUE_TYPES.CURRENCY },
  {
    id: "cost-of-sales",
    label: "Cost of Sales",
    field: "costOfSales",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "gross-profit",
    label: "Gross Profit",
    field: "grossProfit",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  // The one section that is not money. Ticket 15 names it, and it is the reason
  // the kind of number is a property of the SECTION here.
  {
    id: "gross-margin",
    label: "Gross Margin",
    field: "grossMargin",
    valueType: MIS_VALUE_TYPES.PERCENTAGE,
  },
  { id: "expense", label: "Expense", field: "expense", valueType: MIS_VALUE_TYPES.CURRENCY },
  { id: "ebitdas", label: "EBITDAS", field: "ebitdas", valueType: MIS_VALUE_TYPES.CURRENCY },
  {
    id: "stock-compensation-gratuity",
    label: "Stock Compensation/Gratuity",
    field: "stockCompensationGratuity",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  { id: "ebitda", label: "EBITDA", field: "ebitda", valueType: MIS_VALUE_TYPES.CURRENCY },
  {
    id: "other-income",
    label: "Other Income",
    field: "otherIncome",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "other-expenses",
    label: "Other Expenses",
    field: "otherExpenses",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "net-other-income",
    label: "Net Other Income",
    field: "netOtherIncome",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "net-profit-loss",
    label: "Net Profit/Loss",
    field: "netProfitLoss",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
];

/** One line's figures, and what kind of number they are. */
export interface FlashPnlFigures {
  valueType: MisValueType;
  /** Absent for a unit the backend said nothing about — which is not nought. */
  amounts: Readonly<Record<FlashUnitKey, number | null>>;
}

export interface FlashPnl {
  rows: BuildRow[];
  /** Keyed by `BuildRow.id`. A section heading has none: it carries no figures. */
  figures: ReadonlyMap<string, FlashPnlFigures>;
}

/**
 * The statement as a tree of rows, and the figures each row holds.
 *
 * Two returns rather than figures on the rows themselves, because `BuildRow`
 * carries no values by design — `BuildTable` asks its `cell` function for them,
 * so the Scale rule and the money formatter stay in one place (ticket 05)
 * instead of being re-applied by every caller.
 */
export function flashPnlRows(statement: FlashBalanceStatement): FlashPnl {
  const figures = new Map<string, FlashPnlFigures>();

  const lineRows = (
    lines: readonly FlashBusinessUnitSummary[],
    section: FlashSection,
    prefix: string,
  ): BuildRow[] => {
    const taken = new Set<string>();
    return lines.map((line, index) => {
      const label = line.title ?? "";
      const id = flashRowId(prefix, label, index, taken);
      figures.set(id, { valueType: section.valueType, amounts: amountsOf(line) });
      const children = flashRowsIn<FlashBusinessUnitSummary>(line.subLevel);
      return {
        id,
        label,
        ...(children.length ? { children: lineRows(children, section, id) } : {}),
      };
    });
  };

  const rows = FLASH_PNL_SECTIONS.map((section) => {
    const lines = flashRowsIn<FlashBusinessUnitSummary>(statement[section.field]);
    return {
      id: section.id,
      label: section.label,
      // The source bolds its heading rows; here they are also the thing that
      // collapses, so the emphasis and the toggle are the same row.
      emphasis: true,
      ...(lines.length ? { children: lineRows(lines, section, section.id) } : {}),
    } satisfies BuildRow;
  });

  return { rows, figures };
}

const amountsOf = (line: FlashBusinessUnitSummary): Record<FlashUnitKey, number | null> =>
  Object.fromEntries(
    FLASH_UNIT_COLUMNS.map((column) => [column.key, flashAmount(line[column.key])]),
  ) as Record<FlashUnitKey, number | null>;

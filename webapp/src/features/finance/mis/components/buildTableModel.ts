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

// The shape of a Build table, with no DOM in it.
//
// A Build reads down: an Opening balance, the movements that change it, a
// Closing balance — and across: one column group per Period, each holding the
// same few sub-columns. `BuildTable.tsx` renders that; this decides what is on
// screen, how wide it has to be, and what the header cells are called.
//
// Kept apart from the component because both halves are things a test can hold
// still. Which rows a collapsed section hides is logic, and logic that only
// exists inside a render can only be tested by rendering. And the `id`/`headers`
// wiring is a set of strings that must agree across three places in the markup;
// agreement between strings is exactly what a unit test is for.

/** One Period, spanning its sub-columns in the header's first row. */
export interface BuildColumnGroup {
  key: string;
  label: string;
}

/** A sub-column repeated under every Period — Amount, % of Opening. */
export interface BuildSubColumn {
  key: string;
  label: string;
  /** Column width in px. The table has an explicit minimum so it scrolls rather than squeezes. */
  width: number;
}

/**
 * One line of a Build.
 *
 * Carries no values: `BuildTable` asks its `cell` function for those, so the
 * Scale rule and the money formatter stay in one place (ticket 05) rather than
 * being re-applied by every caller.
 *
 * It carries no depth either. Depth is where the row sits in the tree, and a
 * row that could state its own would be a row that could contradict the tree.
 */
export interface BuildRow {
  id: string;
  label: string;
  /** A balance line — Opening, Closing, a Gross Profit: emphasised and tinted. */
  emphasis?: boolean;
  /** The rule an accountant draws above a total. */
  ruleAbove?: boolean;
  children?: readonly BuildRow[];
}

/** A row as it appears on screen, with what the tree says about it. */
export interface BuildVisibleRow {
  row: BuildRow;
  /** 0 is outermost. Drives the indent. */
  depth: number;
  /** Owns children, so its label carries a toggle. */
  expandable: boolean;
  expanded: boolean;
}

const hasChildren = (row: BuildRow): boolean => (row.children?.length ?? 0) > 0;

/**
 * The rows currently on screen, in reading order.
 *
 * A closed row keeps its own line and takes everything beneath it away —
 * grandchildren included, so that collapsing a section actually costs nothing
 * rather than merely looking as though it does. That matters here more than it
 * usually would: there is no virtualization yet (ticket 07), so a row that is
 * hidden but still rendered is a row still being paid for.
 *
 * The set names what is OPEN, not what is closed, so that a Build opens as the
 * summary it is meant to be — the balances and the movements between them — and
 * stays that way when rows arrive. Naming what is closed would mean seeding the
 * set from the tree, and a tree that is empty on the first render (because the
 * fetch has not landed) would seed nothing and then blow every section open
 * under the reader the moment it did.
 *
 * An id that no longer matches a row is ignored. Filters change what the Build
 * contains, and a view restored from a link can easily name a section that is
 * no longer there.
 */
export function visibleRows(
  rows: readonly BuildRow[],
  expandedIds: ReadonlySet<string>,
): BuildVisibleRow[] {
  const out: BuildVisibleRow[] = [];
  const walk = (list: readonly BuildRow[], depth: number): void => {
    for (const row of list) {
      const expandable = hasChildren(row);
      const expanded = expandable && expandedIds.has(row.id);
      out.push({ row, depth, expandable, expanded });
      if (expanded) walk(row.children ?? [], depth + 1);
    }
  };
  walk(rows, 0);
  return out;
}

/**
 * How wide the table must be before the container starts scrolling.
 *
 * Stated explicitly because the alternative is two dozen numeric columns
 * sharing whatever width the page has, which at 12 Periods is illegible. The
 * columns keep their size and the horizontal scroll does the work.
 */
export function tableMinWidth(
  groupCount: number,
  subColumns: readonly BuildSubColumn[],
  rowLabelWidth: number,
): number {
  const groupWidth = subColumns.reduce((total, column) => total + column.width, 0);
  return rowLabelWidth + groupCount * groupWidth;
}

/** The header cell names one Build table uses. */
export interface BuildTableIds {
  /** The pinned row-label column's header. */
  rowLabelHeader: string;
  /** A Period's header, spanning its sub-columns. */
  groupHeader(groupKey: string): string;
  /** A sub-column's header, under one Period. */
  subHeader(groupKey: string, subKey: string): string;
  /** A row's own label cell. */
  rowHeader(rowId: string): string;
  /** The `headers` attribute for one figure: its row, its Period, its sub-column. */
  cellHeaders(rowId: string, groupKey: string, subKey: string): string;
}

/**
 * Names for every header cell in one table, derived from a base that is unique
 * per instance (`useId`).
 *
 * This is the mechanism behind the one accessibility claim a two-row header
 * cannot make for free. `scope` and `colSpan` are enough for a single header
 * row; with two, a screen reader reading a figure out of 24 numeric columns has
 * no way to say which Period it belongs to. `headers` on every data cell is how
 * it can, and it only works if these strings agree across the three places they
 * appear.
 *
 * Per-instance because two Build tables can share a page — the Subscription
 * grid and a customer drill-down — and duplicate ids would send `headers` to
 * whichever the browser saw first.
 */
export function buildTableIds(base: string): BuildTableIds {
  const rowHeader = (rowId: string) => `${base}:row:${token(rowId)}`;
  const groupHeader = (groupKey: string) => `${base}:period:${token(groupKey)}`;
  // Prefixed by its Period: the same sub-column appears under every one of
  // them, and "amount" alone would name a dozen cells.
  const subHeader = (groupKey: string, subKey: string) =>
    `${base}:period:${token(groupKey)}:${token(subKey)}`;
  return {
    rowLabelHeader: `${base}:rowlabel`,
    groupHeader,
    subHeader,
    rowHeader,
    cellHeaders: (rowId, groupKey, subKey) =>
      `${rowHeader(rowId)} ${groupHeader(groupKey)} ${subHeader(groupKey, subKey)}`,
  };
}

/**
 * A caller's key, made safe to put in an id.
 *
 * Two things would otherwise break, and both are reachable with real data
 * rather than hypothetical:
 *
 * A `headers` attribute is a SPACE-SEPARATED list of ids, so one space inside
 * an id silently splits it into two references that point at nothing. A TTM
 * Period's header is `"2025/12/31 - 2026/12/31"` — spaces and all — so a caller
 * keying its column groups by the label it already has would break the wiring
 * and nothing would say so.
 *
 * And the parts are joined, so `("a", "b:c")` and `("a:b", "c")` would land on
 * the same id. Percent-encoding is injective and escapes both the space and the
 * `:` separator, so neither confusion survives it.
 */
const token = (value: string): string => encodeURIComponent(value);

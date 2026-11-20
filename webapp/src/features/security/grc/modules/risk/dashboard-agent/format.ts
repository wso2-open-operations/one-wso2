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

import type { Cell, ResultColumn, WidgetResult } from "./dashboardAgentApi";

// Turns a widget result into what each visual draws. Pure functions, no React,
// so the shaping rules are easy to test on their own.

const isRate = (col: ResultColumn): boolean => col.id.endsWith("_rate");

// cellText is how a value reads in a table or on a tile.
export function cellText(col: ResultColumn, value: Cell): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (isRate(col)) return `${(value * 100).toFixed(1)}%`;
    if (col.kind === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return value.toLocaleString();
  }
  return String(value);
}

const measureColumns = (r: WidgetResult): number[] =>
  r.columns.flatMap((c, i) => (c.role === "measure" ? [i] : []));
const dimensionColumns = (r: WidgetResult): number[] =>
  r.columns.flatMap((c, i) => (c.role === "dimension" ? [i] : []));

const label = (v: Cell): string => (v === null || v === undefined || v === "" ? "—" : String(v));

export interface BarModel {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; name: string }[];
}

// toBarModel shapes a result for a bar chart: one dimension gives one bar per
// value with a series per measure; two dimensions with one measure give a
// series per value of the second dimension. Anything else is not a bar chart.
export function toBarModel(r: WidgetResult): BarModel | null {
  const dims = dimensionColumns(r);
  const measures = measureColumns(r);
  if (r.rows.length === 0) return null;

  if (dims.length === 1 && measures.length >= 1) {
    const x = r.columns[dims[0]];
    return {
      xKey: x.id,
      series: measures.map((m) => ({ key: r.columns[m].id, name: r.columns[m].label })),
      data: r.rows.map((row) => {
        const out: Record<string, string | number> = { [x.id]: label(row[dims[0]]) };
        for (const m of measures) out[r.columns[m].id] = Number(row[m] ?? 0);
        return out;
      }),
    };
  }

  if (dims.length === 2 && measures.length === 1) {
    const x = r.columns[dims[0]];
    const seriesNames: string[] = [];
    const byX = new Map<string, Record<string, string | number>>();
    for (const row of r.rows) {
      const xv = label(row[dims[0]]);
      const sv = label(row[dims[1]]);
      if (!seriesNames.includes(sv)) seriesNames.push(sv);
      const entry = byX.get(xv) ?? { [x.id]: xv };
      entry[sv] = Number(row[measures[0]] ?? 0);
      byX.set(xv, entry);
    }
    return {
      xKey: x.id,
      series: seriesNames.map((n) => ({ key: n, name: n })),
      data: [...byX.values()],
    };
  }
  return null;
}

export interface GridModel {
  rowTitle: string;
  colTitle: string;
  valueTitle: string;
  rows: string[];
  cols: string[];
  cell: (row: string, col: string) => Cell;
  text: (row: string, col: string) => string;
  // 0 to 1: how strong a cell's value is compared with the largest.
  intensity: (row: string, col: string) => number;
}

// sorted orders axis values: numbers by value, anything else as it came.
function axis(values: string[], numeric: boolean, descending: boolean): string[] {
  const unique = [...new Set(values)];
  if (!numeric) return unique;
  return unique.sort((a, b) => (descending ? Number(b) - Number(a) : Number(a) - Number(b)));
}

// toGridModel shapes a result for a heat map: the first dimension down the
// side (highest at the top when numeric, like a likelihood axis), the second
// across the bottom, and the measure in each cell.
export function toGridModel(r: WidgetResult): GridModel | null {
  const dims = dimensionColumns(r);
  const measures = measureColumns(r);
  if (dims.length !== 2 || measures.length !== 1) return null;

  const [d0, d1] = dims;
  const m = measures[0];
  const numeric = (i: number): boolean => r.rows.length > 0 && r.rows.every((row) => typeof row[i] === "number");

  const values = new Map<string, Cell>();
  let max = 0;
  for (const row of r.rows) {
    values.set(`${label(row[d0])}\u0000${label(row[d1])}`, row[m]);
    if (typeof row[m] === "number") max = Math.max(max, row[m] as number);
  }
  const get = (a: string, b: string): Cell => values.get(`${a}\u0000${b}`) ?? null;
  const col = r.columns[m];

  return {
    rowTitle: r.columns[d0].label,
    colTitle: r.columns[d1].label,
    valueTitle: col.label,
    rows: axis(r.rows.map((row) => label(row[d0])), numeric(d0), true),
    cols: axis(r.rows.map((row) => label(row[d1])), numeric(d1), false),
    cell: get,
    text: (a, b) => cellText(col, get(a, b)),
    intensity: (a, b) => {
      const v = get(a, b);
      return typeof v === "number" && max > 0 ? v / max : 0;
    },
  };
}

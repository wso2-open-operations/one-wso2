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

// How a Flash row is identified, and which rows a Flash opens with.
//
// Shared by the two Flash tables — the P&L across business units
// (`flashPnlRows`) and one unit's months (`flashDetailRows`). Those two differ
// in the records they read and in the order of their sections, which is why
// they are two builders; they do NOT differ in what a row's identity is, and a
// rule about identity living in two places is a rule that drifts. The same
// argument `arrBuildRows` makes about the source's four copies of one fact.

import type { BuildRow } from "./buildTableModel";

/**
 * A row's id: its section, then its own name.
 *
 * Named rather than numbered, because the id is what `BuildTable` tracks an
 * open section by and a refetch must not close what the reader opened. A
 * position would move the moment the backend returned one line more.
 *
 * Two lines in a section CAN share a title — nothing in either contract forbids
 * it — and two rows sharing an id would send `headers` to whichever the browser
 * saw first, so the second one takes its position instead.
 *
 * `taken` is the caller's set for one level of one section, and is mutated: it
 * is what makes the collision rule work across a `map`.
 */
export function flashRowId(
  prefix: string,
  label: string,
  index: number,
  taken: Set<string>,
): string {
  const base = `${prefix}:${encodeURIComponent(label || index)}`;
  const id = taken.has(base) ? `${base}:${index}` : base;
  taken.add(id);
  return id;
}

/**
 * The sections, open on first render — and only the sections.
 *
 * A Flash table opens as the whole statement, the way the source's flat grids
 * do, so every top-level row is in this set. The sub-levels are NOT: they sit a
 * level below, and the source keeps them behind an interaction too (its own is
 * a separate dialog, which ticket 15 replaces with these).
 */
export function flashSectionIds(rows: readonly BuildRow[]): string[] {
  return rows.map((row) => row.id);
}

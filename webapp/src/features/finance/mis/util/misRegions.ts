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

// How a region key off the wire becomes a row, and how it is written.
//
// Both of the Region Summary's views cut their rows by region and both get
// those rows from the RESPONSE rather than from a fixed list, so both have to
// answer the same two questions: is this the same region the last column
// named, and how does finance spell it. The source asks them twice, in two
// copies of `formatRegionLabel` — `useExitArrByRegion.js` and
// `useArrSummaryRegionMetrics.js` — which is one copy too many for a rule
// whose whole job is that two tables agree about what a region is called.

/** The row a region key belongs to: its name, case- and spacing-insensitive. */
export const regionId = (key: string): string =>
  key.trim().replace(/_/g, " ").replace(/\s+/g, " ").toLowerCase();

/**
 * How finance writes each region, for the keys where the wire and the report
 * disagree.
 *
 * The keys BOTH copies of `formatRegionLabel` agree on. They are not the same
 * map: `useExitArrByRegion.js` adds two spellings of its own total row and
 * `useArrSummaryRegionMetrics.js` adds two `wso2 exit` ones. Each table passes
 * its own beside these rather than everyone inheriting everyone's, because a
 * label map is a claim about what a backend sends and neither backend sends the
 * other's keys.
 */
export const REGION_LABELS: Readonly<Record<string, string>> = {
  apac: "APAC",
  eu: "EU",
  na: "NA",
  me: "ME",
  latam: "LatAm",
  anz: "ANZ",
  roe: "ROE",
  roa: "ROA",
  total: "Total",
};

/**
 * A region key as a row header.
 *
 * ---- one rule of the source's is deliberately narrowed -------------------
 *
 * `formatRegionLabel` uppercases EVERY word of two to four letters, so that
 * unmapped acronyms come out as acronyms. Applied per word it also shouts short
 * ordinary ones: "Middle East" — a region named in that function's own comment
 * — renders "Middle EAST". Here the rule applies only when the whole key IS one
 * short word, which is when it is an acronym; a multi-word key is prose and is
 * title-cased instead. Recorded in `docs/ported-apps/mis.md` §7.
 *
 * Capitals the wire already sent are kept, so a backend that sends display
 * names gets them back unchanged rather than re-cased on a guess.
 *
 * `labels` is the map to read overrides from, defaulting to the shared one. A
 * table whose backend spells its own total row differently passes that map plus
 * its own aliases; `total` is in the shared map because both tables' backends
 * send that key and both DROP it before labelling, so it is a wire spelling
 * rather than either table's own total row.
 */
export function regionLabel(
  key: string,
  labels: Readonly<Record<string, string>> = REGION_LABELS,
): string {
  const name = key.trim().replace(/_/g, " ").replace(/\s+/g, " ");
  const mapped = labels[name.toLowerCase()];
  if (mapped) return mapped;
  // Split on + and -, keeping them, so a combined region reads "EU + ROE"
  // rather than "Eu+roe". The separators come back spaced either way.
  return name
    .split(/\s*([-+])\s*/)
    .map((part) => (part === "-" || part === "+" ? ` ${part} ` : namePart(part, labels)))
    .join("");
}

function namePart(part: string, labels: Readonly<Record<string, string>>): string {
  const mapped = labels[part.toLowerCase()];
  if (mapped) return mapped;
  if (/^[A-Za-z]{2,4}$/.test(part)) return part.toUpperCase();
  // Only a word with no capitals of its own is re-capitalised. "Middle East"
  // survives; "middle east" is fixed.
  return part.replace(/\S+/g, (word) =>
    /[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
  );
}

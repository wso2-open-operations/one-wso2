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

/**
 * The type scale — the ONLY font sizes and weights pages should use.
 *
 * Before this, 45 files used 63 different fontSize values in two units
 * ("0.58rem", 14 …) and four bold weights, so no two pages read alike. Every
 * size now maps to one named step, and every weight to one named role. The
 * base is 12.5px (`FS.body`) — taken half a pixel down across the scale
 * after review on the live UI: dense enough for data tables, readable for text.
 *
 *   FS.micro    9.5px  legend dots, tiny badges — use sparingly
 *   FS.caption  10.5px  chips, footers, meta, uppercase labels / table headers
 *   FS.small    11.5px  secondary lines (domain · industry), helper text
 *   FS.body     12.5px  table cells, paragraphs, inputs — the default
 *   FS.reading  13.5px  long-form text (Ask AI answers, descriptions)
 *   FS.title    15px  page and panel titles
 *   FS.display  19px  funnel / stage counts
 *   FS.kpi      23px  hero numbers
 *
 *   FW.regular  400   body text
 *   FW.medium   500   controls, chips, quiet emphasis
 *   FW.semibold 600   row names, labels, table headers
 *   FW.bold     700   titles and numbers only
 */

export const FS = {
  micro: "0.59375rem",   // 9.5px
  caption: "0.65625rem", // 10.5px
  small: "0.71875rem",   // 11.5px
  body: "0.78125rem",    // 12.5px
  reading: "0.84375rem", // 13.5px
  title: "0.9375rem",    // 15px
  display: "1.1875rem",  // 19px
  kpi: "1.4375rem",      // 23px
} as const;

export const FW = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/** Table rows are quieter than page text: 13px semibold names made every row
 * look highlighted. Rows use these instead of FS.body. */
export const ROW = {
  /** The row's name (company, lead, person) — the one thing to scan for. */
  primary: { fontSize: FS.small, fontWeight: FW.medium },
  /** Ordinary cell text. */
  cell: { fontSize: FS.small, fontWeight: FW.regular },
  /** A score / count in a row — same size as the row, medium weight, fixed-width
   * digits so a column of numbers lines up. Colour carries the meaning (hot /
   * warm / cold), so it doesn't also need to be heavy. */
  number: { fontSize: FS.small, fontWeight: FW.medium, fontVariantNumeric: "tabular-nums" },
  /** Second line under a name (domain · industry, job title). */
  secondary: { fontSize: FS.caption, fontWeight: FW.regular },
} as const;

/** Uppercase label style — section labels and table headers share it. */
export const LABEL = {
  fontSize: FS.caption,
  fontWeight: FW.semibold,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
} as const;

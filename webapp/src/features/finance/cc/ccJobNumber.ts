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
 * Travel job numbers that are not in the dropdown — `utils.ts:74-80`.
 *
 * `GET /travels/job-numbers` returns only the past year, because the list
 * would otherwise be enormous. Older spend is rare but real, and until now
 * there was no way to file it: the picker committed only what it had been
 * handed. People know the exact number in those cases, so the field accepts
 * a typed one and the existing `GET /travels/{jobNumber}` — which has no
 * such date limit — decides whether it is real.
 */

/** `TRV-YYYY-MM-NNNN`. */
export const JOB_NUMBER_PATTERN = /^TRV-\d{4}-\d{2}-\d{4}$/;

/**
 * What gets sent and compared.
 *
 * Upper-cased because the dropdown's own entries are, and a typed "trv-…"
 * would otherwise miss both the list and the lookup's cache key while being
 * the same job to everyone reading it.
 */
export function normalizeJobNumber(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Whether this is worth asking the backend about.
 *
 * Shape only — it says nothing about the job existing, which is the
 * lookup's answer, not this one's.
 */
export function isValidJobNumberFormat(value: string): boolean {
  return JOB_NUMBER_PATTERN.test(normalizeJobNumber(value));
}

/**
 * A travel date, the way the source writes it — `utils.ts:35-42`.
 *
 * "10 Jan 2026", not "Jan 10, 2026". The source asks for `en-UK`, which is
 * not a real tag — there is no UK region subtag, only GB — and falls back to
 * British conventions by luck rather than intent. `en-GB` is the tag that
 * actually means that, and formats identically.
 *
 * Separate from `formatNice`, which is US-ordered and used by every other
 * finance screen. Only this tooltip mirrors the source's wording.
 */
export function formatJobDate(input: string | null | undefined): string {
  if (!input) return "—";
  // The entity sends "2016-10-11 00:00:00.0", which Safari will not parse as
  // an ISO string; the date half is all this needs and parses everywhere.
  const date = new Date(input.trim().slice(0, 10));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

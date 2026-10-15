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
 * Travel job numbers that are not in the dropdown.
 *
 * `GET /travels/job-numbers` returns only the past year, so an older job can
 * only be entered by typing it in full.
 */

/** `TRV-YYYY-MM-NNNN`. */
export const JOB_NUMBER_PATTERN = /^TRV-\d{4}-\d{2}-\d{4}$/;

/** Upper-cased, so a typed value matches the list and the lookup's key. */
export function normalizeJobNumber(value: string): string {
  return value.trim().toUpperCase();
}

/** Shape only. Whether the job exists is the lookup's answer. */
export function isValidJobNumberFormat(value: string): boolean {
  return JOB_NUMBER_PATTERN.test(normalizeJobNumber(value));
}

/**
 * A travel date for the job-details tooltip: "10 Jan 2026".
 *
 * Separate from `formatNice`, which is US-ordered and used elsewhere.
 */
export function formatJobDate(input: string | null | undefined): string {
  if (!input) return "—";
  // "2016-10-11 00:00:00.0" is not parsed everywhere; the date half is.
  const date = new Date(input.trim().slice(0, 10));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    // These are calendar dates. A date-only string parses as midnight UTC, so
    // without this a reader behind UTC sees the day before.
    timeZone: "UTC",
  }).format(date);
}

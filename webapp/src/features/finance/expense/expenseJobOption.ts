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
 * The shape both the New Claim dialog (`ExpenseTravelData`, from `/app-data`)
 * and the submitter correction dialog (`SubmitterTravel`, from
 * `/employees/{email}/travels`) already satisfy — this file only reads the
 * three fields a Job Number option needs to display and be searched by, so it
 * stays usable from either without importing one dialog's type into the
 * other's.
 */
export interface JobOption {
  jobNumber: string;
  customerName: string | null;
  country?: string | null;
}

/** The sentinel option for an expense that isn't tied to any travel. */
export const NO_JOB_OPTION: JobOption = { jobNumber: "N/A", customerName: null, country: null };

/**
 * The Job Number dropdown's display label: "<job number> (<country>)", with
 * the country omitted (just the bare job number) when the job has none.
 */
export function formatJobOption(t: JobOption): string {
  if (t.jobNumber === NO_JOB_OPTION.jobNumber) return "N/A (non-travel)";
  return t.country ? `${t.jobNumber} (${t.country})` : t.jobNumber;
}

/**
 * The same label, split so a dropdown option can render the country as a
 * visually secondary detail instead of flush with the job number at equal
 * weight — the job number is what the reader is scanning the list for.
 */
export function formatJobOptionParts(t: JobOption): { main: string; country: string | null } {
  if (t.jobNumber === NO_JOB_OPTION.jobNumber) return { main: "N/A (non-travel)", country: null };
  return { main: t.jobNumber, country: t.country ?? null };
}

/** Lower-cased haystack for filtering the dropdown by job number, customer, or country. */
export function jobSearchText(t: JobOption): string {
  return [t.jobNumber, t.customerName, t.country]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

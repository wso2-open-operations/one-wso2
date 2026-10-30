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

import { useMemo } from "react";
import { useEmployeeDirectory } from "@features/org-chart/api/useOrgChart";
import type { EmployeeDirectoryRecord } from "@features/org-chart/api/orgChartTypes";

/** What a leaderboard row shows about a person, from One WSO2's employee data. */
export interface AmplifyPerson {
  name: string;
  photoUrl: string | null;
}

export type PeopleByEmail = ReadonlyMap<string, AmplifyPerson>;

const NOBODY: PeopleByEmail = new Map();

/** Keyed by trimmed, lowercased work email, the key amplify-api returns on every row. */
export function indexPeople(records: readonly EmployeeDirectoryRecord[]): PeopleByEmail {
  const people = new Map<string, AmplifyPerson>();
  for (const r of records) {
    // One row without an email (a contractor, a placeholder) is skipped, not a crash for the whole page.
    if (typeof r.workEmail !== "string" || !r.workEmail.trim()) continue;
    const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
    people.set(r.workEmail.trim().toLowerCase(), { name, photoUrl: r.employeeThumbnail || null });
  }
  return people;
}

/**
 * Photos and names for leaderboard rows (ADR-009: Amplify stores no people
 * data; the UI enriches rows by email).
 *
 * Same source Org Chart uses: people-app's GET /employees/basic-info, open to
 * every signed-in employee, one response for the whole company, and shared
 * with Org Chart through React Query's cache. Me's own endpoint can't serve
 * this: /employees/{id} answers only for yourself, your reports or admins.
 *
 * Empty until it loads, and stays empty when the people backend isn't
 * configured or the call fails. Rows then fall back to amplify-api's display
 * name and initials, so the leaderboard never waits on it.
 */
export function useAmplifyPeople(): PeopleByEmail {
  const directory = useEmployeeDirectory();
  return useMemo(() => (directory.data ? indexPeople(directory.data) : NOBODY), [directory.data]);
}

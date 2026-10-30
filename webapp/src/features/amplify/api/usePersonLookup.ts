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


import { useMemo } from "react";
import { useEmployeeDirectory } from "@features/org-chart/api/useOrgChart";
import type { EmployeeDirectoryRecord } from "@features/org-chart/api/orgChartTypes";

/** Who a name belongs to, as far as the caller knows. */
export interface PersonRef {
  employeeId: string;
  /** What Amplify recorded; may be the employee id itself. */
  displayName?: string | null;
  email?: string | null;
}

export interface ResolvedPerson {
  name: string;
  photoUrl: string | null;
  team: string | null;
  businessUnit: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a "name" is really an id, which Amplify stores when the sign-in never gave it a name. */
export function looksLikeId(name: string | null | undefined): boolean {
  // A blank or whitespace-only "name" is as good as none.
  return !name?.trim() || UUID.test(name.trim());
}

/** A name for display: the directory's, else what Amplify recorded, never a bare id. */
export function nameOrUnknown(directoryName: string | undefined, recorded: string | null | undefined): string {
  const fromDirectory = directoryName?.trim();
  if (fromDirectory) return fromDirectory;
  return looksLikeId(recorded) ? "Unknown employee" : (recorded ?? "").trim();
}

function fullName(r: EmployeeDirectoryRecord): string {
  return `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
}

/**
 * Looks a person up in the people directory (by work email, then employee id) for the real name, photo, team
 * and business unit. A uuid is never shown as a name: with no directory match the answer is "Unknown employee".
 */
export function usePersonLookup(): (p: PersonRef) => ResolvedPerson {
  const directory = useEmployeeDirectory();
  const index = useMemo(() => {
    const byEmail = new Map<string, EmployeeDirectoryRecord>();
    const byId = new Map<string, EmployeeDirectoryRecord>();
    for (const r of directory.data ?? []) {
      if (typeof r.workEmail === "string" && r.workEmail.trim()) byEmail.set(r.workEmail.trim().toLowerCase(), r);
      if (r.employeeId) byId.set(r.employeeId, r);
    }
    return { byEmail, byId };
  }, [directory.data]);
  return (p) => {
    const rec = (p.email ? index.byEmail.get(p.email.trim().toLowerCase()) : undefined) ?? index.byId.get(p.employeeId);
    const recorded = looksLikeId(p.displayName) ? "" : (p.displayName ?? "").trim();
    return {
      name: (rec && fullName(rec)) || recorded || "Unknown employee",
      photoUrl: rec?.employeeThumbnail ?? null,
      team: rec?.team || null,
      businessUnit: rec?.businessUnit || null,
    };
  };
}

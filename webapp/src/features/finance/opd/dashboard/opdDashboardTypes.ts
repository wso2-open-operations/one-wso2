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
 * `GET /dashboard-summary`, as `dashboardSlice.ts:13-31` declares it.
 *
 * One request serves the whole screen: the four figures, the two-year
 * comparison and the per-employee utilisation list all come back together.
 */
export interface OpdUtilizationRow {
  employeeEmail: string;
  firstName: string;
  lastName: string;
  submittedAmount: number;
  claimLimit: number;
  percentUsed: number;
}

export interface OpdDashboardSummary {
  claimsProcessed: number;
  claimsPending: number;
  valueProcessed: number;
  valuePending: number;
  employeesSubmittedThisYear: number;
  employeesSubmittedLastYear: number;
  employeesFullyUtilizedThisYear: number;
  employeesFullyUtilizedLastYear: number;
  utilization: OpdUtilizationRow[];
}

/**
 * Who a utilisation row is about.
 *
 * `ClaimUtilizationTable.tsx:78` — the name when the backend has one, the work
 * email when it does not. An employee with no name on file is still somebody
 * whose spend finance needs to see, so the row is never blank.
 */
export function utilizationName(row: OpdUtilizationRow): string {
  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  return name || row.employeeEmail;
}

/**
 * How close an employee is to their limit, as the source colours it —
 * `ClaimUtilizationTable.tsx:86`: 90% and over is over-spend territory, 70%
 * and over is worth noticing, below that is unremarkable.
 *
 * Returned as a name rather than a colour so the table maps it to the portal's
 * palette instead of carrying hex values from another app's theme.
 */
export type OpdUtilizationTone = "high" | "medium" | "normal";

export function utilizationTone(percentUsed: number): OpdUtilizationTone {
  if (percentUsed >= 90) return "high";
  if (percentUsed >= 70) return "medium";
  return "normal";
}

/**
 * The percentage as the table prints it.
 *
 * Rounded, and clamped at both ends: the backend divides submitted by the
 * limit, so a corrected claim can put it above 100 and a zero limit can make
 * it `Infinity` — neither is a number to show an employee.
 */
export function utilizationPercent(percentUsed: number): number {
  if (!Number.isFinite(percentUsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(percentUsed)));
}

/** The limit every employee is measured against, when there is a row to read it from. */
export function claimLimitOf(rows: OpdUtilizationRow[]): number | null {
  return rows.length > 0 ? rows[0].claimLimit : null;
}

/**
 * The response, made safe to render.
 *
 * `authedGet<OpdDashboardSummary>` only parses JSON — the type parameter is a
 * claim about the body, not a check on it. A response that omits `utilization`,
 * or sends it as null, would reach `claimLimitOf`, which reads `.length` and
 * throws before anything renders: a blank screen for a missing field.
 *
 * So every field is coerced at the boundary. A missing count becomes 0 and a
 * missing list becomes empty, both of which the screen already knows how to
 * draw, rather than a figure invented to look plausible.
 */
export function normalizeDashboardSummary(raw: unknown): OpdDashboardSummary {
  const body = (raw ?? {}) as Partial<Record<keyof OpdDashboardSummary, unknown>>;
  const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const rows = Array.isArray(body.utilization) ? (body.utilization as unknown[]) : [];

  return {
    claimsProcessed: count(body.claimsProcessed),
    claimsPending: count(body.claimsPending),
    valueProcessed: count(body.valueProcessed),
    valuePending: count(body.valuePending),
    employeesSubmittedThisYear: count(body.employeesSubmittedThisYear),
    employeesSubmittedLastYear: count(body.employeesSubmittedLastYear),
    employeesFullyUtilizedThisYear: count(body.employeesFullyUtilizedThisYear),
    employeesFullyUtilizedLastYear: count(body.employeesFullyUtilizedLastYear),
    // A row with no email is dropped: it is the table's key, and two of them
    // would collide. Names are optional — `utilizationName` falls back to the
    // email — but an unidentifiable row says nothing to anyone.
    utilization: rows
      .map((row) => (row ?? {}) as Partial<Record<keyof OpdUtilizationRow, unknown>>)
      .filter((row): row is Record<string, unknown> => typeof row.employeeEmail === "string" && row.employeeEmail !== "")
      .map((row) => ({
        employeeEmail: String(row.employeeEmail),
        firstName: typeof row.firstName === "string" ? row.firstName : "",
        lastName: typeof row.lastName === "string" ? row.lastName : "",
        submittedAmount: count(row.submittedAmount),
        claimLimit: count(row.claimLimit),
        percentUsed: count(row.percentUsed),
      })),
  };
}

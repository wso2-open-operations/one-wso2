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

import type { OpdClaimSearchPayload, OpdClaimStatus, OpdEmployee } from "../opdTypes";
import { opdStatusFilter } from "../opdTypes";

/**
 * The three queues finance works through — `Approvals.tsx:70-95`.
 *
 * Each tab IS a status filter; switching tabs is not a view change over one
 * list, it is a different question asked of the backend.
 */
export const OPD_APPROVAL_TABS = [
  { segment: "pending", label: "Pending Claims" },
  { segment: "approved", label: "Approved Claims" },
  { segment: "rejected", label: "Rejected Claims" },
] as const;

export type OpdApprovalTab = (typeof OPD_APPROVAL_TABS)[number]["segment"];

/** The statuses a tab asks for. PENDING also brings PENDING_OLD; see `opdStatusFilter`. */
export function statusesForTab(tab: OpdApprovalTab): OpdClaimStatus[] {
  switch (tab) {
    case "approved":
      return ["APPROVED"];
    case "rejected":
      return ["REJECTED"];
    default:
      return ["PENDING"];
  }
}

/**
 * Whether the year range applies to a tab.
 *
 * `Approvals.tsx:74-76` hides it on Pending: a claim waiting on a decision is
 * waiting now, whatever year it was filed in, and a year filter there would
 * hide work that still has to be done.
 */
export function tabHasYearRange(tab: OpdApprovalTab): boolean {
  return tab !== "pending";
}

export type OpdApprovalPeriod = "this" | "last" | "custom";

export function periodLabel(period: OpdApprovalPeriod): string {
  switch (period) {
    case "this":
      return "This Year";
    case "last":
      return "Last Year";
    default:
      return "Custom";
  }
}

/** What finance has narrowed the queue by. */
export interface OpdApprovalFilters {
  period: OpdApprovalPeriod;
  startYear: number;
  endYear: number;
  /** `FilterHolder.tsx` — filter by the claimant's email, and by claim id. */
  email: string;
  claimId: string;
}

export function emptyApprovalFilters(now = new Date()): OpdApprovalFilters {
  const year = now.getFullYear();
  return { period: "this", startYear: year, endYear: year, email: "", claimId: "" };
}

/**
 * The years a period covers, ordered.
 *
 * Either end of a custom span can be picked first, so a backwards range is a
 * legitimate sequence rather than a mistake; sorting it means the queue comes
 * back with claims instead of empty.
 */
export function yearBounds(
  filters: OpdApprovalFilters,
  now = new Date(),
): { startYear: number; endYear: number } {
  const current = now.getFullYear();
  if (filters.period === "this") return { startYear: current, endYear: current };
  if (filters.period === "last") return { startYear: current - 1, endYear: current - 1 };
  return {
    startYear: Math.min(filters.startYear, filters.endYear),
    endYear: Math.max(filters.startYear, filters.endYear),
  };
}

/**
 * The search payload for a tab.
 *
 * No `email` of the caller: this is everybody's claims, which is the whole
 * point of the screen — the backend decides whether the caller may ask.
 */
export function toApprovalSearchPayload(
  tab: OpdApprovalTab,
  filters: OpdApprovalFilters,
  now = new Date(),
): OpdClaimSearchPayload {
  const id = filters.claimId.trim();
  const email = filters.email.trim();
  const payload: OpdClaimSearchPayload = {
    status: opdStatusFilter(statusesForTab(tab)) ?? null,
    // Blank means no filter. `[""]` would ask for a claim whose id is the empty
    // string and come back with nothing.
    ids: id ? [id] : null,
    email: email || null,
  };
  // Pending has no year range, so sending one would narrow a queue the source
  // deliberately leaves unnarrowed.
  if (tabHasYearRange(tab)) {
    const { startYear, endYear } = yearBounds(filters, now);
    payload.startYear = startYear;
    payload.endYear = endYear;
  }
  return payload;
}

/** Whether anything is narrowing the queue, for the Filters button's count. */
export function activeFilterCount(tab: OpdApprovalTab, filters: OpdApprovalFilters): number {
  let n = 0;
  if (filters.email.trim()) n += 1;
  if (filters.claimId.trim()) n += 1;
  if (tabHasYearRange(tab) && filters.period !== "this") n += 1;
  return n;
}

/**
 * Who a claim belongs to, for the User column.
 *
 * `UserCard` resolves the claimant against the employee directory and falls
 * back to the address. An employee the directory has never heard of is still
 * somebody whose claim is waiting, so the row is never blank.
 */
export function claimantName(email: string, employees: OpdEmployee[] | undefined): string {
  const match = employees?.find((e) => e.workEmail === email);
  if (!match) return email;
  const name = `${match.firstName ?? ""} ${match.lastName ?? ""}`.trim();
  return name || email;
}

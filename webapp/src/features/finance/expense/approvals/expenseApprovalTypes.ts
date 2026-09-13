/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  FINANCE_TABS,
  LEAD_TABS,
  type ApproverView,
  type ExpenseClaim,
  type ExpenseClaimSearchPayload,
  type ExpenseClaimStatus,
} from "../expenseTypes";

/**
 * `/search-claims` returns `submittedBy` alongside `employeeEmail` — who filed
 * the claim, as opposed to who it is for. The shared `ExpenseClaim` does not
 * name it because the Me-side screens never differ on it, so this view adds it
 * rather than widening the type the other expense screens also depend on.
 */
export interface ApprovalClaim extends ExpenseClaim {
  submittedBy?: string | null;
}

export type ApprovalTabKey = "pending" | "approved" | "rejected";

/**
 * Approvals.tsx:39-62. The tab a claim is filed under depends on the stage:
 * a lead's "Approved" spans everything they passed on, whatever finance did
 * with it afterwards, so it means "claims I approved" rather than "claims that
 * are approved". Finance's is the terminal status alone.
 */
export function approvalTabs(stage: ApproverView) {
  return stage === "LEAD" ? LEAD_TABS : FINANCE_TABS;
}

export function tabStatuses(stage: ApproverView, tab: ApprovalTabKey): ExpenseClaimStatus[] {
  return approvalTabs(stage).find((t) => t.key === tab)?.statuses ?? [];
}

// FilterHolder.tsx:40 — the range dropdown is two options, not a year list.
export const CLAIM_RANGE_LATEST = "Latest 100";
export const CLAIM_RANGE_CUSTOM = "Custom Date";
export type ClaimRange = typeof CLAIM_RANGE_LATEST | typeof CLAIM_RANGE_CUSTOM;

/** A filter set as the screen holds it, before it becomes a search payload. */
export interface ApprovalFilters {
  /** The employee Autocomplete — lead and finance only. */
  email: string;
  claimId: string;
  range: ClaimRange;
  /** Both set, or both empty — a half-filled range is never applied. */
  startDate: string;
  endDate: string;
}

export const EMPTY_APPROVAL_FILTERS: ApprovalFilters = {
  email: "",
  claimId: "",
  range: CLAIM_RANGE_LATEST,
  startDate: "",
  endDate: "",
};

/**
 * tableSlice.ts:45-54 — the search body. Fields are OMITTED rather than sent
 * empty; the backend treats an empty array differently from an absent one.
 *
 * `showRange` is the source's `isClaimRangeVisible`, which the Pending tab
 * turns off (`Approvals.tsx:44`). It does two things there and both are
 * reproduced here: it hides the range control, and it drops `limit` from the
 * payload — so a pending queue is never silently truncated at 100.
 */
export function toApprovalSearchPayload(
  stage: ApproverView,
  tab: ApprovalTabKey,
  filters: ApprovalFilters,
  viewerEmail: string | undefined,
): ExpenseClaimSearchPayload {
  const showRange = tab !== "pending";
  const custom = showRange && filters.range === CLAIM_RANGE_CUSTOM && filters.startDate && filters.endDate;
  return {
    // Only when the approver filtered by one. Unlike the user's own history,
    // this screen never scopes itself to the signed-in person.
    email: filters.email || undefined,
    // The lead stage is scoped by the claims routed to this person; the finance
    // stage is not scoped at all, which is what the backend's admin-role gate
    // lets through.
    leadEmail: stage === "LEAD" ? viewerEmail : undefined,
    ids: filters.claimId ? [filters.claimId] : undefined,
    limit: showRange && filters.range === CLAIM_RANGE_LATEST ? 100 : undefined,
    startDate: custom ? filters.startDate : undefined,
    endDate: custom ? filters.endDate : undefined,
    status: tabStatuses(stage, tab),
  };
}

/**
 * utils.ts#isOnBehalfOfClaim — a claim filed by someone other than the person
 * it belongs to. `submittedBy` is absent on older records, which read as own.
 */
export function isOnBehalfOfClaim(claim: ApprovalClaim): boolean {
  return Boolean(claim.submittedBy) && claim.submittedBy !== claim.employeeEmail;
}

/**
 * utils.ts#getOnBehalfOfParty — an on-behalf claim has two people on it, and
 * which one is worth naming depends on which side of it the viewer sits. If
 * they filed it, it was submitted FOR the employee; if somebody else filed it,
 * it was submitted BY that person. Either way the party named is the other
 * one, never the viewer. Null for a claim nobody filed on behalf of.
 */
export interface OnBehalfOfParty {
  label: "Submitted for" | "Submitted by";
  email: string;
}

export function onBehalfOfParty(
  claim: ApprovalClaim,
  viewerEmail: string | null | undefined,
): OnBehalfOfParty | null {
  if (!isOnBehalfOfClaim(claim)) return null;
  return Boolean(viewerEmail) && claim.submittedBy === viewerEmail
    ? { label: "Submitted for", email: claim.employeeEmail }
    : { label: "Submitted by", email: claim.submittedBy! };
}

/**
 * Resolve a work email to a display name, falling back to the address when the
 * employee list has not arrived or does not carry one. Names are what the
 * source shows on screen (`UserCard.tsx`); the address belongs in a tooltip.
 */
export function makeNameResolver(
  employees: { workEmail: string; firstName: string | null; lastName: string | null }[] | undefined,
) {
  const byEmail = new Map((employees ?? []).map((e) => [e.workEmail, e]));
  return (email: string | null | undefined): string => {
    if (!email) return "";
    const match = byEmail.get(email);
    const name = match && [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
    return name || email;
  };
}

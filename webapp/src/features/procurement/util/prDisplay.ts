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

// Pure display helpers ported from the standalone app's types/api.ts, so the two
// front ends render a reference, a priority and an activity line identically.

import type { HomeActivity, PRPriority, PRStatus } from "@features/procurement/api/purchasingTypes";

/** PR-YYYY-NNNNNNN when the backend assigned one, else the system id. */
export function prReference(pr: { id: number; reference?: string | null }): string {
  return pr.reference || `#${pr.id}`;
}

/** P3 is the default: requests predating the priority column carry no value. */
export function prPriority(pr: { priority?: PRPriority | null }): PRPriority {
  return pr.priority ?? "P3";
}

export function prPriorityColor(pr: PRPriority): "error" | "warning" | "success" {
  if (pr === "P1") return "error";
  if (pr === "P2") return "warning";
  return "success";
}

export const PR_STATUS_LABELS: Record<PRStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  vendor_selected: "Vendor selected",
  contract_prepared: "Contract prepared",
  order_signed: "Order signed",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const PR_STATUS_COLORS: Record<
  PRStatus,
  "default" | "primary" | "secondary" | "success" | "error" | "info" | "warning"
> = {
  submitted: "info",
  under_review: "warning",
  vendor_selected: "secondary",
  contract_prepared: "secondary",
  order_signed: "success",
  completed: "success",
  rejected: "error",
  cancelled: "default",
};

// Audit/process action → the phrase shown in an activity feed. The map is the
// backend's action vocabulary (model/events.go); the default humanises anything
// a newer backend adds, so an unrecognised action degrades to readable text
// rather than disappearing.
const ACTIVITY_LABELS: Record<string, string> = {
  submit_pr: "Request submitted",
  update_pr: "Request updated",
  reject_pr: "Request rejected",
  add_pr_approver: "Approver added",
  remove_pr_approver: "Approver removed",
  rerequest_pr_approval: "Approval re-requested",
  update_pr_collaborators: "Collaborators updated",
  create_recommendation: "Recommendation created",
  update_recommendation: "Recommendation updated",
  delete_recommendation: "Recommendation removed",
  request_rec_approval: "Approval requested",
  remove_rec_approval: "Approval card removed",
  update_budget_chain: "Budget chain updated",
  raise_rfi: "RFI raised",
  clear_rfi: "RFI cleared",
  add_quotation: "Quotation added",
  update_quotation: "Quotation updated",
  delete_quotation: "Quotation removed",
  select_quotation: "Quotation selected",
  add_draft_contract: "Draft contract added",
  update_contract: "Contract updated",
  delete_contract: "Contract removed",
  create_grn: "GRN recorded",
  update_grn: "GRN updated",
  delete_grn: "GRN removed",
  create_invoice: "Invoice recorded",
  update_invoice: "Invoice updated",
  delete_invoice: "Invoice removed",
};

export function activityLabel(action: string, qualifier: string): string {
  // Actions whose wording depends on the qualifier.
  switch (action) {
    case "pr_approval":
      return qualifier === "reject" ? "Approval rejected" : "Approved";
    case "team_lead_approval":
      return qualifier === "reject" ? "Team lead rejected" : "Team lead approved";
    case "assign_pr":
      return qualifier === "unassign" ? "Unassigned" : "Assigned";
    case "update_pr_priority":
      return qualifier ? `Priority set to ${qualifier}` : "Priority updated";
    case "rec_approval_legal":
      return qualifier === "revert" ? "Legal approval reverted" : "Legal approved";
    case "rec_approval_security":
      return qualifier === "revert" ? "Security approval reverted" : "Security approved";
    case "rec_approval_compliance":
      return qualifier === "revert" ? "Compliance approval reverted" : "Compliance approved";
    case "rec_approval_budget":
      if (qualifier === "reject") return "Budget rejected";
      if (qualifier === "revert") return "Budget approval reverted";
      return "Budget approved";
    case "sign_contract":
      return qualifier === "unsign" ? "Contract unsigned" : "Contract signed";
    case "invoice_status":
      return `Invoice ${qualifier || "updated"}`;
    case "assign_rec_legal":
      return qualifier === "unassign" ? "Legal assignee cleared" : "Legal assignee set";
    case "assign_rec_security":
      return qualifier === "unassign" ? "Security assignee cleared" : "Security assignee set";
    case "assign_rec_compliance":
      return qualifier === "unassign" ? "Compliance assignee cleared" : "Compliance assignee set";
  }
  return (
    ACTIVITY_LABELS[action] ??
    action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function relativeTime(iso: string): string {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** A stable key for an activity row — the feed has no ids of its own. */
export function activityKey(a: HomeActivity): string {
  return `${a.purchase_request_id}-${a.action}-${a.qualifier}-${a.created_at}`;
}

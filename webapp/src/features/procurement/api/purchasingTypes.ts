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

// Wire types for the purchasing backend, mirrored from the standalone app's
// webapp/src/types/api.ts.
//
// Mirrored rather than shared: the two front ends are separate builds in separate
// repos, so there is no package to import. Only the fields these screens actually
// read are carried over — the source interface for PurchaseRequest has ~40, most
// of which belong to the detail view that lands in a later phase. Keep additions
// demand-driven for the same reason.
//
// The contract is owned by the backend. When it changes, BOTH front ends have to
// be updated in the same PR — see docs/plans/21-one-wso2-port.md.

export type Role =
  | "staff"
  | "procurement"
  | "procurement_admin"
  | "admin"
  | "legal"
  | "security"
  | "compliance";

export type PRStatus =
  | "submitted"
  | "under_review"
  | "vendor_selected"
  | "contract_prepared"
  | "order_signed"
  | "completed"
  | "rejected"
  | "cancelled";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type PRPriority = "P1" | "P2" | "P3";

export interface UserSummary {
  id: number;
  email: string;
  name: string;
}

// GET /api/v1/me — identity plus the authorization inputs.
export interface PurchasingMe {
  id: number;
  sub: string;
  email: string;
  name: string;
  roles: Role[];
  // True when the caller approves any PR they didn't submit — a named approver,
  // or a budget/legal/security/compliance actor. Roles alone cannot tell, since
  // budget owners and named approvers hold no distinguishing role.
  is_approver: boolean;
}

// GET /api/v1/purchase-requests — the list projection. The detail read returns
// considerably more; that arrives with the detail page.
export interface PurchaseRequest {
  id: number;
  // Human-readable reference (PR-YYYY-NNNNNNN), assigned at submission. Null for
  // requests predating the feature, where display falls back to the id.
  reference?: string | null;
  title: string;
  status: PRStatus;
  priority: PRPriority;
  created_at: string;
  requester?: UserSummary | null;
  assignee_id?: number | null;
  assignee?: UserSummary | null;
  team_lead_status: ApprovalStatus;
  approvals_total: number;
  approvals_approved: number;
  /** The caller's own named-approval status, on list reads. */
  my_approval_status?: ApprovalStatus | null;
  /** The caller's state across BOTH approval systems. Only on scope=approvals. */
  my_approval_state?: ApprovalStatus | null;
}

export interface HomeActivity {
  purchase_request_id: number;
  reference: string;
  title: string;
  action: string;
  qualifier: string;
  actor_email: string;
  created_at: string;
}

export interface StaffHome {
  my_requests_count: number;
  completed_count: number;
  recent_activity: HomeActivity[];
}

export interface ApprovalsHome {
  pending_count: number;
  completed_count: number;
  recent_activity: HomeActivity[];
}

export interface ProcurementHome {
  pending_count: number;
  awaiting_delivery_count: number;
  completed_count: number;
  recent_activity: HomeActivity[];
}

// GET /api/v1/home — the backend decides which blocks apply to the caller, so
// every field is optional and an absent block means "not your role".
export interface HomeResponse {
  staff?: StaffHome;
  approvals?: ApprovalsHome;
  procurement?: ProcurementHome;
}

/** The list scope the backend understands. Omit for the role-based default. */
export type PRListScope = "mine" | "approvals";

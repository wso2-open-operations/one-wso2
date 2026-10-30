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

import type { BillingFrequency, DraftInput, Issue } from "@features/sales/cado2/quotes/api/quoteTypes";

/** Approval roles. Each is an Asgardeo group. */
export type ApprovalRole =
  | "DEAL_DESK"
  | "LEGAL"
  | "FIELD_ENGINEERING"
  | "SUPPORT"
  | "ENGINEERING"
  | "REGIONAL_DIRECTOR"
  | "AREA_GM"
  | "CRO"
  | "CHIEF_OF_STAFF"
  | "CFO"
  | "CEO";

/** The two parallel branches after Deal Desk. */
export type ApprovalBranch = "DISCOUNT" | "COMMERCIAL";

/** WAITING → PENDING (its turn) → a decision, or CANCELLED. */
export type StepStatus = "WAITING" | "PENDING" | "APPROVED" | "RETURNED" | "CANCELLED";

export type WorkflowStatus = "IN_PROGRESS" | "APPROVED" | "RETURNED" | "RECALLED";

/** One reason a step exists. */
export interface ApprovalTrigger {
  readonly rule: string;
  readonly branch: "ROOT" | ApprovalBranch;
  /** 0 for a quote-level rule. */
  readonly lineNumber: number;
  readonly reason: string;
  /** Already approved in that version, on a resubmission (D119); null = needs approval now. */
  readonly carriedFromVersion?: number | null;
  /**
   * Why a resubmission asks again ("Asked again: the discounts changed since
   * v1 (line 1: 15% → 12%)"); on Deal Desk's reason, what changed (D119).
   */
  readonly note?: string | null;
}

/** The earlier decision a step was carried over from (D119). */
export interface CarriedFrom {
  readonly versionNumber: number;
  readonly actedAt: string | null;
  readonly actedByEmail: string | null;
  /** That decision was Deal Desk's, for the approver (D120). */
  readonly onBehalf?: boolean;
}

/** How a pending step stands against its SLA deadline. */
export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED";

/**
 * One approval step. In a preview only role, branches, edges and reasons are
 * set; in a workflow also its status and decision.
 */
export interface ApprovalStep {
  readonly stepId: number | null;
  readonly role: ApprovalRole;
  /** "Regional Director · NA" for a regional step (D13). */
  readonly roleLabel: string;
  /** Only approvers in this sales region may act (D13); null = anyone with the role. */
  readonly region?: string | null;
  /** Empty for Deal Desk; both for a role shared by the branches. */
  readonly branches: readonly ApprovalBranch[];
  readonly dependsOn: readonly ApprovalRole[];
  readonly triggers: readonly ApprovalTrigger[];
  readonly status: StepStatus | null;
  readonly requestedAt: string | null;
  /** A pending step's deadline (its role's SLA from when it started) and how it stands. */
  readonly dueAt?: string | null;
  readonly slaState?: SlaState | null;
  readonly actedAt: string | null;
  readonly actedByEmail: string | null;
  readonly comment: string | null;
  /** The caller may decide this step now. */
  readonly canAct: boolean;
  /** Why an eligible caller can't (e.g. they submitted the quote). */
  readonly cantActReason: string | null;
  /** Already approved in an earlier version: not asked again (D119). */
  readonly carriedFrom?: CarriedFrom | null;
  /** Deal Desk approved it for the role's approver; the comment is their reason (D120). */
  readonly approvedOnBehalf?: boolean;
  /** The caller, in Deal Desk, may approve this pending step for its approver now (D120). */
  readonly canApproveOnBehalf?: boolean;
}

/** POST /approvals/preview and GET …/approval-preview. */
export interface ApprovalPreview {
  readonly steps: readonly ApprovalStep[];
  /** Stop submission. */
  readonly blockers: readonly Issue[];
  /** Rules that can't be checked until the draft is more complete. */
  readonly pending: readonly string[];
  readonly notes: readonly string[];
  /** The draft can't be evaluated yet; why. */
  readonly invalid: readonly Issue[];
}

export interface ApprovalPreviewInput {
  readonly quoteId?: number;
  readonly versionNumber?: number;
  readonly draft: DraftInput;
}

/** GET /quotes/{id}/versions/{n}/approval. */
export interface ApprovalWorkflow {
  readonly status: WorkflowStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly steps: readonly ApprovalStep[];
}

export type ApprovalOutcome = "approve" | "return";

/** GET /approvals/inbox: a step waiting for the caller. */
export interface ApprovalInboxItem {
  readonly stepId: number;
  readonly role: ApprovalRole;
  readonly roleLabel: string;
  readonly region?: string | null;
  readonly requestedAt: string | null;
  /** The step's deadline and how it stands; the inbox comes most urgent first. */
  readonly dueAt?: string | null;
  readonly slaState?: SlaState | null;
  readonly quoteId: number;
  readonly quoteNumber: string;
  readonly versionNumber: number;
  readonly accountName: string | null;
  readonly opportunityName: string | null;
  readonly currencyIsoCode: string | null;
  readonly tcv: string;
  readonly submittedByEmail: string | null;
  readonly submittedAt: string | null;
  /** Lines whose category the rep chose for an unmapped product. */
  readonly repCategorisedLines?: number;
}

// --- Admin matrix ----------------------------------------------------------

export interface ApprovalThreshold {
  readonly role: string;
  /** Null = "above" the previous rung (the last rung only). */
  readonly maxPercent: string | null;
}

export interface ApprovalGroup {
  readonly code: string;
  readonly name: string;
  readonly ladder: readonly ApprovalThreshold[];
  readonly reviewers: readonly string[];
}

/**
 * How a mapping picks its products (D117), most specific first: a product
 * list, a SKU pattern (* = any characters), or a rule on classification
 * and/or product unit.
 */
export type MappingKind = "PRODUCTS" | "SKU" | "RULE";

/** A product in a product list, with its name and code as they were when chosen. */
export interface ListedProduct {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

/** Puts products into a group; only the fields of its kind are set. */
export interface ApprovalMapping {
  readonly kind: MappingKind;
  readonly products: readonly ListedProduct[];
  readonly skuPattern: string;
  /** Rule fields; "" = any value (not both). */
  readonly classification: string;
  readonly productUnit: string;
  readonly groupCode: string;
}

/** An active Salesforce product, for counting and picking (D117). */
export interface CatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly classification: string;
  readonly productUnit: string;
}

export interface ApprovalSettings {
  readonly shortTermMonths: string;
  readonly longTermMonths: string;
  readonly paymentTermsDays: number;
  readonly downsellCeoPercent: string;
  readonly saasClassification: string;
  /** Billing frequencies that need the CFO (D89); none = the rule is off. */
  readonly billingApproval: readonly BillingFrequency[];
  /** Approval roles whose steps only approvers in the account's region may act on (D13). */
  readonly regionalRoles: readonly string[];
}

export interface ApprovalRoleInfo {
  readonly code: string;
  readonly label: string;
  readonly ladder: boolean;
  readonly reviewer: boolean;
}

export interface ApprovalMatrix {
  readonly groups: readonly ApprovalGroup[];
  readonly mappings: readonly ApprovalMapping[];
  readonly settings: ApprovalSettings;
  readonly roles: readonly ApprovalRoleInfo[];
}

/** A quote a matrix change recalled, before D118. */
export interface AffectedQuote {
  readonly quoteId: number;
  readonly quoteNumber: string;
  readonly versionNumber: number;
}

export interface MatrixSaveResult {
  readonly saved: boolean;
  /** Quotes in approval: they keep their approvals (D118). */
  readonly inFlight: number;
}

export interface MatrixChange {
  readonly id: number;
  readonly changedByEmail: string;
  readonly changedAt: string;
  readonly changes: readonly string[];
  /** Only changes saved before D118 recalled quotes. */
  readonly recalled: readonly AffectedQuote[];
}

// --- Admin SLAs --------------------------------------------------------

/** GET /admin/approval-slas. */
export interface ApprovalSlaPolicy {
  readonly roles: readonly { readonly role: ApprovalRole; readonly roleLabel: string; readonly hours: number }[];
  /** A pending step counts as at risk once this share of its time has gone. */
  readonly atRiskPercent: number;
  readonly minHours: number;
  readonly maxHours: number;
}

/** One logged SLA change. */
export interface ApprovalSlaChange {
  readonly id: number;
  /** A role, or SLA_AT_RISK_PERCENT. */
  readonly setting: string;
  readonly label: string;
  readonly oldValue: number;
  readonly newValue: number;
  readonly changedByEmail: string;
  readonly changedAt: string;
}


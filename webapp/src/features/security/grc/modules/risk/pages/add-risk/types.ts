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

// Matches risk.risk_quarter ENUM in risk_schema.sql
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

// Matches risk.identified_by_type ENUM in risk_schema.sql
export type IdentifiedByType = "EMPLOYEE" | "EXTERNAL_PERSON" | "TOOL";

// Matches risk_score.likelihood / risk_score.impact (1–3 each).
export type LikelihoodLevel = 1 | 2 | 3;
export type ImpactLevel     = 1 | 2 | 3;

// Matches risk_score.risk_level ENUM in risk_schema.sql.
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

// Matches risk.treatment_strategy ENUM in risk_schema.sql.
export type TreatmentStrategy = "REMEDIATE" | "ACCEPT" | "TRANSFER" | "AVOID";

export interface ActionStep {
  description: string;
}

// Confidence is the model's own self-reported confidence, not a calibrated
// probability. Held in form state from the moment "Suggest category" returns
// a result until the form is actually submitted — nothing is persisted
// server-side until then (see AICategorySuggestion's doc comment on the
// backend, apps/grc-platform/backend/internal/risk/model/suggestion.go).
export interface AICategorySuggestion {
  categoryId: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

// Likelihood counterpart to AICategorySuggestion — same reasoning, same
// "nothing persisted until save" rule. Impact is deliberately never part of
// this: only Likelihood is ever suggested (see
// docs/plans/auto-categorisation-plan.md, "Confirmed: Likelihood only, not
// Impact").
export interface AILikelihoodSuggestion {
  score: LikelihoodLevel;
  reason: string;
  confidence: "high" | "medium" | "low";
}

// Action Plan counterpart to AICategorySuggestion/AILikelihoodSuggestion.
// Unlike those two, there's no implicit "did they keep it" signal — Category
// pre-fills a dropdown and Likelihood highlights a matrix row the user still
// clicks a cell in, but Action Plan Description is free text, so `used` is
// set explicitly: true only if the user clicks "Use this suggestion" to copy
// the text into the field, false if a suggestion was fetched but that button
// was never clicked. Always carries a suggestion that was actually requested
// — never set from merely typing in the field.
export interface AIActionPlanSuggestion {
  description: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  used: boolean;
}

import type { EvidenceAttachment } from "@features/security/grc/components/evidence-attachments/EvidenceAttachments";
export type { EvidenceAttachment };

export interface AddRiskFormValues {
  // ── Step 1: Basic Information ─────────────────────────────────────────────
  year: number;
  quarter: Quarter;
  // Integer ID of the selected risk_team row (source register).
  // Fetched from GET /api/v1/risks/teams?type=SOURCE_REGISTER.
  sourceRegister: number | "";
  riskTitle: string;
  riskDescription: string;
  // Array of risk_security_compliance_reference IDs.
  // Fetched from GET /api/v1/risks/compliance-references.
  complianceReferences: number[];
  // Integer ID of the selected risk_category row. Fetched from
  // GET /api/v1/risks/categories. Single-select today; the schema is M2M-capable.
  riskCategory: number | "";
  // Set when the user clicks "Suggest category" and a result comes back;
  // null if they never asked for one. Sent along with the final chosen
  // riskCategory on submit so the backend can record whether it was kept or
  // overridden.
  aiCategorySuggestion: AICategorySuggestion | null;
  identifiedByType: IdentifiedByType;
  // Selected person/tool's name for all three identifiedByType values.
  // EMPLOYEE: picked from a live HR entity search (GET /api/v1/risks/employees/search),
  // never our own database. EXTERNAL_PERSON | TOOL: free text.
  identifiedByName: string;
  // Set alongside identifiedByName when identifiedByType is EMPLOYEE, from the
  // same HR entity search result. The backend re-resolves this server-side and
  // derives identifiedByName from it — the name typed/shown here is never
  // trusted on its own — so this must travel with it. Unused for
  // EXTERNAL_PERSON/TOOL, which have no directory to verify against.
  identifiedByEmail: string;
  // User ID of the risk assigner. Defaults to current user. Fetched from GET /api/v1/risks/users.
  assignedBy: number | "";
  riskIdentifiedDate: Date | null;

  // ── Step 2: Risk Assessment ───────────────────────────────────────────────
  likelihood: LikelihoodLevel | null;
  impact: ImpactLevel | null;
  // Set when the user clicks "Suggest Likelihood" and a result comes back;
  // null if they never asked for one. Sent on submit so the backend can
  // record whether the matrix cell they clicked kept the suggested
  // Likelihood row or picked a different one.
  aiLikelihoodSuggestion: AILikelihoodSuggestion | null;
  impactDescription: string;
  implementationDate: Date | null;
  reassessmentDate: Date | null;

  // ── Step 3: Action Plan ───────────────────────────────────────────────────
  // Integer ID of the assignment risk_team row. Fetched from GET /api/v1/risks/teams?type=ASSIGNMENT.
  assignmentTeam: number | "";
  // User ID of the risk owner. Fetched from GET /api/v1/risks/users, filtered to
  // team membership AND GET /api/v1/risks/owner-candidates.
  riskOwner: number | "";
  // User ID of the management approver. Required on every risk regardless of
  // level/treatment. Fetched from GET /api/v1/risks/management-approvers.
  managementApprover: number | "";
  // User ID of the action owner. Fetched from GET /api/v1/risks/users.
  actionOwner: number | "";
  actionPlanDescription: string;
  // Set when the user clicks "Generate Action Description" and a result
  // comes back; null if they never asked for one. Sent on submit so the
  // backend can record whether the suggested text was actually copied into
  // actionPlanDescription (`used: true`, via "Use this suggestion") or left
  // unused/overridden (`used: false`).
  aiActionPlanSuggestion: AIActionPlanSuggestion | null;
  actionSteps: ActionStep[];
  treatmentStrategy: TreatmentStrategy | "";
  progress: string;
  gitIssueUrl: string;
  emailSubject: string;
  remarks: string;
  // TODO: POST attachments to /api/v1/risks/{id}/evidence after risk creation (backend endpoint not yet implemented)
  evidenceAttachments: EvidenceAttachment[];
}

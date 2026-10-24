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

import { BACKEND_BASE_URL } from "@features/security/grc/shim/apiConfig";
import { toDateOnlyString } from "@features/security/grc/utils/dateTime";
import type { AddRiskFormValues } from "../pages/add-risk/types";

// ── Response types (mirror Go models) ─────────────────────────────────────────

// On a register, which fields its risks carry; on an assignment team, which
// registers' pickers offer it (RISK_MODULE_DESIGN.md §14).
export type RegisterTemplate = "STANDARD" | "AGGREGATED" | "MANAGED_SERVICES";

export interface RiskTeam {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  team_type: string;
  register_template: RegisterTemplate;
  status: string;
}

// A register-template dropdown value: a platform, customer, product or
// deployment type. code is set for customers only.
export interface LookupOption {
  id: number;
  name: string;
  code?: string;
  status: "ACTIVE" | "INACTIVE";
}

export type LookupKind = "platforms" | "customers" | "products" | "deployment-types";

export type RiskEnvironment = "PRODUCTION" | "NON_PRODUCTION" | "DR";

export interface RiskScore {
  id: number;
  likelihood: number;
  impact: number;
  risk_rating: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  color_code: string;
}

export interface ComplianceReference {
  id: number;
  name: string;
  description: string | null;
}

export interface RiskCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface UserOption {
  id: number;
  display_name: string;
  email: string;
  risk_team_ids: number[];
}

// EmployeeOption is a WSO2 employee returned by GET /api/v1/risks/employees/search,
// sourced live from the HR entity service — never from the GRC platform's
// own database. Used only for the "Risk Identified By: Employee" field.
export interface EmployeeOption {
  name: string;
  email: string;
}

export interface CreateRiskResponse {
  id: number;
  risk_code: string;
}

export interface NextSequenceIDResponse {
  next_sequence_id: number;
}

// ── Risk Registers types ───────────────────────────────────────────────────────

export interface RiskListItem {
  id: number;
  risk_code: string;
  risk_title: string;
  source_register_name: string;
  risk_level: string;
  risk_level_color: string;
  owner_name: string;
  assigner_name: string;
  workflow_status: string;
  risk_type: string;
  implementation_date: string | null;
  rejection_comment: string | null;
  rejection_stage: string | null;
  created_at: string;
  // Register-template summary for the table's template columns; empty when the
  // risk's template lacks the field (RISK_MODULE_DESIGN.md §14).
  register_template: RegisterTemplate;
  customer_name: string | null;
  environments: RiskEnvironment[];
  platform_names: string[];
}

export interface RiskScoreInfo {
  id: number;
  likelihood: number;
  impact: number;
  risk_rating: number;
  risk_level: string;
  color_code: string;
}

export interface ActionPlanStep {
  id: number;
  plan_id: number;
  step_no: number;
  description: string;
  status: string;
  completed_date: string | null;
}

export interface ActionPlanDetail {
  id: number;
  action_owner_id: number | null;
  description: string | null;
  status: string;
  plan_type: string;
  steps: ActionPlanStep[];
}

// ActionPlan is the standalone shape returned by GET/POST .../action-plans —
// unlike RiskDetail.action_plan (always the first plan, embedded at risk
// creation), this lists every plan on a risk, including ones the assigner added
// later.
export interface ActionPlan {
  id: number;
  risk_id: number;
  action_owner_id: number | null;
  description: string | null;
  status: string; // PENDING | IN_PROGRESS | COMPLETED
  completed_date: string | null;
  // Always STANDARD on new plans; MANAGEMENT is retired and only appears on
  // historical rows.
  plan_type: string;
  created_by: string | null;
}

// Escalation is created by the backend's daily overdue-risk job, or by a
// Compliance user clicking Escalate — no escalated_to/reason, since neither
// path asks a human for one. created_at is what "escalated on" shows in the UI.
export interface Escalation {
  id: number;
  risk_id: number;
  new_treatment_strategy: string | null;
  action_plan_id: number | null;
  // The management/lead comment answering this escalation. Null until someone
  // comments; writing it returns the risk to its assigner.
  decision: string | null;
  // Stays OPEN through the comment and the assigner's remediation — it is what
  // keeps the risk in the Overdue tab — and is only resolved when the assigner
  // submits for completion approval.
  status: string; // OPEN | RESOLVED
  created_at: string;
}

// HistoryEntry is one event in a risk's history. A row is either a field diff
// (action CREATE/UPDATE/DELETE, with field_changed and old/new values) or a
// workflow event (every other action, with details) — never both.
export interface HistoryEntry {
  id: number;
  risk_id: number;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  details?: HistoryDetails;
  created_by: string;
  /** created_by resolved to an email by the backend; falls back to created_by when unresolved. */
  created_by_email?: string;
  created_at: string;
}

// Every field is optional — each action fills only what it needs.
export interface HistoryDetails {
  from?: string;
  to?: string;
  role?: string;
  comment?: string;
  stage?: string;
  level?: string;
  previousLevel?: string;
  overdueDays?: number;
  plan?: string;
}

export interface RiskAssessmentRecord {
  id: number;
  risk_id: number;
  score_id: number;
  progress: string;
  reassessment_date: string;
  assessed_by: string;
  created_at: string;
  residual_likelihood: number;
  residual_impact: number;
  residual_rating: number;
  residual_level: string;
  residual_color_code: string;
  // Marks a synthetic entry for the risk's gross score, added by the backend
  // so the log shows the full lineage even though it isn't a real reassessment.
  is_initial?: boolean;
}

export interface RiskDetail {
  id: number;
  risk_code: string;
  risk_year: number;
  risk_quarter: string;
  risk_title: string;
  risk_description: string;
  risk_identified_date: string | null;
  identified_by_type: string | null;
  identified_by_name: string | null;
  assigner_id: number;
  owner_id: number;
  impact_description: string | null;
  treatment_strategy: string | null;
  // CUSTOMER | WSO2; null until recorded (risks that predate the field).
  risk_acceptor?: string | null;
  source_register_id: number;
  assignment_team_id: number;
  progress: string | null;
  implementation_date: string | null;
  reassessment_date: string | null;
  git_issue_url: string | null;
  email_subject: string | null;
  remarks: string | null;
  workflow_status: string;
  risk_type: string;
  rejection_comment: string | null;
  rejection_stage: string | null;
  owner_first_approved_at: string | null;
  compliance_approval_date: string | null;
  created_at: string;
  updated_at: string;
  // When this migrated risk's assignee correction window closes (ISO 8601), or
  // null when it isn't a migrated risk or the window has closed. The backend
  // owns the rule — show Update Assignees exactly when this is set.
  assignees_editable_until: string | null;
  source_register_name: string;
  assignment_team_name: string;
  owner_name: string;
  assigner_name: string;
  // The specific user named at creation who must approve this risk's
  // PENDING_MANAGEMENT_APPROVAL stage — holding RISK_MANAGEMENT_APPROVE is not
  // enough on its own. Set on every risk, not just ACCEPT + HIGH ones.
  management_approver_id: number;
  management_approver_name: string;
  compliance_approver_name: string | null;
  // Original rating from creation; immutable once a risk owner has approved
  // the risk. Only EditRiskDialog should read this — for display, use
  // effective_score.
  gross_score: RiskScoreInfo | null;
  // Current residual score: the latest reassessment's score if one exists,
  // else gross_score. This is what headers/tables should display.
  effective_score: RiskScoreInfo | null;
  compliance_references: ComplianceReference[];
  // Many-to-many at the schema level even though Add Risk renders a
  // single-select, so this can come back with zero, one, or several entries —
  // render it as a list, not a scalar.
  risk_categories: RiskCategory[];
  // Register-template values, each with its status so an edit form can mark an
  // INACTIVE one. Null/empty when the risk's template lacks the field.
  register_template: RegisterTemplate;
  customer: LookupOption | null;
  deployment_type: LookupOption | null;
  products: LookupOption[];
  platforms: LookupOption[];
  environments: RiskEnvironment[];
  action_plan: ActionPlanDetail | null;
  assessments: RiskAssessmentRecord[];
  // What the caller may do ON THIS RISK: their privileges resolved in its
  // source register, which is the scope every authority check on a risk uses.
  //
  // Render this risk's action buttons from here, never from the session-wide
  // set in useRiskPrivileges — that one is the union across every register the
  // caller has any grant in. Someone who is Risk Owner in one register and a
  // read-only member of another holds RISK_OWNER_APPROVE in the union, so
  // gating on it would show an Approve button on risks they cannot approve.
  //
  // Only present on a single-risk fetch; list responses omit it, because it is
  // meaningless without one register in hand.
  effective_privileges: string[];
}

export interface ListRisksParams {
  statuses?: string[];
  team_id?: number[];
  level?: string[];
  search?: string;
  risk_type?: string[];
  treatment_strategy?: string[];
  owner_id?: number[];
  // Register-template filters: a risk whose template lacks the field never
  // matches.
  customer_id?: number[];
  environment?: RiskEnvironment[];
  platform_id?: number[];
  submitted_from?: string;
  submitted_to?: string;
  due_from?: string;
  due_to?: string;
  due_overdue?: boolean;
  // Risks carrying an unresolved escalation — what the Overdue Risks tab
  // filters on. Not the ESCALATED status: once management comments, the risk
  // returns to APPROVED while the escalation stays open, so it shows in
  // Approved Risks and Overdue at the same time.
  open_escalation?: boolean;
  offset?: number;
  limit?: number;
}

export interface RiskListPage {
  items: RiskListItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface UpdateRiskPayload {
  risk_title: string;
  risk_description: string;
  risk_identified_date?: string;
  identified_by_type?: string;
  identified_by_name?: string;
  // Required alongside identified_by_type "EMPLOYEE"; the backend re-resolves
  // the name from this and ignores identified_by_name on its own.
  identified_by_email?: string;
  assigner_id?: number;
  owner_id?: number;
  impact_description?: string;
  compliance_reference_ids?: number[];
  progress?: string;
  git_issue_url?: string;
  email_subject?: string;
  remarks?: string;
  reassessment_date?: string;
  gross_score_id?: number;
  implementation_date?: string;
  treatment_strategy?: string;
  // Omit to leave unchanged; it cannot be cleared.
  risk_acceptor?: string;
  assignment_team_id?: number;
  action_plan_description?: string;
  action_owner_id?: number;
  action_steps?: { id?: number; description: string }[];
  // Register-template fields: full-edit only, each the complete new set. Left
  // out when unchanged. There is no customer — it never changes.
  platform_ids?: number[];
  deployment_type_id?: number;
  product_ids?: number[];
  environments?: RiskEnvironment[];
}

export interface CreateAssessmentPayload {
  likelihood: number;
  impact: number;
  progress: string;
  reassessment_date: string;
  // Optional corrections to the risk, Risk Assigner only (the backend answers
  // 403 otherwise). Saved with the assessment and never sent for re-approval.
  // Send only what changed.
  owner_id?: number;
  management_approver_id?: number;
  implementation_date?: string;
}

// ── Dashboard types (mirror model/dashboard.go) ────────────────────────────────

export interface RiskStatusSummary {
  total: number;
  open: number;
  closed: number;
  overdue: number;
}

export interface RegisterTreatmentCount {
  register_id: number;
  register_name: string;
  treatment_strategy: string;
  count: number;
}

export interface RiskLevelCount {
  risk_level: string;
  color_code: string;
  count: number;
}

export interface HeatmapCell {
  likelihood: number;
  impact: number;
  risk_level: string;
  color_code: string;
  count: number;
}

export interface RegisterCertShare {
  register_name: string;
  cert_name: string;
  count: number;
  percentage: number;
}

export interface RegisterStatusLevelCount {
  bucket: string;
  risk_level: string;
  color_code: string;
  count: number;
}

export interface RegisterAnalytics {
  register_id: number;
  register_name: string;
  open_count: number;
  heatmap: HeatmapCell[];
  status_levels: RegisterStatusLevelCount[];
}

export interface RepeatedRiskOccurrence {
  register_name: string;
  status: "OPEN" | "CLOSED";
  risk_level: string;
  color_code: string;
}

export interface RepeatedComplianceRisk {
  risk_title: string;
  occurrences: RepeatedRiskOccurrence[];
}

// Open / Acc / Rem / Closed split shared by the two category tables. accept
// and remediate are subsets of open; TRANSFER, AVOID and untreated open risks
// count in open alone, so open >= accept + remediate.
export interface CategoryCounts {
  open: number;
  accept: number;
  remediate: number;
  closed: number;
}

// A Risk Category held by two or more risks, open or closed, in one register.
export interface RepeatedCategory extends CategoryCounts {
  register_id: number;
  register_name: string;
  category_id: number;
  category_name: string;
}

// A Risk Category with at least one open risk in each of two or more
// registers; counts cover only the registers in register_ids.
export interface CommonOpenCategory extends CategoryCounts {
  category_id: number;
  category_name: string;
  register_ids: number[];
}

// One Risk Category's open managed-services risks, split by effective residual
// level. customers counts distinct customers; total = high + medium + low.
export interface ManagedServicesTheme {
  category_id: number;
  category_name: string;
  customers: number;
  total: number;
  high: number;
  medium: number;
  low: number;
}

// Risks raised in MANAGED_SERVICES registers. open_risks / closed_risks count
// distinct risks; themes count open risks only, so a risk in several
// categories appears under each and the themes can sum past open_risks.
export interface ManagedServicesRisks {
  customer_count: number;
  open_risks: number;
  closed_risks: number;
  high_open: number;
  high_closed: number;
  themes: ManagedServicesTheme[];
}

export interface HighRiskItem {
  id: number;
  risk_code: string;
  risk_title: string;
  register_name: string;
  owner_name: string;
  identified_date: string | null;
  treatment_strategy: string | null;
  implementation_date: string | null;
}

export interface DashboardSummary {
  summary: RiskStatusSummary;
  treatment_by_register: RegisterTreatmentCount[];
  level_counts: RiskLevelCount[];
  org_heatmap: HeatmapCell[];
  cert_distribution: RegisterCertShare[];
  registers: RegisterAnalytics[];
  repeated_compliance_risks: RepeatedComplianceRisk[];
  // Optional: absent when served by a backend older than these fields.
  repeated_categories?: RepeatedCategory[];
  common_open_categories?: CommonOpenCategory[];
  // Optional: absent when served by a backend older than this field.
  managed_services?: ManagedServicesRisks;
  high_risks: HighRiskItem[];
}

// ── Analytics types (mirror model/analytics.go) ────────────────────────────────

export interface AnalyticsKPIs {
  new_risks_this_month: number;
  avg_days_to_close: number | null;
  avg_effective_score: number | null;
}

export interface TrendPoint {
  month: string;
  identified_count: number;
  closed_count: number;
  avg_score: number | null;
}

export interface MonthLevelCount {
  month: string;
  risk_level: string;
  color_code: string;
  count: number;
}

export interface MonthRegisterCount {
  month: string;
  register_name: string;
  count: number;
}

export interface RegisterShare {
  register_name: string;
  count: number;
}

export interface ComplianceShare {
  compliance_name: string;
  count: number;
}

export interface TreatmentShare {
  treatment_strategy: string;
  count: number;
}

export interface WorkflowStageCount {
  workflow_status: string;
  count: number;
}

export interface AgingRiskItem {
  id: number;
  risk_code: string;
  risk_title: string;
  register_name: string;
  owner_name: string;
  risk_level: string;
  color_code: string;
  identified_date: string | null;
  age_days: number;
}

export interface AnalyticsSummary {
  kpis: AnalyticsKPIs;
  trend: TrendPoint[];
  level_distribution: MonthLevelCount[];
  identified_by_register: MonthRegisterCount[] | null;
  closed_by_register: MonthRegisterCount[] | null;
  register_shares: RegisterShare[] | null;
  compliance_distribution: ComplianceShare[];
  treatment_mix: TreatmentShare[];
  workflow_funnel: WorkflowStageCount[];
  aging_risks: AgingRiskItem[];
}

// ── API functions ──────────────────────────────────────────────────────────────

type AuthFetch = (input: RequestInfo | URL, options?: RequestInit) => Promise<Response>;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = Object.assign(new Error(body.message ?? res.statusText), {
      status: res.status,
      data: body,
    });
    throw err;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// mine=true restricts the result to registers the caller holds a grant on.
//
// Used by the Dashboard/Analytics/Registers-list filters so they never offer a
// register with no data behind it, and by AddRisk so the register picker only
// offers registers the caller may actually raise a risk in — the server checks
// RISK_CREATE *in the chosen register*, so an unfiltered list would offer
// choices that fail on submit.
//
// (AddRisk used to omit this deliberately, back when a privilege was org-wide
// and raising a risk under any register was legitimate. Scoped grants ended
// that: the picker must now match what the server will accept.)
//
// A GLOBAL grant holder is unaffected — they get every register either way.
export async function fetchSourceRegisterTeams(
  authFetch: AuthFetch,
  mine?: boolean,
  // Narrows further to registers where the caller holds this privilege. Add
  // Risk passes RISK_CREATE: "registers I can see" and "registers I may raise a
  // risk in" are different questions, and offering the former in a create
  // picker produces choices the server refuses.
  privilege?: string,
): Promise<RiskTeam[]> {
  const query = mine ? `&mine=true${privilege ? `&privilege=${encodeURIComponent(privilege)}` : ""}` : "";
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/teams?type=SOURCE_REGISTER${query}`);
  return handleResponse<RiskTeam[]>(res);
}

// Every team that can be an assignment team (ASSIGNMENT and BOTH). The list is
// the same on every register.
export async function fetchAssignmentTeams(authFetch: AuthFetch): Promise<RiskTeam[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/teams?type=ASSIGNMENT`);
  return handleResponse<RiskTeam[]>(res);
}

// The values a picker offers: ACTIVE only. Existing risks keep showing a value
// that has since been deactivated, which is why edit forms ask for
// status "ALL" and mark those "(inactive)".
export async function fetchLookupOptions(
  authFetch: AuthFetch,
  kind: LookupKind,
  status: "ACTIVE" | "ALL" = "ACTIVE",
): Promise<LookupOption[]> {
  const query = status === "ACTIVE" ? "?status=ACTIVE" : "";
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${kind}${query}`);
  return handleResponse<LookupOption[]>(res);
}

// Adds a customer to the Customer Name list. No approval: anyone who can raise
// a Managed Services risk may add one, so a missing customer never blocks Add
// Risk. The code goes into the risk code and is frozen once a risk uses it.
export async function createCustomer(
  authFetch: AuthFetch,
  payload: { name: string; code: string },
): Promise<LookupOption> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/customers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<LookupOption>(res);
}

export async function fetchRiskScores(authFetch: AuthFetch): Promise<RiskScore[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/scores`);
  return handleResponse<RiskScore[]>(res);
}

export async function fetchComplianceReferences(authFetch: AuthFetch): Promise<ComplianceReference[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/compliance-references`);
  return handleResponse<ComplianceReference[]>(res);
}

export async function fetchUsers(authFetch: AuthFetch): Promise<UserOption[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/users`);
  return handleResponse<UserOption[]>(res);
}

export async function fetchRiskCategories(authFetch: AuthFetch): Promise<RiskCategory[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/categories`);
  return handleResponse<RiskCategory[]>(res);
}

// fetchManagementApprovers / fetchRiskOwnerCandidates return every user who
// already holds the grant their approval action requires — GLOBAL, or scoped
// to one of teamIds (pass the chosen source register and/or assignment team).
// A candidate returned here is guaranteed not to 403 on their first approval.
// teamIds omitted or empty returns GLOBAL holders only.
function teamIdsQuery(teamIds?: number[]): string {
  if (!teamIds || teamIds.length === 0) return "";
  const params = new URLSearchParams();
  teamIds.forEach((id) => params.append("teamId", String(id)));
  return `?${params}`;
}

export async function fetchManagementApprovers(authFetch: AuthFetch, teamIds?: number[]): Promise<UserOption[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/management-approvers${teamIdsQuery(teamIds)}`);
  return handleResponse<UserOption[]>(res);
}

export async function fetchRiskOwnerCandidates(authFetch: AuthFetch, teamIds?: number[]): Promise<UserOption[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/owner-candidates${teamIdsQuery(teamIds)}`);
  return handleResponse<UserOption[]>(res);
}

// fetchRiskAssignerCandidates returns every user who already holds RISK_CREATE
// — GLOBAL, or scoped to one of teamIds (pass the chosen source register).
// Same guarantee as fetchManagementApprovers/fetchRiskOwnerCandidates: a
// candidate offered here can never 403 on Create Risk for lack of the grant.
export async function fetchRiskAssignerCandidates(authFetch: AuthFetch, teamIds?: number[]): Promise<UserOption[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/assigner-candidates${teamIdsQuery(teamIds)}`);
  return handleResponse<UserOption[]>(res);
}

// searchEmployees looks up active employees by email substring, live
// from the HR entity service (never the GRC platform's own database), for
export async function searchEmployees(authFetch: AuthFetch, query: string): Promise<EmployeeOption[]> {
  const params = new URLSearchParams({ q: query });
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/employees/search?${params}`);
  return handleResponse<EmployeeOption[]>(res);
}

// resolveUserByEmail links an HR entity employee to an internal user.id by
// email, creating the user row on the fly if one doesn't exist yet (e.g. an
// employee who's never logged into grc-platform). Used to let fields
// like Action Owner assign any real employee, not just existing grc-platform
// users, while still storing a proper FK rather than free text.
//
// Only email is sent: the backend looks the display name up from hr_entity
// itself rather than trust one supplied here (the search result's `name` is
// display-only and no longer part of this request) — see users.go.
export async function resolveUserByEmail(
  authFetch: AuthFetch,
  employee: EmployeeOption,
): Promise<UserOption> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/users/resolve`, {
    method: "POST",
    body: JSON.stringify({ email: employee.email }),
  });
  return handleResponse<UserOption>(res);
}

export async function fetchNextSequenceID(
  authFetch: AuthFetch,
  sourceRegisterID: number,
  year: number,
  quarter: string,
  // Required for a Managed Services register, whose risk codes count per
  // customer; rejected for any other.
  customerID?: number,
): Promise<number> {
  const params = new URLSearchParams({
    source_register_id: String(sourceRegisterID),
    year: String(year),
    quarter,
  });
  if (customerID !== undefined) params.set("customer_id", String(customerID));
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/next-sequence-id?${params}`);
  const data = await handleResponse<NextSequenceIDResponse>(res);
  return data.next_sequence_id;
}

// ── Build the POST /api/v1/risks payload from the form values ──────────────────

export function buildCreateRiskPayload(data: AddRiskFormValues): Record<string, unknown> {
  return {
    year: data.year,
    quarter: data.quarter,
    source_register_id: data.sourceRegister !== "" ? data.sourceRegister : undefined,
    risk_title: data.riskTitle,
    risk_description: data.riskDescription,
    compliance_reference_ids: data.complianceReferences,
    risk_category_ids: data.riskCategory !== "" ? [data.riskCategory] : undefined,
    identified_by_type: data.identifiedByType,
    identified_by_name: data.identifiedByName !== "" ? data.identifiedByName : undefined,
    // Only meaningful (and only required by the backend) for EMPLOYEE — the
    // server derives identified_by_name from this rather than trust the
    // string above on its own.
    identified_by_email:
      data.identifiedByType === "EMPLOYEE" && data.identifiedByEmail !== ""
        ? data.identifiedByEmail
        : undefined,
    assigner_id: data.assignedBy !== "" ? data.assignedBy : undefined,
    risk_identified_date: toDateOnlyString(data.riskIdentifiedDate),
    likelihood: data.likelihood,
    impact: data.impact,
    impact_description: data.impactDescription,
    implementation_date: toDateOnlyString(data.implementationDate),
    reassessment_date: toDateOnlyString(data.reassessmentDate),
    assignment_team_id: data.assignmentTeam !== "" ? data.assignmentTeam : undefined,
    owner_id: data.riskOwner !== "" ? data.riskOwner : undefined,
    management_approver_id: data.managementApprover !== "" ? data.managementApprover : undefined,
    action_owner_id: data.actionOwner !== "" ? data.actionOwner : undefined,
    action_plan_description: data.actionPlanDescription,
    action_steps: data.actionSteps.map((s) => ({ description: s.description })),
    treatment_strategy: data.treatmentStrategy,
    risk_acceptor: data.riskAcceptor || undefined,
    progress: data.progress || undefined,
    git_issue_url: data.gitIssueUrl || undefined,
    email_subject: data.emailSubject,
    remarks: data.remarks || undefined,
    // Register-template fields. Empty ones are left out; the server checks the
    // rest against the register's template.
    platform_ids: data.platforms.length > 0 ? data.platforms : undefined,
    customer_id: data.customer !== "" ? data.customer : undefined,
    deployment_type_id: data.deploymentType !== "" ? data.deploymentType : undefined,
    product_ids: data.products.length > 0 ? data.products : undefined,
    environments: data.environments.length > 0 ? data.environments : undefined,
  };
}

export async function createRisk(
  authFetch: AuthFetch,
  data: AddRiskFormValues,
): Promise<CreateRiskResponse> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks`, {
    method: "POST",
    body: JSON.stringify(buildCreateRiskPayload(data)),
  });
  return handleResponse<CreateRiskResponse>(res);
}

// ── Risk evidence ───────────────────────────────────────────────────────────

export type RiskEvidenceType = "ACTION_PLAN_ATTACHMENT" | "FINAL_APPROVAL_ATTACHMENT";

export interface RiskEvidence {
  id: number;
  risk_id: number;
  action_plan_id?: number;
  file_name: string;
  file_path: string;
  note: string;
  evidence_type: RiskEvidenceType;
  created_by: string;
  /** created_by resolved to an email by the backend; falls back to created_by when unresolved. */
  created_by_email?: string;
  created_at: string;
  download_url?: string;
}

/**
 * Uploads one evidence file for a risk. Bytes travel browser -> backend ->
 * Compliance Entity -> Azure; no SAS is ever handed to the client.
 *
 * `evidenceType` is ACTION_PLAN_ATTACHMENT ("Risk Evidence Attachment",
 * risk-level, no actionPlanId) or FINAL_APPROVAL_ATTACHMENT ("Risk Action
 * Plan Completion Attachment", actionPlanId required — the plan being
 * completed).
 */
export async function uploadRiskEvidence(
  authFetch: AuthFetch,
  riskId: number,
  params: { evidenceType: RiskEvidenceType; file: File; actionPlanId?: number; note?: string },
): Promise<RiskEvidence> {
  const form = new FormData();
  form.append("evidenceType", params.evidenceType);
  form.append("file", params.file, params.file.name);
  if (params.actionPlanId !== undefined) form.append("actionPlanId", String(params.actionPlanId));
  if (params.note) form.append("note", params.note);

  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/evidence`, {
    method: "POST",
    body: form,
  });
  return handleResponse<RiskEvidence>(res);
}

export async function fetchRiskEvidence(authFetch: AuthFetch, riskId: number): Promise<RiskEvidence[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/evidence`);
  return handleResponse<RiskEvidence[]>(res);
}

export async function deleteRiskEvidence(authFetch: AuthFetch, riskId: number, fileId: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/evidence/${fileId}`, {
    method: "DELETE",
  });
  return handleResponse<void>(res);
}

export async function fetchRisks(
  authFetch: AuthFetch,
  params: ListRisksParams = {},
): Promise<RiskListPage> {
  const q = new URLSearchParams();
  if (params.statuses?.length) q.set("statuses", params.statuses.join(","));
  if (params.team_id?.length) q.set("team_id", params.team_id.join(","));
  if (params.level?.length) q.set("level", params.level.join(","));
  if (params.search) q.set("search", params.search);
  if (params.risk_type?.length) q.set("risk_type", params.risk_type.join(","));
  if (params.treatment_strategy?.length) q.set("treatment_strategy", params.treatment_strategy.join(","));
  if (params.owner_id?.length) q.set("owner_id", params.owner_id.join(","));
  if (params.customer_id?.length) q.set("customer_id", params.customer_id.join(","));
  if (params.environment?.length) q.set("environment", params.environment.join(","));
  if (params.platform_id?.length) q.set("platform_id", params.platform_id.join(","));
  if (params.submitted_from) q.set("submitted_from", params.submitted_from);
  if (params.submitted_to) q.set("submitted_to", params.submitted_to);
  if (params.due_from) q.set("due_from", params.due_from);
  if (params.due_to) q.set("due_to", params.due_to);
  if (params.due_overdue) q.set("due_overdue", "true");
  if (params.open_escalation) q.set("open_escalation", "true");
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks?${q}`);
  return handleResponse<RiskListPage>(res);
}

export async function fetchRiskDetail(
  authFetch: AuthFetch,
  id: number,
): Promise<RiskDetail> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}`);
  return handleResponse<RiskDetail>(res);
}

export async function updateRisk(
  authFetch: AuthFetch,
  id: number,
  payload: UpdateRiskPayload,
): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse<void>(res);
}

// UpdateAssigneesPayload corrects a migrated risk's people and assignment
// team. Send only the fields that changed; an omitted field is left as it is.
export interface UpdateAssigneesPayload {
  assigner_id?: number;
  owner_id?: number;
  management_approver_id?: number;
  assignment_team_id?: number;
  action_owner_id?: number;
}

// updateRiskAssignees works in any workflow status, never triggers
// re-approval, and returns 409 once the risk's correction window has closed.
export async function updateRiskAssignees(
  authFetch: AuthFetch,
  id: number,
  payload: UpdateAssigneesPayload,
): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/assignees`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return handleResponse<void>(res);
}

export async function approveRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/approve`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function rejectRisk(
  authFetch: AuthFetch,
  id: number,
  rejection_comment: string,
): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejection_comment }),
  });
  return handleResponse<void>(res);
}

export async function completeRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/complete`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function ownerApproveRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/owner-approve`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function closeRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/close`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function managementApproveRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/management-approve`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function cancelRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/cancel`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function resubmitRisk(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${id}/resubmit`, { method: "POST" });
  return handleResponse<void>(res);
}

export async function fetchDashboard(
  authFetch: AuthFetch,
  registerId?: number,
): Promise<DashboardSummary> {
  const qs = registerId ? `?register_id=${registerId}` : "";
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/dashboard${qs}`);
  return handleResponse<DashboardSummary>(res);
}

export async function fetchAnalytics(
  authFetch: AuthFetch,
  registerId?: number,
): Promise<AnalyticsSummary> {
  const qs = registerId ? `?register_id=${registerId}` : "";
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/analytics/summary${qs}`);
  return handleResponse<AnalyticsSummary>(res);
}

export async function createAssessment(
  authFetch: AuthFetch,
  riskId: number,
  payload: CreateAssessmentPayload,
): Promise<RiskAssessmentRecord> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/assess`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<RiskAssessmentRecord>(res);
}

// ── Action plans (Overdue Risks / escalation feature) ──────────────────────────

export async function fetchActionPlans(authFetch: AuthFetch, riskId: number): Promise<ActionPlan[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/action-plans`);
  return handleResponse<ActionPlan[]>(res);
}

// createActionPlan adds a further plan to a risk that already has one from
// registration. The backend forces plan_type STANDARD and gates this on the
// caller being the risk's assigner — MANAGEMENT plans are retired.
export async function createActionPlan(
  authFetch: AuthFetch,
  riskId: number,
  payload: { description: string; action_owner_id: number | null; steps: string[] },
): Promise<ActionPlan> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/action-plans`, {
    method: "POST",
    body: JSON.stringify({
      description: payload.description,
      action_owner_id: payload.action_owner_id,
      // Steps are created atomically with the plan on the backend, so a
      // failure can't leave an orphaned, stepless plan behind.
      steps: payload.steps,
    }),
  });
  return handleResponse<ActionPlan>(res);
}

// fetchRiskHistory returns a risk's full history, newest first — every
// workflow event and field edit, behind the drawer's History tab.
export async function fetchRiskHistory(authFetch: AuthFetch, riskId: number): Promise<HistoryEntry[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/history`);
  return handleResponse<HistoryEntry[]>(res);
}

// commentOnEscalation answers an escalation. The comment alone returns the risk
// to its assigner (ESCALATED → APPROVED); the escalation stays open, so
// the risk remains in the Overdue tab until the assigner submits it for
// completion approval.
//
// Only a compliance admin may call this; the server returns 403 otherwise.
export async function commentOnEscalation(
  authFetch: AuthFetch,
  riskId: number,
  escalationId: number,
  comment: string,
): Promise<Escalation> {
  const res = await authFetch(
    `${BACKEND_BASE_URL}/api/v1/risks/${riskId}/escalations/${escalationId}/comment`,
    { method: "POST", body: JSON.stringify({ comment }) },
  );
  return handleResponse<Escalation>(res);
}

export async function fetchActionPlanSteps(
  authFetch: AuthFetch,
  riskId: number,
  planId: number,
): Promise<ActionPlanStep[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/action-plans/${planId}/steps`);
  return handleResponse<ActionPlanStep[]>(res);
}

// completeActionStep marks one step done. Gated server-side by
// COMPLETE_ACTION_STEPS_RISK plus an ownership check (caller must be the plan's
// action_owner_id) — applies uniformly to STANDARD and MANAGEMENT plans.
export async function completeActionStep(
  authFetch: AuthFetch,
  riskId: number,
  planId: number,
  stepId: number,
  completedDate: string,
): Promise<void> {
  const res = await authFetch(
    `${BACKEND_BASE_URL}/api/v1/risks/${riskId}/action-plans/${planId}/steps/${stepId}`,
    { method: "PATCH", body: JSON.stringify({ status: "COMPLETED", completed_date: completedDate }) },
  );
  return handleResponse<void>(res);
}

// completeActionPlan requires every step already COMPLETED (enforced
// server-side); for a MANAGEMENT plan this also resolves its escalation and
// reverts the risk to APPROVED.
export async function completeActionPlan(
  authFetch: AuthFetch,
  riskId: number,
  planId: number,
): Promise<ActionPlan> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/action-plans/${planId}/complete`, {
    method: "POST",
  });
  return handleResponse<ActionPlan>(res);
}

export async function fetchEscalations(authFetch: AuthFetch, riskId: number): Promise<Escalation[]> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/escalations`);
  return handleResponse<Escalation[]>(res);
}

// escalateRisk is the manual trigger — Compliance/Admin escalating an
// overdue APPROVED risk on demand instead of waiting for the daily job
// (up to 24h) to reach it. Same outcome either way: the risk moves to
// ESCALATED and shows up in the Overdue Risks tab.
export async function escalateRisk(authFetch: AuthFetch, riskId: number): Promise<Escalation> {
  const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/risks/${riskId}/escalate`, { method: "POST" });
  return handleResponse<Escalation>(res);
}

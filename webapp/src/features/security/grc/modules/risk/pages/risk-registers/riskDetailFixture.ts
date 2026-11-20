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

import type { RiskDetail } from "../../api/riskApi";

// Test fixtures for components that take a RiskDetail. Not imported by app code.

// A risk that has never been approved, so the full edit form applies.
export function riskDetail(overrides: Partial<RiskDetail> = {}): RiskDetail {
  return {
    id: 5,
    risk_code: "2026-MS-BANKONESUB-Q2-0001",
    risk_year: 2026,
    risk_quarter: "Q2",
    risk_title: "Weak TLS",
    risk_description: "TLS 1.0 is enabled",
    risk_identified_date: "2026-05-01",
    identified_by_type: "TOOL",
    identified_by_name: "scanner",
    assigner_id: 10,
    owner_id: 11,
    impact_description: "Data exposure",
    treatment_strategy: "REMEDIATE",
    source_register_id: 2,
    assignment_team_id: 20,
    progress: null,
    implementation_date: "2030-01-01",
    reassessment_date: "2030-01-01",
    git_issue_url: null,
    email_subject: "Weak TLS",
    remarks: null,
    workflow_status: "PENDING_RISK_OWNER_APPROVAL",
    risk_type: "NEW",
    rejection_comment: null,
    rejection_stage: null,
    owner_first_approved_at: null,
    compliance_approval_date: null,
    created_at: "2026-05-02T00:00:00Z",
    updated_at: "2026-05-02T00:00:00Z",
    assignees_editable_until: null,
    source_register_name: "Managed Services",
    assignment_team_name: "Managed Services Team A",
    owner_name: "Owner",
    assigner_name: "Assigner",
    management_approver_id: 12,
    management_approver_name: "Approver",
    compliance_approver_name: null,
    gross_score: null,
    effective_score: null,
    compliance_references: [],
    risk_categories: [],
    register_template: "MANAGED_SERVICES",
    customer: { id: 1, name: "Bank One Sub", code: "BANKONESUB", status: "ACTIVE" },
    deployment_type: { id: 1, name: "Private Cloud", status: "ACTIVE" },
    products: [
      { id: 1, name: "API Manager", status: "ACTIVE" },
      { id: 2, name: "Identity Server", status: "INACTIVE" },
    ],
    platforms: [],
    environments: ["PRODUCTION"],
    action_plan: {
      id: 9,
      action_owner_id: 13,
      description: "Fix it",
      status: "PENDING",
      plan_type: "STANDARD",
      steps: [
        { id: 1, plan_id: 9, step_no: 1, description: "Disable TLS 1.0", status: "PENDING", completed_date: null },
      ],
    },
    assessments: [],
    pending_likelihood_suggestion: null,
    effective_privileges: [],
    ...overrides,
  };
}

export const aggregatedRisk = (): RiskDetail =>
  riskDetail({
    risk_code: "2026-WSO2CLOUD-Q2-0001",
    source_register_name: "WSO2 Cloud",
    register_template: "AGGREGATED",
    customer: null,
    deployment_type: null,
    products: [],
    environments: [],
    platforms: [{ id: 1, name: "Choreo", status: "ACTIVE" }],
    compliance_references: [{ id: 1, name: "ISO 27001", description: null }],
  });

export const standardRisk = (): RiskDetail =>
  riskDetail({
    risk_code: "2026-ASG-Q2-0001",
    source_register_name: "Asgardeo",
    register_template: "STANDARD",
    customer: null,
    deployment_type: null,
    products: [],
    environments: [],
    platforms: [],
    compliance_references: [{ id: 1, name: "ISO 27001", description: null }],
  });

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

// The wire shapes of the backend behind ONE_WSO2_PROCUREMENT_BACKEND_URL, as its API
// specification defines them. Only the parts the UI reads are listed. Nothing outside
// api/ should use these: the mapping in backendMapping.ts turns them into the UI's own types.

export type BackendCategory = "MARKETING_EVENTS" | "NON_IT" | "IT";

export type BackendStatus = "CANCELLED" | "ASSIGNED" | "REJECTED" | "APPROVED" | "PENDING_APPROVAL" | "DRAFT";

export interface BackendUser {
  email: string;
  roles: string[];
}

export interface BackendDirectoryUser {
  email: string;
  name: string;
}

export interface BackendTeamLeadResult {
  approvalExempt: boolean;
  teamLead?: BackendDirectoryUser | null;
}

export interface BackendReferenceItem {
  code: string;
  label: string;
}

export interface BackendBudgetApprover {
  id: number;
  name: string;
}

export interface BackendEngagementOption {
  code: string;
  name: string;
}

export interface BackendRequestSummary {
  id: number;
  referenceNo: string | null;
  title: string;
  category: BackendCategory;
  status: BackendStatus;
  version: number;
  submittedOn: string | null;
  updatedOn: string;
}

export type BackendPriority = "P1" | "P2" | "P3";

export interface BackendProcurementItem extends BackendRequestSummary {
  priority: BackendPriority | null;
  assigneeEmail: string | null;
  requesterName: string;
  requesterEmail: string;
}

export interface BackendApprovalItem extends BackendRequestSummary {
  requesterName: string;
  requesterEmail: string;
}

/** The body of POST /requests/{id}/decision. */
export interface BackendNewDecision {
  decision: "APPROVED" | "REJECTED";
  comment: string | null;
  disclaimerAccepted: boolean;
}

/** The body of POST /requests/{id}/override. */
export interface BackendNewOverride {
  decision: "APPROVED" | "REJECTED";
  justification: string;
  comment: string | null;
}

export interface BackendDecision {
  version: number;
  decidedBy: string;
  decision: "REJECTED" | "APPROVED";
  isOverride: boolean;
  comment: string | null;
  justification: string | null;
  decidedOn: string;
}

/** What an IT request says about the software it asks for. */
export interface BackendItDetails {
  /** The software's name. */
  softwareName: string;
  /** The plan or subscription tier. */
  planName: string;
  /** What the requester needs the software for. */
  softwareRequirement: string;
  /** How long the software is expected to be used, as free text. */
  usagePeriod: string;
  /** How the software is installed. */
  installationType: "PORTABLE" | "PLUGIN" | "BROWSER_EXTENSION" | "STANDALONE" | "SAAS";
}

/** One line of an event's total investment. */
export interface BackendEventCost {
  /** What the cost is for. */
  category: "SPONSORSHIP_FEE" | "BOOTH_BUILD_AND_DESIGN" | "TRAVEL_AND_ACCOMMODATION" | "SWAG" | "PRINT_AND_BANNERS" | "PAYMENT_TO_PARTNER" | "OTHER";
  /** What an `OTHER` cost is for. */
  description?: string | null;
  /** The amount in USD. */
  amount: number;
}

/** The event of a Marketing & Events request. */
export interface BackendEventDetails {
  /** What kind of event it is. */
  eventType: "INDUSTRY_EVENT_SPONSORSHIP" | "WSO2CON" | "WSO2_SUMMIT" | "OXYGENATE" | "ROUNDTABLE_LUNCH_AND_LEARN" | "OTHER_MARKETING_EVENT";
  /** Whether the event is already approved on the event shortlist. */
  isShortlisted?: boolean;
  /** The event's Line ID on the shortlist. */
  shortlistLineId?: string | null;
  /** The event's name. */
  eventName: string;
  /** The first day of the event, as `YYYY-MM-DD`. */
  startDate: string;
  /** The last day of the event, as `YYYY-MM-DD`. */
  endDate: string;
  /** The event's main audience. */
  audience: string;
  /** The sponsorship package. */
  packageName?: string | null;
  /** What the sponsorship package includes. */
  packageInclusions?: BackendPackageInclusion[];
  /** Link to the organiser's prospectus or contract. */
  prospectusUrl?: string | null;
  /** The share of the investment that the partner pays, from 0 to 100. */
  partnerInvestmentPercent?: number;
  /** How many of the target accounts will attend. */
  targetAccountCount?: number | null;
  /** The key target accounts, by company name. */
  keyAccounts?: string | null;
  /** The new pipeline the event is expected to create, in USD. */
  newPipelineAmount?: number | null;
  /** Link to the completed ROI calculator. */
  roiCalculatorUrl?: string | null;
  /** Whether the event was attended before. */
  attendedBefore?: boolean | null;
  /** What the earlier attendance cost, in USD. */
  previousCost?: number | null;
  /** The pipeline the earlier attendance created, in USD. */
  previousPipeline?: number | null;
  /** Why the event matters for the brand, and what success looks like. */
  brandGoal?: string | null;
  /** The lines of the total investment. */
  costs?: BackendEventCost[];
}

/** What a sponsorship package includes. */
export type BackendPackageInclusion =
  | "BOOTH_SPACE"
  | "DELEGATE_PASSES"
  | "SPEAKING_SLOT"
  | "LEAD_SCANNING"
  | "LOGO_PLACEMENT"
  | "ATTENDEE_LIST"
  | "SPONSORED_SESSION";

/** A file attached to a request. */
export interface BackendAttachment {
  /** The identifier of the file. */
  id: number;
  /** The file's name. */
  fileName: string;
  /** The file's media type. */
  contentType: string;
  /** The file's size in bytes. */
  sizeBytes: number;
  /** What the malware scan found. */
  scanStatus: "FAILED" | "INFECTED" | "CLEAN" | "PENDING";
  /** Email of whoever attached it. */
  uploadedBy: string;
  /** When it was attached, as an ISO time. */
  uploadedOn: string;
}

/** The body of PUT /requests/{id}/budget: the budget details that replace the old ones. */
export interface BackendBudgetChange {
  budgetCategoryCode: string | null;
  businessUnitCode: string | null;
  productCode: string | null;
  regionCode: string | null;
  engagementCode: string | null;
  budgetApproverId: number | null;
}

export interface BackendVendor {
  name: string;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface BackendAnswer {
  questionKey: string;
  answer?: string | null;
}

/** The users and the data and security assessment of the software an IT request asks for. */
export interface BackendItAssessment {
  adminCount: number;
  adminDetails: string;
  userCount: number;
  userDetails: string;
  /** Whether outside parties are expected to interact with the platform. */
  externalInteraction?: boolean;
  handlesSensitiveData?: boolean;
  sensitiveDataDetails?: string | null;
  handlesExternalPii?: boolean;
  externalPiiDetails?: string | null;
  handlesEmployeePii?: boolean;
  employeePiiDetails?: string | null;
  integratesInternalSystems?: boolean;
  integrationDetails?: string | null;
  vendorDocsLinks?: string | null;
}

export interface BackendRequestDetail extends BackendRequestSummary {
  requesterName: string;
  requesterEmail: string;
  requirementDetails: string;
  vendorName: string | null;
  businessJustification: string | null;
  roi: string | null;
  additionalSpecifications: string | null;
  salesforceCampaign: string | null;
  notes: string | null;
  vendors: BackendVendor[];
  answers: BackendAnswer[];
  budgetCategoryCode: string | null;
  businessUnitCode: string | null;
  productCode: string | null;
  regionCode: string | null;
  engagementCode: string | null;
  budgetApproverId: number | null;
  budgetApproverName: string | null;
  teamLeadEmail: string | null;
  additionalApprovers: string[];
  itDetails: BackendItDetails | null;
  itAssessment: BackendItAssessment | null;
  /** The event of a Marketing & Events request. */
  eventDetails: BackendEventDetails | null;
  priority: BackendPriority | null;
  assigneeEmail: string | null;
  collaborators: string[];
  decisions: BackendDecision[];
  createdOn: string;
}

/** The body of POST /requests and PUT /requests/{id}. */
export interface BackendNewRequest {
  category: BackendCategory;
  requirementDetails: string;
  businessJustification: string | null;
  roi: string | null;
  additionalSpecifications: string | null;
  salesforceCampaign: string | null;
  notes: string | null;
  vendors: BackendVendor[];
  budgetCategoryCode: string | null;
  businessUnitCode: string | null;
  productCode: string | null;
  regionCode: string | null;
  engagementCode: string | null;
  budgetApproverId: number | null;
  additionalApprovers: string[];
  itDetails: BackendItDetails | null;
  itAssessment: BackendItAssessment | null;
  /** The event of a Marketing & Events request; none for any other category. */
  eventDetails: BackendEventDetails | null;
  answers: BackendAnswer[];
}

/** What the backend answers to a submit: the reference is given with the first submission. */
export interface BackendUpdatedRequest {
  id: number;
  status: BackendStatus;
  referenceNo?: string | null;
}

export interface BackendCreatedRequest {
  id: number;
  status: BackendStatus;
}

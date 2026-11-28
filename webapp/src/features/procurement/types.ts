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

// Shapes of the Procurement contract, as the UI reads and writes them. The
// backend's own wire shapes live in api/backendTypes.ts; api/backendMapping.ts
// converts between the two.

/** What a request is for: IT, Non-IT, or Marketing & Events. */
export type ProcurementCategory = "IT" | "NON-IT" | "EVENTS";

/**
 * Where a request stands. `draft` is saved but not sent; `submitted` waits on
 * the approvers; `approved` waits for Procurement to assign it; `assigned` is
 * where phase 1 ends; `cancelled` was withdrawn by the requester.
 */
/** The most collaborators the backend keeps on a request. */
export const MAX_COLLABORATORS = 20;

export type RequestStatus = "draft" | "submitted" | "approved" | "rejected" | "assigned" | "cancelled";

export type YesNo = "yes" | "no";

/** How the software is installed, as the backend names it. */
export type InstallationType = "PORTABLE" | "PLUGIN" | "BROWSER_EXTENSION" | "STANDALONE" | "SAAS";

/** An employee. `id` is the email, which is what the backend identifies people by. */
export interface Person {
  id: string;
  name: string;
  email: string;
}

export interface ProcurementMe extends Person {
  /** Procurement roles taken from the user's groups, e.g. `procurement_user`. */
  roles: string[];
  /** The manager who approves the user's requests, when there is one. */
  teamLead: Person | null;
  /** True for someone whose requests need no approver, such as the CEO. */
  approvalExempt: boolean;
}

export interface Integration {
  system: string;
  data: string;
}

export interface Vendor {
  name: string;
  website: string;
  contact: string;
  email: string;
  phone: string;
}

/** What the requester says about a request, per category. Free text is shown as text, never HTML. */
export interface RequestDetails {
  product: string;
  plan: string;
  description: string;
  /** What the requester needs the software for. */
  softwareRequirement: string;
  installationType: InstallationType | "";
  userCount: string;
  userNames: string[];
  adminCount: string;
  adminNames: string[];
  usagePeriod: string;
  /** Whether customers, partners or other outside parties are expected to interact with the platform. */
  externalInteraction: YesNo | "";
  businessJustification: string;
  roi: string;
  specifications: string;
  sensitiveData: YesNo | "";
  sensitiveDataDetail: string;
  externalPii: YesNo | "";
  externalPiiDetail: string;
  employeePii: YesNo | "";
  employeePiiDetail: string;
  integrates: YesNo | "";
  integrations: Integration[];
  vendorDocs: YesNo | "";
  vendorDocsLink: string;
}

/** What kind of event a Marketing & Events request is for, as the backend names it. */
export type EventType =
  | "INDUSTRY_EVENT_SPONSORSHIP"
  | "WSO2CON"
  | "WSO2_SUMMIT"
  | "OXYGENATE"
  | "ROUNDTABLE_LUNCH_AND_LEARN"
  | "OTHER_MARKETING_EVENT";

/** What a sponsorship package includes, as the backend names it. */
export type PackageInclusion =
  | "BOOTH_SPACE"
  | "DELEGATE_PASSES"
  | "SPEAKING_SLOT"
  | "LEAD_SCANNING"
  | "LOGO_PLACEMENT"
  | "ATTENDEE_LIST"
  | "SPONSORED_SESSION";

/** The fixed lines of an event's total investment, as the backend names them. The other costs are lines that the requester names. */
export type EventCostCategory =
  | "SPONSORSHIP_FEE"
  | "BOOTH_BUILD_AND_DESIGN"
  | "TRAVEL_AND_ACCOMMODATION"
  | "SWAG"
  | "PRINT_AND_BANNERS"
  | "PAYMENT_TO_PARTNER";

/** One of the other costs of an event, which the requester describes. */
export interface OtherCost {
  /** What the cost is for. */
  description: string;
  /** The amount in USD, as typed. */
  amount: string;
}

/** What the requester says about the event of a Marketing & Events request. Amounts are kept as typed. */
export interface EventDetails {
  /** What kind of event it is; blank until chosen. */
  eventType: EventType | "";
  /** Whether the event is already approved on the event shortlist. */
  shortlisted: YesNo | "";
  /** The event's Line ID on the shortlist; asked when it is shortlisted. */
  shortlistLineId: string;
  /** The event's name. */
  name: string;
  /** The first day of the event, as `YYYY-MM-DD`. */
  startDate: string;
  /** The last day of the event, as `YYYY-MM-DD`. */
  endDate: string;
  /** The event's main audience. */
  audience: string;
  /** The sponsorship package, for example "Gold sponsor". */
  packageName: string;
  /** What the sponsorship package includes. */
  packageInclusions: PackageInclusion[];
  /** Link to the organiser's prospectus or contract. */
  prospectusUrl: string;
  /** The fixed lines of the total investment, in USD as typed; blank is none. */
  costs: Record<EventCostCategory, string>;
  /** The other lines of the total investment, each named by the requester. */
  otherCosts: OtherCost[];
  /** The share of the investment that the partner pays, from 0 to 100; blank is 0. */
  partnerInvestmentPercent: string;
  /** How many of the target accounts will attend, as a whole number. */
  targetAccounts: string;
  /** The key target accounts, by company name. */
  keyAccounts: string;
  /** The new pipeline the event is expected to create, in USD. */
  newPipeline: string;
  /** Link to the completed ROI calculator. */
  roiCalculatorUrl: string;
  /** Whether the event was attended before; asked of an industry event sponsorship only. */
  attendedBefore: YesNo | "";
  /** What the earlier attendance cost, in USD. */
  previousCost: string;
  /** The pipeline the earlier attendance created, in USD. */
  previousPipeline: string;
  /** Why the event matters for the brand, and what success looks like. */
  brandGoal: string;
}

/** The budget details of a request. Each list value is the code the backend knows it by. */
export interface BudgetDetails {
  category: string;
  businessUnit: string;
  product: string;
  region: string;
  engagementCode: string;
  salesforceCampaign: string;
}

/** Where an attachment stands in the malware scan. */
export type ScanStatus = "pending" | "clean" | "infected" | "failed";

/** A file saved on a request. */
export interface Attachment {
  /** The backend's identifier for the file. */
  id: string;
  /** The file's name. */
  name: string;
  /** The file's media type. */
  contentType: string;
  /** The file's size in bytes. */
  sizeBytes: number;
  /** What the malware scan found. */
  scanStatus: ScanStatus;
  /** Email of whoever attached it. */
  uploadedBy: string;
  /** When it was attached, as an ISO time. */
  uploadedAt: string;
}

/** What the form holds about a request's files: those already saved, those to remove on submit, and those still to upload. */
export interface AttachmentsDraft {
  /** The files the request holds and the requester has not taken off. */
  saved: Attachment[];
  /** The ids of saved files to remove when the request is sent. */
  removed: string[];
  /** The files chosen and not yet uploaded. */
  files: File[];
}

/** The budget details Procurement may change after a request is approved, which replace the old ones. */
export interface BudgetChange {
  budget: BudgetDetails;
  /** The chosen budget approver's id, or "" when none. */
  budgetApproverId: string;
}

/** What the requester fills in. The requester, team lead, status and dates are set by the server, never sent. */
export interface PurchaseRequestInput {
  category: ProcurementCategory;
  /** Emails of the people who may approve besides the team lead; at most 5. */
  additionalApprovers: string[];
  details: RequestDetails;
  /** The event of a Marketing & Events request; empty for any other category. */
  event: EventDetails;
  vendors: Vendor[];
  budget: BudgetDetails;
  /** The chosen budget approver's id, or "" when none. */
  budgetApproverId: string;
  notes: string;
  /** The files to keep, remove and upload with the request. */
  attachments: AttachmentsDraft;
  declarationAccepted: boolean;
}

/** The decision on a request's current version: the latest one, which a Procurement override can replace. */
export interface TeamLeadDecision {
  decision: "pending" | "approved" | "rejected";
  notes: string;
  decidedAt: string | null;
  /** Email of whoever decided, or "" while pending. */
  decidedBy: string;
  /** True when a Procurement admin made this decision, not an approver. */
  isOverride: boolean;
}

/** How urgent a request is for Procurement; P1 is the most urgent. */
export type Priority = "P1" | "P2" | "P3";

/** What raising a request gives back: where to find it, and its reference once it has one. */
export interface SubmittedRequest {
  id: string;
  reference: string | null;
}

/** A row of the queue of requests that Procurement handles. */
export interface QueueItem {
  id: string;
  reference: string | null;
  title: string;
  category: ProcurementCategory;
  status: RequestStatus;
  priority: Priority | null;
  /** Email of the person handling it, or "" when nobody is. */
  assignee: string;
  requester: Person;
  updatedAt: string;
}

/** A row of Approvals: a request that names the signed-in user as an approver. */
export interface ApprovalItem {
  id: string;
  reference: string | null;
  title: string;
  category: ProcurementCategory;
  status: RequestStatus;
  requester: Person;
  submittedAt: string | null;
  updatedAt: string;
}

/** What an approver decides; a rejection needs a comment and an approval needs the confirmation. */
export interface ApprovalDecisionInput {
  decision: "approved" | "rejected";
  comment: string;
  disclaimerAccepted: boolean;
}

/** A row of My Requests. */
export interface RequestSummary {
  id: string;
  /** Null until the request is first submitted. */
  reference: string | null;
  title: string;
  category: ProcurementCategory;
  status: RequestStatus;
  submittedAt: string | null;
  updatedAt: string;
}

export interface PurchaseRequest extends RequestSummary {
  requester: Person;
  /** Null when nobody approves, or the backend did not say who. */
  teamLead: Person | null;
  additionalApprovers: string[];
  teamLeadDecision: TeamLeadDecision;
  details: RequestDetails;
  /** The event of a Marketing & Events request; empty for any other category. */
  event: EventDetails;
  vendors: Vendor[];
  budget: BudgetDetails;
  budgetApproverId: string;
  budgetApproverName: string;
  notes: string;
  priority: Priority | null;
  /** Email of the Procurement person handling it, or "" when nobody is. */
  assignee: string;
  /** Emails of the people who may read it besides the requester and the approvers. */
  collaborators: string[];
}

/** One entry of a pick list: what is stored, and what the person sees. */
export interface Choice {
  value: string;
  label: string;
}

/** A budget approver the requester can choose. */
export interface BudgetApproverOption {
  id: string;
  name: string;
}

/** A list of the request form that Settings keeps, as the backend names it. */
export type ReferenceKind = "BUDGET_CATEGORY" | "BUSINESS_UNIT" | "PRODUCT" | "REGION";

/** An option of one of those lists, offered to requesters or not. */
export interface ReferenceSetting {
  id: string;
  kind: ReferenceKind;
  /** What the option is stored as; it cannot be changed once added. */
  code: string;
  label: string;
  isActive: boolean;
}

/** A new option for one of the lists. */
export interface NewReferenceOption {
  kind: ReferenceKind;
  code: string;
  label: string;
}

/** What Settings changes about an option: its label, and whether it is offered. */
export interface ReferenceOptionChange {
  label: string;
  isActive: boolean;
}

/** The business units and regions a budget approver covers, by code. */
export interface BudgetApproverScopes {
  businessUnits: string[];
  regions: string[];
}

/** A budget approver as Settings shows them, offered to requesters or not. */
export interface BudgetApproverSetting extends BudgetApproverScopes {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

/** What Settings changes about a budget approver; the scopes replace the old ones. */
export interface BudgetApproverChange extends BudgetApproverScopes {
  isActive: boolean;
}

/** The lists the form's pickers draw from. Engagement codes and budget approvers depend on the business unit and region, so they are asked for separately. */
export interface ProcurementLookups {
  budgetCategories: Choice[];
  businessUnits: Choice[];
  products: Choice[];
  regions: Choice[];
}

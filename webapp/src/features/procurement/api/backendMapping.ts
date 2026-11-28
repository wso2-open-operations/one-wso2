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

// Turns the backend's wire shapes into the UI's own types, so a change in the
// backend's shape is felt here and in its tests, not on a screen.

import { emptyDetails, emptyEvent } from "../request-form/requestFormModel";
import type {
  Attachment,
  BudgetApproverOption,
  BudgetApproverScopes,
  BudgetApproverSetting,
  BudgetChange,
  BudgetDetails,
  Choice,
  EventDetails,
  EventType,
  PackageInclusion,
  ApprovalDecisionInput,
  ApprovalItem,
  Person,
  ProcurementMe,
  PurchaseRequest,
  PurchaseRequestInput,
  QueueItem,
  ReferenceSetting,
  ProcurementCategory,
  RequestStatus,
  RequestSummary,
  TeamLeadDecision,
  Vendor,
  YesNo,
} from "../types";
import type {
  BackendApprovalItem,
  BackendAttachment,
  BackendBudgetApproverSetting,
  BackendBudgetChange,
  BackendBudgetScope,
  BackendNewDecision,
  BackendProcurementItem,
  BackendItDetails,
  BackendBudgetApprover,
  BackendCategory,
  BackendDirectoryUser,
  BackendEventDetails,
  BackendEngagementOption,
  BackendNewRequest,
  BackendReferenceItem,
  BackendReferenceSetting,
  BackendRequestDetail,
  BackendRequestSummary,
  BackendItAssessment,
  BackendStatus,
  BackendTeamLeadResult,
  BackendUser,
  BackendVendor,
} from "./backendTypes";

const CATEGORY: Record<BackendCategory, ProcurementCategory> = { IT: "IT", NON_IT: "NON-IT", MARKETING_EVENTS: "EVENTS" };

const STATUS: Record<BackendStatus, RequestStatus> = {
  DRAFT: "draft",
  PENDING_APPROVAL: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  ASSIGNED: "assigned",
  CANCELLED: "cancelled",
};

const BACKEND_STATUS = Object.fromEntries(Object.entries(STATUS).map(([backend, ui]) => [ui, backend])) as Record<RequestStatus, BackendStatus>;

export const toBackendStatus = (status: RequestStatus): BackendStatus => BACKEND_STATUS[status];

export const toPerson = ({ email, name }: BackendDirectoryUser): Person => ({ id: email, name, email });

/** The person a request or an approval names only by email. */
const personFromEmail = (email: string): Person => ({ id: email, name: email, email });

export const toChoices = (items: BackendReferenceItem[]): Choice[] =>
  items.map(({ code, label }) => ({ value: code, label }));

/** An engagement is shown as its code and name, or the code alone when they are the same. */
export const toEngagementChoices = (items: BackendEngagementOption[]): Choice[] =>
  items.map(({ code, name }) => ({ value: code, label: name && name !== code ? `${code} - ${name}` : code }));

export const toBudgetApprovers = (items: BackendBudgetApprover[]): BudgetApproverOption[] =>
  items.map(({ id, name }) => ({ id: String(id), name }));

export const toBudgetApproverSettings = (items: BackendBudgetApproverSetting[]): BudgetApproverSetting[] =>
  items.map(({ id, name, email, isActive, scopes }) => ({
    id: String(id),
    name,
    email,
    isActive,
    businessUnits: scopes.filter((s) => s.scopeType === "BUSINESS_UNIT").map((s) => s.code),
    regions: scopes.filter((s) => s.scopeType === "REGION").map((s) => s.code),
  }));

export const toReferenceSettings = (items: BackendReferenceSetting[]): ReferenceSetting[] =>
  items.map(({ id, type, code, label, isActive }) => ({ id: String(id), kind: type, code, label, isActive }));

export const toBackendScopes = ({ businessUnits, regions }: BudgetApproverScopes): BackendBudgetScope[] => [
  ...businessUnits.map((code): BackendBudgetScope => ({ scopeType: "BUSINESS_UNIT", code })),
  ...regions.map((code): BackendBudgetScope => ({ scopeType: "REGION", code })),
];

/**
 * @param signedIn - The signed-in person from the id_token, because the backend names only the email
 */
export function toMe(user: BackendUser, lead: BackendTeamLeadResult, signedIn: Person): ProcurementMe {
  return {
    ...signedIn,
    email: user.email,
    roles: user.roles,
    teamLead: lead.teamLead ? toPerson(lead.teamLead) : null,
    approvalExempt: lead.approvalExempt,
  };
}

/** A file attached to a request, as the UI holds it. */
export const toAttachment = (a: BackendAttachment): Attachment => ({
  id: String(a.id),
  name: a.fileName,
  contentType: a.contentType,
  sizeBytes: a.sizeBytes,
  scanStatus: a.scanStatus.toLowerCase() as Attachment["scanStatus"],
  uploadedBy: a.uploadedBy,
  uploadedAt: a.uploadedOn,
});

/** The budget details the backend is sent when Procurement changes them; a blank one is sent as none. */
export function toBackendBudgetChange({ budget: b, budgetApproverId }: BudgetChange): BackendBudgetChange {
  return {
    budgetCategoryCode: orNull(b.category),
    businessUnitCode: orNull(b.businessUnit),
    productCode: orNull(b.product),
    regionCode: orNull(b.region),
    engagementCode: orNull(b.engagementCode),
    budgetApproverId: budgetApproverId ? Number(budgetApproverId) : null,
  };
}

export function toSummary(row: BackendRequestSummary): RequestSummary {
  return {
    id: String(row.id),
    reference: row.referenceNo,
    title: row.title,
    category: CATEGORY[row.category],
    status: STATUS[row.status],
    submittedAt: row.submittedOn,
    updatedAt: row.updatedOn,
  };
}

export function toApprovalItem(row: BackendApprovalItem): ApprovalItem {
  return {
    id: String(row.id),
    reference: row.referenceNo,
    title: row.title,
    category: CATEGORY[row.category],
    status: STATUS[row.status],
    requester: { id: row.requesterEmail, name: row.requesterName, email: row.requesterEmail },
    submittedAt: row.submittedOn,
    updatedAt: row.updatedOn,
  };
}

export function toQueueItem(row: BackendProcurementItem): QueueItem {
  return {
    id: String(row.id),
    reference: row.referenceNo,
    title: row.title,
    category: CATEGORY[row.category],
    status: STATUS[row.status],
    priority: row.priority,
    assignee: row.assigneeEmail ?? "",
    requester: { id: row.requesterEmail, name: row.requesterName, email: row.requesterEmail },
    updatedAt: row.updatedOn,
  };
}

export function toNewDecision(input: ApprovalDecisionInput): BackendNewDecision {
  return {
    decision: input.decision === "approved" ? "APPROVED" : "REJECTED",
    comment: orNull(input.comment),
    disclaimerAccepted: input.decision === "approved" && input.disclaimerAccepted,
  };
}

/** An answer the backend did not give stays unanswered; only an explicit true or false is a Yes or a No. */
const yesNo = (value: boolean | undefined): YesNo | "" => (value === undefined ? "" : value ? "yes" : "no");

/** A list of names or integrations the backend holds as one text, one per line, so a name can hold a comma. */
const NAME_SEPARATOR = "\n";
const toNames = (text: string): string[] => text.split(NAME_SEPARATOR).map((n) => n.trim()).filter(Boolean);
const integrationsToText = (rows: { system: string; data: string }[]): string =>
  rows.map((r) => (r.data ? `${r.system}: ${r.data}` : r.system)).join("\n");
const integrationsFromText = (text: string): { system: string; data: string }[] =>
  text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const at = line.indexOf(": ");
      return at < 0 ? { system: line, data: "" } : { system: line.slice(0, at), data: line.slice(at + 2) };
    });

const orNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

function toDetails(d: BackendRequestDetail) {
  const base = emptyDetails();
  const it = d.itDetails;
  const assessment = d.itAssessment;
  return {
    ...base,
    description: d.requirementDetails,
    businessJustification: d.businessJustification ?? "",
    roi: d.roi ?? "",
    specifications: d.additionalSpecifications ?? "",
    ...(it && {
      product: it.softwareName,
      plan: it.planName,
      softwareRequirement: it.softwareRequirement,
      usagePeriod: it.usagePeriod,
      installationType: it.installationType,
    }),
    ...(assessment && {
      userCount: String(assessment.userCount),
      externalInteraction: yesNo(assessment.externalInteraction),
      userNames: toNames(assessment.userDetails),
      adminCount: String(assessment.adminCount),
      adminNames: toNames(assessment.adminDetails),
      sensitiveData: yesNo(assessment.handlesSensitiveData),
      sensitiveDataDetail: assessment.sensitiveDataDetails ?? "",
      externalPii: yesNo(assessment.handlesExternalPii),
      externalPiiDetail: assessment.externalPiiDetails ?? "",
      employeePii: yesNo(assessment.handlesEmployeePii),
      employeePiiDetail: assessment.employeePiiDetails ?? "",
      integrates: yesNo(assessment.integratesInternalSystems),
      integrations: assessment.integrationDetails ? integrationsFromText(assessment.integrationDetails) : base.integrations,
      vendorDocs: yesNo(Boolean(assessment.vendorDocsLinks)),
      vendorDocsLink: assessment.vendorDocsLinks ?? "",
    }),
  };
}

/**
 * The latest decision on the version being read; an older version's decision does not
 * count. It may be a Procurement override, so it says who decided.
 */
function toDecision(d: BackendRequestDetail): TeamLeadDecision {
  const latest = d.decisions
    .filter((x) => x.version === d.version)
    .sort((a, b) => b.decidedOn.localeCompare(a.decidedOn))[0];
  if (!latest) return { decision: "pending", notes: "", decidedAt: null, decidedBy: "", isOverride: false };
  return {
    decision: latest.decision === "APPROVED" ? "approved" : "rejected",
    notes: latest.comment ?? "",
    decidedAt: latest.decidedOn,
    decidedBy: latest.decidedBy,
    isOverride: latest.isOverride,
  };
}

/** An amount, as the form holds it: text, blank when the backend has none. */
const amountText = (value: number | null | undefined): string => (value === null || value === undefined ? "" : String(value));

/** The event the backend holds, as the form's event: amounts as text, and the lines of one cost added up. */
function toEvent(e: BackendEventDetails | null): EventDetails {
  const base = emptyEvent();
  if (!e) return base;
  const costs = { ...base.costs };
  const otherCosts: EventDetails["otherCosts"] = [];
  for (const cost of e.costs ?? []) {
    if (cost.category === "OTHER") {
      otherCosts.push({ description: cost.description ?? "", amount: String(cost.amount) });
    } else {
      costs[cost.category] = String(Math.round(Number(costs[cost.category] || 0) * 100 + cost.amount * 100) / 100);
    }
  }
  return {
    ...base,
    eventType: e.eventType as EventType,
    shortlisted: yesNo(e.isShortlisted ?? false),
    shortlistLineId: e.shortlistLineId ?? "",
    name: e.eventName,
    startDate: e.startDate,
    endDate: e.endDate,
    audience: e.audience,
    packageName: e.packageName ?? "",
    packageInclusions: (e.packageInclusions ?? []) as PackageInclusion[],
    prospectusUrl: e.prospectusUrl ?? "",
    costs,
    otherCosts: otherCosts.length ? otherCosts : base.otherCosts,
    partnerInvestmentPercent: e.partnerInvestmentPercent ? String(e.partnerInvestmentPercent) : "",
    targetAccounts: amountText(e.targetAccountCount),
    keyAccounts: e.keyAccounts ?? "",
    newPipeline: amountText(e.newPipelineAmount),
    roiCalculatorUrl: e.roiCalculatorUrl ?? "",
    attendedBefore: e.attendedBefore === null || e.attendedBefore === undefined ? "" : yesNo(e.attendedBefore),
    previousCost: amountText(e.previousCost),
    previousPipeline: amountText(e.previousPipeline),
    brandGoal: e.brandGoal ?? "",
  };
}

/** The event the backend is sent: only for a Marketing & Events request, and only what its type and shortlist status are asked for. */
function toBackendEvent(input: PurchaseRequestInput): BackendEventDetails | null {
  if (input.category !== "EVENTS") return null;
  const e = input.event;
  const industry = e.eventType === "INDUSTRY_EVENT_SPONSORSHIP";
  const shortlisted = e.shortlisted === "yes";
  const asked = industry && !shortlisted;
  const amount = (value: string): number | null => (value.trim() === "" ? null : Number(value));
  return {
    eventType: e.eventType as BackendEventDetails["eventType"],
    isShortlisted: shortlisted,
    shortlistLineId: shortlisted ? orNull(e.shortlistLineId) : null,
    eventName: e.name.trim(),
    startDate: e.startDate,
    endDate: e.endDate,
    audience: e.audience.trim(),
    packageName: industry ? orNull(e.packageName) : null,
    packageInclusions: industry ? e.packageInclusions : [],
    prospectusUrl: industry ? orNull(e.prospectusUrl) : null,
    partnerInvestmentPercent: e.partnerInvestmentPercent.trim() === "" ? 0 : Number(e.partnerInvestmentPercent),
    targetAccountCount: shortlisted ? null : amount(e.targetAccounts),
    keyAccounts: shortlisted ? null : orNull(e.keyAccounts),
    newPipelineAmount: shortlisted ? null : amount(e.newPipeline),
    roiCalculatorUrl: shortlisted ? null : orNull(e.roiCalculatorUrl),
    attendedBefore: asked && e.attendedBefore !== "" ? e.attendedBefore === "yes" : null,
    previousCost: asked && e.attendedBefore === "yes" ? amount(e.previousCost) : null,
    previousPipeline: asked && e.attendedBefore === "yes" ? amount(e.previousPipeline) : null,
    brandGoal: shortlisted ? null : orNull(e.brandGoal),
    costs: [
      ...(Object.entries(e.costs) as [keyof EventDetails["costs"], string][])
        .filter(([, value]) => value.trim() !== "" && Number(value) > 0)
        .map(([category, value]) => ({ category, amount: Number(value) })),
      ...e.otherCosts
        .filter((c) => c.amount.trim() !== "" && Number(c.amount) > 0)
        .map((c) => ({ category: "OTHER" as const, description: orNull(c.description), amount: Number(c.amount) })),
    ],
  };
}

const toVendor = (v: BackendVendor): Vendor => ({
  name: v.name,
  website: v.website ?? "",
  contact: v.contactName ?? "",
  email: v.contactEmail ?? "",
  phone: v.contactPhone ?? "",
});

export function toRequest(d: BackendRequestDetail): PurchaseRequest {
  const budget: BudgetDetails = {
    category: d.budgetCategoryCode ?? "",
    businessUnit: d.businessUnitCode ?? "",
    product: d.productCode ?? "",
    region: d.regionCode ?? "",
    engagementCode: d.engagementCode ?? "",
    salesforceCampaign: d.salesforceCampaign ?? "",
  };
  const vendors: Vendor[] = d.vendors.length
    ? d.vendors.map(toVendor)
    : d.vendorName
      ? [{ name: d.vendorName, website: "", contact: "", email: "", phone: "" }]
      : [];
  return {
    ...toSummary(d),
    requester: { id: d.requesterEmail, name: d.requesterName, email: d.requesterEmail },
    teamLead: d.teamLeadEmail ? personFromEmail(d.teamLeadEmail) : null,
    additionalApprovers: d.additionalApprovers,
    teamLeadDecision: toDecision(d),
    details: toDetails(d),
    event: toEvent(d.eventDetails),
    vendors,
    budget,
    budgetApproverId: d.budgetApproverId === null ? "" : String(d.budgetApproverId),
    budgetApproverName: d.budgetApproverName ?? "",
    notes: d.notes ?? "",
    priority: d.priority,
    assignee: d.assigneeEmail ?? "",
    collaborators: d.collaborators,
  };
}

/** The body the backend saves a request from. The title is left for the backend to make. */
export function toNewRequest(input: PurchaseRequestInput): BackendNewRequest {
  const { details: d, budget: b } = input;
  const isIt = input.category === "IT";
  const itAssessment: BackendItAssessment | null = isIt
    ? {
        userCount: Number(d.userCount),
        userDetails: d.userNames.join(NAME_SEPARATOR),
        adminCount: Number(d.adminCount),
        adminDetails: d.adminNames.join(NAME_SEPARATOR),
        externalInteraction: d.externalInteraction === "yes",
        handlesSensitiveData: d.sensitiveData === "yes",
        sensitiveDataDetails: d.sensitiveData === "yes" ? orNull(d.sensitiveDataDetail) : null,
        handlesExternalPii: d.externalPii === "yes",
        externalPiiDetails: d.externalPii === "yes" ? orNull(d.externalPiiDetail) : null,
        handlesEmployeePii: d.employeePii === "yes",
        employeePiiDetails: d.employeePii === "yes" ? orNull(d.employeePiiDetail) : null,
        integratesInternalSystems: d.integrates === "yes",
        integrationDetails: d.integrates === "yes" ? orNull(integrationsToText(d.integrations)) : null,
        vendorDocsLinks: d.integrates === "yes" && d.vendorDocs === "yes" ? orNull(d.vendorDocsLink) : null,
      }
    : null;
  const isEvent = input.category === "EVENTS";
  return {
    category: input.category === "IT" ? "IT" : input.category === "EVENTS" ? "MARKETING_EVENTS" : "NON_IT",
    requirementDetails: isEvent ? input.event.name.trim() : d.description.trim(),
    businessJustification: isEvent ? null : orNull(d.businessJustification),
    roi: isEvent ? null : orNull(d.roi),
    additionalSpecifications: input.category === "NON-IT" ? orNull(d.specifications) : null,
    salesforceCampaign: orNull(b.salesforceCampaign),
    notes: orNull(input.notes),
    vendors: input.vendors.map((v) => ({
      name: v.name.trim(),
      website: orNull(v.website),
      contactName: orNull(v.contact),
      contactEmail: orNull(v.email),
      contactPhone: orNull(v.phone),
    })),
    budgetCategoryCode: orNull(b.category),
    businessUnitCode: orNull(b.businessUnit),
    productCode: orNull(b.product),
    regionCode: orNull(b.region),
    engagementCode: orNull(b.engagementCode),
    budgetApproverId: input.budgetApproverId ? Number(input.budgetApproverId) : null,
    additionalApprovers: input.additionalApprovers,
    itDetails: isIt
      ? {
          softwareName: d.product.trim(),
          planName: d.plan.trim(),
          softwareRequirement: d.softwareRequirement.trim(),
          usagePeriod: d.usagePeriod.trim(),
          installationType: d.installationType as BackendItDetails["installationType"],
        }
      : null,
    itAssessment,
    eventDetails: toBackendEvent(input),
    answers: [],
  };
}

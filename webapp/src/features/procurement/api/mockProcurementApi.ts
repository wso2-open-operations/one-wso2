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

// SAMPLE DATA ONLY, served in dev builds while the Procurement backend is not
// configured (see isProcurementMockActive), and used for submitting while that
// is not connected. Held in memory, so a reload starts over; nothing is written
// to browser storage. It follows the backend's rules where the screens meet
// them: an additional approver is never the requester or the team lead, and
// only a rejected request is edited.

import type {
  Attachment,
  AttachmentsDraft,
  BudgetApproverOption,
  Choice,
  Person,
  Priority,
  ProcurementLookups,
  ProcurementMe,
  PurchaseRequest,
  PurchaseRequestInput,
} from "../types";
import { MAX_COLLABORATORS } from "../types";
import { emptyDetails, emptyEvent } from "../request-form/requestFormModel";
import type { ProcurementApi } from "./procurementApi";

const person = (name: string, email: string): Person => ({ id: email, name, email });

// Sample people, lists and vendors.
export const MOCK_DIRECTORY: readonly Person[] = [
  person("Alex Morgan", "alex.morgan@example.com"),
  person("Blake Rivers", "blake.rivers@example.com"),
  person("Casey Lane", "casey.lane@example.com"),
  person("Drew Parker", "drew.parker@example.com"),
  person("Emery Quinn", "emery.quinn@example.com"),
  person("Finley Brooks", "finley.brooks@example.com"),
  person("Legal Reviewer", "legal.reviewer@example.com"),
  person("Security Reviewer", "security.reviewer@example.com"),
  person("Compliance Reviewer", "compliance.reviewer@example.com"),
  person("Budget Owner", "budget.owner@example.com"),
  person("Jordan Ellis", "jordan.ellis@example.com"),
];

const TEAM_LEAD = MOCK_DIRECTORY[10];

/** The sample Procurement team, taken from the sample people above. */
const MOCK_TEAM: readonly Person[] = [MOCK_DIRECTORY[1], MOCK_DIRECTORY[3], MOCK_DIRECTORY[4]];

/** People who are not leads, such as interns: the directory finds them only when leads are not asked for. */
const NON_LEADS: ReadonlySet<string> = new Set(["casey.lane@example.com", "finley.brooks@example.com"]);

/** A pick list where each label also has a code, as the backend serves them. */
const choices = (prefix: string, labels: string[]): Choice[] =>
  labels.map((label, index) => ({ value: `${prefix}-${index + 1}`, label }));

const MOCK_LOOKUPS: ProcurementLookups = {
  budgetCategories: choices("CAT", [
    "Software & Subscriptions",
    "Hardware & Equipment",
    "Cloud & Hosting",
    "Professional Services",
    "Marketing & Events",
    "Facilities & Office",
    "HR & People",
    "Travel & Accommodation",
    "Insurance",
    "Other",
  ]),
  businessUnits: choices("BU", [
    "Finance",
    "Engineering - Platform",
    "Marketing",
    "Sales",
    "People Operations",
    "Facilities & Admin",
    "Legal",
    "Customer Success",
  ]),
  products: choices("PRD", [
    "WSO2 API Manager",
    "WSO2 Identity Server",
    "WSO2 MI / Integration",
    "Choreo",
    "Asgardeo",
    "Ballerina",
    "Cross-product / Platform",
    "Not product-specific",
  ]),
  regions: choices("REG", [
    "APAC - Sri Lanka",
    "APAC - India",
    "APAC - Australia",
    "APAC - Other",
    "Americas - USA",
    "Americas - Other",
    "EMEA - UK",
    "EMEA - Europe",
    "EMEA - Other",
    "Global / Multi-region",
  ]),
};

const MOCK_ENGAGEMENT_CODES: Choice[] = [
  { value: "ENG-1001", label: "ENG-1001 - Platform Engineering" },
  { value: "ENG-1002", label: "ENG-1002 - Sales Operations" },
  { value: "ENG-2040", label: "ENG-2040 - Facilities" },
];

const MOCK_BUDGET_APPROVERS: BudgetApproverOption[] = [{ id: "10", name: "Budget Owner" }];

/** The code of a sample list entry, found by its label. */
const codeOf = (list: Choice[], label: string): string => list.find((c) => c.label === label)?.value ?? "";

const SEARCH_LIMIT = 10;
const MIN_QUERY_LENGTH = 3;

function seedRequests(requester: Person): PurchaseRequest[] {
  const L = MOCK_LOOKUPS;
  const base = { event: emptyEvent(), additionalApprovers: [], notes: "", priority: null, assignee: "", collaborators: [], requester, budgetApproverId: "10", budgetApproverName: "Budget Owner" };
  const vendor = (name: string, website: string) => ({ name, website, contact: "", email: "", phone: "" });
  return [
    {
      ...base,
      id: "seed-1",
      reference: "PR-2026-00003",
      title: "ZoomInfo",
      category: "IT",
      status: "submitted",
      teamLead: TEAM_LEAD,
      teamLeadDecision: { decision: "pending", notes: "", decidedAt: null, decidedBy: "", isOverride: false },
      vendors: [vendor("ZoomInfo", "https://www.zoominfo.com")],
      budget: {
        category: codeOf(L.budgetCategories, "Software & Subscriptions"),
        businessUnit: codeOf(L.businessUnits, "Sales"),
        product: codeOf(L.products, "Not product-specific"),
        region: codeOf(L.regions, "Global / Multi-region"),
        engagementCode: "",
        salesforceCampaign: "",
      },
      details: {
        ...emptyDetails(),
        product: "ZoomInfo",
        plan: "Enterprise",
        installationType: "SAAS" as const,
        softwareRequirement: "Prospecting data for the Sales team.",
        externalInteraction: "no",
        description: "Contact and company data for the Sales team's prospecting.",
        usagePeriod: "1 year",
        businessJustification: "The current subscription ends next month.",
        sensitiveData: "no",
        externalPii: "yes",
        externalPiiDetail: "Names, business emails and phone numbers of prospects.",
        employeePii: "no",
        integrates: "yes",
        integrations: [{ system: "Salesforce", data: "Syncs contacts nightly via API" }],
        vendorDocs: "no",
      },
      submittedAt: "2026-10-28T09:12:00.000Z",
      updatedAt: "2026-10-28T09:12:00.000Z",
    },
    {
      ...base,
      id: "seed-2",
      reference: "PR-2026-00002",
      title: "Co-working space, Colombo",
      category: "NON-IT",
      status: "rejected",
      teamLead: TEAM_LEAD,
      teamLeadDecision: {
        decision: "rejected",
        notes: "Please get a second quote and confirm the budget line.",
        decidedAt: "2026-10-27T14:30:00.000Z",
        decidedBy: "jordan.ellis@example.com",
        isOverride: false,
      },
      vendors: [vendor("IWG / Spaces", "https://www.spacesworks.com")],
      budget: {
        category: codeOf(L.budgetCategories, "Facilities & Office"),
        businessUnit: codeOf(L.businessUnits, "Facilities & Admin"),
        product: codeOf(L.products, "Not product-specific"),
        region: codeOf(L.regions, "APAC - Sri Lanka"),
        engagementCode: "ENG-1001",
        salesforceCampaign: "",
      },
      details: {
        ...emptyDetails(),
        description: "Ten co-working desks in Colombo for six months.",
        businessJustification: "Overflow seating while the office is refurbished.",
      },
      submittedAt: "2026-10-26T08:00:00.000Z",
      updatedAt: "2026-10-27T14:30:00.000Z",
    },
    {
      ...base,
      id: "seed-3",
      reference: "PR-2026-00001",
      title: "SentinelOne",
      category: "IT",
      status: "approved",
      teamLead: TEAM_LEAD,
      teamLeadDecision: {
        decision: "approved",
        notes: "",
        decidedAt: "2026-10-22T10:05:00.000Z",
        decidedBy: "jordan.ellis@example.com",
        isOverride: false,
      },
      vendors: [vendor("SentinelOne", "https://www.sentinelone.com")],
      budget: {
        category: codeOf(L.budgetCategories, "Software & Subscriptions"),
        businessUnit: codeOf(L.businessUnits, "Engineering - Platform"),
        product: codeOf(L.products, "Cross-product / Platform"),
        region: codeOf(L.regions, "Global / Multi-region"),
        engagementCode: "",
        salesforceCampaign: "",
      },
      details: {
        ...emptyDetails(),
        product: "SentinelOne",
        plan: "Complete",
        installationType: "SAAS" as const,
        softwareRequirement: "Endpoint protection for engineering laptops.",
        externalInteraction: "no",
        description: "Endpoint protection for engineering laptops.",
        usagePeriod: "1 year",
        businessJustification: "Replaces the current endpoint tool, which reaches end of support.",
        sensitiveData: "yes",
        sensitiveDataDetail: "Endpoint telemetry from laptops that hold source code.",
        externalPii: "no",
        employeePii: "no",
        integrates: "no",
      },
      submittedAt: "2026-10-21T11:40:00.000Z",
      updatedAt: "2026-10-22T10:05:00.000Z",
    },
  ];
}

/** Requests by other people that name the signed-in user as their approver. */
function approvalSeeds(approver: Person): PurchaseRequest[] {
  const L = MOCK_LOOKUPS;
  const waiting = { decision: "pending" as const, notes: "", decidedAt: null, decidedBy: "", isOverride: false };
  const base = {
    event: emptyEvent(),
    additionalApprovers: [],
    notes: "",
    priority: null,
    assignee: "",
    collaborators: [],
    teamLead: approver,
    budgetApproverId: "10",
    budgetApproverName: "Budget Owner",
    vendors: [{ name: "Acme Supplies", website: "https://www.acme.example.com", contact: "", email: "", phone: "" }],
    budget: {
      category: codeOf(L.budgetCategories, "Facilities & Office"),
      businessUnit: codeOf(L.businessUnits, "Facilities & Admin"),
      product: codeOf(L.products, "Not product-specific"),
      region: codeOf(L.regions, "APAC - Sri Lanka"),
      engagementCode: "ENG-2040",
      salesforceCampaign: "",
    },
  };
  return [
    {
      ...base,
      id: "approval-1",
      reference: "PR-2026-00011",
      title: "Standing desks for the Colombo office",
      category: "NON-IT",
      status: "submitted",
      requester: MOCK_DIRECTORY[0],
      teamLeadDecision: waiting,
      details: { ...emptyDetails(), description: "Twelve standing desks for the Colombo office.", businessJustification: "Replaces desks that are past repair." },
      submittedAt: "2026-11-10T09:00:00.000Z",
      updatedAt: "2026-11-10T09:00:00.000Z",
    },
    {
      ...base,
      id: "approval-2",
      reference: "PR-2026-00009",
      title: "Notion",
      category: "NON-IT",
      status: "approved",
      requester: MOCK_DIRECTORY[1],
      teamLeadDecision: { decision: "approved", notes: "", decidedAt: "2026-11-05T10:00:00.000Z", decidedBy: approver.email, isOverride: false },
      details: { ...emptyDetails(), description: "Team wiki subscription.", businessJustification: "Replaces scattered documents." },
      submittedAt: "2026-11-04T09:00:00.000Z",
      updatedAt: "2026-11-05T10:00:00.000Z",
    },
  ];
}

/**
 * Approved requests that someone else raised and someone else approved, which is what a Procurement user handles:
 * a request the signed-in user raised or approved cannot be handled by them.
 */
function teamSeeds(): PurchaseRequest[] {
  const L = MOCK_LOOKUPS;
  const lead = MOCK_DIRECTORY[3];
  const approved = { decision: "approved" as const, notes: "", decidedAt: "2026-11-07T10:00:00.000Z", decidedBy: lead.email, isOverride: false };
  const base = {
    additionalApprovers: [],
    notes: "",
    teamLead: lead,
    teamLeadDecision: approved,
    budgetApproverId: "10",
    budgetApproverName: "Budget Owner",
    vendors: [{ name: "Acme Supplies", website: "https://www.acme.example.com", contact: "", email: "", phone: "" }],
    budget: {
      category: codeOf(L.budgetCategories, "Facilities & Office"),
      businessUnit: codeOf(L.businessUnits, "Facilities & Admin"),
      product: codeOf(L.products, "Not product-specific"),
      region: codeOf(L.regions, "APAC - Sri Lanka"),
      engagementCode: "ENG-2040",
      salesforceCampaign: "",
    },
    category: "NON-IT" as const,
    submittedAt: "2026-11-06T09:00:00.000Z",
    updatedAt: "2026-11-07T10:00:00.000Z",
  };
  return [
    {
      ...base,
      id: "team-1",
      reference: "PR-2026-00012",
      title: "Ergonomic chairs for the Colombo office",
      status: "approved",
      requester: MOCK_DIRECTORY[2],
      priority: null,
      assignee: "",
      collaborators: [],
      event: emptyEvent(),
      details: { ...emptyDetails(), description: "Forty ergonomic chairs.", businessJustification: "Replaces chairs that are past repair." },
    },
    {
      ...base,
      id: "team-2",
      reference: "PR-2026-00013",
      title: "Printer toner and paper",
      status: "assigned",
      requester: MOCK_DIRECTORY[0],
      priority: "P2",
      assignee: MOCK_DIRECTORY[1].email,
      collaborators: [MOCK_DIRECTORY[2].email],
      event: emptyEvent(),
      details: { ...emptyDetails(), description: "Toner and paper for the second floor printers.", businessJustification: "Current stock runs out this month." },
    },
  ];
}

/** The most urgent first; a request with no priority yet comes last. */
const urgencyRank = (priority: Priority | null): number => (priority ? ["P1", "P2", "P3"].indexOf(priority) : 3);

function titleFor(input: PurchaseRequestInput): string {
  const text = input.category === "IT" ? input.details.product : input.category === "EVENTS" ? input.event.name : input.details.description;
  return text.trim().split("\n")[0].slice(0, 80) || "Untitled request";
}

function buildMockProcurementApi(user: Person): ProcurementApi {
  const requests: PurchaseRequest[] = seedRequests(user);
  const toApprove: PurchaseRequest[] = approvalSeeds(user);
  const forTeam: PurchaseRequest[] = teamSeeds();
  let counter = requests.length;
  const confirmed = new Set<string>();
  const me: ProcurementMe = { ...user, roles: ["procurement_user", "procurement_admin"], teamLead: TEAM_LEAD, approvalExempt: false };

  const find = (requestId: string): PurchaseRequest => {
    const found = [...requests, ...toApprove, ...forTeam].find((r) => r.id === requestId);
    if (!found) throw new Error("Request not found.");
    return found;
  };

  const assertApprovers = (input: PurchaseRequestInput): void => {
    const emails = input.additionalApprovers.map((e) => e.toLowerCase());
    if (emails.includes(user.email.toLowerCase()) || emails.includes(TEAM_LEAD.email.toLowerCase())) {
      throw new Error("An additional approver cannot be you or your team lead.");
    }
  };

  const attached = new Map<string, { meta: Attachment; blob: Blob }[]>([
    [
      "seed-2",
      [
        {
          meta: { id: "a-1", name: "Colombo-space-quote.pdf", contentType: "application/pdf", sizeBytes: 182_000, scanStatus: "clean", uploadedBy: user.email, uploadedAt: "2026-11-03T08:00:00.000Z" },
          blob: new Blob(["Sample quote"], { type: "application/pdf" }),
        },
      ],
    ],
  ]);
  let attachmentCounter = 1;
  /** Makes the request's sample files match the requester's choice, as the backend's calls would. */
  const syncAttachments = (requestId: string, { removed, files }: AttachmentsDraft): void => {
    const kept = (attached.get(requestId) ?? []).filter((a) => !removed.includes(a.meta.id));
    for (const file of files) {
      attachmentCounter += 1;
      kept.push({
        meta: {
          id: `a-${attachmentCounter}`,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          scanStatus: "clean",
          uploadedBy: user.email,
          uploadedAt: new Date().toISOString(),
        },
        blob: file,
      });
    }
    attached.set(requestId, kept);
  };

  const approverName = (id: string): string => MOCK_BUDGET_APPROVERS.find((a) => a.id === id)?.name ?? "";

  return {
    getMe: async () => me,
    getLookups: async () => MOCK_LOOKUPS,
    getBudgetApprovers: async ({ businessUnit, region }) => (businessUnit || region ? MOCK_BUDGET_APPROVERS : []),
    getEngagementCodes: async (businessUnitName) => (businessUnitName ? MOCK_ENGAGEMENT_CODES : []),
    searchDirectory: async (query, leadsOnly) => {
      const q = query.trim().toLowerCase();
      if (q.length < MIN_QUERY_LENGTH) return [];
      return MOCK_DIRECTORY.filter(
        (p) =>
          p.email.toLowerCase() !== user.email.toLowerCase() &&
          !(leadsOnly && NON_LEADS.has(p.email)) &&
          p.email.toLowerCase().startsWith(q),
      ).slice(0, SEARCH_LIMIT);
    },
    listMyRequests: async () =>
      [...requests]
        .sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))
        .map(({ id, reference, title, category, status, submittedAt, updatedAt }) => ({ id, reference, title, category, status, submittedAt, updatedAt })),
    // A copy, so that a save which changes the stored request is seen as new data by the screens that read it.
    getRequest: async (requestId) => ({ ...find(requestId) }),
    submitRequest: async (input) => {
      if (!input.declarationAccepted) throw new Error("Confirm the declaration before submitting.");
      assertApprovers(input);
      counter += 1;
      const now = new Date().toISOString();
      const created: PurchaseRequest = {
        id: `mock-${counter}`,
        reference: `PR-${now.slice(0, 4)}-${String(counter).padStart(5, "0")}`,
        title: titleFor(input),
        category: input.category,
        status: "submitted",
        requester: user,
        teamLead: TEAM_LEAD,
        additionalApprovers: input.additionalApprovers,
        teamLeadDecision: { decision: "pending", notes: "", decidedAt: null, decidedBy: "", isOverride: false },
        details: input.details,
        event: input.event,
        vendors: input.vendors,
        budget: input.budget,
        budgetApproverId: input.budgetApproverId,
        budgetApproverName: approverName(input.budgetApproverId),
        notes: input.notes,
        priority: null,
        assignee: "",
        collaborators: [],
        submittedAt: now,
        updatedAt: now,
      };
      requests.push(created);
      syncAttachments(created.id, input.attachments);
      return { id: created.id, reference: created.reference };
    },
    resubmitRequest: async (requestId, input) => {
      const existing = find(requestId);
      if (existing.status !== "rejected") throw new Error("Only a rejected request can be edited and resubmitted.");
      if (!input.declarationAccepted) throw new Error("Confirm the declaration before submitting.");
      assertApprovers(input);
      Object.assign(existing, {
        title: titleFor(input),
        category: input.category,
        status: "submitted",
        additionalApprovers: input.additionalApprovers,
        teamLeadDecision: { decision: "pending", notes: "", decidedAt: null, decidedBy: "", isOverride: false },
        details: input.details,
        event: input.event,
        vendors: input.vendors,
        budget: input.budget,
        budgetApproverId: input.budgetApproverId,
        budgetApproverName: approverName(input.budgetApproverId),
        notes: input.notes,
        updatedAt: new Date().toISOString(),
      });
      syncAttachments(requestId, input.attachments);
    },
    listApprovals: async (status = "submitted") =>
      toApprove
        .filter((r) => r.status === status)
        .map(({ id, reference, title, category, status: stage, requester, submittedAt, updatedAt }) => ({
          id,
          reference,
          title,
          category,
          status: stage,
          requester,
          submittedAt,
          updatedAt,
        })),
    decideRequest: async (requestId, { decision, comment, disclaimerAccepted }) => {
      const found = toApprove.find((r) => r.id === requestId);
      if (!found || found.status !== "submitted") throw new Error("This request is not waiting for your decision.");
      if (decision === "rejected" && comment.trim() === "") throw new Error("Add why the request is rejected.");
      if (decision === "approved" && !disclaimerAccepted) throw new Error("Confirm that you reviewed the request.");
      Object.assign(found, {
        status: decision,
        teamLeadDecision: { decision, notes: comment.trim(), decidedAt: new Date().toISOString(), decidedBy: user.email, isOverride: false },
        updatedAt: new Date().toISOString(),
      });
    },
    overrideRequest: async (requestId, { decision, justification, comment }) => {
      const found = find(requestId);
      if (!me.roles.includes("procurement_admin")) throw new Error("You are not allowed to do this.");
      if (found.requester.email.toLowerCase() === user.email.toLowerCase()) throw new Error("Request not found.");
      if (found.status !== "approved") throw new Error("This request is not waiting for a decision.");
      if (justification.trim() === "") throw new Error("Invalid justification.");
      if (decision === "approved" && confirmed.has(requestId)) throw new Error("This approval was already confirmed.");
      if (decision === "approved") confirmed.add(requestId);
      Object.assign(found, {
        status: decision === "approved" ? "approved" : "rejected",
        teamLeadDecision: { decision, notes: comment.trim(), decidedAt: new Date().toISOString(), decidedBy: user.email, isOverride: true },
        updatedAt: new Date().toISOString(),
      });
    },
    listTeamQueue: async ({ status, priority, assignee } = {}) =>
      [...requests, ...toApprove, ...forTeam]
        .filter((r) => (r.status === "approved" || r.status === "assigned") && (!status || r.status === status) && (!priority || r.priority === priority))
        .filter((r) => !assignee || r.assignee.toLowerCase() === assignee.toLowerCase())
        .sort((a, b) => urgencyRank(a.priority) - urgencyRank(b.priority))
        .map(({ id, reference, title, category, status: stage, priority: urgency, assignee, requester, updatedAt }) => ({
          id,
          reference,
          title,
          category,
          status: stage,
          priority: urgency,
          assignee,
          requester,
          updatedAt,
        })),
    assignRequest: async (requestId, email) => {
      const found = find(requestId);
      if (found.status !== "approved" && found.status !== "assigned") throw new Error("Only an approved request can be assigned.");
      if (found.requester.email.toLowerCase() === user.email.toLowerCase()) throw new Error("You cannot handle your own request.");
      Object.assign(found, { status: "assigned", assignee: email ?? user.email, updatedAt: new Date().toISOString() });
    },
    unassignRequest: async (requestId) => {
      const found = find(requestId);
      if (found.status !== "assigned") throw new Error("Only an assigned request can be unassigned.");
      Object.assign(found, { status: "approved", assignee: "", updatedAt: new Date().toISOString() });
    },
    setPriority: async (requestId, priority) => {
      const found = find(requestId);
      if (found.status !== "approved" && found.status !== "assigned") throw new Error("Only an approved or assigned request has a priority.");
      Object.assign(found, { priority, updatedAt: new Date().toISOString() });
    },
    changeTeamLead: async (requestId, email) => {
      const found = find(requestId);
      if (found.requester.email.toLowerCase() !== user.email.toLowerCase()) throw new Error("Only the requester can change the team lead.");
      if (found.status !== "submitted" || found.teamLeadDecision.decision !== "pending") throw new Error("The request no longer waits for a decision.");
      const lead = MOCK_DIRECTORY.find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (!lead || NON_LEADS.has(lead.email)) throw new Error("The person must be an active team lead.");
      const taken = [found.requester.email, found.teamLead?.email ?? "", ...found.additionalApprovers].map((e) => e.toLowerCase());
      if (taken.includes(lead.email.toLowerCase())) throw new Error("That person cannot be the team lead of this request.");
      Object.assign(found, { teamLead: lead, updatedAt: new Date().toISOString() });
    },
    cancelRequest: async (requestId) => {
      const existing = find(requestId);
      if (existing.status !== "submitted" && existing.status !== "rejected") {
        throw new Error("Only a submitted or rejected request can be cancelled.");
      }
      Object.assign(existing, { status: "cancelled", updatedAt: new Date().toISOString() });
    },
    listAttachments: async (requestId) => {
      find(requestId);
      return (attached.get(requestId) ?? []).map((a) => a.meta);
    },
    downloadAttachment: async (requestId, attachmentId) => {
      const found = (attached.get(requestId) ?? []).find((a) => a.meta.id === attachmentId);
      if (!found) throw new Error("Attachment not found.");
      return found.blob;
    },
    listTeamMembers: async () => [...MOCK_TEAM],
    changeBudget: async (requestId, { budget, budgetApproverId }) => {
      const found = find(requestId);
      if (found.status !== "approved" && found.status !== "assigned") throw new Error("Only an approved or assigned request can change its budget.");
      if (found.category === "NON-IT" && budget.engagementCode.trim() === "") throw new Error("A Non-IT request keeps its engagement code.");
      Object.assign(found, { budget, budgetApproverId, budgetApproverName: approverName(budgetApproverId), updatedAt: new Date().toISOString() });
    },
    addCollaborator: async (requestId, email) => {
      const found = find(requestId);
      if (found.status !== "approved" && found.status !== "assigned") throw new Error("Only an approved or assigned request can have collaborators.");
      if (found.collaborators.some((c) => c.toLowerCase() === email.toLowerCase())) throw new Error("That person is a collaborator already.");
      if (found.collaborators.length >= MAX_COLLABORATORS) throw new Error(`A request has at most ${MAX_COLLABORATORS} collaborators.`);
      Object.assign(found, { collaborators: [...found.collaborators, email], updatedAt: new Date().toISOString() });
    },
    removeCollaborator: async (requestId, email) => {
      const found = find(requestId);
      Object.assign(found, { collaborators: found.collaborators.filter((c) => c.toLowerCase() !== email.toLowerCase()), updatedAt: new Date().toISOString() });
    },
  };
}

const mockApis = new Map<string, ProcurementApi>();

/**
 * One in-memory store per user, kept for the life of the page so a request
 * raised on one screen is still there on the next.
 *
 * @param user - The signed-in user, who owns every request the mock returns
 */
export function createMockProcurementApi(user: Person): ProcurementApi {
  let api = mockApis.get(user.id);
  if (!api) {
    api = buildMockProcurementApi(user);
    mockApis.set(user.id, api);
  }
  return api;
}

/** Forget every user's sample data, for tests. */
export function resetMockProcurementApis(): void {
  mockApis.clear();
}

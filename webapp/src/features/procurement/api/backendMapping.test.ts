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

import { describe, expect, it } from "vitest";
import type { Person, PurchaseRequestInput } from "../types";
import type { BackendRequestDetail } from "./backendTypes";
import { draftFromRequest, draftToInput, emptyDraft, emptyEvent } from "../request-form/requestFormModel";
import { toBackendScopes, toBudgetApproverSettings, toReferenceSettings, toBudgetApprovers, toChoices, toEngagementChoices, toMe, toApprovalItem, toBackendStatus, toNewDecision, toNewRequest, toQueueItem, toRequest, toSummary } from "./backendMapping";

const signedIn: Person = { id: "me@example.com", name: "Me Myself", email: "me@example.com" };

const detail = (patch: Partial<BackendRequestDetail> = {}): BackendRequestDetail => ({
  id: 5,
  referenceNo: "PR-2026-00005",
  title: "Figma",
  category: "IT",
  status: "PENDING_APPROVAL",
  version: 2,
  submittedOn: "2026-11-02T08:00:00Z",
  updatedOn: "2026-11-02T08:00:00Z",
  createdOn: "2026-11-01T08:00:00Z",
  requesterName: "Me Myself",
  requesterEmail: "me@example.com",
  requirementDetails: "Design tool for the UX team.",
  vendorName: "Figma Inc",
  businessJustification: "Replaces two tools.",
  roi: "Saves 10 hours a week.",
  additionalSpecifications: null,
  salesforceCampaign: "Q4 launch",
  notes: "Needed by January.",
  vendors: [],
  eventDetails: null,
  answers: [],
  budgetCategoryCode: "CAT-1",
  businessUnitCode: "BU-2",
  productCode: null,
  regionCode: "REG-3",
  engagementCode: "ENG-1",
  budgetApproverId: 10,
  budgetApproverName: "Budget Owner",
  teamLeadEmail: "lead@example.com",
  additionalApprovers: ["other@example.com"],
  itDetails: {
    softwareName: "Figma",
    planName: "Enterprise",
    softwareRequirement: "Design and prototyping for the UX team",
    usagePeriod: "1 year",
    installationType: "SAAS",
  },
  itAssessment: null,
  priority: null,
  assigneeEmail: null,
  collaborators: [],
  decisions: [],
  ...patch,
});

describe("backend mapping", () => {
  it("turns a summary row into the UI's, with a string id and the UI's names for category and status", () => {
    expect(
      toSummary({ id: 7, referenceNo: null, title: "T", category: "NON_IT", status: "DRAFT", version: 1, submittedOn: null, updatedOn: "2026-11-01T00:00:00Z" }),
    ).toEqual({ id: "7", reference: null, title: "T", category: "NON-IT", status: "draft", submittedAt: null, updatedAt: "2026-11-01T00:00:00Z" });
  });

  it.each([
    ["PENDING_APPROVAL", "submitted"],
    ["APPROVED", "approved"],
    ["REJECTED", "rejected"],
    ["ASSIGNED", "assigned"],
    ["CANCELLED", "cancelled"],
    ["DRAFT", "draft"],
  ] as const)("reads status %s as %s", (backend, ui) => {
    expect(toRequest(detail({ status: backend })).status).toBe(ui);
  });

  it("reads Marketing & Events as its own category", () => {
    expect(toRequest(detail({ category: "MARKETING_EVENTS" })).category).toBe("EVENTS");
  });

  it("maps a detail: codes stay codes, the team lead is named by email, and the IT details fill the plan, requirement and usage period", () => {
    const r = toRequest(detail());
    expect(r).toMatchObject({
      id: "5",
      reference: "PR-2026-00005",
      requester: { name: "Me Myself", email: "me@example.com" },
      teamLead: { email: "lead@example.com", name: "lead@example.com" },
      additionalApprovers: ["other@example.com"],
      budget: { category: "CAT-1", businessUnit: "BU-2", product: "", region: "REG-3", engagementCode: "ENG-1" },
      budgetApproverId: "10",
      budgetApproverName: "Budget Owner",
      vendors: [{ name: "Figma Inc" }],
      notes: "Needed by January.",
    });
    expect(r.budget.salesforceCampaign).toBe("Q4 launch");
    expect(r.details).toMatchObject({
      description: "Design tool for the UX team.",
      product: "Figma",
      plan: "Enterprise",
      softwareRequirement: "Design and prototyping for the UX team",
      usagePeriod: "1 year",
      roi: "Saves 10 hours a week.",
      businessJustification: "Replaces two tools.",
      installationType: "SAAS",
    });
  });

  it("reads every vendor with its contact, and falls back to the single vendor name", () => {
    const full = toRequest(
      detail({ vendors: [{ name: "Figma Inc", website: "https://figma.com", contactName: "Sam", contactEmail: "sam@example.com", contactPhone: "123" }] }),
    );
    expect(full.vendors).toEqual([{ name: "Figma Inc", website: "https://figma.com", contact: "Sam", email: "sam@example.com", phone: "123" }]);
    expect(toRequest(detail()).vendors).toEqual([{ name: "Figma Inc", website: "", contact: "", email: "", phone: "" }]);
  });

  it("has no team lead, vendor or budget approver when the backend names none", () => {
    const r = toRequest(detail({ teamLeadEmail: null, vendorName: null, vendors: [], budgetApproverId: null, budgetApproverName: null }));
    expect(r.teamLead).toBeNull();
    expect(r.vendors).toEqual([]);
    expect(r.budgetApproverId).toBe("");
  });

  it("reads the IT assessment answers into the form, and nothing when there are none", () => {
    expect(toRequest(detail()).details.sensitiveData).toBe("");
    const assessment = toRequest(
      detail({
        itAssessment: {
          adminCount: 2,
          adminDetails: "IT team\nSecurity",
          userCount: 40,
          userDetails: "Design team",
          externalInteraction: true,
          handlesSensitiveData: false,
          handlesExternalPii: true,
          externalPiiDetails: "Customer names",
          handlesEmployeePii: false,
          integratesInternalSystems: true,
          integrationDetails: "Google Workspace: SSO login\nSalesforce",
          vendorDocsLinks: "https://docs.example.com",
        },
      }),
    ).details;
    expect(assessment).toMatchObject({
      userCount: "40",
      userNames: ["Design team"],
      adminCount: "2",
      adminNames: ["IT team", "Security"],
      sensitiveData: "no",
      externalPii: "yes",
      externalPiiDetail: "Customer names",
      employeePii: "no",
      integrates: "yes",
      integrations: [{ system: "Google Workspace", data: "SSO login" }, { system: "Salesforce", data: "" }],
      vendorDocs: "yes",
      vendorDocsLink: "https://docs.example.com",
    });
  });

  it("shows the decision on the version being read, and ignores an older version's", () => {
    const decisions = [
      { version: 1, decidedBy: "lead@example.com", decision: "REJECTED" as const, isOverride: false, comment: "Get a second quote.", justification: null, decidedOn: "2026-10-30T10:00:00Z" },
    ];
    expect(toRequest(detail({ version: 1, status: "REJECTED", decisions })).teamLeadDecision).toEqual({
      decision: "rejected",
      notes: "Get a second quote.",
      decidedAt: "2026-10-30T10:00:00Z",
      decidedBy: "lead@example.com",
      isOverride: false,
    });
    expect(toRequest(detail({ version: 2, decisions })).teamLeadDecision.decision).toBe("pending");
  });

  it("shows a Procurement override as the decision when it is the latest, and says who made it", () => {
    const decisions = [
      { version: 2, decidedBy: "lead@example.com", decision: "APPROVED" as const, isOverride: false, comment: null, justification: null, decidedOn: "2026-11-03T10:00:00Z" },
      { version: 2, decidedBy: "admin@example.com", decision: "REJECTED" as const, isOverride: true, comment: "Over budget.", justification: "Budget exceeded", decidedOn: "2026-11-04T10:00:00Z" },
    ];
    expect(toRequest(detail({ decisions })).teamLeadDecision).toMatchObject({
      decision: "rejected",
      decidedBy: "admin@example.com",
      isOverride: true,
    });
  });

  it("leaves an assessment answer unanswered when the backend omits it, and reads only an explicit true or false as Yes or No", () => {
    const assessment = { adminCount: 1, adminDetails: "IT", userCount: 5, userDetails: "Team" };
    expect(toRequest(detail({ itAssessment: assessment })).details).toMatchObject({
      sensitiveData: "",
      externalPii: "",
      employeePii: "",
      integrates: "",
    });
    expect(toRequest(detail({ itAssessment: { ...assessment, handlesSensitiveData: false, handlesExternalPii: true } })).details).toMatchObject({
      sensitiveData: "no",
      externalPii: "yes",
      employeePii: "",
    });
  });

  it("builds the signed-in user from the token and the backend's roles and team lead", () => {
    expect(toMe({ email: "me@example.com", roles: ["procurement_user"] }, { approvalExempt: false, teamLead: { email: "lead@example.com", name: "Lead" } }, signedIn)).toMatchObject({
      name: "Me Myself",
      roles: ["procurement_user"],
      teamLead: { name: "Lead", email: "lead@example.com" },
      approvalExempt: false,
    });
    expect(toMe({ email: "me@example.com", roles: [] }, { approvalExempt: true }, signedIn)).toMatchObject({ teamLead: null, approvalExempt: true });
  });

  it("turns lists into choices, an engagement as code and name, and approver ids into strings", () => {
    expect(toChoices([{ code: "BU-1", label: "Sales" }])).toEqual([{ value: "BU-1", label: "Sales" }]);
    expect(toEngagementChoices([{ code: "E1", name: "Platform" }, { code: "E2", name: "E2" }])).toEqual([
      { value: "E1", label: "E1 - Platform" },
      { value: "E2", label: "E2" },
    ]);
    expect(toBudgetApprovers([{ id: 10, name: "Budget Owner" }])).toEqual([{ id: "10", name: "Budget Owner" }]);
  });

  it("reads an option of a list of the form with its list as the kind", () => {
    expect(toReferenceSettings([{ id: 3, type: "REGION", code: "REG-1", label: "Global", isActive: false }])).toEqual([
      { id: "3", kind: "REGION", code: "REG-1", label: "Global", isActive: false },
    ]);
  });

  it("splits what a budget approver covers into business units and regions, and joins them again to send", () => {
    const scopes = [
      { scopeType: "BUSINESS_UNIT" as const, code: "BU-1" },
      { scopeType: "REGION" as const, code: "REG-1" },
      { scopeType: "BUSINESS_UNIT" as const, code: "BU-2" },
    ];
    expect(toBudgetApproverSettings([{ id: 10, name: "Budget Owner", email: "budget.owner@example.com", isActive: false, scopes }])).toEqual([
      { id: "10", name: "Budget Owner", email: "budget.owner@example.com", isActive: false, businessUnits: ["BU-1", "BU-2"], regions: ["REG-1"] },
    ]);
    expect(toBackendScopes({ businessUnits: ["BU-1", "BU-2"], regions: ["REG-1"] })).toEqual([
      { scopeType: "BUSINESS_UNIT", code: "BU-1" },
      { scopeType: "BUSINESS_UNIT", code: "BU-2" },
      { scopeType: "REGION", code: "REG-1" },
    ]);
  });
});

describe("the request the backend is sent", () => {
  const itInput = (): PurchaseRequestInput => {
    const draft = emptyDraft();
    draft.category = "IT";
    draft.additionalApprovers = [{ id: "a@example.com", name: "A", email: "a@example.com" }];
    draft.budgetApproverId = "10";
    draft.budget = { ...draft.budget, businessUnit: "BU-1", salesforceCampaign: "Q4" };
    draft.vendors = [{ name: "Figma Inc", website: "https://figma.com", contact: "", email: "", phone: "" }];
    draft.details = {
      ...draft.details,
      product: "Figma",
      plan: "Enterprise",
      description: "Design tool",
      softwareRequirement: "Design and prototyping for the product team",
      usagePeriod: "1 year",
      installationType: "SAAS",
      businessJustification: "Needed",
      externalInteraction: "yes",
      userCount: "40",
      userNames: ["Design team", "Product"],
      adminCount: "2",
      adminNames: ["IT"],
      sensitiveData: "no",
      externalPii: "no",
      employeePii: "yes",
      employeePiiDetail: "Names",
      integrates: "yes",
      integrations: [{ system: "Salesforce", data: "Nightly sync" }, { system: "Okta", data: "" }],
      vendorDocs: "yes",
      vendorDocsLink: "https://docs.example.com",
    };
    draft.declarationAccepted = true;
    return draftToInput(draft);
  };

  it("sends an IT request with its software details, IT assessment, vendors and budget, and leaves the title to the backend", () => {
    const body = toNewRequest(itInput());
    expect(body).toMatchObject({
      category: "IT",
      requirementDetails: "Design tool",
      businessJustification: "Needed",
      salesforceCampaign: "Q4",
      budgetApproverId: 10,
      businessUnitCode: "BU-1",
      additionalApprovers: ["a@example.com"],
      vendors: [{ name: "Figma Inc", website: "https://figma.com", contactName: null }],
      itDetails: {
        softwareName: "Figma",
        planName: "Enterprise",
        softwareRequirement: "Design and prototyping for the product team",
        usagePeriod: "1 year",
        installationType: "SAAS",
      },
      itAssessment: {
        externalInteraction: true,
        userCount: 40,
        userDetails: "Design team\nProduct",
        adminCount: 2,
        handlesEmployeePii: true,
        employeePiiDetails: "Names",
        handlesSensitiveData: false,
        sensitiveDataDetails: null,
        integrationDetails: "Salesforce: Nightly sync\nOkta",
        vendorDocsLinks: "https://docs.example.com",
      },
    });
    expect(body).not.toHaveProperty("title");
    expect(body.answers).toEqual([]);
  });

  it("keeps a name that holds a comma as one name when the request is read back", () => {
    const input = itInput();
    input.details.userNames = ["Doe, Jane", "Design team"];
    input.details.adminNames = ["Smith, Sam"];
    const sent = toNewRequest(input);
    const read = toRequest({
      id: 1,
      referenceNo: null,
      title: "Figma",
      status: "DRAFT",
      version: 1,
      submittedOn: null,
      updatedOn: "2026-11-01T00:00:00Z",
      createdOn: "2026-11-01T00:00:00Z",
      requesterName: "Me",
      requesterEmail: "me@example.com",
      vendorName: null,
      budgetApproverName: null,
      teamLeadEmail: null,
      priority: null,
      assigneeEmail: null,
      collaborators: [],
      decisions: [],
      ...sent,
    });
    expect(read.details.userNames).toEqual(["Doe, Jane", "Design team"]);
    expect(read.details.adminNames).toEqual(["Smith, Sam"]);
  });

  it("sends a Non-IT request without IT details or answers, with its specifications", () => {
    const draft = emptyDraft();
    draft.category = "NON-IT";
    draft.details.description = "  40 chairs ";
    draft.details.specifications = "Spec sheet";
    draft.details.plan = "ignored";
    const body = toNewRequest(draftToInput(draft));
    expect(body).toMatchObject({ category: "NON_IT", requirementDetails: "40 chairs", additionalSpecifications: "Spec sheet", itDetails: null, itAssessment: null, answers: [], budgetApproverId: null });
  });

  it("reads back what it sent", () => {
    const sent = toNewRequest(itInput());
    const read = toRequest({
      id: 1,
      referenceNo: null,
      title: "Figma",
      status: "DRAFT",
      version: 1,
      submittedOn: null,
      updatedOn: "2026-11-01T00:00:00Z",
      createdOn: "2026-11-01T00:00:00Z",
      requesterName: "Me",
      requesterEmail: "me@example.com",
      vendorName: null,
      budgetApproverName: null,
      teamLeadEmail: null,
      priority: null,
      assigneeEmail: null,
      collaborators: [],
      decisions: [],
      ...sent,
    });
    expect(draftToInput({ ...draftFromRequest(read), declarationAccepted: true })).toEqual(itInput());
  });
});

describe("approvals", () => {
  it("reads an approval row with who raised it", () => {
    expect(
      toApprovalItem({ id: 4, referenceNo: "PR-2026-00004", title: "T", category: "IT", status: "PENDING_APPROVAL", version: 1, submittedOn: null, updatedOn: "2026-11-01T00:00:00Z", requesterName: "Alex Morgan", requesterEmail: "alex@example.com" }),
    ).toEqual({
      id: "4",
      reference: "PR-2026-00004",
      title: "T",
      category: "IT",
      status: "submitted",
      requester: { id: "alex@example.com", name: "Alex Morgan", email: "alex@example.com" },
      submittedAt: null,
      updatedAt: "2026-11-01T00:00:00Z",
    });
  });

  it("names a status the way the backend does", () => {
    expect(toBackendStatus("submitted")).toBe("PENDING_APPROVAL");
    expect(toBackendStatus("rejected")).toBe("REJECTED");
  });

  it("sends the confirmation only with an approval, and the comment only when there is one", () => {
    expect(toNewDecision({ decision: "approved", comment: " ", disclaimerAccepted: true })).toEqual({ decision: "APPROVED", comment: null, disclaimerAccepted: true });
    expect(toNewDecision({ decision: "rejected", comment: "No", disclaimerAccepted: true })).toEqual({ decision: "REJECTED", comment: "No", disclaimerAccepted: false });
  });
});

describe("the Procurement queue", () => {
  it("reads a queue row with who raised it, its priority and who handles it", () => {
    expect(
      toQueueItem({ id: 8, referenceNo: "PR-2026-00008", title: "Desks", category: "NON_IT", status: "ASSIGNED", version: 1, submittedOn: null, updatedOn: "2026-11-01T00:00:00Z", priority: "P1", assigneeEmail: "pat@example.com", requesterName: "Alex Morgan", requesterEmail: "alex@example.com" }),
    ).toEqual({
      id: "8",
      reference: "PR-2026-00008",
      title: "Desks",
      category: "NON-IT",
      status: "assigned",
      priority: "P1",
      assignee: "pat@example.com",
      requester: { id: "alex@example.com", name: "Alex Morgan", email: "alex@example.com" },
      updatedAt: "2026-11-01T00:00:00Z",
    });
  });

  it("reads nobody handling it, and the handling fields of a request", () => {
    expect(toQueueItem({ id: 8, referenceNo: null, title: "T", category: "IT", status: "APPROVED", version: 1, submittedOn: null, updatedOn: "x", priority: null, assigneeEmail: null, requesterName: "A", requesterEmail: "a@example.com" })).toMatchObject({ priority: null, assignee: "" });
    expect(toRequest(detail({ priority: "P2", assigneeEmail: "pat@example.com", collaborators: ["c@example.com"] }))).toMatchObject({ priority: "P2", assignee: "pat@example.com", collaborators: ["c@example.com"] });
  });
});

describe("a Marketing & Events request", () => {
  const eventInput = (patch: Partial<PurchaseRequestInput["event"]> = {}): PurchaseRequestInput => ({
    ...draftToInput({
      ...emptyDraft(),
      category: "EVENTS",
      event: {
        ...emptyEvent(),
        eventType: "INDUSTRY_EVENT_SPONSORSHIP",
        shortlisted: "no",
        name: " KubeCon ",
        startDate: "2027-03-01",
        endDate: "2027-03-03",
        audience: "Platform engineers",
        packageName: "Gold sponsor",
        packageInclusions: ["BOOTH_SPACE"],
        attendedBefore: "yes",
        previousCost: "40000",
        previousPipeline: "300000",
        costs: { ...emptyEvent().costs, SPONSORSHIP_FEE: "60000", SWAG: "", PAYMENT_TO_PARTNER: "2000" },
        otherCosts: [
          { description: "Stickers", amount: "500.5" },
          { description: "Lanyards", amount: "100" },
          { description: "Nothing yet", amount: "" },
        ],
        partnerInvestmentPercent: "20",
        targetAccounts: "10",
        keyAccounts: "Acme",
        newPipeline: "500000",
        roiCalculatorUrl: "https://example.com/roi",
        brandGoal: "Be known",
        ...patch,
      },
    }),
  });

  it("is sent as MARKETING_EVENTS with the event and only the costs that were given", () => {
    const body = toNewRequest(eventInput());
    expect(body.category).toBe("MARKETING_EVENTS");
    expect(body.requirementDetails).toBe("KubeCon");
    expect(body.businessJustification).toBeNull();
    expect(body.roi).toBeNull();
    expect(body.vendors).toEqual([]);
    expect(body.itDetails).toBeNull();
    expect(body.eventDetails).toMatchObject({
      eventType: "INDUSTRY_EVENT_SPONSORSHIP",
      isShortlisted: false,
      eventName: "KubeCon",
      packageInclusions: ["BOOTH_SPACE"],
      targetAccountCount: 10,
      newPipelineAmount: 500000,
      attendedBefore: true,
      previousCost: 40000,
      previousPipeline: 300000,
      partnerInvestmentPercent: 20,
      costs: [
        { category: "SPONSORSHIP_FEE", amount: 60000 },
        { category: "PAYMENT_TO_PARTNER", amount: 2000 },
        { category: "OTHER", description: "Stickers", amount: 500.5 },
        { category: "OTHER", description: "Lanyards", amount: 100 },
      ],
    });
  });

  it("leaves out what a shortlisted event is not asked for, earlier attendance included", () => {
    const shortlisted = toNewRequest(eventInput({ shortlisted: "yes", shortlistLineId: "L-42" })).eventDetails;
    expect(shortlisted).toMatchObject({
      isShortlisted: true,
      shortlistLineId: "L-42",
      targetAccountCount: null,
      newPipelineAmount: null,
      roiCalculatorUrl: null,
      brandGoal: null,
      attendedBefore: null,
      previousCost: null,
      previousPipeline: null,
    });
  });

  it("leaves out the sponsorship package and earlier attendance unless it is an industry sponsorship", () => {
    const other = toNewRequest(eventInput({ eventType: "WSO2CON", prospectusUrl: "https://example.com/p" })).eventDetails;
    expect(other).toMatchObject({
      packageName: null,
      packageInclusions: [],
      prospectusUrl: null,
      attendedBefore: null,
      previousCost: null,
      previousPipeline: null,
    });
  });

  it("is read back into the form's event, with the other costs as their own lines", () => {
    const request = toRequest(
      detail({
        category: "MARKETING_EVENTS",
        eventDetails: {
          eventType: "WSO2_SUMMIT",
          isShortlisted: true,
          shortlistLineId: "L-42",
          eventName: "Summit",
          startDate: "2027-05-01",
          endDate: "2027-05-02",
          audience: "Customers",
          partnerInvestmentPercent: 30,
          costs: [
            { category: "SWAG", amount: 100 },
            { category: "SWAG", amount: 20.5 },
            { category: "PAYMENT_TO_PARTNER", amount: 999 },
            { category: "OTHER", description: "Stickers", amount: 50 },
            { category: "OTHER", description: "Lanyards", amount: 25.5 },
          ],
        },
      }),
    );
    expect(request.category).toBe("EVENTS");
    expect(request.event).toMatchObject({ eventType: "WSO2_SUMMIT", shortlisted: "yes", shortlistLineId: "L-42", name: "Summit", attendedBefore: "" });
    expect(request.event.costs.SWAG).toBe("120.5");
    expect(request.event.costs.PAYMENT_TO_PARTNER).toBe("999");
    expect(request.event.costs.SPONSORSHIP_FEE).toBe("");
    expect(request.event.otherCosts).toEqual([
      { description: "Stickers", amount: "50" },
      { description: "Lanyards", amount: "25.5" },
    ]);
    expect(request.event.partnerInvestmentPercent).toBe("30");
  });

  it("adds up several lines of one cost without leaving a fraction of a cent", () => {
    const request = toRequest(
      detail({
        category: "MARKETING_EVENTS",
        eventDetails: {
          eventType: "WSO2CON",
          eventName: "Con",
          startDate: "2027-05-01",
          endDate: "2027-05-02",
          audience: "Customers",
          costs: [
            { category: "SWAG", amount: 0.07 },
            { category: "SWAG", amount: 0.14 },
          ],
        },
      }),
    );
    expect(request.event.costs.SWAG).toBe("0.21");
  });

  it("is an empty event when the request has none", () => {
    expect(toRequest(detail()).event).toEqual(emptyEvent());
  });
});

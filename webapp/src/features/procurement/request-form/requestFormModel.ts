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

// What the request form holds while it is being filled in, which step is
// missing what, and how a draft becomes the request the backend is sent. All
// pure: the screens only render it.

import { emptyAttachments } from "./attachmentRules";
import type {
  Attachment,
  AttachmentsDraft,
  BudgetDetails,
  Choice,
  EventCostCategory,
  EventDetails,
  PackageInclusion,
  Person,
  ProcurementCategory,
  ProcurementLookups,
  ProcurementMe,
  PurchaseRequest,
  PurchaseRequestInput,
  RequestDetails,
  Vendor,
} from "../types";

/** The largest amount the backend's database holds. */
const MAX_AMOUNT = 999_999_999_999.99;

/** The most the backend keeps of the user or administrator names together. */
const MAX_NAMES_LENGTH = 1000;

/** The most vendors the backend accepts on a request. */
export const MAX_VENDORS = 10;

/** The most characters the backend accepts in an email address. */
const MAX_EMAIL_LENGTH = 254;

/** The shape the backend accepts for an email address. */
const EMAIL_SHAPE = /^[a-z0-9._%+-]+@[a-z0-9.-]+$/i;

/** The most users or administrators the backend accepts a count for. */
const MAX_PEOPLE_COUNT = 100_000;

/** The backend only searches the directory from this many characters. */
export const MIN_DIRECTORY_QUERY = 3;

/** The most additional approvers the backend accepts on a request. */
export const MAX_ADDITIONAL_APPROVERS = 5;

/** How long the software is expected to be used. The backend keeps it as free text, so it is not a looked-up list. */
export const USAGE_PERIODS = [
  "Trial / pilot (under 3 months)",
  "Monthly plan",
  "1 year",
  "2 years",
  "3+ years",
  "Ongoing / perpetual",
  "Other",
] as const;

export const INSTALLATION_TYPES: readonly Choice[] = [
  { value: "SAAS", label: "SaaS or Online" },
  { value: "STANDALONE", label: "Standalone" },
  { value: "BROWSER_EXTENSION", label: "Web browser extension" },
  { value: "PLUGIN", label: "Software plugin" },
  { value: "PORTABLE", label: "Portable application" },
];

/** The kinds of event a Marketing & Events request can be for, with the names a person reads. */
export const EVENT_TYPES: readonly Choice[] = [
  { value: "INDUSTRY_EVENT_SPONSORSHIP", label: "Industry event sponsorship" },
  { value: "WSO2CON", label: "WSO2CON" },
  { value: "WSO2_SUMMIT", label: "WSO2 Summit" },
  { value: "OXYGENATE", label: "Oxygenate" },
  { value: "ROUNDTABLE_LUNCH_AND_LEARN", label: "Roundtable & Lunch & Learn" },
  { value: "OTHER_MARKETING_EVENT", label: "Other marketing events" },
];

/** What a sponsorship package can include, with the names a person reads. */
export const PACKAGE_INCLUSIONS: readonly { value: PackageInclusion; label: string }[] = [
  { value: "BOOTH_SPACE", label: "Booth space" },
  { value: "DELEGATE_PASSES", label: "Delegate passes" },
  { value: "SPEAKING_SLOT", label: "Speaking slot" },
  { value: "LEAD_SCANNING", label: "Lead scanning" },
  { value: "LOGO_PLACEMENT", label: "Logo placement" },
  { value: "ATTENDEE_LIST", label: "Attendee list" },
  { value: "SPONSORED_SESSION", label: "Sponsored session" },
];

/** The fixed lines of an event's total investment, with the names a person reads. */
export const EVENT_COSTS: readonly { value: EventCostCategory; label: string }[] = [
  { value: "SPONSORSHIP_FEE", label: "Sponsorship fee" },
  { value: "BOOTH_BUILD_AND_DESIGN", label: "Booth build and design" },
  { value: "TRAVEL_AND_ACCOMMODATION", label: "Travel and accommodation (estimate)" },
  { value: "SWAG", label: "SWAG" },
  { value: "PRINT_AND_BANNERS", label: "Print and banners" },
  { value: "PAYMENT_TO_PARTNER", label: "Payment to partner" },
];

/** How many times its total investment an event has to return as new pipeline. */
export const REQUIRED_PIPELINE_MULTIPLE = 4;

export const REQUEST_STEPS = ["Requester details", "Procurement category", "Requirement details", "Vendor & budget", "Review & submit"] as const;

/** The requirement step's title, which names the category once one is chosen. */
export function detailsLabel(category: RequestDraft["category"]): string {
  return category === "IT"
    ? "IT requirement details"
    : category === "NON-IT"
      ? "Non-IT requirement details"
      : category === "EVENTS"
        ? "Event details"
        : "Requirement details";
}

/** The budget step's title: an event has no vendors to ask for. */
export function budgetLabel(category: RequestDraft["category"]): string {
  return category === "EVENTS" ? "Budget" : "Vendor & budget";
}

export const STEP_REQUESTER = 1;
export const STEP_CATEGORY = 2;
export const STEP_DETAILS = 3;
export const STEP_BUDGET = 4;
export const STEP_REVIEW = 5;

export interface RequestDraft {
  category: ProcurementCategory | "";
  /** People who may approve besides the team lead, which the backend chooses. */
  additionalApprovers: Person[];
  details: RequestDetails;
  /** The event of a Marketing & Events request; empty for any other category. */
  event: EventDetails;
  vendors: Vendor[];
  budget: BudgetDetails;
  /** The chosen budget approver's id, or "" when none. */
  budgetApproverId: string;
  notes: string;
  /** The files the request holds, those to take off it, and those to upload. */
  attachments: AttachmentsDraft;
  declarationAccepted: boolean;
}

export function emptyDetails(): RequestDetails {
  return {
    product: "",
    plan: "",
    description: "",
    softwareRequirement: "",
    installationType: "",
    userCount: "",
    userNames: [],
    adminCount: "",
    adminNames: [],
    usagePeriod: "",
    externalInteraction: "",
    businessJustification: "",
    roi: "",
    specifications: "",
    sensitiveData: "",
    sensitiveDataDetail: "",
    externalPii: "",
    externalPiiDetail: "",
    employeePii: "",
    employeePiiDetail: "",
    integrates: "",
    integrations: [{ system: "", data: "" }],
    vendorDocs: "",
    vendorDocsLink: "",
  };
}

/** The event of a request that has none yet: nothing chosen, nothing typed. */
export function emptyEvent(): EventDetails {
  return {
    eventType: "",
    shortlisted: "",
    shortlistLineId: "",
    name: "",
    startDate: "",
    endDate: "",
    audience: "",
    packageName: "",
    packageInclusions: [],
    prospectusUrl: "",
    costs: { SPONSORSHIP_FEE: "", BOOTH_BUILD_AND_DESIGN: "", TRAVEL_AND_ACCOMMODATION: "", SWAG: "", PRINT_AND_BANNERS: "", PAYMENT_TO_PARTNER: "" },
    otherCosts: [{ description: "", amount: "" }],
    partnerInvestmentPercent: "",
    targetAccounts: "",
    keyAccounts: "",
    newPipeline: "",
    roiCalculatorUrl: "",
    attendedBefore: "",
    previousCost: "",
    previousPipeline: "",
    brandGoal: "",
  };
}

export function emptyVendor(): Vendor {
  return { name: "", website: "", contact: "", email: "", phone: "" };
}

export function emptyBudget(): BudgetDetails {
  return { category: "", businessUnit: "", product: "", region: "", engagementCode: "", salesforceCampaign: "" };
}

export function emptyDraft(): RequestDraft {
  return {
    category: "",
    additionalApprovers: [],
    details: emptyDetails(),
    event: emptyEvent(),
    vendors: [emptyVendor()],
    budget: emptyBudget(),
    budgetApproverId: "",
    notes: "",
    attachments: emptyAttachments(),
    declarationAccepted: false,
  };
}

/**
 * A rejected request, reopened for editing. The declaration must be made again on resubmit.
 *
 * @param request - The request to reopen
 * @param attachments - The files the request already holds; kept unless the requester removes them
 */
export function draftFromRequest(request: PurchaseRequest, attachments: readonly Attachment[] = []): RequestDraft {
  return {
    category: request.category,
    additionalApprovers: request.additionalApprovers.map((email) => ({ id: email, name: email, email })),
    details: { ...request.details },
    event: {
      ...request.event,
      costs: { ...request.event.costs },
      otherCosts: request.event.otherCosts.length ? request.event.otherCosts.map((c) => ({ ...c })) : [{ description: "", amount: "" }],
      packageInclusions: [...request.event.packageInclusions],
    },
    vendors: request.vendors.length ? request.vendors.map((v) => ({ ...v })) : [emptyVendor()],
    budget: { ...request.budget },
    budgetApproverId: request.budgetApproverId,
    notes: request.notes,
    attachments: { saved: [...attachments], removed: [], files: [] },
    declarationAccepted: false,
  };
}

const blank = (value: string): boolean => value.trim() === "";

/** A count, when given, is a whole number the backend accepts. */
const invalidCount = (value: string): boolean => {
  if (blank(value)) return false;
  const n = Number(value);
  return !Number.isInteger(n) || n < 0 || n > MAX_PEOPLE_COUNT;
};

const labelIn = (list: readonly Choice[], value: string): string => list.find((c) => c.value === value)?.label ?? value;

/**
 * A budget as a person reads it: each code replaced by its label from the
 * lists. A code that is no longer listed is shown as it is.
 *
 * @param engagement - The engagement codes of the budget's business unit
 */
export function budgetForDisplay(budget: BudgetDetails, lookups: ProcurementLookups, engagement: readonly Choice[]): BudgetDetails {
  return {
    category: labelIn(lookups.budgetCategories, budget.category),
    businessUnit: labelIn(lookups.businessUnits, budget.businessUnit),
    product: labelIn(lookups.products, budget.product),
    region: labelIn(lookups.regions, budget.region),
    engagementCode: labelIn(engagement, budget.engagementCode),
    salesforceCampaign: budget.salesforceCampaign,
  };
}

/**
 * What is wrong with one field. `field` is the name the field is given in the
 * form (its `name` prop), so the form can show `message` under it.
 */
export interface Problem {
  field: string;
  message: string;
}

const REQUIRED = "Required";
const PICK = "Select an option";
const WHOLE_NUMBER = "Enter a whole number";
const NAMES_TOO_LONG = `Keep the names to ${MAX_NAMES_LENGTH} characters in total`;
/** How long the names are together, written one per line as the backend keeps them. */
const namesLength = (names: string[]): number => names.map((n) => n.trim()).filter(Boolean).join("\n").length;
const LINK = "Enter a link starting with http:// or https://";
const LINKS = "Enter links starting with http:// or https://, separated by commas";
const AMOUNT = "Enter an amount of 0 or more, with at most two decimals";

/** What an IT request still needs in its requirement details and its assessment. */
function itDetailsProblems(d: RequestDetails): Problem[] {
  const problems: Problem[] = [];
  const need = (field: string, missing: boolean, message = REQUIRED) => missing && problems.push({ field, message });
  need("product", blank(d.product));
  need("plan", blank(d.plan));
  need("description", blank(d.description));
  need("softwareRequirement", blank(d.softwareRequirement));
  need("installationType", !d.installationType, PICK);
  need("usagePeriod", blank(d.usagePeriod), PICK);
  need("businessJustification", blank(d.businessJustification));
  problems.push(...itAssessmentProblems(d));
  return problems;
}

/** What the users, administrators and the data and security questions of an IT request still need. */
function itAssessmentProblems(d: RequestDetails): Problem[] {
  const problems: Problem[] = [];
  const need = (field: string, missing: boolean, message = REQUIRED) => missing && problems.push({ field, message });
  need("externalInteraction", !d.externalInteraction, PICK);
  need("userCount", blank(d.userCount) || invalidCount(d.userCount), WHOLE_NUMBER);
  need("userNames", d.userNames.length === 0 || namesLength(d.userNames) > MAX_NAMES_LENGTH, d.userNames.length === 0 ? "Add at least one name" : NAMES_TOO_LONG);
  need("adminCount", blank(d.adminCount) || invalidCount(d.adminCount), WHOLE_NUMBER);
  need("adminNames", d.adminNames.length === 0 || namesLength(d.adminNames) > MAX_NAMES_LENGTH, d.adminNames.length === 0 ? "Add at least one name" : NAMES_TOO_LONG);
  need("sensitiveData", !d.sensitiveData, PICK);
  need("sensitiveDataDetail", d.sensitiveData === "yes" && blank(d.sensitiveDataDetail));
  need("externalPii", !d.externalPii, PICK);
  need("externalPiiDetail", d.externalPii === "yes" && blank(d.externalPiiDetail));
  need("employeePii", !d.employeePii, PICK);
  need("employeePiiDetail", d.employeePii === "yes" && blank(d.employeePiiDetail));
  need("integrates", !d.integrates, PICK);
  if (d.integrates === "yes") {
    need("integrationSystem", !d.integrations.some((i) => !blank(i.system)));
    need("vendorDocs", !d.vendorDocs, PICK);
    const links = splitLinks(d.vendorDocsLink);
    need("vendorDocsLink", d.vendorDocs === "yes" && (links.length === 0 || links.some(invalidLink)), links.length === 0 ? REQUIRED : LINKS);
  }
  return problems;
}

/** An amount as a number, or NaN when it is blank or not a number. */
const parseAmount = (value: string): number => (blank(value) ? NaN : Number(value));

/** An amount is not negative and has at most two decimals. */
const invalidAmount = (value: string): boolean => {
  if (blank(value)) return false;
  const n = Number(value);
  return !Number.isFinite(n) || n < 0 || n > MAX_AMOUNT || Math.round(n * 100) / 100 !== n;
};

/** The links in a text that holds several, separated by commas or spaces. */
export const splitLinks = (value: string): string[] => value.split(/[\s,]+/).filter(Boolean);

/** Whether a text that is not blank is anything but one http or https link without spaces. */
const invalidLink = (value: string): boolean => {
  if (blank(value)) return false;
  const text = value.trim();
  if (/\s/.test(text)) return true;
  try {
    return !["http:", "https:"].includes(new URL(text).protocol);
  } catch {
    return true;
  }
};

/** The event's total investment: its cost lines added up, a blank or invalid line counting as nothing. */
export function totalInvestment(costs: EventDetails["costs"], otherCosts: EventDetails["otherCosts"]): number {
  const amounts = [...Object.values(costs), ...otherCosts.map((c) => c.amount)];
  const cents = amounts.reduce((sum, value) => sum + (Number.isFinite(parseAmount(value)) ? Math.round(parseAmount(value) * 100) : 0), 0);
  return cents / 100;
}

/** A share, when given, is a whole number from 0 to 100. */
const invalidPercent = (value: string): boolean => {
  if (blank(value)) return false;
  const n = Number(value);
  return !Number.isInteger(n) || n < 0 || n > 100;
};

/** What the event of a Marketing & Events request still needs, by the backend's rules for its type and shortlist status. */
function eventDetailsProblems(e: EventDetails): Problem[] {
  const problems: Problem[] = [];
  const need = (field: string, missing: boolean, message = REQUIRED) => missing && problems.push({ field, message });
  need("eventType", !e.eventType, PICK);
  need("shortlisted", !e.shortlisted, PICK);
  need("shortlistLineId", e.shortlisted === "yes" && blank(e.shortlistLineId));
  need("eventName", blank(e.name));
  need("startDate", blank(e.startDate));
  need("endDate", blank(e.endDate));
  if (!blank(e.startDate) && !blank(e.endDate)) need("endDate", e.endDate < e.startDate, "End date must be on or after the start date");
  need("audience", blank(e.audience));
  const industry = e.eventType === "INDUSTRY_EVENT_SPONSORSHIP";
  if (industry) {
    need("packageName", blank(e.packageName));
    need("prospectusUrl", invalidLink(e.prospectusUrl), LINK);
  }
  for (const [category, value] of Object.entries(e.costs)) need(`cost.${category}`, invalidAmount(value), AMOUNT);
  e.otherCosts.forEach((line, index) => {
    need(`otherCost.${index}.amount`, invalidAmount(line.amount), AMOUNT);
    need(`otherCost.${index}.description`, !blank(line.amount) && blank(line.description));
  });
  need("partnerPercent", invalidPercent(e.partnerInvestmentPercent), "Enter a whole number from 0 to 100");
  const total = totalInvestment(e.costs, e.otherCosts);
  need("cost.SPONSORSHIP_FEE", total <= 0 && !problems.some((p) => p.field.startsWith("cost.") || p.field.startsWith("otherCost.")), "Add at least one cost");
  if (e.shortlisted === "yes") return problems;
  if (industry) {
    need("attendedBefore", !e.attendedBefore, PICK);
    if (e.attendedBefore === "yes") {
      need("previousCost", blank(e.previousCost) || invalidAmount(e.previousCost), blank(e.previousCost) ? REQUIRED : AMOUNT);
      need("previousPipeline", blank(e.previousPipeline) || invalidAmount(e.previousPipeline), blank(e.previousPipeline) ? REQUIRED : AMOUNT);
    }
  }
  const accounts = parseAmount(e.targetAccounts);
  need("targetAccounts", blank(e.targetAccounts) || !Number.isInteger(accounts) || accounts < 0 || accounts > MAX_PEOPLE_COUNT, WHOLE_NUMBER);
  need("keyAccounts", accounts > 0 && blank(e.keyAccounts));
  const pipeline = parseAmount(e.newPipeline);
  need("newPipeline", blank(e.newPipeline) || invalidAmount(e.newPipeline), blank(e.newPipeline) ? REQUIRED : AMOUNT);
  need("roiCalculatorUrl", blank(e.roiCalculatorUrl) || invalidLink(e.roiCalculatorUrl), blank(e.roiCalculatorUrl) ? REQUIRED : LINK);
  if (Number.isFinite(pipeline) && total > 0 && pipeline < total * REQUIRED_PIPELINE_MULTIPLE && !invalidAmount(e.newPipeline)) {
    need("newPipeline", true, `Must be at least ${REQUIRED_PIPELINE_MULTIPLE}x the total investment`);
  }
  return problems;
}

/** What a Non-IT request still needs in its requirement details. */
function nonItDetailsProblems(d: RequestDetails): Problem[] {
  const problems: Problem[] = [];
  if (blank(d.description)) problems.push({ field: "description", message: REQUIRED });
  if (blank(d.businessJustification)) problems.push({ field: "businessJustification", message: REQUIRED });
  return problems;
}

/** What the budget details and approver of a Non-IT or Marketing & Events request still need, and what is wrong with the vendors. */
function budgetProblems(draft: RequestDraft): Problem[] {
  const problems: Problem[] = [];
  if (draft.category === "NON-IT" || draft.category === "EVENTS") {
    const b = draft.budget;
    const need = (field: string, missing: boolean) => missing && problems.push({ field, message: PICK });
    need("budgetCategory", blank(b.category));
    need("businessUnit", blank(b.businessUnit));
    need("budgetProduct", blank(b.product));
    need("region", blank(b.region));
    need("engagementCode", blank(b.engagementCode));
    need("budgetApprover", draft.category === "NON-IT" && blank(draft.budgetApproverId));
  }
  if (draft.category !== "EVENTS") {
    draft.vendors.forEach((v, index) => {
      const given = [v.website, v.contact, v.email, v.phone].some((value) => !blank(value));
      if (blank(v.name) && given) problems.push({ field: `vendorName.${index}`, message: "Add the vendor's name" });
      if (invalidLink(v.website)) problems.push({ field: `vendorWebsite.${index}`, message: LINK });
      if (!blank(v.email) && (v.email.trim().length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(v.email.trim()))) {
        problems.push({ field: `vendorEmail.${index}`, message: "Enter a valid email address" });
      }
    });
  }
  return problems;
}

/**
 * What a step still needs, one problem per field. Empty means the step is complete.
 *
 * @param me - The signed-in user, who may not approve their own request
 */
export function problemsForStep(step: number, draft: RequestDraft, me: ProcurementMe): Problem[] {
  switch (step) {
    case STEP_REQUESTER: {
      // With no manager on record, the first additional approver becomes the team lead.
      if (!me.teamLead && !me.approvalExempt && draft.additionalApprovers.length === 0) {
        return [{ field: "additionalApprovers", message: "Add a team lead or an additional approver" }];
      }
      const notAllowed = draft.additionalApprovers.some(
        (a) => isSamePerson(a, me) || (me.teamLead !== null && isSamePerson(a, me.teamLead)),
      );
      return notAllowed ? [{ field: "additionalApprovers", message: "Remove yourself and your team lead from the approvers" }] : [];
    }
    case STEP_CATEGORY:
      return draft.category ? [] : [{ field: "category", message: "Choose a category" }];
    case STEP_DETAILS:
      return draft.category === "IT"
        ? itDetailsProblems(draft.details)
        : draft.category === "NON-IT"
          ? nonItDetailsProblems(draft.details)
          : draft.category === "EVENTS"
            ? eventDetailsProblems(draft.event)
            : [{ field: "category", message: "Choose a category" }];
    case STEP_BUDGET:
      return budgetProblems(draft);
    default:
      return [];
  }
}

/** Every step before review, in order, with what each is missing; steps that are complete are left out. */
export function incompleteSteps(draft: RequestDraft, me: ProcurementMe): { step: number; problems: Problem[] }[] {
  return [STEP_REQUESTER, STEP_CATEGORY, STEP_DETAILS, STEP_BUDGET]
    .map((step) => ({ step, problems: problemsForStep(step, draft, me) }))
    .filter((s) => s.problems.length > 0);
}

export function isSamePerson(a: Person, b: Person): boolean {
  return a.id === b.id || a.email.toLowerCase() === b.email.toLowerCase();
}

const cleanList = (values: string[]): string[] => values.map((v) => v.trim()).filter(Boolean);

/** Whether two categories are submitted under the same declaration: Marketing & Events has its own. */
export const sharesDeclaration = (from: RequestDraft["category"], to: RequestDraft["category"]): boolean =>
  (from === "EVENTS") === (to === "EVENTS");

/** The notes a request is sent with: a shortlisted event is not asked for any, so none it held are kept. */
export const submittedNotes = (draft: RequestDraft): string =>
  draft.category === "EVENTS" && draft.event.shortlisted === "yes" ? "" : draft.notes;

/**
 * The request the backend is sent. The requester, status and dates are not in
 * it: the server takes them from the token and its own clock.
 *
 * @throws When the draft has no category; callers check `incompleteSteps` first
 */
export function draftToInput(draft: RequestDraft): PurchaseRequestInput {
  if (!draft.category) throw new Error("The request is incomplete.");
  const d = draft.details;
  return {
    category: draft.category,
    additionalApprovers: draft.additionalApprovers.map((a) => a.email),
    details: {
      ...d,
      userNames: cleanList(d.userNames),
      adminNames: cleanList(d.adminNames),
      integrations: d.integrates === "yes" ? d.integrations.filter((i) => !blank(i.system)) : [],
    },
    event: draft.category === "EVENTS" ? draft.event : emptyEvent(),
    vendors: draft.category === "EVENTS" ? [] : draft.vendors.filter((v) => !blank(v.name)),
    budget: draft.budget,
    budgetApproverId: draft.budgetApproverId,
    notes: submittedNotes(draft),
    attachments: draft.attachments,
    declarationAccepted: draft.declarationAccepted,
  };
}

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

// The wizard's form model and its conversions. Pure functions only, so every
// mapping is unit-tested without rendering anything.
//
//   saved version ──fromVersion──▶ form values ──toDraftInput──▶ save request
//                                        └──────toPreviewBody──▶ live pricing request

import type {
  Address,
  AddressInput,
  BillingFrequency,
  ContactInput,
  DealKind,
  DealType,
  DraftInput,
  DraftResponse,
  LineCategory,
  LineFormula,
  Partner,
  PricingMethod,
  PricingPreview,
} from "@features/sales/cado2/quotes/api/quoteTypes";
import { sumMoney } from "@features/sales/cado2/utils/money";
import { cleanLegalText, isEmptyLegalText } from "@features/sales/cado2/utils/legalRichText";

/**
 * Contact: none yet, or one of the opportunity's contacts in Salesforce
 * (D124). "manual" is a contact typed in before D124: shown, kept until
 * replaced, but it can't be submitted.
 */
export interface ContactValue {
  mode: "none" | "salesforce" | "manual";
  sfContactId: string;
  name: string;
  title: string;
  email: string;
}

/** Address as the rep sees and edits it. */
export interface AddressValue {
  sfAccountId: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  taxId: string;
}

/** One line; product fields are for display and come from the price book. */
/** A saved line's pricing (D82): the price book, or a formula version with how it worked the price out. */
export interface KeptPricing {
  method: PricingMethod;
  formulaVersionId: number | null;
  formula: LineFormula | null;
}

export interface LineValue {
  /** Id of the saved line this came from; keeps its stored price. */
  lineId: number | null;
  pricebookEntryId: string;
  /** The Salesforce product: tells a formula-priced one (D81). Absent on lines from before it was kept. */
  productId?: string;
  /** How a saved line was priced (D82); absent on a new line. */
  keepPricing?: KeptPricing;
  /**
   * The AM moved this saved line to its product's pricing in force: the
   * latest formula version, or the price book (D82). Set only by the line
   * dialog; without it a saved line keeps its pricing.
   */
  useLatestPricing?: boolean;
  productName: string;
  productCode: string;
  /** The product's Salesforce description; "" when it has none. */
  productDescription: string;
  /** The line's price book; "" for lines saved before it was sent. */
  pricebookId: string;
  pricebookName: string;
  unitPrice: string;
  /**
   * The line's group on the order form, from its product's Salesforce
   * classification (D152); "" when that classification isn't set up, so the
   * line can't be quoted.
   */
  category: LineCategory | "";
  /**
   * Charged every year (else once), from the same classification, as the
   * backend says (D152). The category only places the line in an order-form
   * section.
   */
  recurring: boolean;
  /** The product's Salesforce classification (e.g. PS, CL); "" when unknown. CL is SaaS, PS on-prem. */
  classification: string;
  unitOfMeasure: string;
  quantity: string;
  discount: string;
  /** The contract year the line belongs to, 1-based. */
  yearNumber: number;
  /**
   * A one-off line's dates within its year, as picked: they stay put when the
   * term moves ("" only for a line not yet dated: the year's start, and the
   * end its start). Always "" for a recurring line, which covers its whole
   * year (D146).
   */
  startDate: string;
  endDate: string;
  /**
   * The unit price charged: "" = the list price (unitPrice).
   * The AM may raise it, never lower it; a formula-priced line has none.
   */
  salesPrice: string;
  /** The line's own key in the form, stable as lines move. */
  key: string;
}

let lineKeys = 0;
/** A new line's key, unique in the page. */
export const newLineKey = () => `line-${Date.now().toString(36)}-${++lineKeys}`;

/** The most contract years a quote can have (D85). */
export const MAX_YEARS = 10;

/** The billing choices, in the order shown (D85, D86). */
export const BILLING_OPTIONS: readonly BillingFrequency[] = ["MONTHLY", "QUARTERLY", "ANNUAL", "UPFRONT", "SPECIAL_TERMS"];

export interface DraftFormValues {
  // Step 1 — the quote's identity is fixed after the first save (UI choice 3).
  accountId: string;
  accountName: string;
  accountAddress: Address | null;
  /** From Salesforce: required to quote (approvals will route on it). "" = none. */
  accountSalesRegion: string;
  /** From Salesforce; optional. "" = none. */
  accountSubRegion: string;
  opportunityId: string;
  opportunityName: string;
  /** The opportunity's primary quote, synced to Salesforce (D68): a setting of the quote. */
  isPrimary: boolean;
  dealType: DealType | null;
  partner: Pick<Partner, "id" | "name" | "role" | "billingAddress"> | null;
  /**
   * What Salesforce's record type says the deal is, shown read-only;
   * "" before an opportunity is chosen. isRenewal follows it.
   */
  dealKind: DealKind | "";
  recordTypeName: string;
  isRenewal: boolean;
  previousOpportunityIds: string[];
  legalEntityId: string;
  currencyIsoCode: string;
  /** The quote's price book; "" until the rep chooses. New lines are priced from it by default. */
  defaultPricebookId: string;
  defaultPricebookName: string;
  /** Every quote has a start date. */
  startDate: string;
  // Step 2 — the contract years: 12 months each from the
  // start; only the last may be shorter. The AM adds them; nothing is split
  // automatically.
  /** 0 = no year yet. */
  yearCount: number;
  /** The last year's end when the AM shortened it; "" = a full 12 months. */
  lastYearEndDate: string;
  /** With a recurring line (D85); annually in advance unless changed. */
  billingFrequency: BillingFrequency | "";
  /** Partner-led quotes only: the partner's commission %, "" until entered. */
  partnerCommissionPercent: string;
  /**
   * D151: each contract year's commission, in order, when they differ; [] =
   * partnerCommissionPercent for every year.
   */
  partnerCommissionByYear: string[];
  lines: LineValue[];
  // Step 3
  netTermsDays: "" | "30" | "45" | "60";
  poNumber: string;
  specialTermsEnabled: boolean;
  specialTerms: string;
  // Step 4 — Legal: section 04 blocks the AM marks
  // non-standard (Legal writes them), and the partner agreement.
  termsOnPremNonStandard: boolean;
  termsSaasNonStandard: boolean;
  /** The agreement's name when the partner role names none; "" otherwise. */
  partnerContractName: string;
  /** YYYY-MM-DD; "" until entered. */
  partnerContractDate: string;
  /**
   * Governing terms Legal already wrote for a non-standard block, on an
   * earlier version or the quote this one was cloned from (D109). Shown
   * read-only; never sent: Legal reviews them again.
   */
  legalTexts: { readonly ONPREM: string; readonly SAAS: string };
  billTo: AddressValue;
  shipTo: AddressValue;
  shipToSameAsBillTo: boolean;
  billingContact: ContactValue;
  securityContact: ContactValue;
  /** D165: where legal notices go; optional. */
  legalContact: ContactValue;
  justification: string;
}

export const emptyContact: ContactValue = {
  mode: "none",
  sfContactId: "",
  name: "",
  title: "",
  email: "",
};

export const emptyAddress: AddressValue = {
  sfAccountId: "",
  companyName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
  taxId: "",
};

export function emptyDraftForm(): DraftFormValues {
  return {
    accountId: "",
    accountName: "",
    accountAddress: null,
    accountSalesRegion: "",
    accountSubRegion: "",
    opportunityId: "",
    opportunityName: "",
    isPrimary: false,
    dealType: null,
    partner: null,
    dealKind: "",
    recordTypeName: "",
    isRenewal: false,
    previousOpportunityIds: [],
    legalEntityId: "",
    currencyIsoCode: "",
    defaultPricebookId: "",
    defaultPricebookName: "",
    startDate: "",
    yearCount: 1, // Year 1, always there: a full year from the start; the AM adds more
    lastYearEndDate: "",
    billingFrequency: "ANNUAL",
    partnerCommissionPercent: "",
    partnerCommissionByYear: [],
    lines: [],
    netTermsDays: "",
    poNumber: "",
    specialTermsEnabled: false,
    specialTerms: "",
    termsOnPremNonStandard: false,
    termsSaasNonStandard: false,
    partnerContractName: "",
    partnerContractDate: "",
    legalTexts: { ONPREM: "", SAAS: "" },
    billTo: { ...emptyAddress },
    shipTo: { ...emptyAddress },
    shipToSameAsBillTo: false,
    billingContact: { ...emptyContact },
    securityContact: { ...emptyContact },
    legalContact: { ...emptyContact },
    justification: "",
  };
}

// ---------------------------------------------------------------------------
// Dates (local calendar dates as "YYYY-MM-DD"; never through toISOString,
// which is UTC and shifts the day near midnight)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** Formats a local Date as "YYYY-MM-DD". */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local Date, or null. */
export function parseDateString(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toDateString(d) === s ? d : null;
}

/**
 * End date of a term of `years` starting on `start`: the day before the
 * anniversary (1 Jan 2027 + 3 years → 31 Dec 2029). A 29 Feb start rolls to
 * 28 Feb, matching the backend's month-end clamping.
 */
export function endDateFor(start: string, years: number): string {
  const d = parseDateString(start);
  if (!d) return "";
  const anniversary = new Date(d.getFullYear() + years, d.getMonth(), 1);
  const lastDay = new Date(anniversary.getFullYear(), anniversary.getMonth() + 1, 0).getDate();
  anniversary.setDate(Math.min(d.getDate(), lastDay));
  anniversary.setDate(anniversary.getDate() - 1);
  return toDateString(anniversary);
}

// ---------------------------------------------------------------------------
// Subscription term
// ---------------------------------------------------------------------------

/** Lines with a discount above 0%; any makes the justification required. */
export const discountedLines = (lines: readonly { discount: string }[]) => lines.filter((l) => Number(l.discount) > 0).length;

/** The groups, in the order form's words; a product's comes from its classification (D152). */
export const LINE_CATEGORIES: readonly { value: LineCategory; label: string }[] = [
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "SUPPORT", label: "Support" },
  { value: "PROFESSIONAL_SERVICE", label: "Professional Services" },
];

/** Subscription and Support lines repeat yearly; a Professional Service doesn't. */


/** Whether the quote needs a subscription term: any recurring line. */
/** Whether any line is charged every year, so a subscription term is needed (D37, D76). */
export const hasRecurring = (lines: readonly { readonly recurring: boolean }[]) => lines.some((l) => l.recurring);

/** `start` moved by whole months, the day clamped to the month's last (as the backend counts). */
function addMonths(start: Date, months: number): Date {
  const first = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(start.getDate(), last));
}

/**
 * How long a term is, both days included, in words (D85), exactly as the
 * backend says it: "1 year", "3 years", "1 year + 1 day", "11 months + 30
 * days", "2 years + 3 months". "" when a date is missing or the end is before the start.
 */
export function durationText(start: string, end: string): string {
  const d = durationParts(start, end);
  if (!d) return "";
  const part = (n: number, unit: string) => (n === 1 ? `1 ${unit}` : n > 1 ? `${n} ${unit}s` : "");
  return [part(d.years, "year"), part(d.months, "month"), part(d.days, "day")].filter(Boolean).join(" + ");
}

/** The same duration, short, for the products table's Term column (D94, D96): "1Y 1M 1D", "3Y", "11M 30D". */
export function durationShort(start: string, end: string): string {
  const d = durationParts(start, end);
  if (!d) return "";
  return [d.years && `${d.years}Y`, d.months && `${d.months}M`, d.days && `${d.days}D`].filter(Boolean).join(" ");
}

/** Whole years, then whole months, then days, from the start to the end (both inclusive). */
function durationParts(start: string, end: string): { years: number; months: number; days: number } | null {
  const s = parseDateString(start);
  const e = parseDateString(end);
  if (!s || !e || e < s) return null;
  const whole = (months: number) => {
    const last = addMonths(s, months);
    last.setDate(last.getDate() - 1);
    return last <= e;
  };
  let years = 0;
  while (whole(12 * (years + 1))) years++;
  let months = 0;
  while (months < 11 && whole(12 * years + months + 1)) months++;
  const from = addMonths(s, 12 * years + months);
  const days = Math.round((e.getTime() - from.getTime()) / 86_400_000) + 1;
  return { years, months, days };
}

// ---------------------------------------------------------------------------
// Contract years
// ---------------------------------------------------------------------------

/** One contract year. */
export interface ContractYear {
  readonly number: number;
  readonly start: string;
  readonly end: string;
}

/**
 * The contract years, as the backend lays them out: Year n starts 12 × (n−1)
 * months after the start and runs 12 months; the last ends on `lastEnd` when
 * it is set and within that year. Empty without a start or a year.
 */
export function contractYears(start: string, count: number, lastEnd = ""): ContractYear[] {
  const s = parseDateString(start);
  if (!s || count < 1) return [];
  const years: ContractYear[] = [];
  for (let n = 1; n <= count; n++) {
    years.push({ number: n, start: toDateString(addMonths(s, 12 * (n - 1))), end: endDateFor(start, n) });
  }
  const last = years[count - 1];
  if (lastEnd && lastEnd >= last.start && lastEnd <= last.end) years[count - 1] = { ...last, end: lastEnd };
  return years;
}

/** The form's contract years. */
export const formYears = (v: Pick<DraftFormValues, "startDate" | "yearCount" | "lastYearEndDate">) =>
  contractYears(v.startDate, v.yearCount, v.lastYearEndDate);

/** The contract's end: the last year's end; "" without a year. */
export const contractEnd = (v: Pick<DraftFormValues, "startDate" | "yearCount" | "lastYearEndDate">) =>
  formYears(v).at(-1)?.end ?? "";

/** Why the last year's end is not allowed, or "" (within its year, at most 12 months). */
export function lastYearEndProblem(start: string, count: number, lastEnd: string): string {
  if (!lastEnd || count < 1) return "";
  const last = contractYears(start, count).at(-1);
  if (!last) return "";
  if (lastEnd < last.start) return `Year ${count} must end on or after it starts (${formatDate(last.start)})`;
  if (lastEnd > last.end) return `Year ${count} can be at most 12 months: end by ${formatDate(last.end)}`;
  return "";
}

/**
 * A line's dates (D146): a recurring line its whole year; a one-off line its
 * own, the start defaulting to the year's and the end to the start. Null
 * without its year.
 */
export function lineDates(
  l: Pick<LineValue, "yearNumber" | "startDate" | "endDate" | "recurring">,
  years: readonly ContractYear[],
): { start: string; end: string } | null {
  const y = years[l.yearNumber - 1];
  if (!y) return null;
  if (l.recurring) return { start: y.start, end: y.end };
  const start = l.startDate || y.start;
  return { start, end: l.endDate || start };
}

/** Why a line's dates are not allowed in its year, or "". */
export function lineDatesProblem(
  l: Pick<LineValue, "yearNumber" | "startDate" | "endDate" | "recurring">,
  years: readonly ContractYear[],
): string {
  const y = years[l.yearNumber - 1];
  const d = lineDates(l, years);
  if (!y || !d) return "";
  if (d.start < y.start || d.start > y.end || d.end > y.end)
    return `Dates must fall within Year ${y.number}: ${formatDate(y.start)} – ${formatDate(y.end)}`;
  if (d.end < d.start) return "The end date must not be before the start date";
  return "";
}

/** A date moved by whole years, the day clamped to the month's end. */
function shiftYears(date: string, years: number): string {
  const d = parseDateString(date);
  return d ? toDateString(addMonths(d, 12 * years)) : "";
}

/**
 * Clone year `from` into a new year at the end: only its recurring lines,
 * as new lines (priced as today), dates moved into the new year and kept
 * within it. A line covering its whole year covers the whole new one.
 */
export function cloneYear(v: Pick<DraftFormValues, "startDate" | "yearCount" | "lastYearEndDate" | "lines">, from: number) {
  const yearCount = v.yearCount + 1;
  const years = contractYears(v.startDate, yearCount);
  const to = years[yearCount - 1];
  const gap = yearCount - from;
  const within = (d: string, fallback: string) => (d ? (d < to.start ? to.start : d > to.end ? to.end : d) : fallback);
  // Recurring products only.
  const copies = v.lines
    .filter((l) => l.yearNumber === from && l.recurring)
    .map((l) => ({
      ...l,
      key: newLineKey(),
      // A new line: priced as today, not kept to the copied line's pricing (D82).
      keepPricing: undefined,
      useLatestPricing: undefined,
      lineId: null,
      yearNumber: yearCount,
      startDate: within(l.startDate && shiftYears(l.startDate, gap), ""),
      endDate: within(l.endDate && shiftYears(l.endDate, gap), ""),
    }));
  return { yearCount, lastYearEndDate: "", lines: [...v.lines, ...copies] };
}

/** Adds an empty year at the end; the year before it becomes a full 12 months. */
export const addYear = (v: Pick<DraftFormValues, "yearCount">) => ({ yearCount: v.yearCount + 1, lastYearEndDate: "" });

/**
 * Deletes year `n` and its products, from anywhere in the list. Later years
 * move up: renumbered and 12 months earlier, their products' own dates too.
 * A shortened last year keeps its length when it moves up; deleting the last
 * year leaves the new last one a full 12 months.
 */
export function deleteYear(v: Pick<DraftFormValues, "yearCount" | "lastYearEndDate" | "lines">, n: number) {
  // The only year stays: a quote always has Year 1.
  if (v.yearCount <= 1) return { yearCount: v.yearCount, lastYearEndDate: v.lastYearEndDate, lines: v.lines };
  const back = (d: string) => (d ? shiftYears(d, -1) : d);
  return {
    yearCount: v.yearCount - 1,
    lastYearEndDate: n < v.yearCount && v.lastYearEndDate ? back(v.lastYearEndDate) : "",
    lines: v.lines
      .filter((l) => l.yearNumber !== n)
      .map((l) => (l.yearNumber > n ? { ...l, yearNumber: l.yearNumber - 1, startDate: back(l.startDate), endDate: back(l.endDate) } : l)),
  };
}

/**
 * Where a new line for year `n` goes: after the last line of that year (or
 * of an earlier one), so line numbers run year by year wherever they show.
 */
export const insertIndex = (lines: readonly Pick<LineValue, "yearNumber">[], n: number) =>
  lines.reduce((at, l, i) => (l.yearNumber <= n ? i + 1 : at), 0);

/**
 * The last year's end, as stored: "" when it's a full 12 months. Its recurring
 * lines follow it; its one-off lines keep their dates, and it can't end
 * before them (lastYearEarliestEnd, D146).
 */
export function setLastYearEnd(v: Pick<DraftFormValues, "startDate" | "yearCount">, end: string) {
  return end === contractYears(v.startDate, v.yearCount).at(-1)?.end ? "" : end;
}

/**
 * The earliest the last year may end (D146): the latest end of its one-off
 * lines, with that line's product; null when none holds it back.
 */
export function lastYearEarliestEnd(
  v: Pick<DraftFormValues, "startDate" | "yearCount" | "lastYearEndDate" | "lines">,
): { date: string; productName: string } | null {
  const years = formYears(v);
  let earliest: { date: string; productName: string } | null = null;
  for (const l of v.lines) {
    if (l.recurring || l.yearNumber !== v.yearCount) continue;
    const d = lineDates(l, years);
    if (d && (!earliest || d.end > earliest.date)) earliest = { date: d.end, productName: l.productName };
  }
  return earliest;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** Splits a Salesforce street: line 1 = first line, line 2 = the rest (UI choice 2). */
export function splitStreet(street: string | null | undefined): [string, string] {
  const lines = (street ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return [lines[0] ?? "", lines.slice(1).join(", ")];
}

/** Pre-fills an address from a Salesforce account (the rep can edit it). */
export function addressFrom(sfAccountId: string, companyName: string, a: Address | null): AddressValue {
  const [line1, line2] = splitStreet(a?.street);
  return {
    ...emptyAddress,
    sfAccountId,
    companyName,
    addressLine1: line1,
    addressLine2: line2,
    city: a?.city ?? "",
    stateProvince: a?.stateProvince ?? "",
    postalCode: a?.postalCode ?? "",
    country: a?.country ?? "",
  };
}

// ---------------------------------------------------------------------------
// Saved version → form
// ---------------------------------------------------------------------------

function contactFrom(res: DraftResponse, role: "BILLING" | "SECURITY" | "LEGAL"): ContactValue {
  const c = res.version.contacts.find((x) => x.role === role);
  if (!c) return { ...emptyContact };
  return {
    mode: c.source === "SALESFORCE" ? "salesforce" : "manual",
    sfContactId: c.sfContactId ?? "",
    name: c.name,
    title: c.title ?? "",
    email: c.email ?? "",
  };
}

function addressFromView(res: DraftResponse, type: "BILL_TO" | "SHIP_TO"): AddressValue {
  const a = res.version.addresses.find((x) => x.type === type);
  if (!a) return { ...emptyAddress };
  return {
    sfAccountId: a.sfAccountId ?? "",
    companyName: a.companyName,
    addressLine1: a.addressLine1 ?? "",
    addressLine2: a.addressLine2 ?? "",
    city: a.city ?? "",
    stateProvince: a.stateProvince ?? "",
    postalCode: a.postalCode ?? "",
    country: a.country ?? "",
    taxId: a.taxId ?? "",
  };
}

/** Form values for a saved draft. */
/** The text Legal wrote for a non-standard block; "" when none. */
function legalTextOf(legal: DraftResponse["version"]["legal"], kind: "ONPREM" | "SAAS"): string {
  const b = legal?.sections.blocks.find((x) => x.kind === kind);
  return b?.nonStandard && !isEmptyLegalText(b.text) ? b.text : "";
}

export function fromVersion(res: DraftResponse): DraftFormValues {
  const v = res.version;
  const start = v.subscriptionStartDate ?? "";
  // A quote always has Year 1 (2026-10-26); a draft saved without years gets it.
  const yearCount = Math.max(1, v.yearCount ?? 0);
  // The last year's end only when shortened: a full year is the default.
  const lastEnd = v.years?.at(-1)?.endDate ?? "";
  const fullEnd = contractYears(start, yearCount).at(-1)?.end ?? "";
  // Each line keeps its year; a one-off line its own dates.
  const shipTo = res.version.addresses.find((a) => a.type === "SHIP_TO");
  return {
    ...emptyDraftForm(),
    accountId: res.quote.sfAccountId,
    isPrimary: res.quote.isPrimary,
    accountName: v.accountName ?? "",
    accountSalesRegion: v.accountSalesRegion ?? "",
    accountSubRegion: v.accountSubRegion ?? "",
    opportunityId: res.quote.sfOpportunityId,
    opportunityName: v.opportunityName ?? "",
    dealType: v.dealType,
    partner: v.partner
      ? {
          id: v.partner.sfAccountId,
          name: v.partner.name,
          role: v.partner.role,
          billingAddress: null,
        }
      : null,
    dealKind: v.dealKind,
    recordTypeName: v.opportunityRecordType ?? "",
    isRenewal: v.isRenewal,
    previousOpportunityIds: v.previousOpportunities.map((p) => p.sfOpportunityId),
    legalEntityId: v.legalEntityId ? String(v.legalEntityId) : "",
    currencyIsoCode: v.currencyIsoCode ?? "",
    defaultPricebookId: v.defaultPricebook?.id ?? "",
    defaultPricebookName: v.defaultPricebook?.name ?? "",
    startDate: start,
    yearCount,
    lastYearEndDate: lastEnd && lastEnd !== fullEnd ? lastEnd : "",
    billingFrequency: v.billingFrequency ?? "ANNUAL",
    partnerCommissionPercent: v.partnerCommissionPercent ? String(Number(v.partnerCommissionPercent)) : "",
    partnerCommissionByYear: (v.partnerCommissionByYear ?? []).map((r) => String(Number(r))),
    lines: v.lines.map((l) => ({
      lineId: l.id,
      pricebookEntryId: l.pricebookEntryId,
      productId: l.sfProductId,
      keepPricing: {
        method: l.pricingMethod ?? "PRICE_BOOK",
        formulaVersionId: l.formula?.versionId ?? null,
        formula: l.formula ?? null,
      },
      productName: l.productName,
      productCode: l.productCode ?? "",
      productDescription: l.productDescription ?? "",
      pricebookId: l.pricebookId ?? "",
      pricebookName: l.pricebookName,
      unitPrice: l.unitPrice,
      category: l.category,
      recurring: l.recurring,
      classification: l.classification ?? "",
      unitOfMeasure: l.unitOfMeasure ?? "",
      quantity: String(l.quantity),
      discount: String(Number(l.discountPercent)),
      yearNumber: l.yearNumber ?? 0,
      // A one-off line's real dates, kept when the term moves (D146). A
      // recurring line takes its year's.
      startDate: !l.recurring ? (l.startDate ?? "") : "",
      endDate: !l.recurring ? (l.endDate ?? "") : "",
      salesPrice: l.salesPrice && Number(l.salesPrice) !== Number(l.unitPrice) ? plainDecimal(l.salesPrice) : "",
      key: `saved-${l.id}`,
    })),
    netTermsDays: (["30", "45", "60"] as const).find((n) => String(v.netTermsDays) === n) ?? "",
    poNumber: v.poNumber ?? "",
    specialTermsEnabled: v.specialTerms.enabled,
    specialTerms: v.specialTerms.text ?? "",
    termsOnPremNonStandard: v.termsOnPremNonStandard ?? false,
    termsSaasNonStandard: v.termsSaasNonStandard ?? false,
    partnerContractName: v.partnerContractName ?? "",
    partnerContractDate: v.partnerContractDate ?? "",
    legalTexts: {
      ONPREM: legalTextOf(v.legal, "ONPREM"),
      SAAS: legalTextOf(v.legal, "SAAS"),
    },
    billTo: addressFromView(res, "BILL_TO"),
    shipTo: addressFromView(res, "SHIP_TO"),
    shipToSameAsBillTo: shipTo?.source === "SAME_AS_BILL_TO",
    billingContact: contactFrom(res, "BILLING"),
    securityContact: contactFrom(res, "SECURITY"),
    legalContact: contactFrom(res, "LEGAL"),
    justification: v.justification ?? "",
  };
}

// ---------------------------------------------------------------------------
// Form → requests
// ---------------------------------------------------------------------------

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

function contactInput(c: ContactValue): ContactInput | undefined {
  if (c.mode === "salesforce" && c.sfContactId) return { sfContactId: c.sfContactId };
  if (c.mode === "manual" && (c.name.trim() || c.email.trim())) {
    return { name: opt(c.name), email: opt(c.email), title: opt(c.title) };
  }
  return undefined;
}

function addressInput(a: AddressValue): AddressInput | undefined {
  const out: AddressInput = {
    sfAccountId: opt(a.sfAccountId),
    companyName: opt(a.companyName),
    addressLine1: opt(a.addressLine1),
    addressLine2: opt(a.addressLine2),
    city: opt(a.city),
    stateProvince: opt(a.stateProvince),
    postalCode: opt(a.postalCode),
    country: opt(a.country),
    taxId: opt(a.taxId),
  };
  return Object.values(out).some((v) => v !== undefined && v !== out.sfAccountId) ? out : undefined;
}

// ---------------------------------------------------------------------------
// Partner commission
// ---------------------------------------------------------------------------

/** Whether the quote is partner-led, so a commission applies. */
export const isPartnerLed = (v: Pick<DraftFormValues, "dealType">) => v.dealType === "PARTNER";

/** Why a commission % is not allowed, or "" when it is: 0–100, at most 2 decimals. */
export function commissionProblem(value: string): string {
  const s = value.trim();
  if (!s) return "Enter the partner's commission (0 if none)";
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s) || Number(s) > 100) return "Use 0 to 100, with at most 2 decimals";
  return "";
}

/** The commission to send: only on a partner-led quote, and only once valid. */
function commissionInput(v: DraftFormValues): string | undefined {
  if (v.partnerCommissionByYear.length > 0) return undefined;
  return isPartnerLed(v) && !commissionProblem(v.partnerCommissionPercent) ? v.partnerCommissionPercent.trim() : undefined;
}

/** The rates per year to send (D151): partner-led, set, and every one valid. */
export function commissionByYearInput(v: Pick<DraftFormValues, "partnerCommissionByYear" | "dealType">): string[] | undefined {
  const rates = v.partnerCommissionByYear;
  return isPartnerLed(v) && rates.length > 0 && rates.every((r) => !commissionProblem(r)) ? rates.map((r) => r.trim()) : undefined;
}

/** Rates per year in words, equal years together (D151): "Year 1: 15% · Years 2–3: 10%". */
export function commissionRatesText(rates: readonly string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < rates.length; ) {
    let j = i;
    while (j + 1 < rates.length && Number(rates[j + 1]) === Number(rates[i])) j++;
    parts.push(`${j > i ? `Years ${i + 1}–${j + 1}` : `Year ${i + 1}`}: ${Number(rates[i])}%`);
    i = j + 1;
  }
  return parts.join(" · ");
}

/**
 * The rates per year after a year is added, cloned or deleted (D151): a new
 * year takes the last year's rate, a clone its year's, a deleted year's goes.
 * Down to one year, there's one rate again (returned as single).
 */
export function commissionAfterYearChange(
  rates: readonly string[],
  change: { readonly add: true } | { readonly clone: number } | { readonly remove: number },
): { byYear: string[]; single: string | null } {
  if (rates.length === 0) return { byYear: [], single: null };
  const next =
    "add" in change
      ? [...rates, rates[rates.length - 1]]
      : "clone" in change
        ? [...rates, rates[change.clone - 1] ?? rates[rates.length - 1]]
        : rates.filter((_, i) => i !== change.remove - 1);
  return next.length > 1 ? { byYear: next, single: null } : { byYear: [], single: next[0] ?? rates[0] };
}

/** The years of a request, and the billing (every quote, D88). */
function termInput(v: DraftFormValues) {
  return {
    yearCount: v.yearCount > 0 ? v.yearCount : undefined,
    lastYearEndDate: v.yearCount > 0 ? opt(v.lastYearEndDate) : undefined,
    billingFrequency: v.billingFrequency || undefined,
  };
}

/**
 * A line's year, dates and sales price in a request: each only when set (the
 * backend defaults them). A recurring line sends no dates: it covers its year (D146).
 */
function linePlace(l: LineValue) {
  return {
    yearNumber: l.yearNumber,
    startDate: l.recurring ? undefined : opt(l.startDate),
    endDate: l.recurring ? undefined : opt(l.endDate),
    salesPrice: opt(l.salesPrice),
  };
}

/** A decimal string without trailing zeros or a trailing point, never through a float: "27500.50" → "27500.5". */
export const plainDecimal = (v: string): string => v.trim().replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

/**
 * Why a sales price is not allowed, or "": an amount of 0 or more with up to
 * 8 decimals, as Salesforce keeps. Any line may be raised; only a
 * Professional Services line may go below the list price (D171). "" = the
 * list price.
 */
export function salesPriceProblem(salesPrice: string, listPrice: string, services = false): string {
  const s = salesPrice.trim();
  if (!s) return "";
  if (!/^\d+(\.\d{1,8})?$/.test(s)) return "Use an amount with at most 8 decimals";
  if (!services && Number(s) < Number(listPrice))
    return `The sales price can't be below the list price (${Number(listPrice).toFixed(2)}). Only Professional Services can be priced lower`;
  return "";
}

/** The save request body. */
export function toDraftInput(v: DraftFormValues, expectedUpdatedAt?: string): DraftInput {
  return {
    sfOpportunityId: v.opportunityId,
    sfAccountId: v.accountId,
    expectedUpdatedAt,
    isPrimary: v.isPrimary,
    previousOpportunityIds: v.isRenewal ? v.previousOpportunityIds : [],
    legalEntityId: v.legalEntityId ? Number(v.legalEntityId) : undefined,
    currencyIsoCode: opt(v.currencyIsoCode),
    defaultPricebookId: opt(v.defaultPricebookId),
    subscriptionStartDate: opt(v.startDate),
    ...termInput(v),
    partnerCommissionPercent: isPartnerLed(v) && v.partnerCommissionByYear.length === 0 ? opt(v.partnerCommissionPercent) : undefined,
    partnerCommissionByYear: commissionByYearInput(v),
    netTermsDays: v.netTermsDays ? Number(v.netTermsDays) : undefined,
    specialTerms: {
      enabled: v.specialTermsEnabled,
      // Rich text (2026-10-24), cleaned; the editor's empty value is none.
      text: v.specialTermsEnabled ? opt(cleanLegalText(v.specialTerms)) : undefined,
    },
    // No longer used: section 04 is per product type.
    governingTerms: { enabled: false },
    termsOnPremNonStandard: v.termsOnPremNonStandard,
    termsSaasNonStandard: v.termsSaasNonStandard,
    partnerContractName: opt(v.partnerContractName),
    partnerContractDate: opt(v.partnerContractDate),
    poNumber: opt(v.poNumber),
    justification: opt(v.justification),
    contacts: {
      billing: contactInput(v.billingContact),
      security: contactInput(v.securityContact),
      legal: contactInput(v.legalContact),
    },
    billTo: addressInput(v.billTo),
    shipTo: v.shipToSameAsBillTo ? undefined : addressInput(v.shipTo),
    shipToSameAsBillTo: v.shipToSameAsBillTo,
    lines: v.lines.map((l) => ({
      keepSnapshotFromLineId: l.lineId ?? undefined,
      pricebookEntryId: l.pricebookEntryId,
      quantity: Number(l.quantity),
      discountPercent: l.discount.trim() || "0",
      unitOfMeasure: opt(l.unitOfMeasure),
      // A saved line the AM moved to the pricing in force (D82).
      useLatestFormula: l.lineId !== null && l.useLatestPricing ? true : undefined,
      ...linePlace(l),
    })),
  };
}

/**
 * The live-pricing request, or null until there is enough to price: a start
 * date, a currency, at least one line, a year, a billing frequency, and every
 * line's dates within its year.
 */
export function toPreviewBody(v: DraftFormValues): object | null {
  const lines = v.lines;
  if (!v.startDate || !v.currencyIsoCode || lines.length === 0 || v.yearCount < 1 || !v.billingFrequency) return null;
  const years = formYears(v);
  if (lastYearEndProblem(v.startDate, v.yearCount, v.lastYearEndDate)) return null;
  if (lines.some((l) => !years[l.yearNumber - 1] || lineDatesProblem(l, years))) return null;
  return {
    currencyIsoCode: v.currencyIsoCode,
    subscriptionStartDate: v.startDate,
    yearCount: v.yearCount,
    lastYearEndDate: opt(v.lastYearEndDate),
    billingFrequency: v.billingFrequency,
    partnerCommissionPercent: commissionInput(v),
    partnerCommissionByYear: commissionByYearInput(v),
    lines: lines.map((l) => ({
      pricebookEntryId: l.pricebookEntryId,
      quantity: Number(l.quantity),
      discountPercent: l.discount.trim() || "0",
      ...linePlace(l),
      keepPricing:
        l.keepPricing && !l.useLatestPricing
          ? { method: l.keepPricing.method, formulaVersionId: l.keepPricing.formulaVersionId }
          : undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// Stored pricing and submission dates
// ---------------------------------------------------------------------------

/**
 * The pricing as stored on a version, in the live preview's shape, so a
 * submitted version always shows its frozen numbers (never re-priced with
 * today's rules). Year boundaries follow the term; each year's amounts are
 * the exact sums of its line rows. Null if the version has no priced lines.
 */
export function storedPricing(res: DraftResponse): PricingPreview | null {
  const v = res.version;
  // Every line is priced, one whose classification isn't set up included; one
  // unpriced means the quote isn't priced.
  const pricedLines = v.lines;
  if (!v.subscriptionStartDate || pricedLines.length === 0 || pricedLines.some((l) => l.schedule.length === 0)) return null;
  // The contract years as stored; each year's amounts are the exact sums of
  // its rows (a year without products is 0). When it is invoiced is the
  // backend's: billed upfront, everything falls in Year 1.
  const years = (v.years ?? []).map((y) => {
    const rows = v.lines.flatMap((l) => l.schedule.filter((r) => r.yearNumber === y.yearNumber));
    return {
      yearNumber: y.yearNumber,
      periodStart: y.startDate,
      periodEnd: y.endDate,
      net: sumMoney(rows.map((r) => r.net)),
      arr: y.arr ?? "0.00",
      billing: y.billing ?? sumMoney(rows.map((r) => r.billing)),
      commission: sumMoney(rows.map((r) => r.commission ?? "0.00")),
      netBilling: y.netBilling ?? sumMoney(rows.map((r) => r.netBilling ?? r.billing)),
    };
  });
  return {
    rulesVersion: v.pricingRulesVersion,
    termMonths: "",
    totals: v.totals,
    years,
    smallDeal: v.smallDeal ?? null,
    // Aligned with the version's lines, one for one (a line whose classification isn't set up is priced too).
    lines: v.lines.map((l) => ({
      pricebookEntryId: l.pricebookEntryId,
      yearNumber: l.yearNumber ?? undefined,
      annualList: l.annualList,
      annualNet: l.annualNet,
      arr: l.arr,
      tcv: l.tcv,
      commission: l.commission,
      schedule: l.schedule,
    })),
  };
}

/**
 * Lines the live preview's prices up with the form's lines, product by product
 * in order, leaving a gap where the preview hasn't caught up with a change yet,
 * so no line shows another's amount.
 */
export function alignPreview(
  p: PricingPreview | null,
  lines: readonly { readonly category: LineCategory | ""; readonly pricebookEntryId: string }[],
): PricingPreview | null {
  if (!p) return null;
  let k = 0;
  const aligned = lines.map((l) => {
    const next = p.lines[k];
    if (!next || next.pricebookEntryId !== l.pricebookEntryId) return undefined;
    k++;
    return next;
  });
  return { ...p, lines: aligned as unknown as PricingPreview["lines"] };
}

/**
 * The expiry date a submission made at `now` would get: the UTC
 * calendar day, plus the validity period. Mirrors the backend rule so
 * the submit dialog can show it beforehand.
 */
export function expiryFor(now: Date, validityDays: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + validityDays));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whether a quote with this expiry date has expired, judged by the UTC day. */
export function isExpired(expiryDate: string | null, now: Date): boolean {
  return expiryDate !== null && expiryFor(now, 0) > expiryDate;
}

/** "2026-10-31" → "31 Oct 2026", as in the approved layout. */
export function formatDate(date: string | null): string {
  const d = date ? parseDateString(date) : null;
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** A moment, "3 Oct 2026, 09:00", in the viewer's time zone: the one date-time format (D14, 2026-10-14). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Who last changed something, "3 Oct 2026 · admin@wso2.com": the one style (D15, 2026-10-14). */
export function changedText(at: string, by: string | null): string {
  const day = formatDate(at.slice(0, 10));
  return by ? `${day} · ${by}` : day;
}

/** The billing choice, in the same words everywhere (D85), the order form included. */
export const BILLING_LABEL: Record<BillingFrequency, string> = {
  MONTHLY: "Monthly in Advance",
  QUARTERLY: "Quarterly in Advance",
  ANNUAL: "Annually in Advance",
  UPFRONT: "Upon the Execution of the Order Form",
  SPECIAL_TERMS: "See Special Terms",
};

// ---------------------------------------------------------------------------
// Issues → wizard steps
// ---------------------------------------------------------------------------

/** Wizard steps, in order. */
export const STEPS = ["Overview", "Products & Pricing", "Commercials", "Legal", "Review"] as const;

/** Fields on Products & Pricing besides the lines: currency and price book, the start date and term, commission. */
const STEP_2_FIELDS = [
  // The start date is on step 2 with the term (D73).
  "subscriptionStartDate",
  "currencyIsoCode",
  "defaultPricebookId",
  "years",
  "yearCount",
  "lastYearEndDate",
  "partnerCommissionPercent",
  "partnerCommissionByYear",
];

/** Commercials (D86): billing and payment terms first. */
const STEP_3_FIELDS = [
  "billingFrequency",
  "netTermsDays",
  "poNumber",
  "billTo",
  "shipTo",
  "contacts.billing",
  "contacts.security",
  "contacts.legal",
];

/** Legal: section 04, the partner agreement and the special terms. */
const STEP_4_FIELDS = ["specialTerms", "governingTerms", "partnerContractName", "partnerContractDate", "legalTerms"];

/** The step (0-based) where an issue's field lives, so the summary panel can jump there. */
export function stepOfField(field: string): number {
  // "salesforce": a refused sync (D77), done from Products & Pricing.
  if (field === "lines" || field.startsWith("lines[") || field === "salesforce" || STEP_2_FIELDS.includes(field)) return 1;
  if (STEP_3_FIELDS.some((f) => field === f || field.startsWith(f + ".") || field.startsWith(f + "["))) return 2;
  if (STEP_4_FIELDS.some((f) => field === f || field.startsWith(f + "."))) return 3;
  // The justification is written on Review, just above Submit (D141).
  if (field === "justification") return 4;
  return 0;
}

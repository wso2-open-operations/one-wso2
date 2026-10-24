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

// Quote lifecycle helpers: labels for version statuses, the version
// comparison (worked out in the browser) and the history timeline.
// Pure functions only, so each is unit-tested without rendering.

import type {
  AuditEvent,
  ContactView,
  AddressView,
  DraftResponse,
  OpportunityQuote,
  VersionStatus,
} from "@features/sales/cado2/quotes/api/quoteTypes";
import { BILLING_LABEL, durationText, formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { roleLabel } from "@features/sales/cado2/approvals/model/approvalText";

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<VersionStatus, string> = {
  DRAFT: "Draft",
  // A submitted version is in approval.
  SUBMITTED: "In approval",
  RECALLED: "Recalled",
  CLOSED: "Closed",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

export const STATUS_COLOR: Record<VersionStatus, "default" | "primary" | "warning" | "error" | "success"> = {
  DRAFT: "default",
  SUBMITTED: "primary",
  RECALLED: "warning",
  CLOSED: "default", // an end, not an error (2026-10-14)
  APPROVED: "success",
  RETURNED: "warning",
};

/** The label for a quote's status, which is its latest version's. */
export function quoteStatusLabel(status: VersionStatus, latestVersion: number): string {
  return status === "DRAFT" && latestVersion > 1 ? `Draft (v${latestVersion})` : STATUS_LABEL[status];
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

export type Change = "same" | "changed" | "added" | "removed";

export interface CompareRow {
  readonly section: "Overview" | "Products" | "Commercials" | "Legal" | "Totals";
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly change: Change;
}

const DASH = "–";
const text = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? DASH : String(v));

function contact(res: DraftResponse, role: ContactView["role"]): string {
  const c = res.version.contacts.find((x) => x.role === role);
  return c ? [c.name, c.email].filter(Boolean).join(" · ") : DASH;
}

function address(res: DraftResponse, type: AddressView["type"]): string {
  const a = res.version.addresses.find((x) => x.type === type);
  if (!a) return DASH;
  if (a.source === "SAME_AS_BILL_TO") return "Same as bill to";
  return [a.companyName, a.addressLine1, a.addressLine2, a.city, a.stateProvince, a.postalCode, a.country, a.taxId]
    .filter(Boolean)
    .join(", ");
}

const terms = (t: { enabled: boolean; text: string | null }, off: string) => (t.enabled ? text(t.text) : off);

type Line = DraftResponse["version"]["lines"][number];

/** Lines keyed by price book entry and occurrence ("01uA#1", "01uA#2"). */
function keyed(lines: readonly Line[]): Map<string, Line> {
  const seen = new Map<string, number>();
  const out = new Map<string, Line>();
  for (const l of lines) {
    const n = (seen.get(l.pricebookEntryId) ?? 0) + 1;
    seen.set(l.pricebookEntryId, n);
    out.set(`${l.pricebookEntryId}#${n}`, l);
  }
  return out;
}

const lineSummary = (l: Line, currency: string) =>
  `${l.quantity} × ${currency} ${formatMoney(l.unitPrice)}${Number(l.discretionaryDiscountPercent) ? `, ${Number(l.discretionaryDiscountPercent)}% off` : ""}`;

/**
 * Field-by-field comparison of two versions. Lines are matched by product
 * price book entry, in order; unmatched lines are added or removed.
 */
export function compareVersions(a: DraftResponse, b: DraftResponse): CompareRow[] {
  const rows: CompareRow[] = [];
  const add = (section: CompareRow["section"], label: string, from: string, to: string) =>
    rows.push({ section, label, from, to, change: from === to ? "same" : "changed" });
  const va = a.version;
  const vb = b.version;
  const cur = (r: DraftResponse) => r.version.currencyIsoCode ?? "";

  add("Overview", "Customer", text(va.accountName), text(vb.accountName));
  add("Overview", "Opportunity", text(va.opportunityName), text(vb.opportunityName));
  add("Overview", "Deal type", text(va.dealType), text(vb.dealType));
  add("Overview", "Partner", text(va.partner?.name), text(vb.partner?.name));
  add("Overview", "Renewal", va.isRenewal ? "Yes" : "No", vb.isRenewal ? "Yes" : "No");
  add("Overview", "WSO2 legal entity", text(va.legalEntity?.name), text(vb.legalEntity?.name));
  add("Overview", "Currency", text(va.currencyIsoCode), text(vb.currencyIsoCode));
  add("Overview", "Start date", formatDate(va.subscriptionStartDate), formatDate(vb.subscriptionStartDate));
  const termText = (v: typeof va) =>
    (v.subscriptionStartDate && v.subscriptionEndDate && durationText(v.subscriptionStartDate, v.subscriptionEndDate)) || DASH;
  add("Products", "Subscription term", termText(va), termText(vb));
  add("Products", "End date", formatDate(va.subscriptionEndDate), formatDate(vb.subscriptionEndDate));
  const commission = (p: string | null | undefined) => (p ? `${Number(p)}%` : DASH);
  add("Products", "Partner commission", commission(va.partnerCommissionPercent), commission(vb.partnerCommissionPercent));

  const la = keyed(va.lines);
  const lb = keyed(vb.lines);
  for (const [key, l] of la) {
    const m = lb.get(key);
    if (!m) {
      rows.push({ section: "Products", label: l.productName, from: lineSummary(l, cur(a)), to: DASH, change: "removed" });
      continue;
    }
    const name = l.productName;
    add("Products", `${name} · Quantity`, String(l.quantity), String(m.quantity));
    add("Products", `${name} · Unit price`, formatMoney(l.unitPrice), formatMoney(m.unitPrice));
    add("Products", `${name} · Discount`, `${Number(l.discretionaryDiscountPercent)}%`, `${Number(m.discretionaryDiscountPercent)}%`);
    add("Products", `${name} · Period`, `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`, `${formatDate(m.startDate)} – ${formatDate(m.endDate)}`);
    add("Products", `${name} · Annual`, formatMoney(l.annualNet), formatMoney(m.annualNet));
  }
  for (const [key, l] of lb) {
    if (!la.has(key)) {
      rows.push({ section: "Products", label: l.productName, from: DASH, to: lineSummary(l, cur(b)), change: "added" });
    }
  }

  // Billing and payment terms open Commercials (D86).
  add("Commercials", "Billing", text(va.billingFrequency && BILLING_LABEL[va.billingFrequency]), text(vb.billingFrequency && BILLING_LABEL[vb.billingFrequency]));
  add("Commercials", "Payment terms", va.netTermsDays ? `Net ${va.netTermsDays}` : DASH, vb.netTermsDays ? `Net ${vb.netTermsDays}` : DASH);
  add("Commercials", "PO number", text(va.poNumber), text(vb.poNumber));
  // Section 04: standard, or non-standard written by Legal.
  const blocks = (x: typeof va) =>
    [x.termsOnPremNonStandard ? "On-prem: non-standard" : "", x.termsSaasNonStandard ? "SaaS: non-standard" : ""].filter(Boolean).join(" · ") ||
    "Standard";
  add("Legal", "Governing terms", blocks(va), blocks(vb));
  add("Legal", "Special terms", terms(va.specialTerms, "None"), terms(vb.specialTerms, "None"));
  add("Legal", "Partner agreement date", formatDate(va.partnerContractDate ?? null), formatDate(vb.partnerContractDate ?? null));
  add("Commercials", "Bill to", address(a, "BILL_TO"), address(b, "BILL_TO"));
  add("Commercials", "Ship to", address(a, "SHIP_TO"), address(b, "SHIP_TO"));
  add("Commercials", "Billing contact", contact(a, "BILLING"), contact(b, "BILLING"));
  add("Commercials", "Security contact", contact(a, "SECURITY"), contact(b, "SECURITY"));
  add("Commercials", "Justification", text(va.justification), text(vb.justification));

  // ARR and ACV are null on a services-only quote.
  const na = (x: string | null) => (x === null ? "Not applicable" : formatMoney(x));
  add("Totals", "ARR", na(va.totals.arr), na(vb.totals.arr));
  add("Totals", "ACV", na(va.totals.acv), na(vb.totals.acv));
  add("Totals", "TCV", formatMoney(va.totals.tcv), formatMoney(vb.totals.tcv));
  return rows;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  /** The latest event of the group. */
  readonly event: AuditEvent;
  /** How many consecutive saves it stands for (1 for anything else). */
  readonly count: number;
}

/** Events that repeat and read better as one line with a count. */
const GROUPED = new Set(["DRAFT_SAVED", "ORDER_FORM_PREVIEWED", "DOCUMENT_DOWNLOADED"]);

/** Groups consecutive saves, previews or downloads of the same version by the same person. */
export function groupHistory(events: readonly AuditEvent[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (
      last &&
      GROUPED.has(e.eventType) &&
      last.event.eventType === e.eventType &&
      last.event.actorEmail === e.actorEmail &&
      last.event.versionNumber === e.versionNumber
    ) {
      out[out.length - 1] = { event: e, count: last.count + 1 };
    } else {
      out.push({ event: e, count: 1 });
    }
  }
  return out;
}

const roleOf = (meta: Record<string, unknown>) => (typeof meta.role === "string" ? roleLabel(meta.role) : "An approver");

/** A primary quote named for others (D68): "Q-26-00031 (nimesha@wso2.com)", or "A draft by …" before its first submit. */
export function primaryLabel(q: Pick<OpportunityQuote, "quoteNumber" | "ownerEmail">): string {
  return q.quoteNumber ? `${q.quoteNumber} (${q.ownerEmail})` : `A draft by ${q.ownerEmail}`;
}

/**
 * A quote's name: its number once it has been submitted, otherwise its
 * customer and deal, e.g. "Acme Corp · APIM renewal 2026".
 */
export function quoteLabel(number: string | null, accountName?: string | null, opportunityName?: string | null): string {
  return number ?? ([accountName, opportunityName].filter(Boolean).join(" · ") || "Draft quote");
}

/** What happened, in words. */
export function describeEvent({ event: e, count }: HistoryEntry): string {
  const v = e.versionNumber ? `Version ${e.versionNumber}` : "Quote";
  const meta = e.metadata ?? {};
  switch (e.eventType) {
    case "QUOTE_CREATED":
      return "Quote created";
    case "VERSION_DELETED":
      // Logged on the quote: the version itself no longer exists.
      return `Version ${typeof meta.versionNumber === "number" ? meta.versionNumber : "?"} draft deleted`;
    case "DRAFT_SAVED":
      return `${v} draft saved${count > 1 ? ` ×${count}` : ""}`;
    case "VERSION_SUBMITTED":
      return `${v} submitted${typeof meta.expiryDate === "string" ? ` · expires ${formatDate(meta.expiryDate)}` : ""}`;
    case "VERSION_RECALLED":
      return `${v} recalled`;
    case "VERSION_CREATED":
      return `${v} created${typeof meta.copiedFromVersion === "number" ? ` (revised from v${meta.copiedFromVersion})` : ""}`;
    case "QUOTE_CLOSED":
      return "Quote closed";
    // Salesforce sync (D77): what changed there, or why it was refused.
    case "QUOTE_SYNCED": {
      const n = (k: string) => (typeof meta[k] === "number" ? (meta[k] as number) : 0);
      return `${v} synced to Salesforce · ${n("updated")} updated, ${n("added")} added, ${n("removed")} removed`;
    }
    case "QUOTE_SYNC_FAILED":
      return `Salesforce refused the sync of ${v.toLowerCase()}${
        Array.isArray(meta.reasons) && meta.reasons.length ? `: ${meta.reasons.join("; ")}` : ""
      }`;
    // Primary quote (D68): metadata names the other quote involved, if any.
    case "QUOTE_MADE_PRIMARY":
      return typeof meta.releasedQuoteNumber === "string"
        ? `Made the primary quote, releasing ${meta.releasedQuoteNumber}`
        : "Made the primary quote";
    case "QUOTE_PRIMARY_RELEASED":
      return typeof meta.byQuoteNumber === "string"
        ? `No longer the primary quote: ${meta.byQuoteNumber} was made primary`
        : typeof meta.byQuoteId === "number"
          ? "No longer the primary quote: another quote was made primary"
          : "No longer the primary quote";
    case "APPROVAL_WORKFLOW_CREATED": {
      const n = Array.isArray(meta.steps) ? meta.steps.length : 0;
      return `${v} approval started${n ? ` · ${n} approval${n === 1 ? "" : "s"} needed` : ""}`;
    }
    case "APPROVAL_REQUESTED":
      return `Waiting on ${roleOf(meta)}`;
    case "APPROVAL_APPROVED":
      return `${roleOf(meta)} approved ${v.toLowerCase()}`;
    case "APPROVAL_REJECTED": // history from before Reject was merged into Return (2026-10-12)
      return `${roleOf(meta)} rejected ${v.toLowerCase()}`;
    case "APPROVAL_RETURNED":
      return `${roleOf(meta)} returned ${v.toLowerCase()}`;
    case "VERSION_APPROVED":
      return `${v} fully approved`;
    case "ORDER_FORM_PREVIEWED":
      return `${v} order form previewed${count > 1 ? ` ×${count}` : ""}`;
    case "ORDER_FORM_ISSUED":
      return `${v} order form issued${typeof meta.expiryDate === "string" ? ` · expires ${formatDate(meta.expiryDate)}` : ""}`;
    case "DOCUMENT_DOWNLOADED":
      return `Order form downloaded${count > 1 ? ` ×${count}` : ""}`;
    case "DOCUMENT_GENERATION_FAILED":
      return `The order form couldn't be produced`;
    default:
      return e.eventType;
  }
}

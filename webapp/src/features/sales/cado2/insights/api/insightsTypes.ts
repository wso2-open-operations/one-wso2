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

// The Insights API (D106), as CadO2's backend returns it. Money is a decimal
// string; converted amounts are in `currency` (USD) at Salesforce's rates of
// `ratesAsOf` (D104), or null when they couldn't be converted.

export type SlaStateCode = "ON_TRACK" | "AT_RISK" | "BREACHED";

export interface MoneyMeta {
  readonly currency: string;
  readonly ratesAvailable: boolean;
  readonly ratesAsOf: string | null;
  /** Quotes left out of money totals: no rate for their currency. */
  readonly unconverted: readonly { readonly currency: string; readonly quotes: number }[];
}

export interface RoleLoad {
  readonly role: string;
  readonly label: string;
  readonly onTrack: number;
  readonly dueSoon: number;
  readonly overdue: number;
  /** The regions its waiting steps are in (regional roles). */
  readonly regions: readonly string[];
}

export interface RoleSpeed {
  readonly role: string;
  readonly label: string;
  readonly medianHours: number;
  readonly decisions: number;
  readonly slaHours: number;
}

export interface OldestWait {
  readonly quoteId: number;
  readonly quoteNumber: string | null;
  readonly accountName: string | null;
  readonly days: number;
  readonly waitingOn: readonly string[];
}

export interface AgingBucket {
  readonly key: string;
  readonly label: string;
  readonly quotes: number;
  readonly value: string | null;
}

export interface AttentionItem {
  readonly stepId: number;
  readonly quoteId: number;
  readonly quoteNumber: string | null;
  readonly versionNumber: number;
  readonly accountName: string | null;
  readonly region: string | null;
  readonly currency: string | null;
  readonly tcv: string;
  readonly value: string | null;
  readonly waitingOn: string;
  readonly requestedAt: string | null;
  readonly dueAt: string | null;
  readonly slaState: SlaStateCode;
}

/** GET /insights/approval-operations. */
export interface ApprovalOperations extends MoneyMeta {
  readonly region: string | null;
  readonly regions: readonly string[];
  readonly inApproval: number;
  readonly inApprovalValue: string | null;
  readonly overdueSteps: number;
  readonly dueSoonSteps: number;
  readonly medianApprovalHours: number | null;
  readonly approvedInWindow: number;
  readonly approvalWindowDays: number;
  readonly submittedLastDay: number;
  readonly byRole: readonly RoleLoad[];
  readonly speed: readonly RoleSpeed[];
  readonly oldest: OldestWait | null;
  readonly aging: readonly AgingBucket[];
  readonly attention: readonly AttentionItem[];
}

export type ReportStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" | "RECALLED" | "CLOSED";

export interface ReportRow {
  readonly quoteId: number;
  readonly quoteNumber: string | null;
  readonly versionNumber: number;
  readonly status: ReportStatus;
  readonly accountName: string | null;
  readonly opportunityName: string | null;
  readonly region: string | null;
  readonly partnerName: string | null;
  readonly channel: "DIRECT" | "PARTNER" | null;
  /** From the opportunity's Salesforce record type (D35). */
  readonly dealKind: "FIRST_SALE" | "RENEWAL" | "EXPANSION" | "OTHER";
  readonly recordTypeName: string | null;
  readonly currency: string | null;
  readonly tcv: string;
  readonly tcvConverted: string | null;
  readonly arrConverted: string | null;
  readonly maxDiscretionaryPercent: string | null;
  readonly ownerEmail: string;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly approvedAt: string | null;
  readonly daysInApproval: number | null;
  readonly waitingOn: readonly string[];
}

/** GET /insights/quotes. */
export interface QuoteReport extends MoneyMeta {
  readonly rows: readonly ReportRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalValue: string | null;
  readonly truncated: boolean;
}

export type ReportSort = "CREATED" | "SUBMITTED" | "APPROVED" | "VALUE" | "ACCOUNT" | "DAYS_IN_APPROVAL";
export type ReportDateField = "CREATED" | "SUBMITTED" | "APPROVED";

export type ReportPeriod = "" | "30" | "90" | "quarter" | "year" | "custom";
export type ReportDealKind = "" | "FIRST_SALE" | "RENEWAL" | "EXPANSION";
/** A deal-size band in USD ("0-50000", "1000000-"), or a custom range. */
export type ReportSize = "" | "0-50000" | "50000-250000" | "250000-1000000" | "1000000-" | "custom";

/** The report's filters; also the URL's query, so a view can be shared. */
export interface ReportFilters {
  /** Matches the quote number, account, opportunity, partner or product. */
  readonly q: string;
  readonly status: "" | ReportStatus;
  readonly region: string;
  readonly period: ReportPeriod;
  /** A custom period (YYYY-MM-DD, both inclusive; either may be empty). */
  readonly from: string;
  readonly to: string;
  /** Which date the period applies to. */
  readonly dateField: ReportDateField;
  readonly dealKind: ReportDealKind;
  readonly channel: "" | "DIRECT" | "PARTNER";
  readonly waitingOn: string;
  readonly size: ReportSize;
  /** A custom deal-size range in USD. */
  readonly minValue: string;
  readonly maxValue: string;
  readonly sort: ReportSort;
  readonly order: "asc" | "desc";
  readonly page: number;
}

/** GET /insights/quotes/{id}: one quote for the Quote Report's side panel. */
export interface QuoteSummary extends MoneyMeta {
  readonly quoteId: number;
  readonly quoteNumber: string | null;
  readonly versionNumber: number;
  readonly status: ReportStatus;
  readonly accountName: string | null;
  readonly opportunityName: string | null;
  readonly region: string | null;
  readonly dealKind: ReportRow["dealKind"];
  readonly recordTypeName: string | null;
  readonly channel: "DIRECT" | "PARTNER" | null;
  readonly partnerName: string | null;
  readonly ownerEmail: string;
  /** The quote's own currency; `currency` (MoneyMeta) is the reporting one. */
  readonly quoteCurrency: string | null;
  readonly tcv: string;
  readonly tcvConverted: string | null;
  readonly arr: string;
  readonly arrConverted: string | null;
  readonly termYears: number | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly approvedAt: string | null;
  readonly lines: readonly {
    readonly lineNumber: number;
    readonly productName: string;
    readonly productCode: string | null;
    readonly quantity: number;
    readonly volumeDiscountPercent: string;
    readonly discretionaryDiscountPercent: string;
    readonly tcv: string;
  }[];
  readonly approvals: readonly {
    readonly role: string;
    readonly label: string;
    readonly status: "WAITING" | "PENDING" | "APPROVED" | "RETURNED" | "CANCELLED";
    readonly slaState: SlaStateCode | null;
    readonly requestedAt: string | null;
    readonly dueAt: string | null;
    readonly actedAt: string | null;
    readonly actedBy: string | null;
    readonly comment: string | null;
    /** Approved in an earlier version, not asked again (D119). */
    readonly carriedOver?: boolean;
  }[];
}

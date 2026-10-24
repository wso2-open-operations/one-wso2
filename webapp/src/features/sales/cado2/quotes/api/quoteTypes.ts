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

// Wire types for the quote endpoints; they mirror backend/types. Money values
// are decimal strings ("41000.00") and dates are "YYYY-MM-DD" strings.

export type DealType = "DIRECT" | "PARTNER";
/**
 * How the customer is invoiced (D85); UPFRONT = upon the execution of the
 * order form; SPECIAL_TERMS = see special terms, which must then be on (D86).
 */
export type BillingFrequency = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "UPFRONT" | "SPECIAL_TERMS";
export type LineCategory = "SUBSCRIPTION" | "SUPPORT" | "PROFESSIONAL_SERVICE";

/**
 * Who chose a line's category: MAPPED = an Admin's product mapping (the
 * rep can't change it); REP = the product isn't mapped, so the rep chose and
 * Deal Desk verifies it.
 */
export type CategorySource = "MAPPED" | "REP";
/**
 * How the subscription term is set (D85): a number of years (1–10), or an
 * end date of any length up to 10 years.
 */

/** A problem with one field, e.g. { field: "lines[2].quantity", message: "…" }. */
export interface Issue {
  readonly field: string;
  readonly message: string;
}

/** 422 body. */
export interface ValidationProblem {
  readonly message: string;
  readonly issues: readonly Issue[];
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface Address {
  readonly street: string | null;
  readonly city: string | null;
  readonly stateProvince: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
}

export interface Account {
  readonly id: string;
  readonly name: string | null;
  readonly billingAddress: Address | null;
  /** Salesforce Sales_Regions__c, e.g. "APAC". Required to quote. */
  readonly salesRegion: string | null;
  /** Salesforce Sub_Region__c, e.g. "South Asia". Optional. */
  readonly subRegion: string | null;
}

export interface Partner {
  readonly id: string | null;
  readonly name: string | null;
  readonly role: string | null;
  readonly recordType: string | null;
  readonly billingAddress: Address | null;
}

export interface Opportunity {
  readonly id: string;
  readonly name: string | null;
  readonly stageName: string | null;
  readonly closeDate: string | null;
  /** Day created (YYYY-MM-DD); the list comes newest-created first. */
  readonly createdDate: string | null;
  readonly currencyIsoCode: string | null;
  readonly isWon: boolean | null;
  readonly isClosed: boolean | null;
  readonly directChannel: string | null;
  readonly dealType: DealType | null;
  readonly partner: Partner | null;
  /** Salesforce RecordType.Name, e.g. "Renewal". */
  readonly recordTypeName: string | null;
  /** What the record type means for the quote and its approvals. */
  readonly dealKind: DealKind;
  /** ARR_Cloud_ARR__c in the opportunity's own currency (SF-Q1 provisional). */
  readonly arr: number | null;
  /** The opportunity's price book, which all its products come from; pre-fills the quote's. */
  readonly pricebook?: PricebookRef | null;
  /** Subs_Start_Date__c / Subs_End_Date__c; null on a consultancy-only deal. A renewal starts the day after the renewed one ends. */
  readonly subsStartDate?: string | null;
  readonly subsEndDate?: string | null;
}

/**
 * When a renewal is expected to start: the day after the renewed opportunity's
 * subscription end date. `differs`: the quote starts another day (a warning
 * for the AM and Deal Desk; never blocks).
 */
export interface RenewalStart {
  readonly expectedStartDate: string;
  readonly fromOpportunityId: string;
  readonly fromOpportunityName: string;
  readonly differs: boolean;
}

/** First Sale, Renewal or Expansion; any other record type is OTHER. */
export type DealKind = "FIRST_SALE" | "RENEWAL" | "EXPANSION" | "OTHER";

export interface Contact {
  readonly id: string | null;
  readonly name: string | null;
  readonly title: string | null;
  readonly email: string | null;
}

export interface PricebookEntry {
  readonly id: string;
  readonly unitPrice: string | null;
  readonly currencyIsoCode: string | null;
  readonly isActive: boolean;
  readonly pricebook: {
    readonly id: string | null;
    readonly name: string | null;
  } | null;
}

/** A price book. */
export interface PricebookRef {
  readonly id: string;
  readonly name: string;
}

/** GET /pricebooks: a price book the quote can use; "(Current)" books first. */
export interface PricebookOption extends PricebookRef {
  readonly current: boolean;
  /** How many active products the book prices in the currency; null when unknown (not shown). */
  readonly productCount?: number | null;
}

export interface Product {
  readonly id: string;
  readonly name: string | null;
  readonly productCode: string | null;
  /** The product's Salesforce description. */
  readonly description?: string | null;
  readonly family: string | null;
  readonly unitOfMeasure: string | null;
  /** Product_Unit__c and product_Classification__c: the approval group inputs. */
  readonly productUnit: string | null;
  readonly classification: string | null;
  /** The Admin's mapping; null = not mapped, the rep chooses. */
  readonly category?: LineCategory | null;
  /** Charged every year, from the Salesforce classification (D76). */
  readonly recurring: boolean;
  readonly pricebookEntries: readonly PricebookEntry[];
}

export interface ActiveLegalEntity {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly country: string;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Headline numbers. ARR and ACV are null for a services-only quote. */
export interface Totals {
  readonly arr: string | null;
  readonly acv: string | null;
  readonly tcv: string;
  /** Partner-led quotes with a commission % only; null otherwise. */
  readonly partnerCommission?: string | null;
  /** TCV less the partner commission: what WSO2 invoices in all. */
  readonly netOrderValue?: string | null;
}

export interface ScheduleRow {
  readonly yearNumber: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly yearFraction: string;
  readonly gross: string;
  readonly discount: string;
  readonly net: string;
  readonly billing: string;
  /** Partner commission on this row, and what is invoiced after it (A6). */
  readonly commission?: string;
  readonly netBilling?: string;
}

/** GET /bundles/{productId}: the children a parent brings, priced from the quote's book; Missing names those not in it. */
export interface BundleChildren {
  readonly children: readonly Product[];
  readonly missing: readonly string[];
}

export interface PricingYear {
  readonly yearNumber: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly net: string;
  /** The year's recurring lines at their full yearly rate. */
  readonly arr?: string;
  readonly billing: string;
  readonly commission?: string;
  readonly netBilling?: string;
}

// ---------------------------------------------------------------------------
// Legal terms (2026-10-24): Admin › Legal Texts and a quote's sections
// ---------------------------------------------------------------------------

/** A section 05 notice and when it applies; an empty list matches any. */
export interface LegalNoticeConfig {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly showTitle: boolean;
  readonly finePrint: boolean;
  readonly channels: readonly string[] | null;
  readonly regions: readonly string[] | null;
  readonly dealKinds: readonly string[] | null;
}

/** GET /legal: the texts as quotes use them; the EULA link is in the texts. */
export interface LegalConfig {
  /** TERMS_ONPREM_DIRECT, TERMS_ONPREM_PARTNER, TERMS_SAAS_DIRECT, TERMS_SAAS_PARTNER. */
  readonly texts: Readonly<Record<string, string>>;
  readonly notices: readonly LegalNoticeConfig[];
  /** Salesforce partner role → the agreement named on the order form. */
}

export type LegalBlockKind = "ONPREM" | "SAAS";

/** A section 04 block: the standard text filled in, or Legal's terms; "" while Legal hasn't written it. */
export interface LegalBlock {
  readonly kind: LegalBlockKind;
  readonly nonStandard: boolean;
  readonly text: string;
}

/** A notice that applies, with what added it ("" for every deal). */
export interface LegalNoticeOut {
  readonly title: string;
  readonly body: string;
  readonly showTitle: boolean;
  readonly finePrint: boolean;
  readonly reason: string;
}

/** Sections 04 and 05, resolved. */
export interface LegalSections {
  readonly blocks: readonly LegalBlock[];
  readonly notices: readonly LegalNoticeOut[];
  readonly contractName: string;
}

/** A version's legal sections, frozen at submission; Legal's texts laid over. */
export interface LegalView {
  readonly onPrem: boolean;
  readonly saas: boolean;
  readonly onPremNonStandard: boolean;
  readonly saasNonStandard: boolean;
  readonly contractName: string;
  readonly partnerName: string;
  readonly contractDate: string | null;
  readonly sections: LegalSections;
  /** What section 06 says: Legal's wording when they changed it, else the AM's; null when off. */
  readonly specialTerms: string | null;
  readonly specialTermsByLegal: boolean;
  readonly amSpecialTerms: string | null;
  readonly frozen: boolean;
}

/**
 * A deal whose TCV is under the small-deal amount in USD, at Salesforce's
 * current rate (2026-10-24): the AM is asked to contact their Sales
 * Manager and the BU GM. A warning only.
 */
export interface SmallDeal {
  readonly thresholdUsd: string;
  readonly tcvUsd: string;
}

/** One contract year of a saved version; net and ARR are null while unpriced. */
export interface ContractYearView {
  readonly yearNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly net: string | null;
  readonly arr: string | null;
}

// ---------------------------------------------------------------------------
// Pricing formulas (D81)
// ---------------------------------------------------------------------------

/** A Salesforce product in a formula, named as Salesforce had it when saved. */
export interface FormulaProduct {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
}

/** One placeholder's value: a fixed VALUE ("25000", "10%"), or PRODUCTS whose lines it adds up. */
export interface FormulaBinding {
  readonly name: string;
  readonly kind: "VALUE" | "PRODUCTS";
  readonly value?: string;
  readonly products?: readonly FormulaProduct[];
}

/**
 * One version of a product's pricing formula (D82). Every change is a new
 * version; REMOVED means the product has no formula from then on (no
 * expression or bindings). GET /pricing-formulas lists each product's latest.
 */
export interface PricingFormula {
  readonly versionId: number;
  readonly version: number;
  readonly status: "ACTIVE" | "REMOVED";
  readonly productId: string;
  readonly productName: string;
  readonly productCode: string | null;
  readonly expression: string;
  readonly bindings: readonly FormulaBinding[];
  /** What a line priced with this version shows as its unit of measure (D83); "" when REMOVED. */
  readonly unitOfMeasure: string;
  readonly updatedByEmail: string;
  readonly updatedAt: string;
}

/** How a formula line's unit price was worked out, and with which version: v2 of 2026-10-20, "max(25,000, 10% × 320,000)". */
export interface LineFormula {
  readonly versionId: number;
  readonly version: number;
  /** "2026-10-20": the day the version was made. */
  readonly versionDate: string;
  /** The version's unit of measure (D83). */
  readonly unitOfMeasure?: string;
  readonly expression: string;
  readonly explanation: string;
  readonly listPrice: string;
  readonly values: readonly { readonly name: string; readonly value: string; readonly products?: readonly FormulaProduct[] }[];
}

/** How a line's unit price was worked out: the price book, or an Admin's formula (D81). */
export type PricingMethod = "PRICE_BOOK" | "FORMULA";

export interface PricingPreview {
  readonly rulesVersion: string;
  readonly termMonths: string;
  readonly totals: Totals;
  readonly years: readonly PricingYear[];
  /** TCV under USD 30,000 (a warning); null otherwise. */
  readonly smallDeal?: SmallDeal | null;
  readonly lines: readonly {
    readonly pricebookEntryId: string;
    readonly yearNumber?: number;
    readonly startDate?: string;
    readonly endDate?: string;
    /** The category priced: a mapped product's comes from its mapping. */
    readonly category?: LineCategory;
    readonly categorySource?: CategorySource;
    /** The list price priced: a formula line's is worked out (D81). */
    readonly unitPrice?: string;
    /** The unit price charged. */
    readonly salesPrice?: string;
    readonly pricingMethod?: PricingMethod;
    readonly formula?: LineFormula | null;
    readonly discretionaryDiscountPercent?: string;
    readonly annualList: string;
    readonly annualNet: string;
    readonly arr: string;
    readonly tcv: string;
    readonly commission?: string;
    readonly schedule: readonly ScheduleRow[];
  }[];
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export interface ContactInput {
  readonly sfContactId?: string;
  readonly name?: string;
  readonly title?: string;
  readonly email?: string;
}

export interface AddressInput {
  readonly sfAccountId?: string;
  readonly companyName?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly taxId?: string;
}

export interface DraftLineInput {
  readonly keepSnapshotFromLineId?: number;
  readonly pricebookEntryId: string;
  readonly quantity: number;
  /** "" = not chosen yet (D72): the draft saves, submission waits for it. */
  readonly category: LineCategory | "";
  readonly discretionaryDiscountPercent: string;
  readonly unitOfMeasure?: string;
  /** A kept line moved to its product's pricing in force: the latest formula version, or the price book (D82). */
  readonly useLatestFormula?: boolean;
  /** The contract year the line belongs to. */
  readonly yearNumber: number;
  /** Within its year; omitted = the whole year. A one-off is charged on its start. */
  readonly startDate?: string;
  readonly endDate?: string;
  /** The unit price charged; omitted = the list price. Never below it; none on a formula line. */
  readonly salesPrice?: string;
  /** A bundle child: the position in lines of its parent. */
  readonly parentIndex?: number;
}

/** POST /quotes and PUT /quotes/{id}/versions/{n} body. */
export interface DraftInput {
  readonly sfOpportunityId: string;
  readonly sfAccountId: string;
  readonly expectedUpdatedAt?: string;
  /** The Overview's "Primary quote" tick (D68); ticking releases the current primary. */
  readonly isPrimary?: boolean;
  /** Only kept when Salesforce says the opportunity is a Renewal. */
  readonly previousOpportunityIds: readonly string[];
  readonly legalEntityId?: number;
  readonly currencyIsoCode?: string;
  /** The quote's price book; omitted = none chosen. */
  readonly defaultPricebookId?: string;
  readonly subscriptionStartDate?: string;
  /** How many contract years the AM added, 1–10; omitted = none yet. */
  readonly yearCount?: number;
  /** The last year's end when it is shorter than 12 months; omitted = a full year. */
  readonly lastYearEndDate?: string;
  /** With a recurring line only (D85). */
  readonly billingFrequency?: BillingFrequency;
  /** Section 04: blocks the AM marks non-standard (Legal writes them). */
  readonly termsOnPremNonStandard?: boolean;
  readonly termsSaasNonStandard?: boolean;
  /** The partner agreement: its name when the partner role has none, and its date (YYYY-MM-DD). */
  readonly partnerContractName?: string;
  readonly partnerContractDate?: string;
  /** Partner-led quotes only: one % for every line. */
  readonly partnerCommissionPercent?: string;
  readonly netTermsDays?: number;
  readonly specialTerms: { readonly enabled: boolean; readonly text?: string };
  readonly governingTerms: {
    readonly enabled: boolean;
    readonly text?: string;
  };
  readonly poNumber?: string;
  readonly justification?: string;
  readonly contacts: {
    readonly billing?: ContactInput;
    readonly security?: ContactInput;
  };
  readonly billTo?: AddressInput;
  readonly shipTo?: AddressInput;
  readonly shipToSameAsBillTo: boolean;
  readonly lines: readonly DraftLineInput[];
}

export interface LineView {
  readonly id: number;
  readonly lineNumber: number;
  readonly sfProductId: string;
  readonly productName: string;
  readonly productCode: string | null;
  /** The product's description, stored with the line. */
  readonly productDescription?: string | null;
  readonly pricebookEntryId: string;
  readonly pricebookId?: string;
  readonly pricebookName: string;
  /** The list price: the price book's, or the formula's. */
  readonly unitPrice: string;
  /** What the customer is charged per unit: the list price unless the AM raised it. */
  readonly salesPrice?: string;
  /** PRICE_BOOK, or FORMULA: worked out by an Admin's formula, with no discount (D81). */
  readonly pricingMethod?: PricingMethod;
  readonly formula?: LineFormula | null;
  readonly unitOfMeasure: string | null;
  readonly productUnit: string | null;
  readonly classification: string | null;
  /** Charged every year, from the classification (D76). */
  readonly recurring: boolean;
  readonly quantity: number;
  readonly category: LineCategory;
  readonly categorySource?: CategorySource;
  readonly discretionaryDiscountPercent: string;
  /** The contract year it belongs to. */
  readonly yearNumber: number | null;
  /** A bundle child's parent line number; null otherwise. */
  readonly parentLineNumber?: number | null;
  /** Null until the quote has a start date and a year (D78). */
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly annualList: string;
  readonly annualNet: string;
  readonly arr: string;
  readonly acv: string;
  readonly tcv: string;
  readonly commission?: string;
  readonly schedule: readonly ScheduleRow[];
}

export interface ContactView {
  readonly role: "BILLING" | "SECURITY";
  readonly source: "SALESFORCE" | "MANUAL";
  readonly sfContactId: string | null;
  readonly name: string;
  readonly title: string | null;
  readonly email: string | null;
}

export interface AddressView {
  readonly type: "BILL_TO" | "SHIP_TO";
  readonly source: "SALESFORCE" | "MANUAL" | "SAME_AS_BILL_TO";
  readonly sfAccountId: string | null;
  readonly companyName: string;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly stateProvince: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly taxId: string | null;
}

/** The WSO2 legal entity as snapshotted on a version. */
export interface LegalEntitySnapshot {
  readonly code: string;
  readonly name: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string | null;
  readonly city?: string;
  readonly stateProvince?: string | null;
  readonly postalCode?: string | null;
  readonly country?: string;
  readonly taxId?: string | null;
  readonly registrationNumber?: string | null;
}

/**
 * Version statuses. The quote shows its latest version's. A
 * SUBMITTED version is in approval.
 */
export type VersionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "RECALLED"
  | "CLOSED"
  | "APPROVED"
  | "RETURNED";

/** Lifecycle actions the caller may take now. */
export type QuoteAction = "RECALL" | "REVISE" | "CLOSE";

export interface VersionView {
  readonly versionNumber: number;
  readonly status: VersionStatus;
  readonly pricingRulesVersion: string;
  readonly accountName: string | null;
  /** The account's sales region and sub-region, as of the last save; frozen at submit. */
  readonly accountSalesRegion: string | null;
  readonly accountSubRegion: string | null;
  readonly opportunityName: string | null;
  readonly dealType: DealType | null;
  readonly partner: {
    readonly sfAccountId: string | null;
    readonly name: string | null;
    readonly role: string | null;
  } | null;
  readonly legalEntityId: number | null;
  /** Snapshot taken on save. */
  readonly legalEntity: LegalEntitySnapshot | null;
  /** Derived from the opportunity's record type. */
  readonly isRenewal: boolean;
  readonly opportunityRecordType: string | null;
  readonly dealKind: DealKind;
  readonly currencyIsoCode: string | null;
  /** The quote's price book; null until the rep chooses. */
  readonly defaultPricebook?: PricebookRef | null;
  readonly subscriptionStartDate: string | null;
  /** The contract's end: the last year's end. */
  readonly subscriptionEndDate: string | null;
  /** The contract years; null/empty before Year 1 is added. */
  readonly yearCount: number | null;
  readonly years: readonly ContractYearView[];
  /** A priced quote under USD 30,000 (a warning); null otherwise. */
  readonly smallDeal?: SmallDeal | null;
  /** The legal sections; null when not configured. */
  readonly legal?: LegalView | null;
  /** Section 04 choices and the partner agreement. */
  readonly termsOnPremNonStandard?: boolean;
  readonly termsSaasNonStandard?: boolean;
  readonly partnerContractName?: string | null;
  readonly partnerContractDate?: string | null;
  /** "15.00" on a partner-led quote with a commission; null otherwise. */
  readonly partnerCommissionPercent?: string | null;
  readonly billingFrequency: BillingFrequency | null;
  readonly netTermsDays: number | null;
  readonly specialTerms: {
    readonly enabled: boolean;
    readonly text: string | null;
  };
  readonly governingTerms: {
    readonly enabled: boolean;
    readonly text: string | null;
  };
  readonly poNumber: string | null;
  readonly justification: string | null;
  readonly totals: Totals;
  readonly contacts: readonly ContactView[];
  readonly addresses: readonly AddressView[];
  readonly previousOpportunities: readonly {
    readonly sfOpportunityId: string;
    readonly name: string;
    readonly arr: string | null;
    readonly currencyIsoCode: string | null;
    /** Its subscription dates in Salesforce when the version was saved (frozen at submission). */
    readonly subsStartDate?: string | null;
    readonly subsEndDate?: string | null;
  }[];
  /** A renewal's expected start date: the day after the renewed opportunity ends; null when unknown or not a renewal. */
  readonly renewalStart?: RenewalStart | null;
  readonly lines: readonly LineView[];
  /** Set on submit: the UTC day it was submitted, and + validity days. */
  readonly issueDate: string | null;
  readonly expiryDate: string | null;
  readonly submittedAt: string | null;
  readonly submittedByEmail: string | null;
  /** The version this one was revised from. */
  readonly copiedFromVersion: number | null;
  readonly closedReason: string | null;
  readonly closedByEmail: string | null;
  readonly closedAt: string | null;
  readonly updatedAt: string;
  readonly updatedByEmail: string;
}

export interface QuoteView {
  readonly id: number;
  /** Set at the quote's first submit; null before. */
  readonly quoteNumber: string | null;
  /** The latest version's status; the quote has none of its own. */
  readonly status: VersionStatus;
  /** What the caller may do now; empty for anyone who may not change the quote. */
  readonly actions: readonly QuoteAction[];
  /** The opportunity's primary quote, the one synced to Salesforce (D68). */
  readonly isPrimary: boolean;
  /** The caller may "Sync to Salesforce": sync on, primary, may change it (D77). */
  readonly canSync?: boolean;
  /** The last sync to Salesforce (D77); null until the first. */
  readonly sfSyncedAt?: string | null;
  readonly sfSyncedByEmail?: string | null;
  readonly sfSyncedVersion?: number | null;
  /** The caller may change the quote: its owner, or another AM when Admin allows it (D69). */
  readonly canEdit: boolean;
  readonly ownerEmail: string;
  readonly sfOpportunityId: string;
  readonly sfAccountId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly versions: readonly {
    readonly versionNumber: number;
    readonly status: VersionStatus;
    readonly tcv: string;
    readonly submittedAt: string | null;
    readonly updatedAt: string;
  }[];
}

/** Response of a save or a version read. */
export interface DraftResponse {
  readonly quote: QuoteView;
  readonly version: VersionView;
  readonly issues: readonly Issue[];
}

export interface QuoteListItem {
  readonly id: number;
  /** Set at the quote's first submit; null before. */
  readonly quoteNumber: string | null;
  /** The latest version's status. */
  readonly status: VersionStatus;
  readonly ownerEmail: string;
  readonly sfAccountId: string;
  readonly sfOpportunityId: string;
  /** The opportunity's primary quote (D68). */
  readonly isPrimary: boolean;
  /** The caller may change it (D69). */
  readonly canEdit: boolean;
  readonly accountName: string | null;
  readonly opportunityName: string | null;
  readonly versionNumber: number;
  readonly currencyIsoCode: string | null;
  readonly tcv: string;
  readonly expiryDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One entry of GET /quotes/{id}/audit-events. */
export interface AuditEvent {
  readonly id: number;
  readonly eventType:
    | "QUOTE_CREATED"
    | "DRAFT_SAVED"
    | "VERSION_SUBMITTED"
    | "VERSION_RECALLED"
    | "VERSION_DELETED"
    | "VERSION_CREATED"
    | "QUOTE_CLOSED"
    // Approvals.
    | "APPROVAL_WORKFLOW_CREATED"
    | "APPROVAL_REQUESTED"
    | "APPROVAL_APPROVED"
    // Kept for history from before Reject was merged into Return (2026-10-12).
    | "APPROVAL_REJECTED"
    // Primary quote (D68): on the quote, with no version.
    | "QUOTE_MADE_PRIMARY"
    | "QUOTE_PRIMARY_RELEASED"
    // Salesforce sync (D77): written to the opportunity, or refused by it.
    | "QUOTE_SYNCED"
    | "QUOTE_SYNC_FAILED"
    | "APPROVAL_RETURNED"
    | "VERSION_APPROVED"
    | "ORDER_FORM_PREVIEWED"
    | "ORDER_FORM_ISSUED"
    | "DOCUMENT_DOWNLOADED"
    | "DOCUMENT_GENERATION_FAILED";
  readonly versionNumber: number | null;
  readonly actorEmail: string;
  readonly occurredAt: string;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly comment: string | null;
  readonly metadata: Record<string, unknown> | null;
}

/** GET /quote-settings. */
export interface QuoteSettings {
  /** Expiry = submission date (UTC) + this many days. */
  readonly validityDays: number;
}

export interface QuoteList {
  readonly items: readonly QuoteListItem[];
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Order form documents
// ---------------------------------------------------------------------------

/** One issued document; the file is immutable (DGD-7). */
export interface DocumentView {
  readonly id: number;
  readonly documentNumber: number;
  readonly documentType: "ORDER_FORM" | "QUOTE";
  readonly layout: "DIRECT" | "PARTNER";
  readonly status: "ACTIVE" | "SUPERSEDED";
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly generatedAt: string;
  readonly generatedByEmail: string;
}

/** A version's documents and what the caller may do now. */
export interface DocumentsView {
  /** The owner, on an approved version not yet issued (DGD-2, DGD-3). */
  readonly canPreview: boolean;
  readonly canIssue: boolean;
  /** What issuing today would set. */
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly documents: readonly DocumentView[];
}

/** The answer to DELETE /quotes/{id}/versions/{n}. */
export interface DeleteDraftResult {
  /** The draft was the quote's only version, so the whole quote is gone. */
  readonly quoteDeleted: boolean;
  /** The latest version again; null when the quote is gone. */
  readonly latest: DraftResponse | null;
}

/** A quote on an opportunity, with which is primary (D68). Every AM sees them all (D69). */
export interface OpportunityQuote {
  readonly quoteId: number;
  readonly quoteNumber: string | null;
  readonly ownerEmail: string;
  readonly isPrimary: boolean;
  readonly status: VersionStatus;
  readonly versionNumber: number;
  readonly currencyIsoCode: string | null;
  readonly tcv: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** What AMs may do with quotes they don't own (D69). */
export type QuoteAccess = "VIEW" | "VIEW_EDIT";

/** Whose quotes the Quotes page lists (D70): the caller's own, or everyone's. */
export type QuoteScope = "mine" | "all";

/** GET /opportunities/{id}/products: what a new quote starts from (D72). */
export interface OpportunityProducts {
  readonly currencyIsoCode: string | null;
  readonly pricebook: { readonly id: string | null; readonly name: string | null } | null;
  /** One per Salesforce line, priced from the opportunity's price book. */
  readonly products: readonly Product[];
  /** Products the price book doesn't price, e.g. "not active in USD Price Book in USD". */
  readonly notBroughtIn: readonly { readonly productName: string; readonly reason: string }[];
}

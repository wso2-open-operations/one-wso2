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

// Sample quotes for tests: a draft with open issues, a complete priced draft,
// and the same quote submitted.

import type { DraftResponse, LineView } from "@features/sales/cado2/quotes/api/quoteTypes";

export const draft: DraftResponse = {
  quote: {
    id: 5,
    // A draft has no number until its first submit.
    quoteNumber: null,
    status: "DRAFT",
    ownerEmail: "rep@wso2.com",
    actions: ["CLOSE"],
    isPrimary: false,
    canEdit: true,
    sfOpportunityId: "006000000000001",
    sfAccountId: "001000000000001",
    createdAt: "2026-09-25T09:00:00Z",
    updatedAt: "2026-09-25T10:00:00Z",
    versions: [{ versionNumber: 1, status: "DRAFT", tcv: "0.00", submittedAt: null, updatedAt: "2026-09-25T10:00:00.123Z" }],
  },
  version: {
    versionNumber: 1,
    status: "DRAFT",
    pricingRulesVersion: "2026-09-M9",
    accountName: "Acme Corp",
    accountSalesRegion: "APAC",
    accountSubRegion: "South Asia",
    opportunityName: "Acme APIM renewal",
    dealType: "DIRECT",
    partner: null,
    legalEntityId: null,
    legalEntity: null,
    isRenewal: false,
    opportunityRecordType: "First Sale",
    dealKind: "FIRST_SALE",
    currencyIsoCode: "USD",
    subscriptionStartDate: "2026-10-01",
    subscriptionEndDate: "2027-09-30",
    yearCount: 1,
    years: [{ yearNumber: 1, startDate: "2026-10-01", endDate: "2027-09-30", net: null, arr: null }],
    billingFrequency: "ANNUAL",
    netTermsDays: 30,
    specialTerms: { enabled: false, text: null },
    governingTerms: { enabled: false, text: null },
    poNumber: null,
    justification: null,
    totals: { arr: "0.00", acv: "0.00", tcv: "0.00" },
    contacts: [],
    addresses: [],
    previousOpportunities: [],
    lines: [],
    issueDate: null,
    expiryDate: null,
    submittedAt: null,
    submittedByEmail: null,
    copiedFromVersion: null,
    closedReason: null,
    closedByEmail: null,
    closedAt: null,
    updatedAt: "2026-09-25T10:00:00.123Z",
    updatedByEmail: "rep@wso2.com",
  },
  issues: [{ field: "lines", message: "Add at least one product" }],
};

export const gateway: LineView = {
  id: 51,
  lineNumber: 1,
  sfProductId: "01t000000000001",
  productName: "WSO2 Gateway",
  productCode: "GW-01",
  pricebookEntryId: "01u000000000001",
  pricebookId: "01sFY26USD0000001A",
  pricebookName: "FY26 USD",
  unitPrice: "360",
  unitOfMeasure: "Gateways",
  productUnit: "APIM",
  classification: "PS",
  recurring: true,
  quantity: 20,
  category: "SUBSCRIPTION",
  discretionaryDiscountPercent: "10.00",
  yearNumber: 1,
  startDate: "2026-10-01",
  endDate: "2027-09-30",
  annualList: "7200.00",
  annualNet: "6480.00",
  arr: "6480.00",
  acv: "6480.00",
  tcv: "6480.00",
  schedule: [
    {
      yearNumber: 1,
      periodStart: "2026-10-01",
      periodEnd: "2027-09-30",
      yearFraction: "1.0000",
      gross: "7200.00",
      discount: "720.00",
      net: "6480.00",
      billing: "6480.00",
    },
  ],
};

/** A complete, priced draft with nothing left to fix (every step's checks pass). */
export const ready: DraftResponse = {
  ...draft,
  version: {
    ...draft.version,
    contacts: [
      { role: "BILLING", source: "SALESFORCE", sfContactId: "003000000000002", name: "Ana Payables", title: null, email: "ap@acme.example" },
      { role: "SECURITY", source: "SALESFORCE", sfContactId: "003000000000001", name: "Marco Ruiz", title: "Head of IT", email: "marco@acme.example" },
    ],
    addresses: [
      {
        type: "BILL_TO",
        source: "SALESFORCE",
        sfAccountId: "001000000000001",
        companyName: "Acme Corp",
        addressLine1: "1200 Market Street",
        addressLine2: null,
        city: "Philadelphia",
        stateProvince: "PA",
        postalCode: null,
        country: "USA",
        taxId: null,
      },
      {
        type: "SHIP_TO",
        source: "SAME_AS_BILL_TO",
        sfAccountId: null,
        companyName: "Acme Corp",
        addressLine1: null,
        addressLine2: null,
        city: null,
        stateProvince: null,
        postalCode: null,
        country: null,
        taxId: null,
      },
    ],
    legalEntityId: 1,
    legalEntity: { code: "WSO2_LLC", name: "WSO2, LLC." },
    totals: { arr: "6480.00", acv: "6480.00", tcv: "6480.00" },
    lines: [gateway],
  },
  issues: [],
};

export const submitted: DraftResponse = {
  quote: {
    ...ready.quote,
    quoteNumber: "Q-26-00005", // numbered at its first submit
    status: "SUBMITTED",
    actions: ["RECALL"],
    versions: [{ versionNumber: 1, status: "SUBMITTED", tcv: "6480.00", submittedAt: "2026-10-01T09:30:00Z", updatedAt: "2026-10-01T09:30:00.000Z" }],
  },
  version: {
    ...ready.version,
    status: "SUBMITTED",
    issueDate: "2026-10-01",
    expiryDate: "2026-10-31",
    submittedAt: "2026-10-01T09:30:00Z",
    submittedByEmail: "rep@wso2.com",
    updatedAt: "2026-10-01T09:30:00.000Z",
  },
  issues: [],
};

/** A submitted partner deal with every field filled in, for the read-only sheet. */
export const fullPartnerQuote: DraftResponse = {
  ...submitted,
  version: {
    ...submitted.version,
    dealType: "PARTNER",
    partner: { sfAccountId: "001PARTNER00000001", name: "Acme Reseller", role: "Reseller" },
    legalEntity: {
      code: "WSO2_LLC",
      name: "WSO2, LLC.",
      addressLine1: "787 Castro Street",
      city: "Mountain View",
      stateProvince: "CA",
      country: "USA",
    },
    isRenewal: true,
    previousOpportunities: [{ sfOpportunityId: "006PREV", name: "Acme renewal FY26", arr: null, currencyIsoCode: "USD" }],
    // A partner-led deal at 0% commission, so every figure stays as it is.
    partnerCommissionPercent: "0.00",
    totals: { arr: "6480.00", acv: "6480.00", tcv: "6480.00", partnerCommission: "0.00", netOrderValue: "6480.00" },
    netTermsDays: 45,
    poNumber: "PO-4471",
    specialTerms: { enabled: true, text: "Custom SLA credits" },
    governingTerms: { enabled: false, text: null },
    justification: "Strategic logo in the region",
    contacts: [
      { role: "BILLING", source: "MANUAL", sfContactId: null, name: "Jane Payables", title: null, email: "ap@reseller.example" },
      { role: "SECURITY", source: "SALESFORCE", sfContactId: "003VM00000CONTAC1A", name: "Marco Ruiz", title: "Head of IT", email: "marco@acme.example" },
    ],
    addresses: [
      {
        type: "BILL_TO",
        source: "SALESFORCE",
        sfAccountId: "001PARTNER00000001",
        companyName: "Acme Reseller Ltd",
        addressLine1: "1 Partner Way",
        addressLine2: null,
        city: "London",
        stateProvince: null,
        postalCode: "EC1A 1AA",
        country: "United Kingdom",
        taxId: "GB123",
      },
      {
        type: "SHIP_TO",
        source: "MANUAL",
        sfAccountId: "001000000000001",
        companyName: "Acme Corp",
        addressLine1: "1200 Market Street",
        addressLine2: "Suite 400",
        city: "Philadelphia",
        stateProvince: "PA",
        postalCode: null,
        country: "USA",
        taxId: null,
      },
    ],
  },
};


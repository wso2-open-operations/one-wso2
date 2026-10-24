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
import { durationShort, emptyDraftForm, fromVersion } from "@features/sales/cado2/quotes/form/draftForm";
import { draft, fullPartnerQuote } from "@features/sales/cado2/quotes/testing/fixtures";
import { expiryState, sheetFromForm, sheetFromVersion, hasYearlySchedule, orderForm, termLabel, yearOpportunity } from "./sheetModel";
import { initialsOfName as initialsFor } from "@features/sales/cado2/utils/initials";
import { lifecycleSteps } from "./lifecycleSteps";

describe("sheetFromVersion", () => {
  const s = sheetFromVersion(fullPartnerQuote);

  it("carries everything that was submitted", () => {
    expect(s).toMatchObject({
      accountName: "Acme Corp",
      opportunityName: "Acme APIM renewal",
      dealType: "PARTNER",
      partner: { name: "Acme Reseller", role: "Reseller" },
      isRenewal: true,
      previousOpportunities: ["Acme renewal FY26"],
      legalEntity: { name: "WSO2, LLC.", address: "787 Castro Street, Mountain View, CA, USA" },
      currency: "USD",
      startDate: "2026-10-01",
      endDate: "2027-09-30",
      billingFrequency: "ANNUAL",
      recurring: true,
      netTermsDays: 45,
      poNumber: "PO-4471",
      specialTerms: "Custom SLA credits",
      legal: null, // the fixture has no legal sections
      justification: "Strategic logo in the region",
      pricingRulesVersion: "2026-09-M9",
    });
    // Billing, then security.
    expect(s.contacts).toHaveLength(2);
    expect(s.contacts[0]).toMatchObject({ name: "Jane Payables", source: "MANUAL" });
    expect(s.contacts[1]).toMatchObject({ name: "Marco Ruiz", title: "Head of IT", source: "SALESFORCE" });
    expect(s.billTo).toEqual({ companyName: "Acme Reseller Ltd", lines: ["1 Partner Way", "London, EC1A 1AA", "United Kingdom"], taxId: "GB123" });
    expect(s.shipTo?.lines).toEqual(["1200 Market Street", "Suite 400", "Philadelphia, PA", "USA"]);
    expect(s.lines[0]).toMatchObject({ productName: "WSO2 Gateway", quantity: "20", discountPercent: "10", annualNet: "6480.00", tcv: "6480.00" });
    expect(s.years).toHaveLength(1);
    expect(s.totals?.tcv).toBe("6480.00");
  });

  it("shows how a saved formula line was priced (D81)", () => {
    const line = fullPartnerQuote.version.lines[0];
    const withFormula = {
      ...fullPartnerQuote,
      version: {
        ...fullPartnerQuote.version,
        lines: [
          {
            ...line,
            discretionaryDiscountPercent: "0",
            pricingMethod: "FORMULA" as const,
            formula: { versionId: 6, version: 3, versionDate: "2026-10-15", expression: "max($1, $2)", explanation: "max(25,000, 648)", listPrice: "0", values: [] },
          },
        ],
      },
    };
    expect(sheetFromVersion(withFormula).lines[0].formula).toEqual({ version: "v3 · 15 Oct 2026", explanation: "max(25,000, 648)" });
    expect(s.lines[0].formula).toBeNull();
  });

  it("leaves unpriced drafts without totals", () => {
    const d = sheetFromVersion(draft);
    expect(d.totals).toBeNull();
    expect(d.years).toEqual([]);
    expect(d.lines).toEqual([]);
  });
});

describe("sheetFromForm", () => {
  it("shows the unsaved form the same way as the saved version", () => {
    const form = fromVersion(fullPartnerQuote);
    const fromForm = sheetFromForm(form, null, { name: "WSO2, LLC.", country: "USA" });
    const saved = sheetFromVersion(fullPartnerQuote);
    for (const k of ["accountName", "opportunityName", "dealType", "partner", "currency", "startDate", "endDate", "recurring", "billingFrequency", "poNumber", "specialTerms", "justification"] as const) {
      expect(fromForm[k], k).toEqual(saved[k]);
    }
    // The same years; the form's amounts wait for the live preview.
    const dates = (s: typeof saved) => s.contractYears.map(({ number, start, end }) => ({ number, start, end }));
    expect(dates(fromForm)).toEqual(dates(saved));
    expect(fromForm.contacts.map((c) => c?.name ?? null)).toEqual(["Jane Payables", "Marco Ruiz"]);
    expect(fromForm.previousOpportunityCount).toBe(1);
  });

  it("takes a formula line's price and explanation from the preview, with no discount (D81)", () => {
    const form = fromVersion(fullPartnerQuote);
    const preview = {
      rulesVersion: "2026-09-M9",
      termMonths: "12",
      totals: null as never,
      years: [],
      lines: [
        {
          pricebookEntryId: form.lines[0].pricebookEntryId,
          unitPrice: "25000.00",
          pricingMethod: "FORMULA" as const,
          formula: { versionId: 6, version: 3, versionDate: "2026-10-15", expression: "max($1, $2)", explanation: "max(25,000, 648)", listPrice: "0", values: [] },
          annualList: "25000.00",
          annualNet: "25000.00",
          arr: "25000.00",
          tcv: "25000.00",
          schedule: [],
        },
      ],
    };
    const line = sheetFromForm(form, preview, null).lines[0];
    expect(line).toMatchObject({
      unitPrice: "25000.00",
      discountPercent: "0",
      formula: { version: "v3 · 15 Oct 2026", explanation: "max(25,000, 648)" },
    });

    const plain = sheetFromForm(form, null, null).lines[0];
    expect(plain.formula).toBeNull();
    expect(plain.discountPercent).toBe("10");
  });

  it("marks what isn't chosen yet", () => {
    const s = sheetFromForm(emptyDraftForm(), null, null);
    expect(s.contacts).toEqual([null, null]);
    expect(s.billTo).toBeNull();
    expect(s.legalEntity).toBeNull();
    expect(s.totals).toBeNull();
  });
});

describe("labels", () => {
  it("names the term by its length, in words (D85)", () => {
    expect(termLabel({ startDate: "2027-01-01", endDate: "2027-12-31" })).toBe("1 year");
    expect(termLabel({ startDate: "2027-01-01", endDate: "2029-12-31" })).toBe("3 years");
    expect(termLabel({ startDate: "2027-01-01", endDate: "2027-06-30" })).toBe("6 months");
    expect(termLabel({ startDate: "2027-01-01", endDate: "2028-01-01" })).toBe("1 year + 1 day");
    expect(termLabel({ startDate: "", endDate: "" })).toBe("");
    // Short, for the products table (D94).
    expect(durationShort("2027-01-01", "2029-12-31")).toBe("3Y");
    expect(durationShort("2027-01-01", "2028-01-01")).toBe("1Y 1D");
    expect(durationShort("2027-01-01", "2028-02-01")).toBe("1Y 1M 1D");
    expect(durationShort("2027-01-01", "2027-12-30")).toBe("11M 30D");
    expect(durationShort("", "")).toBe("");
  });

  it("names each year's opportunity, and shows a schedule only past one year", () => {
    expect(yearOpportunity(1)).toBe("This quote's opportunity");
    expect(yearOpportunity(2)).toBe("Own opportunity, created later");
    const year = (n: number) => ({ yearNumber: n, periodStart: "", periodEnd: "", net: "1.00", billing: "1.00" });
    expect(hasYearlySchedule({ years: [year(1)] })).toBe(false);
    expect(hasYearlySchedule({ years: [year(1), year(2)] })).toBe(true);
  });

  it("leaves order-form totals blank until every line is priced", () => {
    const s = sheetFromVersion(fullPartnerQuote);
    expect(orderForm(s.lines)).toMatchObject({ groups: [{ title: "Subscription", subtotal: "6480.00" }], total: "6480.00" });
    const unpriced = orderForm([{ ...s.lines[0], tcv: null }]);
    expect(unpriced.total).toBeNull();
    expect(unpriced.groups[0].subtotal).toBeNull();
  });

  it("makes avatar initials", () => {
    expect(initialsFor("Northwind Logistics")).toBe("NL");
    expect(initialsFor("marco")).toBe("M");
    expect(initialsFor("WSO2, LLC.")).toBe("WL");
    expect(initialsFor("")).toBe("?");
  });

  it("colours the expiry countdown by the UTC day", () => {
    const now = new Date("2026-10-01T09:00:00Z");
    expect(expiryState("2026-10-31", now)).toEqual({ days: 30, tone: "ok", label: "30 days left" });
    expect(expiryState("2026-10-08", now).tone).toBe("soon");
    expect(expiryState("2026-10-01", now)).toMatchObject({ tone: "soon", label: "Expires today" });
    expect(expiryState("2026-09-29", now)).toMatchObject({ tone: "expired", label: "Expired 2 days ago" });
  });
});

describe("lifecycleSteps", () => {
  const ev = (eventType: string, extra = {}) => ({
    id: 1, eventType, versionNumber: 1, actorEmail: "rep@wso2.com", occurredAt: "2026-10-01T09:00:00Z",
    fromStatus: null, toStatus: null, comment: null, metadata: null, ...extra,
  }) as never;

  it("shows what happened, then what comes next", () => {
    const steps = lifecycleSteps(fullPartnerQuote, [ev("QUOTE_CREATED"), ev("DRAFT_SAVED"), ev("VERSION_SUBMITTED")]);
    // The expiry is the chip above the timeline, not a step (C4, 2026-10-14).
    expect(steps.map((s) => s.label)).toEqual(["Quote created", "Submitted", "In approval"]);
  });

  it("shows a closure from the version even without the history", () => {
    const closed = {
      ...fullPartnerQuote,
      version: { ...fullPartnerQuote.version, status: "CLOSED" as const, closedReason: "Lost", closedByEmail: "rep@wso2.com", closedAt: "2026-10-05T09:00:00Z" },
    };
    expect(lifecycleSteps(closed, []).at(-1)).toMatchObject({ label: "Quote closed", note: "Lost", when: "5 Oct 2026", tone: "error" });
  });
});

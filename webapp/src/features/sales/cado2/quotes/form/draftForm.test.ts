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
import type { DraftResponse } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  addressFrom,
  commissionProblem,
  durationText,
  emptyDraftForm,
  endDateFor,
  addYear,
  cloneYear,
  contractYears,
  expiryFor,
  formatDate,
  fromVersion,
  pulledLines,
  alignPreview,
  isExpired,
  parseDateString,
  splitStreet,
  stepOfField,
  storedPricing,
  lastYearEndProblem,
  lineDatesProblem,
  deleteYear,
  insertIndex,
  salesPriceProblem,
  setLastYearEnd,
  toDateString,
  toDraftInput,
  toPreviewBody,
  type DraftFormValues,
} from "./draftForm";

describe("dates", () => {
  it("ends a term the day before its anniversary", () => {
    expect(endDateFor("2027-01-01", 1)).toBe("2027-12-31");
    expect(endDateFor("2027-01-01", 3)).toBe("2029-12-31");
    expect(endDateFor("2027-07-15", 2)).toBe("2029-07-14");
  });

  it("clamps a leap-day start the way the backend does", () => {
    expect(endDateFor("2028-02-29", 1)).toBe("2029-02-27");
  });


  it("round-trips local dates without a UTC shift", () => {
    // setup.ts runs the suite in America/Los_Angeles to catch exactly this.
    expect(toDateString(parseDateString("2027-01-01")!)).toBe("2027-01-01");
    expect(parseDateString("2027-02-30")).toBeNull();
    expect(parseDateString("01/01/2027")).toBeNull();
  });
});

describe("addresses", () => {
  it("puts the first street line in line 1 and the rest in line 2", () => {
    expect(splitStreet("1200 Market Street\nSuite 400\nFloor 2")).toEqual(["1200 Market Street", "Suite 400, Floor 2"]);
    expect(splitStreet("  One line  ")).toEqual(["One line", ""]);
    expect(splitStreet(null)).toEqual(["", ""]);
  });

  it("pre-fills from a Salesforce account", () => {
    const a = addressFrom("001A", "Northwind", {
      street: "1200 Market Street\nSuite 400",
      city: "Philadelphia",
      stateProvince: "PA",
      postalCode: "19107",
      country: "USA",
    });
    expect(a).toMatchObject({
      sfAccountId: "001A",
      companyName: "Northwind",
      addressLine1: "1200 Market Street",
      addressLine2: "Suite 400",
      country: "USA",
      taxId: "",
    });
  });
});

function filled(): DraftFormValues {
  return {
    ...emptyDraftForm(),
    accountId: "001VM00000ABCDEAA4",
    opportunityId: "006VM00000O4AUSYA3",
    currencyIsoCode: "USD",
    startDate: "2027-01-01",
    yearCount: 3,
    billingFrequency: "ANNUAL",
    legalEntityId: "7",
    netTermsDays: "30",
    securityContact: {
      mode: "salesforce",
      sfContactId: "003A",
      name: "Marco",
      title: "",
      email: "",
    },
    billingContact: {
      mode: "manual",
      sfContactId: "",
      name: " Jane ",
      title: "",
      email: "ap@x.example",
    },
    billTo: {
      ...addressFrom("001A", "Northwind", {
        street: "1 St",
        city: "Phl",
        stateProvince: null,
        postalCode: null,
        country: "USA",
      }),
    },
    shipToSameAsBillTo: true,
    specialTermsEnabled: false,
    specialTerms: "stale text that must not be sent",
    lines: [
      {
        lineId: 11,
        pricebookEntryId: "01uA",
        productName: "Gateway",
        productCode: "GW",
        productDescription: "",
        pricebookId: "01sFY26",
        pricebookName: "FY26",
        unitPrice: "360",
        category: "SUBSCRIPTION",
        categorySource: "REP",
        recurring: true,
        classification: "PS",
        unitOfMeasure: "",
        quantity: "20",
        discount: "10",
        yearNumber: 1,
        startDate: "",
        endDate: "",
        salesPrice: "",
        key: `k-${Math.random()}`,
        parentKey: "",
      },
      {
        lineId: null,
        pricebookEntryId: "01uB",
        productName: "Portal",
        productCode: "",
        productDescription: "",
        pricebookId: "01sFY26",
        pricebookName: "FY26",
        unitPrice: "4800",
        category: "SUBSCRIPTION",
        categorySource: "REP",
        recurring: true,
        classification: "PS",
        unitOfMeasure: "Portals",
        quantity: "1",
        discount: "",
        yearNumber: 1,
        startDate: "",
        endDate: "",
        salesPrice: "",
        key: `k-${Math.random()}`,
        parentKey: "",
      },
    ],
  };
}

describe("toDraftInput", () => {
  it("sends the Overview's primary tick, a setting of the quote (D68)", () => {
    expect(toDraftInput({ ...emptyDraftForm(), isPrimary: true }).isPrimary).toBe(true);
    expect(toDraftInput(emptyDraftForm()).isPrimary).toBe(false);
  });

  it("sends choices, never prices, and keeps saved lines' snapshots", () => {
    const input = toDraftInput(filled(), "2026-09-25T10:00:00.123Z");

    expect(input).toMatchObject({ yearCount: 3, lastYearEndDate: undefined, billingFrequency: "ANNUAL" });
    expect(input.expectedUpdatedAt).toBe("2026-09-25T10:00:00.123Z");
    expect(input.legalEntityId).toBe(7);
    expect(input.netTermsDays).toBe(30);
    expect(input.lines[0]).toEqual({
      keepSnapshotFromLineId: 11,
      pricebookEntryId: "01uA",
      quantity: 20,
      category: "SUBSCRIPTION",
      discretionaryDiscountPercent: "10",
      unitOfMeasure: undefined,
      useLatestFormula: undefined,
      yearNumber: 1,
      startDate: undefined, // the whole year: the backend fills it in
      endDate: undefined,
    });
    expect(input.lines[1]).toMatchObject({
      discretionaryDiscountPercent: "0",
      keepSnapshotFromLineId: undefined,
    });
    expect(JSON.stringify(input)).not.toContain("unitPrice");
  });

  // D82: a saved line keeps its pricing; only a line the AM moved asks for the pricing in force.
  it("keeps a saved line's pricing unless the AM moved it", () => {
    const v = filled();
    const keepPricing = { method: "FORMULA" as const, formulaVersionId: 6, formula: null };
    const kept = { ...v, lines: [{ ...v.lines[0], keepPricing }] };
    expect(toDraftInput(kept).lines[0].useLatestFormula).toBeUndefined();
    expect((toPreviewBody(kept) as { lines: { keepPricing?: unknown }[] }).lines[0].keepPricing).toEqual({
      method: "FORMULA",
      formulaVersionId: 6,
    });

    const moved = { ...v, lines: [{ ...v.lines[0], keepPricing, useLatestPricing: true }] };
    expect(toDraftInput(moved).lines[0].useLatestFormula).toBe(true);
    expect((toPreviewBody(moved) as { lines: { keepPricing?: unknown }[] }).lines[0].keepPricing).toBeUndefined();
  });

  it("maps contacts, addresses and switched-off terms", () => {
    const input = toDraftInput(filled());

    expect(input.contacts.security).toEqual({ sfContactId: "003A" });
    expect(input.contacts).not.toHaveProperty("primary"); // no primary contact
    expect(input.contacts.billing).toEqual({
      name: "Jane",
      email: "ap@x.example",
      title: undefined,
    });
    expect(input.shipTo).toBeUndefined();
    expect(input.shipToSameAsBillTo).toBe(true);
    expect(input.specialTerms).toEqual({ enabled: false, text: undefined });
  });

  it("sends the years, a shortened last year, and each line's own dates", () => {
    const v = filled();
    const input = toDraftInput({
      ...v,
      yearCount: 2,
      lastYearEndDate: "2028-06-30",
      lines: [{ ...v.lines[0], yearNumber: 2, startDate: "2028-03-01" }, { ...v.lines[1], recurring: false, endDate: "2027-05-01" }],
    });
    expect(input).toMatchObject({ yearCount: 2, lastYearEndDate: "2028-06-30" });
    expect(input.lines[0]).toMatchObject({ yearNumber: 2, startDate: "2028-03-01", endDate: undefined });
    expect(input.lines[1]).toMatchObject({ yearNumber: 1, endDate: undefined }); // a one-off has no end
    expect(toDraftInput({ ...v, yearCount: 0 }).yearCount).toBeUndefined();
  });

  it("drops previous opportunities when the quote is not a renewal", () => {
    const v = {
      ...filled(),
      isRenewal: false,
      previousOpportunityIds: ["006P"],
    };
    expect(toDraftInput(v).previousOpportunityIds).toEqual([]);
  });
});

describe("toPreviewBody", () => {
  it("is null until there is enough to price", () => {
    expect(toPreviewBody(emptyDraftForm())).toBeNull();
    expect(toPreviewBody({ ...filled(), billingFrequency: "" })).toBeNull();
    expect(toPreviewBody({ ...filled(), lines: [] })).toBeNull();
    expect(toPreviewBody({ ...filled(), yearCount: 0 })).toBeNull();
    expect(toPreviewBody({ ...filled(), lastYearEndDate: "2030-01-01" })).toBeNull(); // Year 3 over 12 months
    const v = filled();
    expect(toPreviewBody({ ...v, lines: [{ ...v.lines[0], startDate: "2028-01-01" }] })).toBeNull(); // outside Year 1
  });

  it("prices a line waiting for its category too (D72, D76)", () => {
    const v = filled();
    const waiting = { ...v, lines: [...v.lines, { ...v.lines[0], pricebookEntryId: "01uWAIT", category: "" as const }] };
    const body = toPreviewBody(waiting) as { lines: { pricebookEntryId: string; category: string }[] };
    expect(body.lines.at(-1)).toMatchObject({ pricebookEntryId: "01uWAIT", category: "" });
    // An uncategorised product still needs a year.
    expect(toPreviewBody({ ...v, yearCount: 0, lines: [{ ...v.lines[0], category: "" }] })).toBeNull();
  });

  it("carries the years and the lines' choices", () => {
    expect(toPreviewBody(filled())).toMatchObject({
      yearCount: 3,
      billingFrequency: "ANNUAL",
      lines: [{ pricebookEntryId: "01uA", quantity: 20, yearNumber: 1 }, { pricebookEntryId: "01uB", yearNumber: 1 }],
    });
    expect(JSON.stringify(toPreviewBody(filled()))).not.toContain("uplift");
  });

  it("prices a shortened last year with the chosen billing", () => {
    expect(toPreviewBody({ ...filled(), yearCount: 2, lastYearEndDate: "2028-03-31", billingFrequency: "QUARTERLY" })).toMatchObject({
      yearCount: 2,
      lastYearEndDate: "2028-03-31",
      billingFrequency: "QUARTERLY",
    });
  });

  it("prices a quote with no recurring product in Year 1, with its billing (D88)", () => {
    const v = filled();
    const services = { ...v, yearCount: 1, billingFrequency: "UPFRONT" as const, lines: v.lines.map((l) => ({ ...l, recurring: false })) };
    expect(toPreviewBody(services)).toMatchObject({ subscriptionStartDate: "2027-01-01", yearCount: 1, billingFrequency: "UPFRONT" });
    expect(toPreviewBody({ ...services, billingFrequency: "" })).toBeNull();
  });
});

describe("contract years", () => {
  const line = (yearNumber: number, recurring = true, startDate = "", endDate = "") =>
    ({ ...filled().lines[0], lineId: 9, yearNumber, recurring, startDate, endDate });

  it("lays out 12-month years from the start, the last one shortened when set", () => {
    expect(contractYears("2027-03-15", 3)).toEqual([
      { number: 1, start: "2027-03-15", end: "2028-03-14" },
      { number: 2, start: "2028-03-15", end: "2029-03-14" },
      { number: 3, start: "2029-03-15", end: "2030-03-14" },
    ]);
    expect(contractYears("2027-01-01", 2, "2028-06-30").at(-1)).toEqual({ number: 2, start: "2028-01-01", end: "2028-06-30" });
    expect(contractYears("", 2)).toEqual([]);
    expect(lastYearEndProblem("2027-01-01", 2, "2029-01-01")).toMatch(/at most 12 months/);
    expect(lastYearEndProblem("2027-01-01", 2, "2027-12-31")).toMatch(/on or after it starts/);
  });

  it("keeps a line's dates within its own year", () => {
    const years = contractYears("2027-01-01", 2);
    expect(lineDatesProblem(line(2, true, "2028-04-01"), years)).toBe("");
    expect(lineDatesProblem(line(2, true, "2027-06-01"), years)).toMatch(/within Year 2/);
    expect(lineDatesProblem(line(1, true, "2027-06-01", "2027-05-01"), years)).toMatch(/before the start/);
  });

  it("clones only a year's recurring lines into a new last year, as new lines", () => {
    const v = { ...filled(), yearCount: 2, lastYearEndDate: "2028-06-30", lines: [line(1), line(1, false), line(2, true, "2028-03-01")] };
    const next = cloneYear(v, 2);
    expect(next.yearCount).toBe(3);
    expect(next.lastYearEndDate).toBe(""); // Year 2 is a full year again
    const copies = next.lines.slice(3);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ yearNumber: 3, lineId: null, startDate: "2029-03-01", endDate: "" });
    expect(cloneYear(v, 1).lines.slice(3).map((l) => l.recurring)).toEqual([true]); // the one-off stays behind
  });

  it("adds a year at the end", () => {
    expect(addYear({ yearCount: 2 })).toEqual({ yearCount: 3, lastYearEndDate: "" });
  });

  it("deletes any year; later years move up 12 months, with their products' own dates", () => {
    const v = { ...filled(), yearCount: 3, lastYearEndDate: "2029-06-30", lines: [line(1), line(2), line(3, true, "2029-03-01")] };
    const next = deleteYear(v, 2);
    expect(next.yearCount).toBe(2);
    expect(next.lastYearEndDate).toBe("2028-06-30"); // the short last year keeps its length
    expect(next.lines.map((l) => [l.yearNumber, l.startDate])).toEqual([[1, ""], [2, "2028-03-01"]]);
    // Deleting the last year leaves a full one.
    expect(deleteYear(v, 3)).toMatchObject({ yearCount: 2, lastYearEndDate: "" });
  });

  it("puts a new line after its year's lines, so numbers run year by year", () => {
    const lines = [{ yearNumber: 1 }, { yearNumber: 1 }, { yearNumber: 2 }, { yearNumber: 3 }];
    expect(insertIndex(lines, 1)).toBe(2);
    expect(insertIndex(lines, 2)).toBe(3);
    expect(insertIndex(lines, 3)).toBe(4);
    expect(insertIndex([{ yearNumber: 2 }], 1)).toBe(0);
  });

  it("pulls the last year's products back within a shortened year", () => {
    const v = { ...filled(), yearCount: 2, lines: [line(2, true, "2028-09-01", "2028-11-30"), line(1)] };
    const next = setLastYearEnd(v, "2028-06-30");
    expect(next.lastYearEndDate).toBe("2028-06-30");
    expect(next.lines[0]).toMatchObject({ startDate: "", endDate: "" });
    expect(next.lines[1]).toBe(v.lines[1]);
    expect(setLastYearEnd(v, "2028-12-31").lastYearEndDate).toBe(""); // a full year again
  });

  it("says the duration in words, as the backend does (D85)", () => {
    expect(durationText("2027-01-01", "2027-12-31")).toBe("1 year");
    expect(durationText("2027-01-01", "2029-12-31")).toBe("3 years");
    expect(durationText("2027-01-01", "2028-01-01")).toBe("1 year + 1 day");
    expect(durationText("2027-01-01", "2027-12-30")).toBe("11 months + 30 days");
    expect(durationText("2027-01-01", "2029-03-31")).toBe("2 years + 3 months");
    expect(durationText("2027-03-05", "2027-03-05")).toBe("1 day");
    expect(durationText("2027-01-31", "2027-02-27")).toBe("1 month");
    expect(durationText("2027-03-05", "2027-03-04")).toBe("");
  });

});

describe("bundles", () => {
  const base = () => filled().lines[0];
  const parent = { ...base(), key: "p", parentKey: "", yearNumber: 1 };
  const child = { ...base(), pricebookEntryId: "01uC", key: "c", parentKey: "p", yearNumber: 1, recurring: false };

  it("names a child's parent by position when saving", () => {
    const input = toDraftInput({ ...filled(), lines: [base(), parent, child] });
    expect(input.lines[2].parentIndex).toBe(1);
    expect(input.lines[1].parentIndex).toBeUndefined();
  });

  it("clones a recurring parent with its children, as new linked lines", () => {
    const next = cloneYear({ ...filled(), yearCount: 1, lines: [parent, child] }, 1);
    const [p2, c2] = next.lines.slice(2);
    expect(p2.yearNumber).toBe(2);
    expect(c2).toMatchObject({ yearNumber: 2, parentKey: p2.key, pricebookEntryId: "01uC" }); // a one-off child comes along
    expect(p2.key).not.toBe("p");
  });

  it("leaves a child behind with its non-recurring parent", () => {
    const oneOff = { ...parent, recurring: false };
    const recurringChild = { ...child, recurring: true };
    expect(cloneYear({ ...filled(), yearCount: 1, lines: [oneOff, recurringChild] }, 1).lines).toHaveLength(2);
  });
});

describe("sales price", () => {
  it("sends a raised sales price, and none when it is the list price", () => {
    const v = filled();
    const input = toDraftInput({ ...v, lines: [{ ...v.lines[0], salesPrice: "400" }, v.lines[1]] });
    expect(input.lines[0].salesPrice).toBe("400");
    expect(input.lines[1].salesPrice).toBeUndefined();
    expect((toPreviewBody({ ...v, lines: [{ ...v.lines[0], salesPrice: "400" }] }) as { lines: { salesPrice?: string }[] }).lines[0].salesPrice).toBe("400");
  });

  it("allows the list price or more, with at most 2 decimals", () => {
    expect(salesPriceProblem("", "360")).toBe("");
    expect(salesPriceProblem("360", "360")).toBe("");
    expect(salesPriceProblem("400.50", "360")).toBe("");
    expect(salesPriceProblem("359.99", "360")).toMatch(/below the list price \(360.00\)/);
    expect(salesPriceProblem("400.123", "360")).toMatch(/2 decimals/);
  });
});

describe("fromVersion", () => {
  it("rebuilds the form from a saved draft", () => {
    const res = {
      quote: { id: 1, sfAccountId: "001A", sfOpportunityId: "006A" },
      version: {
        accountName: "Northwind",
        opportunityName: "API 2027",
        dealType: "PARTNER",
        partner: { sfAccountId: "001P", name: "Acme", role: "Reseller" },
        legalEntityId: 7,
        isRenewal: false,
        currencyIsoCode: "USD",
        subscriptionStartDate: "2027-01-01",
        subscriptionEndDate: "2027-06-30",
        yearCount: 1,
        years: [{ yearNumber: 1, startDate: "2027-01-01", endDate: "2027-06-30", net: null, arr: null }],
        billingFrequency: "ANNUAL",
        netTermsDays: 45,
        specialTerms: { enabled: true, text: "SLA" },
        governingTerms: { enabled: false, text: null },
        poNumber: null,
        justification: null,
        contacts: [
          {
            role: "SECURITY",
            source: "SALESFORCE",
            sfContactId: "003A",
            name: "Marco",
            title: null,
            email: null,
          },
        ],
        addresses: [
          {
            type: "BILL_TO",
            source: "SALESFORCE",
            sfAccountId: "001P",
            companyName: "Acme",
            addressLine1: "1",
            addressLine2: null,
            city: "L",
            stateProvince: null,
            postalCode: null,
            country: "UK",
            taxId: null,
          },
          {
            type: "SHIP_TO",
            source: "SAME_AS_BILL_TO",
            sfAccountId: "001P",
            companyName: "Acme",
            addressLine1: "1",
            addressLine2: null,
            city: "L",
            stateProvince: null,
            postalCode: null,
            country: "UK",
            taxId: null,
          },
        ],
        previousOpportunities: [],
        lines: [
          {
            id: 55,
            pricebookEntryId: "01uA",
            productName: "Gateway",
            productCode: null,
            pricebookId: "01sFY26",
        pricebookName: "FY26",
            unitPrice: "360",
            unitOfMeasure: null,
            quantity: 20,
            category: "SUBSCRIPTION",
            discretionaryDiscountPercent: "10.00",
            recurring: true,
            classification: "PS",
            yearNumber: 1,
            startDate: "2027-01-01",
            endDate: "2027-04-30",
          },
        ],
      },
      issues: [],
    } as unknown as DraftResponse;

    const v = fromVersion(res);

    expect(v.yearCount).toBe(1);
    expect(v.lastYearEndDate).toBe("2027-06-30"); // a shortened Year 1
    expect(v.billingFrequency).toBe("ANNUAL");
    expect(v.netTermsDays).toBe("45");
    expect(v.shipToSameAsBillTo).toBe(true);
    expect(v.securityContact).toMatchObject({
      mode: "salesforce",
      sfContactId: "003A",
    });
    expect(v.billingContact.mode).toBe("none");
    expect(v.lines[0]).toMatchObject({
      lineId: 55,
      discount: "10",
      yearNumber: 1,
      startDate: "", // the year's own start
      endDate: "2027-04-30", // narrowed within the year
    });
    expect(v.partner?.name).toBe("Acme");
  });
});

describe("stepOfField", () => {
  it("sends each issue to the step that owns the field", () => {
    expect(stepOfField("legalEntityId")).toBe(0);
    expect(stepOfField("contacts.billing")).toBe(2);
    expect(stepOfField("defaultPricebookId")).toBe(1); // the price book card is on Products & Pricing
    expect(stepOfField("lines")).toBe(1);
    expect(stepOfField("lines[2].quantity")).toBe(1);
    expect(stepOfField("subscriptionStartDate")).toBe(1); // with the term (D73)
    expect(stepOfField("billingFrequency")).toBe(2); // Commercials (D86)
    expect(stepOfField("years")).toBe(1);
    expect(stepOfField("lastYearEndDate")).toBe(1);
    expect(stepOfField("billTo.city")).toBe(2);
    expect(stepOfField("contacts.billing")).toBe(2);
    expect(stepOfField("netTermsDays")).toBe(2); // the Payment Terms card on Commercials (D86)
    expect(stepOfField("poNumber")).toBe(2);
    expect(stepOfField("specialTerms.billing")).toBe(3); // the Legal step
    expect(stepOfField("partnerContractDate")).toBe(3);
    expect(stepOfField("legalTerms")).toBe(3);
  });
});

describe("storedPricing", () => {
  const row = (yearNumber: number, periodStart: string, periodEnd: string, net: string, billing: string) => ({
    yearNumber, periodStart, periodEnd, yearFraction: "1.0000", gross: net, discount: "0.00", net, billing,
  });
  const res = {
    version: {
      pricingRulesVersion: "2026-09-D4",
      subscriptionStartDate: "2027-01-01",
      subscriptionEndDate: "2028-06-30",
      years: [
        { yearNumber: 1, startDate: "2027-01-01", endDate: "2027-12-31", net: "1000.30", arr: "1000.30" },
        { yearNumber: 2, startDate: "2028-01-01", endDate: "2028-06-30", net: "500.15", arr: "1000.30" },
      ],
      totals: { arr: "1000.30", acv: "1000.30", tcv: "1500.45", payableNow: "1000.30" },
      lines: [
        { pricebookEntryId: "01uA", annualList: "1000.10", annualNet: "1000.10", arr: "1000.10", tcv: "1500.15",
          schedule: [row(1, "2027-01-01", "2027-12-31", "1000.10", "1000.10"), row(2, "2028-01-01", "2028-06-30", "500.05", "500.05")] },
        { pricebookEntryId: "01uB", annualList: "0.20", annualNet: "0.20", arr: "0.20", tcv: "0.30",
          schedule: [row(1, "2027-04-01", "2027-12-31", "0.20", "0.20"), row(2, "2028-01-01", "2028-06-30", "0.10", "0.10")] },
      ],
    },
  } as unknown as DraftResponse;

  it("rebuilds the yearly schedule from the stored rows, summed exactly", () => {
    const p = storedPricing(res);
    expect(p?.totals.tcv).toBe("1500.45");
    expect(p?.years).toEqual([
      { yearNumber: 1, periodStart: "2027-01-01", periodEnd: "2027-12-31", net: "1000.30", arr: "1000.30", billing: "1000.30", commission: "0.00", netBilling: "1000.30" },
      { yearNumber: 2, periodStart: "2028-01-01", periodEnd: "2028-06-30", net: "500.15", arr: "1000.30", billing: "500.15", commission: "0.00", netBilling: "500.15" },
    ]);
    expect(p?.lines[1].annualNet).toBe("0.20");
  });

  it("shows a stored line waiting for its category with its amount (D75)", () => {
    const waiting = {
      version: { ...res.version, lines: [res.version.lines[0], { ...res.version.lines[1], category: "" }] },
    } as unknown as DraftResponse;
    const p = storedPricing(waiting);
    expect(p?.lines[0].tcv).toBe("1500.15");
    expect(p?.lines[1].tcv).toBe(res.version.lines[1].tcv);
  });

  it("is null when a line was stored unpriced", () => {
    const unpriced = { version: { ...res.version, lines: [{ ...res.version.lines[0], schedule: [] }] } } as unknown as DraftResponse;
    expect(storedPricing(unpriced)).toBeNull();
  });

  it("shows a services-only quote in its one year", () => {
    const services = {
      version: {
        ...res.version,
        subscriptionEndDate: "2027-12-31",
        years: [{ yearNumber: 1, startDate: "2027-01-01", endDate: "2027-12-31", net: "720.00", arr: "0.00" }],
        totals: { arr: null, acv: null, tcv: "720.00", payableNow: "720.00" },
        lines: [{ ...res.version.lines[0], category: "PROFESSIONAL_SERVICE", schedule: [row(1, "2027-01-01", "2027-01-01", "720.00", "720.00")] }],
      },
    } as unknown as DraftResponse;
    expect(storedPricing(services)?.years).toEqual([
      { yearNumber: 1, periodStart: "2027-01-01", periodEnd: "2027-12-31", net: "720.00", arr: "0.00", billing: "720.00", commission: "0.00", netBilling: "720.00" },
    ]);
  });
});

describe("submission dates", () => {
  it("adds the validity period to the UTC day", () => {
    expect(expiryFor(new Date("2026-10-01T09:30:00Z"), 30)).toBe("2026-10-31");
    // 02:00 on 1 Oct in Colombo is still 30 Sep in UTC.
    expect(expiryFor(new Date("2026-10-01T02:00:00+05:30"), 30)).toBe("2026-10-30");
    expect(expiryFor(new Date("2026-12-15T12:00:00Z"), 30)).toBe("2027-01-14");
  });

  it("treats a quote as expired only after its expiry day", () => {
    expect(isExpired("2026-10-31", new Date("2026-10-31T23:59:00Z"))).toBe(false);
    expect(isExpired("2026-10-31", new Date("2026-11-01T00:00:00Z"))).toBe(true);
    expect(isExpired(null, new Date())).toBe(false);
  });

  it("formats dates as in the approved layout", () => {
    expect(formatDate("2026-10-31")).toBe("31 Oct 2026");
    expect(formatDate(null)).toBe("—");
  });
});

describe("partner commission", () => {
  const partner = (): DraftFormValues => ({ ...filled(), dealType: "PARTNER", partnerCommissionPercent: "15" });

  it("checks the % the way the backend does", () => {
    expect(commissionProblem("")).toMatch(/Enter/);
    expect(commissionProblem("0")).toBe("");
    expect(commissionProblem("12.5")).toBe("");
    expect(commissionProblem("100")).toBe("");
    for (const bad of ["100.01", "-1", "7.125", "abc"]) expect(commissionProblem(bad)).toMatch(/0 to 100/);
  });

  it("sends the % on a partner-led quote only", () => {
    expect(toDraftInput(partner()).partnerCommissionPercent).toBe("15");
    expect(toDraftInput({ ...partner(), dealType: "DIRECT" }).partnerCommissionPercent).toBeUndefined();
    expect(toPreviewBody(partner())).toMatchObject({ partnerCommissionPercent: "15" });
    expect(toPreviewBody({ ...partner(), partnerCommissionPercent: "abc" })).toMatchObject({ partnerCommissionPercent: undefined });
    expect(toPreviewBody({ ...partner(), dealType: "DIRECT" })).toMatchObject({ partnerCommissionPercent: undefined });
  });
});

// D72: a new quote starts from its opportunity's products.
describe("pulledLines", () => {
  const entry = (id: string, isActive: boolean) => ({
    id, unitPrice: "360", currencyIsoCode: "USD", isActive, pricebook: { id: "01sUSD", name: "USD Price Book" },
  });
  it("brings in each product at 1 unit, priced from the book, with its mapped category or none yet", () => {
    const lines = pulledLines([
      { id: "01tGW", name: "WSO2 Gateway", productCode: "GW", category: "SUBSCRIPTION", recurring: true, pricebookEntries: [entry("01uGW", true)] },
      { id: "01tIS", name: "WSO2 Integrator", recurring: false, pricebookEntries: [entry("01uIS", true)] },
      { id: "01tOLD", name: "Old", pricebookEntries: [entry("01uOLD", false)] },
    ] as never);
    expect(lines.map((l) => [l.pricebookEntryId, l.quantity, l.discount, l.unitPrice, l.category, l.categorySource, l.recurring])).toEqual([
      ["01uGW", "1", "", "360", "SUBSCRIPTION", "MAPPED", true],
      ["01uIS", "1", "", "360", "", "REP", false], // recurring from Salesforce, not the category (D76)
    ]);
    expect(lines[0].pricebookName).toBe("USD Price Book");
  });
});

describe("alignPreview", () => {
  const priced = (ids: string[]) => ({ lines: ids.map((pricebookEntryId) => ({ pricebookEntryId, tcv: `tcv-${pricebookEntryId}` })) }) as never;
  const line = (pricebookEntryId: string, category: "" | "SUBSCRIPTION" = "SUBSCRIPTION") => ({ pricebookEntryId, category });

  it("puts each price back on its line, with a gap for a line waiting for its category", () => {
    const p = alignPreview(priced(["A", "C"]), [line("A"), line("B", ""), line("C")]);
    expect(p?.lines.map((l) => l?.tcv)).toEqual(["tcv-A", undefined, "tcv-C"]);
  });

  it("never shows a line another's price while the preview catches up", () => {
    // B just got its category; the preview still has A and C only.
    const p = alignPreview(priced(["A", "C"]), [line("A"), line("B"), line("C")]);
    expect(p?.lines.map((l) => l?.tcv)).toEqual(["tcv-A", undefined, "tcv-C"]); // B waits; C keeps its own

    // C removed just now; the preview still has A and C: B doesn't take C's price.
    const q = alignPreview(priced(["A", "C"]), [line("A"), line("B")]);
    expect(q?.lines.map((l) => l?.tcv)).toEqual(["tcv-A", undefined]);
  });
});

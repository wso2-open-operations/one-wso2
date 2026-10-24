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
import { render, screen, within } from "@testing-library/react";
import { draft, fullPartnerQuote } from "@features/sales/cado2/quotes/testing/fixtures";
import { dealFigures, sheetFromVersion } from "@features/sales/cado2/quotes/sheet/sheetModel";
import CustomerBand from "./CustomerBand";
import QuoteSheet from "./QuoteSheet";
import DealFiguresSection from "./DealFiguresSection";
import type { QuoteSheet as Sheet, SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";

const sheet = sheetFromVersion(fullPartnerQuote);

describe("QuoteSheet", () => {
  it("leaves the customer to the page header, names the partner in Deal, and puts each contact under its address", () => {
    render(<QuoteSheet sheet={sheet} />);
    // Who it's for is in the page header (C1, 2026-10-14).
    expect(screen.queryByRole("region", { name: "Customer" })).toBeNull();
    const deal = screen.getByRole("region", { name: "Deal" });
    expect(deal).toHaveTextContent("Deal typePartner deal");
    expect(deal).toHaveTextContent("PartnerAcme Reseller");
    expect(deal).toHaveTextContent("Sales regionAPAC");
    expect(deal).toHaveTextContent("Sub-regionSouth Asia");

    // The contacts sit with the addresses, as in the order form's section 01.
    const billTo = screen.getByLabelText("Bill To");
    expect(within(billTo).getByLabelText("Billing contact")).toHaveTextContent("typed in");
    const security = within(screen.getByLabelText("Ship To")).getByLabelText("Security contact");
    expect(within(security).getByText("Marco Ruiz")).toBeInTheDocument();
    expect(within(security).getByRole("link", { name: /marco@acme.example/ })).toHaveAttribute("href", "mailto:marco@acme.example");
    expect(security).not.toHaveTextContent("typed in");
  });

  it("prints the ship-to address in full when it is the bill-to address, and says so", () => {
    render(<QuoteSheet sheet={{ ...sheet, shipTo: null, shipToSameAsBillTo: true }} />);
    const shipTo = screen.getByLabelText("Ship To");
    expect(within(shipTo).getByText("Same as bill to")).toBeInTheDocument();
    expect(within(shipTo).getByText(sheet.billTo!.companyName)).toBeInTheDocument();
    for (const line of sheet.billTo!.lines) expect(within(shipTo).getByText(line)).toBeInTheDocument();
  });

  it("shows every submitted field", () => {
    render(<QuoteSheet sheet={sheet} />);
    for (const text of [
      "WSO2, LLC.",
      "787 Castro Street, Mountain View, CA, USA",
      "1 Oct 2026 – 30 Sept 2027",
      "Annually in Advance",
      "Acme renewal FY26",
      "Net 45",
      "PO-4471",
      "Custom SLA credits",
      "Acme Reseller Ltd",
      "Tax ID GB123",
      "Suite 400",
      "Strategic logo in the region",
      "2026-09-M9",
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
    const products = screen.getByRole("table", { name: "Products" });
    expect(within(products).getByText("WSO2 Gateway")).toBeInTheDocument();
    // The Term column (D85, back since D94, renamed D96): the term on a recurring line.
    expect(within(products).getByRole("columnheader", { name: "Term" })).toBeInTheDocument();
    expect(within(products).getAllByText("1Y").length).toBeGreaterThan(0);
    expect(within(products).getByText("Subscription")).toBeInTheDocument();
    expect(within(products).getByText("Gateways")).toBeInTheDocument();
    // A one-year quote has no yearly schedule.
    expect(screen.queryByRole("table", { name: "Yearly Schedule" })).toBeNull();
  });

  it("shows one view with the internal details: price book, pricing rules, justification", () => {
    render(<QuoteSheet sheet={{ ...sheet, pricebookName: "FY26 USD" }} />);
    expect(screen.queryByRole("group", { name: "Quote view" })).toBeNull();
    // The quote's price book once, in the Deal section; not on every line.
    expect(screen.getByText("FY26 USD")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Products" })).queryByText(/FY26 USD/)).toBeNull();
    expect(screen.getByText("Strategic logo in the region")).toBeInTheDocument();
    expect(screen.getByText("2026-09-M9")).toBeInTheDocument();
  });

  it("marks gaps on a draft", () => {
    render(<QuoteSheet sheet={sheetFromVersion(draft)} />);
    expect(screen.getAllByText("Not set yet").length).toBeGreaterThan(3);
    expect(screen.getByText("No products yet")).toBeInTheDocument();
    expect(screen.getByText("Appears once the quote can be priced")).toBeInTheDocument();
  });
});

// A 3-year quote: two subscriptions, support and a one-time service.
const line = (number: number, productName: string, category: SheetLine["category"], tcv: string, arr: string): SheetLine => ({
  number, productName, productCode: null, productDescription: null, pricebookName: "FY26 USD", category, categoryByRep: false, recurring: category !== "PROFESSIONAL_SERVICE", quantity: "1", unitOfMeasure: null, unitPrice: "1",
  discountPercent: "0", formula: null, yearNumber: 1, startDate: "2027-01-01", endDate: "2027-12-31", ownDates: false, parentName: null, annualList: null, annualNet: null, arr, acv: null, tcv, commission: "0.00",
  schedule: [1, 2, 3].map((y) => ({ yearNumber: y, periodStart: "", periodEnd: "", yearFraction: "1.0000", gross: "1.00", discount: "0.00", net: "1.00", billing: "1.00" })),
});
const threeYears: Sheet = {
  ...sheet,
  contractYears: [1, 2, 3].map((n) => ({
    number: n, start: `${2026 + n}-01-01`, end: `${2026 + n}-12-31`, net: null, arr: null,
  })),
  endDate: "2029-12-31",
  lines: [
    line(1, "Gateway", "SUBSCRIPTION", "19440.00", "6480.00"),
    line(2, "API Portal", "SUBSCRIPTION", "14400.00", "4800.00"),
    line(3, "Enterprise Support", "SUPPORT", "75000.00", "25000.00"),
    line(4, "Onboarding", "PROFESSIONAL_SERVICE", "10700.00", "0.00"),
  ],
  years: [
    { yearNumber: 1, periodStart: "2027-01-01", periodEnd: "2027-12-31", net: "46980.00", billing: "46980.00" },
    { yearNumber: 2, periodStart: "2028-01-01", periodEnd: "2028-12-31", net: "36280.00", billing: "36280.00" },
    { yearNumber: 3, periodStart: "2029-01-01", periodEnd: "2029-12-31", net: "36280.00", billing: "36280.00" },
  ],
  totals: { arr: "36280.00", acv: "39846.67", tcv: "119540.00" },
};

describe("Order form", () => {
  it("groups the lines by category, each with its own subtotal, then the total order value", () => {
    render(<QuoteSheet sheet={threeYears} />);
    const table = within(screen.getByRole("table", { name: "Products" }));
    const rows = table.getAllByRole("row").map((r) => r.textContent);
    const at = (text: string) => rows.findIndex((r) => r?.includes(text));
    expect(at("Subscription")).toBeLessThan(at("Gateway"));
    expect(at("API Portal")).toBeLessThan(at("Subscription subtotal"));
    expect(at("Subscription subtotal")).toBeLessThan(at("Enterprise Support"));
    expect(at("Enterprise Support")).toBeLessThan(at("Support subtotal"));
    expect(at("Support subtotal")).toBeLessThan(at("Onboarding"));
    expect(at("Onboarding")).toBeLessThan(at("Professional Services subtotal"));
    expect(rows[at("Subscription subtotal")]).toContain("33,840.00");
    expect(rows[at("Support subtotal")]).toContain("75,000.00");
    expect(rows[at("Professional Services subtotal")]).toContain("10,700.00");
    expect(rows.some((r) => r?.includes("Support and services"))).toBe(false);
    // One card, a section per year (here every line is in
    // Year 1); the card closes with the total over every year.
    expect(at("Total order value")).toBe(-1);
    expect(screen.getByRole("region", { name: "Order totals" })).toHaveTextContent("Total order value · all 3 years (USD)119,540.00");
    // Each year closes with its own total, inside its table.
    expect(rows.at(-1)).toContain("Year 1 total (USD)119,540.00");
    expect(screen.getByRole("button", { name: /^Year 1/ })).toHaveTextContent("4 products");
    expect(screen.getAllByText("No products in this year.")).toHaveLength(2);
  });

  // 2026-10-12 (amends D53): a line shows its product's name and SKU only; the
  // description is shown when choosing the product.
  it("shows a line's product name and SKU, not its description", () => {
    const described = { ...threeYears.lines[0], productCode: "GW-SKU", productDescription: "Based on the number of gateways." };
    render(<QuoteSheet sheet={{ ...threeYears, lines: [described, ...threeYears.lines.slice(1)] }} />);
    const table = within(screen.getByRole("table", { name: "Products" }));
    const cell = table.getByText(described.productName).closest("td")!;
    expect(within(cell).getByText("GW-SKU")).toBeInTheDocument();
    expect(within(cell).queryByText("Based on the number of gateways.")).toBeNull();
  });

  it("shows the yearly schedule for a multi-year quote, with each year's opportunity", () => {
    render(<QuoteSheet sheet={threeYears} />);
    const schedule = within(screen.getByRole("table", { name: "Yearly schedule" }));
    expect(schedule.getByText("This quote's opportunity")).toBeInTheDocument();
    expect(schedule.getAllByText("Own opportunity, created later")).toHaveLength(2);
    expect(schedule.getByText("1. Gateway")).toBeInTheDocument();
  });
});

describe("Partner commission", () => {
  // 15% of every line of the 3-year quote: 2,916 + 2,160 + 11,250 + 1,605.
  const withCommission = (l: SheetLine, c: string): SheetLine => ({ ...l, commission: c });
  const partner: Sheet = {
    ...threeYears,
    partnerCommissionPercent: "15",
    lines: [
      withCommission(threeYears.lines[0], "2916.00"),
      withCommission(threeYears.lines[1], "2160.00"),
      withCommission(threeYears.lines[2], "11250.00"),
      withCommission(threeYears.lines[3], "1605.00"),
    ],
    totals: { ...threeYears.totals!, partnerCommission: "17931.00", netOrderValue: "101609.00" },
  };

  // D99: the header shows the account and opportunity only; the partner is in the Deal section.
  it("leaves the partner out of the header", () => {
    const sold = { ...partner, dealType: "PARTNER" as const, partner: { name: "Tech Mahindra - Enterprise", role: "Value Added Reseller" } };
    render(<CustomerBand sheet={sold} />);
    expect(screen.getByText(sold.opportunityName)).toBeInTheDocument();
    expect(screen.queryByText(/Tech Mahindra/)).toBeNull();
  });

  it("adds the commission and the net order value under the total order value", () => {
    render(<QuoteSheet sheet={partner} />);
    // In the order totals box under the table (D97), in this order.
    const totals = screen.getByRole("region", { name: "Order totals" }).textContent ?? "";
    expect(totals).toContain("Total order value · all 3 years (USD)119,540.00");
    expect(totals).toContain("Partner commission (15%) (USD)− 17,931.00");
    expect(totals).toContain("Net order value (USD)101,609.00");
    expect(totals.indexOf("Total order value")).toBeLessThan(totals.indexOf("Net order value"));
  });

  it("leaves commission and net to the order form's totals", () => {
    render(<DealFiguresSection sheet={partner} />);
    // Shown once, in the order form (C2, 2026-10-14).
    expect(screen.queryByLabelText("Partner Commission")).toBeNull();
    expect(screen.queryByLabelText("Net order value")).toBeNull();
    expect(screen.queryByLabelText("First invoice")).toBeNull(); // removed (D85)
    expect(screen.queryByRole("table", { name: "Figures by product" })).toBeNull(); // removed: ARR by year instead
  });

  it("shows the schedule's billing net of commission", () => {
    render(<QuoteSheet sheet={{ ...partner, years: partner.years.map((y) => ({ ...y, netBilling: "1.00" })) }} />);
    expect(within(screen.getByRole("table", { name: "Yearly schedule" })).getByText("Billed, net of commission")).toBeInTheDocument();
  });

  it("says a one-off line is one-time in the Term column (D85, D94)", () => {
    render(<QuoteSheet sheet={{ ...threeYears, startDate: "2027-01-01" }} />);
    const products = within(screen.getByRole("table", { name: "Products" }));
    expect(products.getAllByText("1Y")).toHaveLength(3); // two subscriptions and support, each for its year
    expect(products.getByText("One-time")).toBeInTheDocument(); // the onboarding service
  });

  // D94: a subtotal's value sits in the Amount column, under the line amounts.
  it("puts every subtotal in the Amount column", () => {
    render(<QuoteSheet sheet={threeYears} />);
    const table = screen.getByRole("table", { name: "Products" });
    const amountCol = [...table.querySelectorAll("thead th")].findIndex((th) => th.textContent?.startsWith("Amount"));
    const row = within(table).getByText(/^Subscription subtotal/).closest("tr") as HTMLTableRowElement;
    const cells = [...row.cells];
    const span = cells.slice(0, -1).reduce((n, c) => n + c.colSpan, 0);
    expect(span).toBe(amountCol); // the label fills the columns before Amount
  });

  // A draft whose products have no category yet still lists them on the quote page, under a plain heading.
  it("lists lines without a category under Uncategorised, without the wizard's red flag", () => {
    const uncategorised = threeYears.lines.map((l) => ({ ...l, category: "" as const }));
    render(<QuoteSheet sheet={{ ...threeYears, lines: uncategorised }} />);
    const table = screen.getByRole("table", { name: "Products" });
    const group = within(table).getByRole("rowgroup", { name: "Uncategorised" });
    for (const l of threeYears.lines) expect(within(group).getByText(l.productName)).toBeInTheDocument();
    expect(within(table).queryByText(/to choose a category/)).toBeNull();
    expect(screen.getByRole("region", { name: "Order totals" })).toHaveTextContent("119,540.00");
  });

  it("shows no commission rows on a direct deal", () => {
    render(<QuoteSheet sheet={{ ...threeYears, dealType: "DIRECT", partnerCommissionPercent: null }} />);
    expect(screen.queryByText(/Partner commission/)).toBeNull();
  });
});

describe("DealFiguresSection", () => {
  // D76: ARR follows whether a line recurs (its Salesforce classification), not its category.
  it("counts a recurring line in ARR whatever its category, and leaves out a one-off one", () => {
    const [gateway, ...rest] = threeYears.lines;
    const onboarding = rest.find((l) => l.productName === "Onboarding")!;
    const lines = threeYears.lines.map((l) =>
      l === gateway ? { ...l, category: "PROFESSIONAL_SERVICE" as const } : l === onboarding ? { ...l, category: "" as const } : l,
    );
    const f = dealFigures({ ...threeYears, lines })!;
    expect(f.arrParts.map((p) => p.productName)).toContain("Gateway"); // recurring, though placed under Professional Services
    expect(f.arrExcluded).toEqual(["Onboarding"]); // one-off, though uncategorised
  });

  it("shows ARR for each year alike, then how TCV and ACV are worked out", () => {
    const sheet = { ...threeYears, years: threeYears.years.map((y, i) => ({ ...y, arr: ["36280.00", "36280.00", "40000.00"][i] })) };
    render(<DealFiguresSection sheet={sheet} />);
    const arr = within(screen.getByLabelText("ARR · annual recurring revenue"));
    // Every year alike in a mini table, the currency in its heading; no headline figure and no product list.
    const byYear = within(screen.getByRole("table", { name: "ARR by year" }));
    expect(byYear.getByText("ARR (USD)")).toBeInTheDocument();
    expect(byYear.getAllByText("36,280.00")).toHaveLength(2);
    expect(byYear.getByText("40,000.00")).toBeInTheDocument();
    expect(arr.queryByText(/approvals/)).toBeNull();
    expect(arr.queryByText(/Left out/)).toBeNull();
    expect(within(screen.getByLabelText("TCV · total contract value")).getByText(/Year 1 46,980.00 \+ Year 2 36,280.00 \+ Year 3 36,280.00/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("ACV · average per contract year")).getByText("TCV ÷ 3 contract years")).toBeInTheDocument();
  });

  // D86: billing sits with the payment terms, as on the Commercials step.
  it("shows the billing frequency under Commercial Terms, not in Deal", () => {
    render(<QuoteSheet sheet={{ ...sheet, recurring: true, billingFrequency: "SPECIAL_TERMS" }} />);
    const terms = screen.getByRole("region", { name: "Commercial Terms" });
    expect(terms).toHaveTextContent("Billing frequencySee Special Terms");
    expect(screen.getByRole("region", { name: "Deal" })).not.toHaveTextContent("Billing");
  });

  // D88: services-only quotes have a billing frequency too.
  it("shows the billing frequency on a services-only quote", () => {
    render(<QuoteSheet sheet={{ ...sheet, recurring: false, billingFrequency: "UPFRONT" }} />);
    expect(screen.getByRole("region", { name: "Commercial Terms" })).toHaveTextContent(
      "Billing frequencyUpon the Execution of the Order Form",
    );
  });

  it("shows ARR and ACV as not applicable on a services-only quote", () => {
    const services: Sheet = {
      ...sheet,
      recurring: false,
      lines: [line(1, "Onboarding", "PROFESSIONAL_SERVICE", "720.00", "0.00")],
      years: [{ yearNumber: 1, periodStart: "2027-01-01", periodEnd: "2027-01-01", net: "720.00", billing: "720.00" }],
      totals: { arr: null, acv: null, tcv: "720.00" },
    };
    render(<DealFiguresSection sheet={services} />);
    expect(within(screen.getByLabelText("ARR · annual recurring revenue")).getByText("Not applicable")).toBeInTheDocument();
    expect(within(screen.getByLabelText("ACV · average per contract year")).getByText("Not applicable")).toBeInTheDocument();
  });
});

// The quote page shows sections 04–06 as they print.
describe("LegalSection", () => {
  const withLegal: Sheet = {
    ...sheet,
    dealType: "PARTNER",
    legal: {
      sections: {
        blocks: [
          { kind: "ONPREM", nonStandard: false, text: "Governed by the Value Added Reseller Agreement." },
          { kind: "SAAS", nonStandard: true, text: "" },
        ],
        notices: [{ title: "Auto Renewal", body: "Renews for 12 months.", showTitle: true, finePrint: false, reason: "partner deal" }],
        contractName: "Value Added Reseller",
       
      },
      contractName: "Value Added Reseller",
      contractDate: "2024-03-12",
      partnerName: "Acme Reseller",
      specialTerms: "Legal's wording",
      specialTermsByLegal: true,
      frozen: true,
    },
  };

  it("shows the terms per product type, the notices and the special terms", () => {
    render(<QuoteSheet sheet={withLegal} />);
    const legal = within(screen.getByRole("region", { name: "Legal" }));
    expect(legal.getByText("As submitted")).toBeInTheDocument();
    expect(legal.getByText(/Value Added Reseller · Acme Reseller · 12 Mar 2024/)).toBeInTheDocument();
    expect(legal.getByText("Governed by the Value Added Reseller Agreement.")).toBeInTheDocument();
    expect(legal.getByText("SaaS products")).toBeInTheDocument();
    expect(legal.getByText("Legal writes these terms during their approval.")).toBeInTheDocument();
    expect(legal.getByText("Auto Renewal")).toBeInTheDocument();
    expect(legal.getByText("Legal's wording")).toBeInTheDocument();
    expect(legal.getByText("Reworded by Legal during their approval")).toBeInTheDocument();
  });

  it("isn't shown without the legal texts", () => {
    render(<QuoteSheet sheet={{ ...sheet, legal: null }} />);
    expect(screen.queryByRole("region", { name: "Legal" })).toBeNull();
  });
});

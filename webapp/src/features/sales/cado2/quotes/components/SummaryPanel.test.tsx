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
import { emptyDraftForm, fromVersion } from "@features/sales/cado2/quotes/form/draftForm";
import { fullPartnerQuote } from "@features/sales/cado2/quotes/testing/fixtures";
import SummaryPanel from "./SummaryPanel";

const values = fromVersion({ ...fullPartnerQuote, version: { ...fullPartnerQuote.version, status: "DRAFT" } });
const totals = { arr: "41000.00", acv: "41000.00", tcv: "123000.00", payableNow: "41000.00" };

describe("SummaryPanel (F5 review)", () => {
  it("leads with the totals, then groups every value entered so far", () => {
    render(<SummaryPanel values={values} legalEntityName="WSO2, LLC." totals={totals} pricing={false} />);
    expect(screen.getByText("USD 123,000.00")).toBeInTheDocument();
    expect(screen.getByText("Total order value")).toBeInTheDocument();
    // ARR and ACV live in the Deal figures section, not the summary.
    expect(screen.queryByText(/^ARR/)).toBeNull();
    expect(screen.queryByText(/^ACV/)).toBeNull();

    // No Contacts group, and no primary contact with the customer.
    expect(screen.queryByRole("region", { name: "Contacts" })).toBeNull();
    const customer = within(screen.getByRole("region", { name: "Customer" }));
    expect(customer.getByText("Acme Corp")).toBeInTheDocument();
    expect(customer.getByText("Acme APIM renewal")).toBeInTheDocument();
    expect(customer.getByText("Partner deal").tagName).not.toBe("SPAN"); // plain text, not a chip
    expect(screen.queryByRole("img", { name: /avatar/i })).toBeNull();
    expect(customer.getByText("Acme Reseller")).toBeInTheDocument();
    expect(customer.queryByText(/contact/i)).toBeNull();

    const terms = within(screen.getByRole("region", { name: "Deal Terms" }));
    expect(terms.getByText("WSO2, LLC.")).toBeInTheDocument();
    expect(terms.getByText("USD")).toBeInTheDocument();
    expect(terms.queryByText(/uplift/i)).toBeNull(); // no uplift
    expect(terms.getByText(/1 Oct 2026 – 30 Sept 2027/)).toBeInTheDocument();
    expect(terms.getByText("1 year · 1 year")).toBeInTheDocument(); // its length, then how many years
    expect(terms.queryByText("Annually in Advance")).toBeNull(); // on Commercials (D86)
    expect(screen.queryByText("First invoice")).toBeNull(); // removed (D85)

    const products = within(screen.getByRole("region", { name: "Products" }));
    expect(products.getByText("WSO2 Gateway")).toBeInTheDocument();
    expect(products.getByText("Quantity 20")).toBeInTheDocument();

    // …and the billing and security contacts with the commercial details.
    const commercial = within(screen.getByRole("region", { name: "Commercials" }));
    expect(commercial.getByText("Annually in Advance")).toBeInTheDocument();
    expect(commercial.getByText("Net 45")).toBeInTheDocument();
    expect(commercial.getByText("PO-4471")).toBeInTheDocument();
    expect(commercial.getByText("Acme Reseller Ltd")).toBeInTheDocument();
    // Every line of the address is part of the (bold) value, none on the grey detail line.
    const cityLine = commercial.getByText("London, United Kingdom");
    expect(cityLine.closest(".MuiTypography-caption")).toBeNull();
    // Ship to is always shown; on this partner deal it is the customer's address.
    expect(commercial.getByText("Acme Corp")).toBeInTheDocument();
    expect(commercial.getByText("Philadelphia, USA")).toBeInTheDocument();
    expect(commercial.getByText("Jane Payables")).toBeInTheDocument();
    expect(commercial.getByText("ap@reseller.example · typed in")).toBeInTheDocument();
    expect(commercial.getByText("Security contact (optional)")).toBeInTheDocument();

    expect(screen.queryByText(/to fix/)).toBeNull();
  });

  // ONE_WSO2_SALESFORCE_BASE_URL, which defaults to WSO2's own Lightning host.
  it("links Salesforce values to their records", () => {
    render(<SummaryPanel values={values} legalEntityName={null} totals={null} pricing={false} />);
    expect(screen.getByRole("link", { name: /Acme Corp/ })).toHaveAttribute(
      "href",
      "https://wso2.lightning.force.com/lightning/r/Account/001000000000001/view",
    );
    expect(screen.getByRole("link", { name: /Acme APIM renewal/ })).toHaveAttribute("href", expect.stringContaining("/lightning/r/Opportunity/"));
    expect(screen.getByRole("link", { name: /Marco Ruiz/ })).toHaveAttribute("href", expect.stringContaining("/lightning/r/Contact/003VM00000CONTAC1A/view"));
    expect(screen.getByRole("link", { name: /Marco Ruiz/ })).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: /Jane Payables/ })).toBeNull(); // typed in: not in Salesforce
  });

  it("links nothing typed in by hand, and shows dashes for what isn't entered yet", () => {
    render(<SummaryPanel values={emptyDraftForm()} legalEntityName={null} totals={null} pricing={false} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByText("Not set yet").length).toBeGreaterThan(8);
  });
});

describe("SummaryPanel — services only", () => {
  it("shows the term with Year 1 too", () => {
    const services = { ...values, lines: values.lines.map((l) => ({ ...l, category: "PROFESSIONAL_SERVICE" as const, recurring: false })) };
    const t = { arr: null, acv: null, tcv: "720.00" };
    render(<SummaryPanel values={services} legalEntityName={null} totals={t} pricing={false} />);
    expect(screen.getAllByText("USD 720.00")).toHaveLength(1); // total order value
    const terms = within(screen.getByRole("region", { name: "Deal Terms" }));
    expect(terms.getByText("Term")).toBeInTheDocument(); // services sit in Year 1 like any product
    expect(terms.queryByText("Billing")).toBeNull();
  });
});

describe("SummaryPanel — ship to", () => {
  it("repeats the bill-to address, marked as the same, on a direct deal with the box ticked", () => {
    const direct = { ...values, dealType: "DIRECT" as const, shipToSameAsBillTo: true };
    render(<SummaryPanel values={direct} legalEntityName={null} totals={null} pricing={false} />);
    const commercial = within(screen.getByRole("region", { name: "Commercials" }));
    expect(commercial.getAllByText("Acme Reseller Ltd")).toHaveLength(2); // bill to and ship to
    expect(commercial.getByText("Same as bill to")).toBeInTheDocument();
  });
});


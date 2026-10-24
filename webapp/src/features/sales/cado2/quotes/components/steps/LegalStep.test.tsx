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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import { emptyDraftForm, type DraftFormValues, type LineValue } from "@features/sales/cado2/quotes/form/draftForm";
import LegalStep from "./LegalStep";

vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useLegalConfig: () => ({
    data: {
      texts: {
        TERMS_ONPREM_DIRECT: '<p>Governed by this Order Form and <a href="https://wso2.com/licenses/eula/3.6">WSO2 Software License</a>.</p>',
        TERMS_ONPREM_PARTNER: "Governed by the {CONTRACT_NAME} with {PARTNER_NAME} dated {CONTRACT_DATE}.",
        TERMS_SAAS_DIRECT: "SaaS terms.",
        TERMS_SAAS_PARTNER: "SaaS terms (partner).",
      },
      notices: [
        { id: 1, title: "Additional capacity", body: "Capacity text.", showTitle: false, finePrint: false, channels: null, regions: null, dealKinds: null },
        { id: 2, title: "Middle East", body: "ME text.", showTitle: true, finePrint: false, channels: ["PARTNER"], regions: ["ME"], dealKinds: null },
      ],
    },
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const line = (classification: string): LineValue => ({
  lineId: null, pricebookEntryId: `01u${classification}`, productName: classification, productCode: "", productDescription: "",
  pricebookId: "01sA", pricebookName: "FY26 USD", unitPrice: "1000", category: "SUBSCRIPTION", categorySource: "MAPPED",
  recurring: true, classification, unitOfMeasure: "", quantity: "1", discount: "", yearNumber: 1, startDate: "", endDate: "",
  salesPrice: "", key: `k-${classification}`, parentKey: "",
});

function Shown() {
  const v = useWatch<DraftFormValues>();
  return <p>chosen: {`${v.termsOnPremNonStandard} ${v.termsSaasNonStandard}`}</p>;
}

function Harness({ values = {} }: { values?: Partial<DraftFormValues> }) {
  const form = useForm<DraftFormValues>({ defaultValues: { ...emptyDraftForm(), lines: [line("PS")], ...values } });
  return (
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormProvider {...form}>
        <LegalStep />
        <Shown />
      </FormProvider>
    </DatePickers.LocalizationProvider>
  );
}

// Legal terms (2026-10-24).
describe("LegalStep", () => {
  it("shows a direct deal's standard on-prem terms with their EULA link, and the notices for every deal", () => {
    render(<Harness values={{ dealType: "DIRECT", accountSalesRegion: "NA" }} />);
    const terms = within(screen.getByRole("region", { name: "Governing Terms" }));
    // The EULA prints as the words, linked; not the bare address.
    expect(terms.getByText(/Governed by this Order Form and/)).toBeInTheDocument();
    expect(terms.getByRole("link", { name: "WSO2 Software License" })).toHaveAttribute("href", "https://wso2.com/licenses/eula/3.6");
    expect(terms.getByText("Standard")).toBeInTheDocument(); // one tag, on the card
    const notices = within(screen.getByRole("region", { name: "Legal Terms and Notices" }));
    expect(notices.getByText("Capacity text.")).toBeInTheDocument();
    expect(notices.queryByText("ME text.")).toBeNull();
  });

  it("shows a block per product type, and sends a non-standard one to Legal", async () => {
    render(<Harness values={{ dealType: "DIRECT", lines: [line("PS"), line("CL")] }} />);
    expect(screen.getByRole("region", { name: "On-premises products" })).toBeInTheDocument();
    const saas = within(screen.getByRole("region", { name: "SaaS products" }));
    await userEvent.setup().click(saas.getByRole("switch"));
    expect(saas.getByText(/Legal will write these terms during their approval/)).toBeInTheDocument();
    expect(screen.getByText("chosen: false true")).toBeInTheDocument();
    expect(screen.getByText("Goes to Legal")).toBeInTheDocument();
  });

  it("fills a partner deal's agreement and adds its regional notice, saying why", () => {
    render(
      <Harness
        values={{
          dealType: "PARTNER",
          accountSalesRegion: "ME",
          partner: { id: "001P", name: "Acme Reseller", role: "Value Added Reseller", billingAddress: null },
          partnerContractName: "Global System Integrator",
          partnerContractDate: "2024-03-12",
        }}
      />,
    );
    // The AM's choice prints as chosen; the Salesforce role is only a hint.
    expect(screen.getByText("Salesforce partner role: Value Added Reseller")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "On-premises products" })).toHaveTextContent("Governed by the Global System Integrator with Acme Reseller");
    // The deal's values are marked on the Legal step, so the AM can check them.
    const block = within(screen.getByRole("region", { name: "On-premises products" }));
    expect(block.getByText("Acme Reseller").tagName).toBe("MARK");
    expect(block.getByText("12 March 2024").tagName).toBe("MARK");
    expect(screen.getByText("Partner deal · region ME")).toBeInTheDocument();
    // A title prints only where Legal says so.
    expect(screen.getByText("Middle East")).toBeInTheDocument();
    expect(screen.queryByText("Additional capacity")).toBeNull();
  });

  it("asks the AM for the agreement, from the three, with no partner role to hint", async () => {
    render(<Harness values={{ dealType: "PARTNER", partner: { id: "001P", name: "Acme", role: null, billingAddress: null } }} />);
    const agreement = screen.getByRole("combobox", { name: "Partner agreement" });
    expect(screen.getByText("No partner role in Salesforce")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "On-premises products" })).toHaveTextContent(
      "the [contract name] with Acme dated [contract date]",
    );
    await userEvent.setup().click(agreement);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Value Added Reseller", "Global System Integrator", "One Time Reseller"]);
  });

  it("has the special terms, and says when the billing needs them", () => {
    render(<Harness values={{ billingFrequency: "SPECIAL_TERMS" }} />);
    const special = within(screen.getByRole("region", { name: "Special Terms" }));
    expect(special.getByText(/Billing says See Special Terms/)).toBeInTheDocument();
    expect(special.getByRole("switch")).not.toBeChecked();
  });
});

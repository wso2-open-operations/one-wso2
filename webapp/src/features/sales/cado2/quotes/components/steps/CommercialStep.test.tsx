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
import { FormProvider, useForm } from "react-hook-form";
import {
  emptyDraftForm,
  type DraftFormValues,
  type LineValue,
} from "@features/sales/cado2/quotes/form/draftForm";
import CommercialStep from "./CommercialStep";

vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useAccountContacts: () => ({
    data: [],
    isPending: false,
    isFetching: false,
    error: null,
  }),
}));

const line = (discount: string): LineValue => ({
  lineId: null,
  pricebookEntryId: "01uA",
  productName: "API Control Plane",
  productCode: "APIM-CP",
  productDescription: "",
  pricebookId: "01sA",
  pricebookName: "FY26 USD",
  unitPrice: "1000",
  category: "SUBSCRIPTION",
  categorySource: "MAPPED",
  recurring: true,
  classification: "PS",
  unitOfMeasure: "Gateways",
  quantity: "1",
  discount,
  yearNumber: 1,
  startDate: "",
  endDate: "",
  salesPrice: "",
  key: `k-${Math.random()}`,
  parentKey: "",
});

function Harness({ lines, values = {} }: { lines: LineValue[]; values?: Partial<DraftFormValues> }) {
  const form = useForm<DraftFormValues>({
    defaultValues: { ...emptyDraftForm(), lines, ...values },
  });
  return (
    <FormProvider {...form}>
      <CommercialStep />
    </FormProvider>
  );
}

describe("CommercialStep — justification", () => {
  it("is optional when no line has a discount", () => {
    render(<Harness lines={[line("0"), line("")]} />);
    expect(
      screen.getByRole("textbox", { name: "Justification (optional)" }),
    ).not.toBeRequired();
    expect(screen.queryByText(/a justification is required/)).toBeNull();
  });

  it("is required, with a hint, once a line has a discount", () => {
    render(<Harness lines={[line("18"), line("0"), line("5.5")]} />);
    expect(
      screen.getByRole("textbox", { name: /^Justification/ }),
    ).toBeRequired();
    expect(
      screen.getByText(
        "A discount has been added to 2 lines, so a justification is required.",
      ),
    ).toBeInTheDocument();
  });
});

// D86: Commercials opens with billing and payment terms, billing right above Terms.
describe("CommercialStep — Commercials", () => {
  // The terms moved to the Legal step.
  it("orders billing, payment terms, then bill to with the PO number", () => {
    render(<Harness lines={[line("0")]} />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions.slice(0, 3)).toEqual(["Billing Frequency", "Payment Terms", "Bill To"]);
    expect(regions).not.toContain("Terms");
    expect(screen.queryByRole("region", { name: "Payment" })).toBeNull();
    const billTo = within(screen.getByRole("region", { name: "Bill To" }));
    expect(billTo.getByRole("textbox", { name: "PO number (optional)" })).toBeInTheDocument();
  });

  // D88: services-only quotes choose their billing too. The special-terms
  // to-do now sits on the Legal step, with the switch.
  it("asks for the billing frequency when no product recurs", () => {
    render(<Harness lines={[{ ...line("0"), recurring: false }]} values={{ billingFrequency: "SPECIAL_TERMS" }} />);
    expect(screen.getByRole("region", { name: "Billing Frequency" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Payment Terms" })).toBeInTheDocument();
    expect(screen.queryByText(/Billing says See Special Terms/)).toBeNull();
  });
});

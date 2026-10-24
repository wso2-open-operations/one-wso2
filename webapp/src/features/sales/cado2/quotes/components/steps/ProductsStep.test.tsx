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
import type { JSX } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import {
  emptyDraftForm,
  type DraftFormValues,
  type LineValue,
} from "@features/sales/cado2/quotes/form/draftForm";
import ProductsStep from "./ProductsStep";

// D72: products brought in from the opportunity.

const empty = {
  data: [],
  error: null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
};
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useAccountOpportunities: () => empty,
  usePricingFormulas: () => empty,
  useBundleChildren: () => ({ data: { children: [], missing: [] }, isFetching: false }),
  useCurrencies: () => ({ ...empty, data: ["USD"] }),
  usePricebooks: () => empty,
  useProducts: () => ({
    ...empty,
    data: { pages: [] },
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));

const line = (name: string, category: LineValue["category"]): LineValue => ({
  lineId: null,
  pricebookEntryId: `01u${name}`,
  productName: name,
  productCode: "",
  productDescription: "",
  pricebookId: "01sUSD",
  pricebookName: "USD Price Book",
  unitPrice: "360",
  category,
  categorySource: category ? "MAPPED" : "REP",
  recurring: category !== "PROFESSIONAL_SERVICE",
  classification: "PS",
  unitOfMeasure: "",
  quantity: "1",
  discount: "",
  yearNumber: 1,
  startDate: "",
  endDate: "",
  salesPrice: "",
  key: `k-${Math.random()}`,
  parentKey: "",
});

function Harness({
  startDate = "2027-01-01",
  values = {},
}: { startDate?: string; values?: Partial<DraftFormValues> } = {}): JSX.Element {
  const form = useForm<DraftFormValues>({
    defaultValues: {
      ...emptyDraftForm(),
      accountId: "001A",
      currencyIsoCode: "USD",
      defaultPricebookId: "01sUSD",
      defaultPricebookName: "USD Price Book",
      startDate,
      dealKind: "FIRST_SALE",
      lines: [
        line("WSO2 Gateway", "SUBSCRIPTION"),
        line("WSO2 Integrator", ""),
      ],
      notBroughtIn: [
        {
          productName: "WSO2 Legacy",
          reason: "not active in USD Price Book in USD",
        },
      ],
      ...values,
    },
  });
  return (
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormProvider {...form}>
        <ProductsStep preview={null} />
      </FormProvider>
    </DatePickers.LocalizationProvider>
  );
}

describe("ProductsStep (Products & Pricing)", () => {
  // D78: products can be added and kept before the start date; they are
  // priced once it is chosen.
  it("lets the AM add products before the start date is chosen", () => {
    render(<Harness startDate="" />);
    expect(screen.getByRole("button", { name: "Add product to Year 1" })).toBeEnabled();
    expect(screen.getByText("Amounts appear once the start date is chosen.")).toBeInTheDocument();
  });

  // Currency and price book first, then the term right above the products it
  // lays out (2026-10-23); billing and payment terms are on Commercials (D86).
  it("puts the term right above the products, and says what wasn't brought in", () => {
    render(<Harness />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions[0]).toBe("Currency & Price Book");
    expect(regions.indexOf("Term")).toBe(regions.indexOf("Products") - 1);
    expect(regions.indexOf("Year 1")).toBeGreaterThan(regions.indexOf("Products")); // a section inside the Products card
    expect(regions).not.toContain("Billing Frequency");
    expect(regions).not.toContain("Payment Terms");
    expect(
      screen.getByText("WSO2 Legacy: not active in USD Price Book in USD"),
    ).toBeInTheDocument();
  });

  // D93: a plain "Uncategorised" heading, no amber and no chip; the line's edit button opens the dialog.
  it("puts a line whose product isn't mapped under Uncategorised; its category is chosen in the line's dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const table = screen.getByRole("table", { name: "Products" });
    expect(within(table).queryByRole("combobox")).toBeNull(); // no dropdown on the line
    expect(within(table).getByText("Uncategorised")).toBeInTheDocument(); // its own section, first
    // Framed by a thin red line.
    const group = within(table).getByRole("rowgroup", { name: "Uncategorised" });
    expect(within(group).getByText("WSO2 Integrator")).toBeInTheDocument();
    expect(within(group).queryByText("WSO2 Gateway")).toBeNull();
    // Says what to do (D95).
    expect(within(table).getByText(/to choose a category/)).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: /Category not set/ })).toBeNull();

    // Line 2 is WSO2 Integrator, the one without a category.
    await user.click(within(table).getByRole("button", { name: "Edit line 2" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("No category is set up for this product");
    await user.click(within(dialog).getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Support" }));
    await user.click(within(dialog).getByRole("button", { name: "Save line" }));

    expect(within(table).getByText("Support")).toBeInTheDocument(); // now in its group
    expect(within(table).queryByText("Uncategorised")).toBeNull(); // gone once empty
    expect(within(table).queryByRole("rowgroup", { name: "Uncategorised" })).toBeNull();
  });

  // D91, amended 2026-10-23: the commission card sits above the term and the products, before any product too.
  it("puts the partner commission card above the term and the products", () => {
    render(<Harness values={{ dealType: "PARTNER", lines: [] }} />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions.indexOf("Partner Commission")).toBe(regions.indexOf("Term") - 1);
    expect(regions.indexOf("Partner Commission")).toBeGreaterThan(regions.indexOf("Currency & Price Book"));
  });

  it("has no commission card on a direct deal (D91)", () => {
    render(<Harness values={{ dealType: "DIRECT" }} />);
    expect(screen.queryByRole("region", { name: "Partner Commission" })).toBeNull();
  });
});

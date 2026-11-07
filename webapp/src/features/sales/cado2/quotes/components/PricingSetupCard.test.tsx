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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { emptyDraftForm, type DraftFormValues, type LineValue } from "@features/sales/cado2/quotes/form/draftForm";
import PricingSetupCard from "./PricingSetupCard";

const lookup = (data: unknown) => ({ data, isPending: false, isFetching: false, error: null, refetch: vi.fn() });
const opportunity = {
  id: "006A", name: "APIM Renewal 2026", currencyIsoCode: "EUR" as string | null,
  pricebook: { id: "01sEUR00000000001A", name: "EUR Price Book (Current)" } as { id: string; name: string } | null,
};
const books: Record<string, unknown[]> = {
  EUR: [
    { id: "01sEUR00000000001A", name: "EUR Price Book (Current)", current: true, productCount: 212 },
    { id: "01sEUR20250000001A", name: "EUR Price Book (2025)", current: false, productCount: 190 },
  ],
  USD: [{ id: "01sUSD00000000001A", name: "USD Price Book (Current)", current: true, productCount: null }],
};

vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useCurrencies: () => lookup(["USD", "EUR"]),
  usePricebooks: (currency: string) => lookup(currency ? (books[currency] ?? []) : undefined),
  useAccountOpportunities: () => lookup([opportunity]),
}));

function Value() {
  const [currency, book] = useWatch<DraftFormValues, ["currencyIsoCode", "defaultPricebookName"]>({
    name: ["currencyIsoCode", "defaultPricebookName"],
  });
  return <p>value: {currency || "none"} · {book || "none"}</p>;
}

function Harness({ values }: { values: Partial<DraftFormValues> }) {
  const form = useForm<DraftFormValues>({
    defaultValues: { ...emptyDraftForm(), accountId: "001A", opportunityId: "006A", ...values },
  });
  return (
    <FormProvider {...form}>
      <PricingSetupCard />
      <Value />
    </FormProvider>
  );
}

beforeEach(() => {
  opportunity.currencyIsoCode = "EUR";
  opportunity.pricebook = { id: "01sEUR00000000001A", name: "EUR Price Book (Current)" };
});

describe("PricingSetupCard", () => {
  it("shows the opportunity's currency and price book, locked, and fills them in", async () => {
    render(<Harness values={{}} />);
    const currency = screen.getByRole("textbox", { name: "Currency" });
    const book = screen.getByRole("textbox", { name: "Price book" });
    expect(currency).toHaveAttribute("readonly");
    expect(book).toHaveAttribute("readonly");
    expect(await screen.findByText("value: EUR · EUR Price Book (Current)")).toBeInTheDocument();
    expect(screen.getAllByText("From the Salesforce opportunity")).toHaveLength(2);
    expect(screen.queryByText("Products can't be added")).toBeNull();
  });

  it("follows the opportunity when Salesforce has changed since the draft was saved", async () => {
    render(<Harness values={{ currencyIsoCode: "USD", defaultPricebookId: "01sUSD00000000001A", defaultPricebookName: "USD Price Book (Current)" }} />);
    expect(await screen.findByText("value: EUR · EUR Price Book (Current)")).toBeInTheDocument();
  });

  it("says what to fix in Salesforce when the opportunity's book can't be used, and leaves no book", async () => {
    opportunity.pricebook = { id: "01sOLD00000000001A", name: "EUR Price Book 2021" };
    render(<Harness values={{}} />);
    expect(screen.getByText("Products can't be added")).toBeInTheDocument();
    expect(
      screen.getByText(/The opportunity's price book, EUR Price Book 2021, is inactive in Salesforce or has no active products in EUR/),
    ).toBeInTheDocument();
    expect(await screen.findByText(/· none$/)).toBeInTheDocument();
  });

  // D142: what the opportunity lacks, the AM chooses.
  it("lets the AM choose the price book when the opportunity has none, the currency staying locked", async () => {
    opportunity.pricebook = null;
    const user = userEvent.setup();
    render(<Harness values={{}} />);
    expect(screen.getByRole("textbox", { name: "Currency" })).toHaveAttribute("readonly");
    expect(screen.getByText(/The opportunity has no price book in Salesforce, so choose one here/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Price book" }));
    await user.click(screen.getByRole("option", { name: "EUR Price Book (2025)" }));
    expect(await screen.findByText("value: EUR · EUR Price Book (2025)")).toBeInTheDocument();
  });

  it("lets the AM choose the currency, then the book, when the opportunity has neither", async () => {
    opportunity.currencyIsoCode = null;
    opportunity.pricebook = null;
    const user = userEvent.setup();
    render(<Harness values={{}} />);
    expect(screen.getByText(/no currency and price book in Salesforce, so choose them here/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Currency" }));
    await user.click(screen.getByRole("option", { name: "USD" }));
    await user.click(screen.getByRole("combobox", { name: "Price book" }));
    await user.click(screen.getByRole("option", { name: "USD Price Book (Current)" }));
    expect(await screen.findByText("value: USD · USD Price Book (Current)")).toBeInTheDocument();
  });

  it("asks before a change removes the products", async () => {
    opportunity.pricebook = null;
    const user = userEvent.setup();
    // Only the count matters here.
    const line = { key: "l1", productName: "API Manager" } as unknown as LineValue;
    render(<Harness values={{ defaultPricebookId: "01sEUR00000000001A", defaultPricebookName: "EUR Price Book (Current)", lines: [line] }} />);
    await user.click(screen.getByRole("combobox", { name: "Price book" }));
    await user.click(screen.getByRole("option", { name: "EUR Price Book (2025)" }));
    const dialog = within(screen.getByRole("dialog", { name: "Change the price book?" }));
    expect(dialog.getByText(/the product on this quote is removed/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Change and remove products" }));
    expect(await screen.findByText("value: EUR · EUR Price Book (2025)")).toBeInTheDocument();
  });
});

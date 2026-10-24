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
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import type { LineValue } from "@features/sales/cado2/quotes/form/draftForm";
import AddLineDialog from "./AddLineDialog";

const gateway = {
  id: "01t000000000001",
  name: "WSO2 API Manager",
  productCode: "APIM-GW",
  family: null,
  unitOfMeasure: "Gateways",
  recurring: true, // from its Salesforce classification (D76)
  classification: "PS", // on-prem
  pricebookEntries: [
    { id: "01u000000000001", unitPrice: "360", currencyIsoCode: "USD", isActive: true, pricebook: { id: "01s1", name: "FY26 USD" } },
  ],
};

// Mapped by an Admin.
const support = {
  ...gateway,
  id: "01t000000000002",
  name: "WSO2 Enterprise Support Plan - APIM",
  productCode: "SUP-APIM",
  // Its description repeats the name first, as in Salesforce.
  description: "WSO2 Enterprise Support Plan - APIM. Based on the number of production gateways.",
  category: "SUPPORT" as const,
  pricebookEntries: [{ ...gateway.pricebookEntries[0], id: "01u000000000002", unitPrice: "25000" }],
};

// The backend lists the quote's price book only. `more` stands for a
// next page still to load; `book` records the book asked for.
const productPages = { more: false, fetchNextPage: vi.fn(), book: "" };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  usePricingFormulas: () => ({ data: formulas.list }),
  useBundleChildren: (id: string | null) => ({ data: id ? bundle.of(id) : undefined, isFetching: false }),
  useProducts: (_currency: string, _term: string, book: string) => {
    productPages.book = book;
    return {
      data: book ? [gateway, support] : [],
      isPending: false,
      fetchStatus: "idle",
      hasNextPage: productPages.more,
      isFetchingNextPage: false,
      fetchNextPage: productPages.fetchNextPage,
    };
  },
}));

const quoteBook = { id: "01s1", name: "FY26 USD" };

// Support priced by an Admin's formula (D81), when a test sets it.
const supportFormula = {
  versionId: 6,
  version: 3,
  status: "ACTIVE" as "ACTIVE" | "REMOVED",
  productId: support.id,
  productName: support.name,
  productCode: support.productCode,
  expression: "max($1, $2 * $3)",
  bindings: [
    { name: "$1", kind: "VALUE" as const, value: "25000" },
    { name: "$2", kind: "VALUE" as const, value: "10%" },
    { name: "$3", kind: "PRODUCTS" as const, products: [{ id: gateway.id, name: gateway.name, code: gateway.productCode }] },
  ],
  unitOfMeasure: "Annual, higher of 25,000 or 10% of subscription",
  updatedByEmail: "admin@wso2.com",
  updatedAt: "2026-10-15T10:00:00Z",
};
const formulas: { list: (typeof supportFormula)[] } = { list: [] };

// Bundles, when a test sets them: parent id → what comes with it.
const bundle: { parents: Record<string, { children: unknown[]; missing: string[] }>; of: (id: string) => unknown } = {
  parents: {},
  of: (id) => bundle.parents[id] ?? { children: [], missing: [] },
};

// A saved Support line priced with formula v3 (quote 57's case).
function savedSupportLine(): LineValue {
  return {
    lineId: 228,
    pricebookEntryId: "01u000000000002",
    productId: support.id,
    productName: support.name,
    productCode: "SUP-APIM",
    productDescription: "",
    pricebookId: "01s1",
    pricebookName: "FY26 USD",
    unitPrice: "414000",
    category: "SUPPORT",
    categorySource: "MAPPED",
    recurring: true,
    classification: "PS",
    unitOfMeasure: "",
    quantity: "1",
    discount: "0",
    yearNumber: 1,
    startDate: "",
    endDate: "",
    salesPrice: "",
    key: `k-${Math.random()}`,
    parentKey: "",
    keepPricing: {
      method: "FORMULA",
      formulaVersionId: 6,
      formula: {
        versionId: 6,
        version: 3,
        versionDate: "2026-10-15",
        unitOfMeasure: "Annual, per v3",
        expression: "max($1, $2 * 10%)",
        explanation: "max(25,000, 4,140,000 × 10%)",
        listPrice: "53000",
        values: [],
      },
    },
  };
}

function renderDialog(onSave = vi.fn(), line: LineValue | null = null) {
  render(
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <AddLineDialog open line={line} currency="USD" pricebook={quoteBook} year={null} onSave={onSave} onClose={vi.fn()} />
    </DatePickers.LocalizationProvider>,
  );
  return onSave;
}

async function pick(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /Product/ }));
  await user.click(await screen.findByRole("option", { name }));
  return user;
}

describe("AddLineDialog", () => {
  it("groups the fields and shows the chosen product and its price-book price", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    for (const group of ["Product", "Price, Quantity & Discount"]) {
      expect(screen.getByRole("region", { name: group })).toBeInTheDocument();
    }
    // Lines have no dates of their own: they cover the quote's term.
    expect(screen.queryByRole("region", { name: "Period" })).toBeNull();
    expect(screen.getByText("Priced from FY26 USD in USD")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chosen product")).toBeNull();

    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(await screen.findByRole("option", { name: /WSO2 API Manager/ }));

    const card = within(screen.getByLabelText("Chosen product"));
    expect(card.getByText("WSO2 API Manager")).toBeInTheDocument();
    expect(card.getByText("APIM-GW")).toBeInTheDocument();
    expect(card.getByText("FY26 USD")).toBeInTheDocument();
    expect(card.getByText("USD 360")).toBeInTheDocument();

    // Not mapped: the rep must choose the category.
    expect(screen.getByText(/No category is set up for this product/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Choose the category")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: /Category/ }));
    await user.click(screen.getByRole("option", { name: "Subscription" }));

    await user.click(screen.getByRole("button", { name: "Add line" }));
    // Product_Unit__c is the product family, so it no longer pre-fills the unit (2026-09-26).
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        pricebookEntryId: "01u000000000001",
        unitPrice: "360",
        unitOfMeasure: "",
        category: "SUBSCRIPTION",
        categorySource: "REP",
        recurring: true,
        classification: "PS",
      }), []);
  });

  // The sales price is the list price unless the AM raises it; never lower.
  it("lets the AM raise the sales price, not lower it", async () => {
    const onSave = renderDialog();
    const user = await pick(/Enterprise Support Plan/); // list 25,000, mapped to Support
    const field = screen.getByRole("textbox", { name: "Sales price" });
    expect(field).toHaveAttribute("placeholder", "25000.00");
    expect(screen.getByText("List price USD 25,000. You can raise it, not lower it.")).toBeInTheDocument();

    await user.type(field, "24000");
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("The sales price can't be below the list price (25000.00)")).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "27500.50");
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: "25000", salesPrice: "27500.5" }), []);
  });

  // A bundle parent brings its children, same year and dates, its quantity to start with.
  it("adds a bundle parent with the products that come with it", async () => {
    bundle.parents = { [gateway.id]: { children: [support], missing: ["Onboarding"] } };
    try {
      const onSave = vi.fn();
      render(
        <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
          <AddLineDialog
            open
            line={null}
            currency="USD"
            pricebook={quoteBook}
            year={{ number: 2, start: "2028-01-01", end: "2028-12-31" }}
            onSave={onSave}
            onClose={vi.fn()}
          />
        </DatePickers.LocalizationProvider>,
      );
      const user = await pick(/WSO2 API Manager/);
      expect(screen.getByLabelText("Bundle")).toHaveTextContent("Comes with WSO2 Enterprise Support Plan - APIM");
      expect(screen.getByLabelText("Not in the price book")).toHaveTextContent("Not in FY26 USD, so not added: Onboarding");
      await user.click(screen.getByRole("combobox", { name: /Category/ }));
      await user.click(screen.getByRole("option", { name: "Subscription" }));
      const qty = screen.getByRole("textbox", { name: "Quantity" });
      await user.clear(qty);
      await user.type(qty, "4");

      await user.click(screen.getByRole("button", { name: "Add 2 lines" }));
      const [parent, children] = onSave.mock.calls[0] as [LineValue, LineValue[]];
      expect(children).toHaveLength(1);
      expect(children[0]).toMatchObject({ productId: support.id, quantity: "4", yearNumber: 2, category: "SUPPORT", parentKey: parent.key });
    } finally {
      bundle.parents = {};
    }
  });

  it("takes a mapped product's category, with no choice to make", async () => {
    const onSave = renderDialog();
    const user = await pick(/Enterprise Support Plan/);

    expect(within(screen.getByLabelText("Category")).getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Set for this product by an Admin")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();
    expect(screen.queryByText(/No category is set up/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ category: "SUPPORT", categorySource: "MAPPED" }), []);
  });

  it("keeps a saved line's category locked when it came from a mapping", async () => {
    const line: LineValue = {
      lineId: 7,
      pricebookEntryId: "01u000000000002",
      productName: "WSO2 Enterprise Support Plan - APIM",
      productCode: "SUP-APIM",
      productDescription: "",
      pricebookId: "01s1",
      pricebookName: "FY26 USD",
      unitPrice: "25000",
      category: "SUPPORT",
      categorySource: "MAPPED",
      recurring: true,
      classification: "PS",
      unitOfMeasure: "",
      quantity: "1",
      discount: "0",
      yearNumber: 1,
      startDate: "",
      endDate: "",
      salesPrice: "",
      key: `k-${Math.random()}`,
      parentKey: "",
    };
    const onSave = renderDialog(vi.fn(), line);

    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();
    // The product can't be changed on a line: remove it and add another (2026-10-12).
    expect(screen.queryByRole("combobox", { name: /Product/ })).toBeNull();
    expect(screen.getByText(/remove this line and add it/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ lineId: 7, category: "SUPPORT", categorySource: "MAPPED" }), []);
  });

  it("lists the quote's price book only, with its prices, and no choice of book", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    expect(productPages.book).toBe("01s1");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "WSO2 API Manager (APIM-GW)",
      "WSO2 Enterprise Support Plan - APIM (SUP-APIM)Based on the number of production gateways.",
    ]);
    expect(screen.getByText("All 2 products shown")).toBeInTheDocument();
    expect(screen.queryByText(/Not in |No category|Other price books/)).toBeNull();

    await user.click(screen.getByRole("option", { name: /Enterprise Support Plan/ }));
    expect(within(screen.getByLabelText("Chosen product")).getByText("FY26 USD")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Price book/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pricebookId: "01s1", pricebookName: "FY26 USD", unitPrice: "25000" }), []);
  });

  it("says more are coming and loads the next page on scrolling to the end", async () => {
    productPages.more = true;
    try {
      renderDialog();
      await userEvent.setup().click(screen.getByRole("combobox", { name: /Product/ }));
      expect(screen.getByText("Showing 2 · scroll for more")).toBeInTheDocument();

      const list = screen.getByRole("listbox");
      Object.defineProperties(list, { scrollHeight: { value: 600 }, clientHeight: { value: 300 } });
      list.scrollTop = 290;
      list.dispatchEvent(new Event("scroll"));
      expect(productPages.fetchNextPage).toHaveBeenCalled();
    } finally {
      productPages.more = false;
    }
  });

  it("shows the description under the name, without repeating the name, and on the chosen product", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    const option = screen.getByRole("option", { name: /Enterprise Support Plan/ });
    const about = within(option).getByText("Based on the number of production gateways.");
    expect(about).toHaveAttribute("title", "Based on the number of production gateways.");
    expect(within(screen.getByRole("option", { name: /WSO2 API Manager/ })).queryByText(/Based on/)).toBeNull();

    await user.click(option);
    expect(within(screen.getByLabelText("Chosen product")).getByText("Based on the number of production gateways.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        productDescription: "WSO2 Enterprise Support Plan - APIM. Based on the number of production gateways.",
      }), []);
  });

  // Locked until it comes from Salesforce (2026-10-14).
  it("locks the unit of measure, saying it will come from Salesforce", async () => {
    renderDialog();
    await pick(/WSO2 API Manager/);
    const uom = screen.getByRole("textbox", { name: "Unit of measure" });
    expect(uom).toBeDisabled();
    expect(uom).toHaveAccessibleDescription("Will come from Salesforce");
  });
});

// A click outside the dialog doesn't throw the typed line away (2026-10-13).
describe("AddLineDialog — closing", () => {
  it("shows a formula product's formula instead of a price, and allows no discount (D81)", async () => {
    formulas.list = [supportFormula];
    try {
      const onSave = renderDialog();
      const user = await pick(/Enterprise Support Plan/);

      const card = within(screen.getByLabelText("Chosen product"));
      expect(card.getByText("By formula")).toBeInTheDocument();
      expect(card.queryByText("USD 25,000")).toBeNull();
      expect(card.getByText("Formula v3 · 15 Oct 2026")).toBeInTheDocument();
      expect(card.getByText("max($1, $2 * $3)")).toBeInTheDocument();
      expect(card.getByText("$1 = 25000 · $2 = 10% · $3 = total of WSO2 API Manager")).toBeInTheDocument();

      const discount = screen.getByRole("textbox", { name: "Discount" });
      expect(discount).toBeDisabled();
      expect(discount).toHaveValue("0");
      expect(screen.getByText("No discount on formula-priced products")).toBeInTheDocument();
      // D83: the unit of measure comes from the formula version.
      expect(screen.getByRole("textbox", { name: "Unit of measure" })).toHaveValue("Annual, higher of 25,000 or 10% of subscription");
      expect(screen.getByText("From the pricing formula v3")).toBeInTheDocument();
      // A formula's price can't be overridden.
      expect(screen.getByRole("textbox", { name: "Sales price" })).toBeDisabled();
      expect(screen.getByText("Priced by formula: the price can't be changed")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add line" }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ productId: support.id, discount: "0", salesPrice: "" }), []);
    } finally {
      formulas.list = [];
    }
  });

  // D82, the case of quote 57: a saved formula line shows the price it was
  // worked out at and its version, even after the formula was removed.
  it("shows a saved formula line's own price and version, and lets the AM move it to the price book", async () => {
    formulas.list = [{ ...supportFormula, versionId: 7, version: 4, status: "REMOVED", expression: "", bindings: [], updatedAt: "2026-10-16T10:00:00Z" }];
    try {
      const onSave = renderDialog(vi.fn(), savedSupportLine());
      const card = within(screen.getByLabelText("Chosen product"));
      expect(card.getByText("USD 414,000")).toBeInTheDocument();
      expect(card.getByText("per unit, by formula")).toBeInTheDocument();
      expect(card.queryByText("per unit, from the price book")).toBeNull();
      expect(card.getByText("Formula v3 · 15 Oct 2026")).toBeInTheDocument();
      expect(card.getByText("= max(25,000, 4,140,000 × 10%)")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeDisabled();
      expect(screen.getByRole("textbox", { name: "Unit of measure" })).toHaveValue("Annual, per v3");

      expect(screen.getByText(/This formula was removed on 16 Oct 2026/)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Use the price-book price" }));
      const moved = within(screen.getByLabelText("Chosen product"));
      expect(moved.getByText("USD 53,000")).toBeInTheDocument();
      expect(moved.getByText("per unit, from the price book")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeEnabled();
      expect(screen.getByRole("textbox", { name: "Unit of measure" })).toHaveValue("");
      await user.click(screen.getByRole("button", { name: "Save line" }));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ lineId: 228, useLatestPricing: true, unitPrice: "53000", unitOfMeasure: "" }), []);
    } finally {
      formulas.list = [];
    }
  });

  it("keeps a saved line on its version unless the AM moves it to the newer one", async () => {
    formulas.list = [{ ...supportFormula, versionId: 8, version: 4, updatedAt: "2026-10-20T10:00:00Z" }];
    try {
      const onSave = renderDialog(vi.fn(), savedSupportLine());
      expect(screen.getByText(/A newer version of this formula is in force: v4 · 20 Oct 2026/)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Save line" }));
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ useLatestPricing: undefined }), []);
      expect(onSave.mock.lastCall?.[0].keepPricing.formulaVersionId).toBe(6);
    } finally {
      formulas.list = [];
    }
  });

  it("offers a formula introduced since a price-book line was saved, without applying it", async () => {
    formulas.list = [supportFormula];
    try {
      const line = { ...savedSupportLine(), unitPrice: "25000", keepPricing: { method: "PRICE_BOOK" as const, formulaVersionId: null, formula: null } };
      renderDialog(vi.fn(), line);
      expect(within(screen.getByLabelText("Chosen product")).getByText("per unit, from the price book")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeEnabled();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Use the formula" }));
      expect(within(screen.getByLabelText("Chosen product")).getByText("By formula")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeDisabled();
    } finally {
      formulas.list = [];
    }
  });

  it("stays open on a click outside it; Cancel closes it", async () => {
    const onClose = vi.fn();
    render(
      <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
        <AddLineDialog open line={null} currency="USD" pricebook={quoteBook} year={null} onSave={vi.fn()} onClose={onClose} />
      </DatePickers.LocalizationProvider>,
    );
    const user = userEvent.setup();
    const backdrop = document.querySelector(".MuiBackdrop-root") as HTMLElement;
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

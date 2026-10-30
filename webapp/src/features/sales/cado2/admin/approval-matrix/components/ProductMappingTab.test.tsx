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

import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApprovalMapping, ApprovalMatrix, CatalogProduct } from "@features/sales/cado2/approvals/api/approvalTypes";
import ProductMappingTab from "./ProductMappingTab";

const catalog: CatalogProduct[] = [
  { id: "01tA", name: "WSO2 API Manager", code: "P-API", classification: "PS", productUnit: "APIM" },
  { id: "01tB", name: "API Manager Cloud", code: "C-API", classification: "CL", productUnit: "APIM" },
  { id: "01tC", name: "Private API/Integration Cloud: Basic", code: "PC-API-B", classification: "PC", productUnit: "APIM" },
  { id: "01tD", name: "Private Identity Cloud: Setup Fee", code: "PC-IAM-SETUP", classification: "PC", productUnit: "IAM" },
  { id: "01tE", name: "Private Identity Cloud: Gold Support", code: "PC-IAM-GOLD", classification: "PC", productUnit: "IAM" },
];
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({
  useMatrixProducts: () => ({ data: catalog, isPending: false, error: null, isFetching: false, refetch: vi.fn() }),
}));

const blank = { products: [], skuPattern: "", classification: "", productUnit: "" };
const base: ApprovalMatrix = {
  groups: [
    { code: "PLATFORM", name: "On-prem platform", reviewers: [], ladder: [] },
    { code: "SAAS", name: "SaaS products", reviewers: [], ladder: [] },
  ],
  mappings: [
    { ...blank, kind: "PRODUCTS", products: [{ id: "01tE", name: "Private Identity Cloud: Gold Support", code: "PC-IAM-GOLD" }], groupCode: "PLATFORM" },
    { ...blank, kind: "SKU", skuPattern: "PC-*", groupCode: "SAAS" },
    { ...blank, kind: "RULE", classification: "PS", productUnit: "APIM", groupCode: "PLATFORM" },
    { ...blank, kind: "RULE", productUnit: "APIM", groupCode: "PLATFORM" },
  ],
  settings: {
    shortTermMonths: "12",
    longTermMonths: "36",
    paymentTermsDays: 45,
    downsellCeoPercent: "10",
    saasClassification: "CL",
    billingApproval: [],
    regionalRoles: [],
  },
  roles: [],
};

let latest: ApprovalMapping[] = base.mappings.slice();
function Harness() {
  const [m, setM] = useState<ApprovalMatrix>(base);
  return (
    <ProductMappingTab
      matrix={m}
      onChange={(mappings) => {
        latest = mappings;
        setM({ ...m, mappings });
      }}
    />
  );
}

// D117: three cards in the order they win, each with its own dialog.
describe("ProductMappingTab", () => {
  beforeEach(() => {
    latest = base.mappings.slice();
  });

  it("lists product lists, patterns and rules with what they match today", () => {
    render(<Harness />);
    expect(within(screen.getByRole("table", { name: "Product lists" })).getByText("Private Identity Cloud: Gold Support")).toBeInTheDocument();
    const patterns = within(screen.getByRole("table", { name: "SKU patterns" }));
    // PC-* matches three codes; the Gold Support product is won by its list but still matches.
    expect(patterns.getByText("3 products")).toBeInTheDocument();
    const rules = within(screen.getByRole("table", { name: "Rules" }));
    expect(rules.getByText("Any")).toBeInTheDocument();
    expect(rules.getByRole("button", { name: "Edit rule Classification PS + Product Unit APIM" })).toBeInTheDocument();
  });

  it("adds a rule, refusing a duplicate while typing (ignoring case)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Add a rule" }));
    const dialog = within(screen.getByRole("dialog", { name: "Add Rule" }));
    await user.type(dialog.getByRole("textbox", { name: "Classification" }), "ps");
    await user.type(dialog.getByRole("textbox", { name: "Product Unit" }), "apim");
    expect(dialog.getByText(/There's already a rule for Classification ps \+ Product Unit apim \(On-prem platform\)/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Add rule" })).toBeDisabled();

    await user.clear(dialog.getByRole("textbox", { name: "Classification" }));
    await user.type(dialog.getByRole("textbox", { name: "Classification" }), "CL");
    expect(dialog.getByText("Matches today: 1 product")).toBeInTheDocument();
    // Same group as where it comes from: nothing to warn about.
    expect(dialog.queryByText(/move here/)).toBeNull();
    await user.click(dialog.getByRole("combobox", { name: /Discount group/ }));
    await user.click(screen.getByRole("option", { name: "SaaS products" }));
    expect(dialog.getByText("1 of these move here from Product Unit APIM (On-prem platform).")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Add rule" }));
    expect(latest.at(-1)).toMatchObject({ kind: "RULE", classification: "CL", productUnit: "apim", groupCode: "SAAS" });
  });

  it("refuses a pattern that ties with another group's, naming a product", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Add a pattern" }));
    const dialog = within(screen.getByRole("dialog", { name: "Add Pattern" }));
    await user.type(dialog.getByRole("textbox", { name: /Product code/ }), "*OLD");
    // PC-* (SaaS) vs *OLD (On-prem, the first group): both 3 fixed characters.
    expect(dialog.getByText(/can match the same products/)).toBeInTheDocument();
    expect(dialog.getByText("Private Identity Cloud: Gold Support")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Add pattern" })).toBeDisabled();
  });

  it("picks several products for a list; one in another list can't be ticked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Add a product list" }));
    const dialog = within(screen.getByRole("dialog", { name: "Add Product List" }));
    expect(dialog.getByRole("button", { name: "Add list" })).toBeDisabled();
    await user.click(dialog.getByRole("button", { name: "Add products…" }));

    const picker = within(screen.getByRole("dialog", { name: "Choose Products" }));
    await user.type(picker.getByRole("textbox", { name: "Name or product code" }), "identity cloud");
    expect(picker.getByRole("checkbox", { name: "Private Identity Cloud: Gold Support" })).toBeDisabled();
    expect(picker.getByText(/Already in another product list \(On-prem platform\)/)).toBeInTheDocument();
    expect(picker.getByText("now: pattern PC-* → SaaS products")).toBeInTheDocument();
    await user.click(picker.getByRole("checkbox", { name: "Private Identity Cloud: Setup Fee" }));
    await user.click(picker.getByRole("button", { name: "Add product" }));

    await user.click(dialog.getByRole("button", { name: "Add list" }));
    expect(latest.at(-1)).toMatchObject({
      kind: "PRODUCTS",
      products: [{ id: "01tD", name: "Private Identity Cloud: Setup Fee", code: "PC-IAM-SETUP" }],
    });
  });

  it("asks before removing, and says where the products fall back to", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remove pattern PC-*" }));
    const dialog = within(screen.getByRole("dialog", { name: "Remove this pattern?" }));
    // Its two products (Gold Support stays with its list): the APIM one falls
    // back to the unit rule; the IAM one is covered by nothing else.
    expect(dialog.getByText(/fall back to/)).toHaveTextContent("1 product fall back to Product Unit APIM (On-prem platform).");
    expect(dialog.getByText(/covered by nothing else/)).toBeInTheDocument();
    expect(latest).toHaveLength(base.mappings.length);
    await user.click(dialog.getByRole("button", { name: "Remove pattern" }));
    expect(latest.some((m) => m.kind === "SKU")).toBe(false);
  });
});

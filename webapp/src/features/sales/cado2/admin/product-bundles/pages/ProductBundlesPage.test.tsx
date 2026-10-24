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
import ProductBundlesPage from "./ProductBundlesPage";

const bundles = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const set = { mutate: vi.fn(), isPending: false, error: null as unknown };

// Mocked so the page is tested without Asgardeo, the network or window.config.
vi.mock("@features/sales/cado2/admin/product-bundles/api/useBundles", () => ({
  useBundles: () => bundles,
  useSetBundle: () => set,
}));
vi.mock("@features/sales/cado2/admin/pricing-formulas/api/usePricingFormulaAdmin", () => ({
  useFormulaProducts: () => ({ data: [], isPending: false, fetchStatus: "idle", hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() }),
}));

const apimBundle = {
  parentProductId: "01t000000000001AAA",
  parentName: "WSO2 API Manager",
  parentCode: "APIM",
  children: [
    { productId: "01t000000000002AAA", name: "API Management Enterprise Support", code: "SUP-APIM" },
    { productId: "01t000000000003AAA", name: "API Analytics", code: null },
  ],
  updatedByEmail: "admin@wso2.com",
  updatedAt: "2026-10-23T10:00:00Z",
};

beforeEach(() => {
  Object.assign(bundles, { data: undefined, error: null, isPending: true });
  set.mutate.mockReset();
});

describe("ProductBundlesPage", () => {
  it("explains bundles when there are none", () => {
    Object.assign(bundles, { isPending: false, data: [] });
    render(<ProductBundlesPage />);
    expect(screen.getByText("No bundles yet")).toBeInTheDocument();
  });

  it("lists each bundle with what comes with it, and removes one after asking", async () => {
    Object.assign(bundles, { isPending: false, data: [apimBundle] });
    render(<ProductBundlesPage />);
    const table = within(screen.getByRole("table", { name: "Bundles" }));
    expect(table.getByText("WSO2 API Manager")).toBeInTheDocument();
    expect(table.getByText("API Management Enterprise Support (SUP-APIM)")).toBeInTheDocument();
    expect(table.getByText("API Analytics")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(table.getByRole("button", { name: "Remove the bundle of WSO2 API Manager" }));
    await user.click(screen.getByRole("button", { name: "Remove bundle" }));
    expect(set.mutate).toHaveBeenCalledWith({ parentProductId: apimBundle.parentProductId, childProductIds: null }, expect.anything());
  });

  it("asks for the parent and its products before saving a new bundle", async () => {
    Object.assign(bundles, { isPending: false, data: [] });
    render(<ProductBundlesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "New bundle" }));
    await user.click(screen.getByRole("button", { name: "Save bundle" }));
    expect(screen.getByText("Choose the parent product")).toBeInTheDocument();
    expect(set.mutate).not.toHaveBeenCalled();
  });

  it("keeps an edited bundle's parent fixed and its products in order", async () => {
    Object.assign(bundles, { isPending: false, data: [apimBundle] });
    render(<ProductBundlesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit the bundle of WSO2 API Manager" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("WSO2 API Manager (APIM)")).toBeInTheDocument();
    expect(dialog.queryByRole("combobox", { name: "Parent product" })).toBeNull();
    await user.click(dialog.getByRole("button", { name: "Save bundle" }));
    expect(set.mutate).toHaveBeenCalledWith(
      { parentProductId: apimBundle.parentProductId, childProductIds: ["01t000000000002AAA", "01t000000000003AAA"] },
      expect.anything(),
    );
  });
});

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
import VolumeDiscountsPage from "./VolumeDiscountsPage";

const data = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const save = { mutate: vi.fn(), isPending: false, error: null as unknown };
const remove = { mutate: vi.fn(), isPending: false, error: null as unknown };
const productList = {
  data: [{ id: "01tGWY", name: "WSO2 Gateway (Self-hosted) - API Platform", code: "SH-API-GW", description: null }] as unknown[],
  isPending: false,
  fetchStatus: "idle",
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
};

// Mocked so the page is tested without Asgardeo, the network or window.config.
vi.mock("@features/sales/cado2/admin/volume-discounts/api/useVolumeDiscounts", () => ({
  useVolumeDiscounts: () => data,
  useSaveVolumeDiscount: () => save,
  useDeleteVolumeDiscount: () => remove,
}));
const changes = { data: [] as unknown[], error: null as unknown, isFetching: false, refetch: vi.fn() };
vi.mock("@features/sales/cado2/admin/components/useAdminChanges", () => ({
  useAdminChanges: () => changes,
}));
vi.mock("@features/sales/cado2/admin/pricing-formulas/api/usePricingFormulaAdmin", () => ({
  useFormulaProducts: () => productList,
}));

const portals = {
  id: 1,
  name: "WSO2 API Portal & AI Hub (Self-hosted) - API Platform",
  products: [
    { productCode: "C-API-PORTAL", productId: "01tCPO", productName: "WSO2 API Portal and MCP Hub (SaaS) - API Platform" },
    { productCode: "SH-API-PORTAL", productId: "01tSPO", productName: "WSO2 API Portal and MCP Hub (Self-hosted) - API Platform" },
  ],
  tiers: [
    { fromQuantity: 1, ceilingPercent: "0.00" },
    { fromQuantity: 2, ceilingPercent: "2.08" },
    { fromQuantity: 5, ceilingPercent: "8.33" },
  ],
  updatedByEmail: "migration",
  updatedAt: "2026-11-13T09:00:00Z",
};
const gateway = {
  id: 5,
  name: "WSO2 Gateway (Self-hosted) - API Platform",
  products: [{ productCode: "SH-API-GW", productId: null, productName: null }],
  tiers: [
    { fromQuantity: 10, ceilingPercent: "6.44" },
    { fromQuantity: 101, ceilingPercent: "27.34" },
    { fromQuantity: 1001, ceilingPercent: "56.66" },
  ],
  updatedByEmail: "admin@wso2.com",
  updatedAt: "2026-11-13T09:00:00Z",
};

beforeEach(() => {
  Object.assign(data, { isPending: false, error: null, data: { tables: [portals, gateway], salesforceAvailable: true } });
  Object.assign(save, { error: null });
  save.mutate.mockReset();
  remove.mutate.mockReset();
});

describe("VolumeDiscountsPage (D169)", () => {
  it("shows each table's products and the range each tier covers", () => {
    render(<VolumeDiscountsPage />);
    const p = within(screen.getByRole("region", { name: portals.name }));
    expect(p.getByText("SH-API-PORTAL")).toBeInTheDocument();
    expect(p.getByText("WSO2 API Portal and MCP Hub (SaaS) - API Platform")).toBeInTheDocument();
    const rows = within(p.getByRole("table", { name: `Tiers of ${portals.name}` })).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual(["CoversVolume discount ceiling", "10%", "2 – 42.08%", "5 and above8.33%"]);

    const g = within(screen.getByRole("region", { name: gateway.name }));
    expect(g.getByText("Below 10")).toBeInTheDocument();
    expect(g.getByText("No volume discount")).toBeInTheDocument();
    expect(g.getByText("10 – 100")).toBeInTheDocument();
    expect(g.getByText("1,001 and above")).toBeInTheDocument();
    expect(g.getByText(/Last changed by admin@wso2.com on 13 Nov 2026/)).toBeInTheDocument();
  });

  it("works out the ranges as the Admin types, and saves the starts and ceilings", async () => {
    const user = userEvent.setup();
    render(<VolumeDiscountsPage />);
    await user.click(screen.getByRole("button", { name: `Edit ${gateway.name}` }));
    const editor = within(screen.getByRole("region", { name: `Editing ${gateway.name}` }));
    expect(editor.getByText("10 – 100")).toBeInTheDocument();

    const from = editor.getByRole("textbox", { name: "Tier 2 from quantity" });
    await user.clear(from);
    await user.type(from, "51");
    expect(editor.getByText("10 – 50")).toBeInTheDocument();
    expect(editor.getByText("51 – 1,000")).toBeInTheDocument();

    await user.click(editor.getByRole("button", { name: "Save" }));
    expect(save.mutate).toHaveBeenCalledWith(
      {
        id: 5,
        body: {
          name: gateway.name,
          productCodes: ["SH-API-GW"],
          tiers: [
            { fromQuantity: 10, ceilingPercent: "6.44" },
            { fromQuantity: 51, ceilingPercent: "27.34" },
            { fromQuantity: 1001, ceilingPercent: "56.66" },
          ],
        },
      },
      expect.anything(),
    );
  });

  it("refuses tiers that don't go up before sending", async () => {
    const user = userEvent.setup();
    render(<VolumeDiscountsPage />);
    await user.click(screen.getByRole("button", { name: `Edit ${gateway.name}` }));
    const editor = within(screen.getByRole("region", { name: `Editing ${gateway.name}` }));
    const from = editor.getByRole("textbox", { name: "Tier 3 from quantity" });
    await user.clear(from);
    await user.type(from, "50");
    await user.click(editor.getByRole("button", { name: "Save" }));
    expect(editor.getByText("Tiers must go up")).toBeInTheDocument();
    expect(save.mutate).not.toHaveBeenCalled();
  });

  it("adds a table with its products", async () => {
    const user = userEvent.setup();
    Object.assign(data, { data: { tables: [], salesforceAvailable: true } });
    render(<VolumeDiscountsPage />);
    expect(screen.getByText("No volume discount tables")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New table" }));
    const editor = within(screen.getByRole("region", { name: "New table" }));
    await user.type(editor.getByRole("textbox", { name: "Name" }), "Gateway");
    await user.click(editor.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /WSO2 Gateway/ }));
    await user.click(editor.getByRole("button", { name: "Add tier" }));
    await user.type(editor.getByRole("textbox", { name: "Tier 2 from quantity" }), "10");
    await user.type(editor.getByRole("textbox", { name: "Tier 2 volume discount ceiling" }), "6.44");
    expect(editor.getByText("1 – 9")).toBeInTheDocument();
    await user.click(editor.getByRole("button", { name: "Save" }));
    expect(save.mutate).toHaveBeenCalledWith(
      {
        id: null,
        body: {
          name: "Gateway",
          productCodes: ["SH-API-GW"],
          tiers: [
            { fromQuantity: 1, ceilingPercent: "0" },
            { fromQuantity: 10, ceilingPercent: "6.44" },
          ],
        },
      },
      expect.anything(),
    );
  });

  it("deletes a table after asking", async () => {
    const user = userEvent.setup();
    render(<VolumeDiscountsPage />);
    await user.click(screen.getByRole("button", { name: `Delete ${gateway.name}` }));
    expect(screen.getByText(/Its products will have no volume discount ceiling/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete table" }));
    expect(remove.mutate).toHaveBeenCalledWith(5, expect.anything());
  });

  // D172: every change, with what it was before.
  it("lists each change in the Change Log", () => {
    Object.assign(data, { isPending: false, data: { tables: [], salesforceAvailable: true } });
    changes.data = [
      {
        id: 2, area: "VOLUME_DISCOUNT_TABLE", item: "3", action: "CHANGED", changedByEmail: "admin@wso2.com", changedAt: "2026-11-14T10:42:00Z",
        before: { name: "API Gateway", products: ["SH-API-GW"], tiers: [{ fromQuantity: 101, ceilingPercent: "27.34" }] },
        after: { name: "API Gateway", products: ["SH-API-GW", "C-API-GW"], tiers: [{ fromQuantity: 101, ceilingPercent: "40.00" }] },
      },
    ];
    render(<VolumeDiscountsPage />);
    const log = within(screen.getByRole("list", { name: "Volume discount changes" }));
    expect(log.getByText("Changed")).toBeInTheDocument();
    expect(log.getByText(/API Gateway/)).toBeInTheDocument();
    expect(log.getByText("Products added: C-API-GW")).toBeInTheDocument();
    expect(log.getByText("From 101: 27.34% → 40.00%")).toBeInTheDocument();
    expect(log.getByText(/14 Nov 2026 · admin@wso2.com/)).toBeInTheDocument();
    changes.data = [];
  });
});

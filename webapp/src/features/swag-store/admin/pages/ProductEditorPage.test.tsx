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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { adminProduct, photo } from "../../testing/fixtures";

const http = vi.hoisted(() => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
  authedPatch: vi.fn(),
  authedPut: vi.fn(),
  authedDelete: vi.fn(),
  fetchWithReauth: vi.fn(),
}));

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "admin" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isSwagStoreBackendConfigured: () => true,
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet: http.authedGet,
  authedPost: http.authedPost,
  authedPatch: http.authedPatch,
  authedPut: http.authedPut,
  authedDelete: http.authedDelete,
  fetchWithReauth: http.fetchWithReauth,
}));
vi.mock("../../util/photoResize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../util/photoResize")>()),
  preparePhoto: async (file: File) => file,
}));

import ProductEditorPage from "./ProductEditorPage";

const originalConfig = window.config;

function backend(product = adminProduct()) {
  http.authedGet.mockImplementation(async (url: string) => {
    if (url === "/admin/categories") return { items: [{ id: "c-apparel", slug: "apparel", name: "Apparel", sort: 1 }] };
    if (url.startsWith("/admin/products?")) return { items: [], total: 0 };
    if (url.startsWith("/admin/products/")) return product;
    throw new Error(`unexpected ${url}`);
  });
}

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

function renderPage(path = "/people-ops/swag-store/products/p-hoodie") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/people-ops/swag-store/products/new" element={<ProductEditorPage />} />
          <Route path="/people-ops/swag-store/products/:productId" element={<ProductEditorPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const field = (name: string) => screen.getByRole("textbox", { name });

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  Object.values(http).forEach((f) => f.mockReset());
});

afterEach(() => {
  window.config = originalConfig;
});

describe("a new product", () => {
  it("is created as a draft from the basics, then opens in the editor", async () => {
    backend();
    http.authedPost.mockResolvedValue(adminProduct({ id: "p-new", status: "DRAFT", name: "WSO2 Mug" }));
    renderPage("/people-ops/swag-store/products/new");
    expect(screen.getByRole("heading", { level: 1, name: "New product" })).toBeInTheDocument();
    expect(screen.getByText("Save the draft to add photos.")).toBeInTheDocument();
    await userEvent.type(field("Name"), "WSO2 Mug");
    await userEvent.type(field("Price (O2C)"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(http.authedPost).toHaveBeenCalledWith(
      "/admin/products",
      "token",
      expect.objectContaining({ name: "WSO2 Mug", price: 45, restockPolicy: "RESTOCKABLE", maxPerUser: null }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/people-ops/swag-store/products/p-new"));
  });

  it("explains a bad price and won't save it", async () => {
    backend();
    renderPage("/people-ops/swag-store/products/new");
    await userEvent.type(field("Name"), "WSO2 Mug");
    await userEvent.type(field("Price (O2C)"), "0");
    expect(screen.getByText("A whole number from 1 to 1,000,000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create draft" })).toBeDisabled();
  });
});

describe("an existing product", () => {
  it("saves uploaded photos with the rest of the form", async () => {
    backend();
    http.authedPatch.mockResolvedValue(adminProduct());
    const path = "products/p-hoodie/back-0a1b2c3d.png";
    http.fetchWithReauth.mockResolvedValue(new Response(JSON.stringify({ view: "back", path, url: null }), { status: 201 }));
    renderPage();
    const input = (await screen.findByLabelText("Back photo file")) as HTMLInputElement;
    await userEvent.upload(input, new File(["png"], "back.png", { type: "image/png" }));
    await screen.findByRole("button", { name: "Replace Back photo" });
    expect(http.authedPatch).not.toHaveBeenCalled(); // an upload alone changes nothing
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(http.authedPatch).toHaveBeenCalledWith(
      "/admin/products/p-hoodie",
      "token",
      expect.objectContaining({
        images: [
          { view: "front", path: photo("front").path, alt: "Front" },
          { view: "back", path, alt: "" },
        ],
      }),
    );
  });

  it("saves the basics with a PATCH", async () => {
    backend();
    http.authedPatch.mockResolvedValue(adminProduct({ price: 95 }));
    renderPage();
    const price = await screen.findByRole("textbox", { name: "Price (O2C)" });
    await userEvent.clear(price);
    await userEvent.type(price, "95");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(http.authedPatch).toHaveBeenCalledWith(
      "/admin/products/p-hoodie",
      "token",
      expect.objectContaining({ name: "WSO2 Hoodie", price: 95, maxPerUser: 2, categoryId: "c-apparel" }),
    );
  });

  it("publishes a draft", async () => {
    backend(adminProduct({ status: "DRAFT", publishedAt: null }));
    http.authedPatch.mockResolvedValue(adminProduct());
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/products/p-hoodie", "token", { status: "ACTIVE" });
  });

  it("restores a removed product, and says when and why it was removed", async () => {
    backend(adminProduct({ status: "REMOVED", removedAt: "2026-11-10T08:00:00Z", removalNote: "Supplier stopped." }));
    http.authedPatch.mockResolvedValue(adminProduct());
    renderPage();
    expect(await screen.findByText(/Supplier stopped\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/products/p-hoodie", "token", { status: "ACTIVE" });
  });

  it("replaces the options, which rebuilds the variants", async () => {
    backend();
    http.authedPut.mockResolvedValue(adminProduct());
    renderPage();
    const options = await screen.findByRole("region", { name: "Options" });
    await userEvent.click(within(options).getByRole("button", { name: "Add a value to Size" }));
    const values = within(options).getAllByRole("textbox", { name: /^Size value/ });
    await userEvent.type(values[values.length - 1], "L");
    await userEvent.click(within(options).getByRole("button", { name: "Save options" }));
    expect(http.authedPut).toHaveBeenCalledWith("/admin/products/p-hoodie/options", "token", {
      options: [{ name: "Size", values: [{ value: "S" }, { value: "M" }, { value: "L" }] }],
    });
  });

  it("receives stock for one variant, and says how many people were told", async () => {
    backend();
    http.authedPost.mockResolvedValue({ onHand: 5, reserved: 0, free: 5, notified: 3 });
    renderPage();
    const row = await screen.findByRole("row", { name: /HOODIE-M/ });
    await userEvent.click(within(row).getByRole("button", { name: "Stock for HOODIE-M" }));
    const dialog = screen.getByRole("dialog", { name: "Stock for HOODIE-M" });
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Quantity" }), "5");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Note (optional)" }), "Delivery 12");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(http.authedPost).toHaveBeenCalledWith("/admin/variants/v-m/stock-movements", "token", {
      delta: 5,
      reason: "RECEIVE",
      note: "Delivery 12",
    });
    expect(await screen.findByText("Stock saved. 3 people waiting for it were emailed.")).toBeInTheDocument();
  });

  it("edits a variant's SKU, price change and restock date", async () => {
    backend();
    http.authedPatch.mockResolvedValue(adminProduct());
    renderPage();
    const row = await screen.findByRole("row", { name: /HOODIE-M/ });
    await userEvent.click(within(row).getByRole("button", { name: "Edit HOODIE-M" }));
    const dialog = screen.getByRole("dialog", { name: "Edit HOODIE-M" });
    const eta = within(dialog).getByLabelText("Restock date");
    await userEvent.type(eta, "2026-12-12");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/products/p-hoodie/variants/v-m", "token", {
      sku: "HOODIE-M",
      priceDelta: 5,
      active: true,
      restockEta: "2026-12-12",
    });
  });
});

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
import { adminProduct, demandRow } from "../../testing/fixtures";
import { formatCivilDate } from "../../util/civilDate";

const http = vi.hoisted(() => ({ authedGet: vi.fn(), authedPatch: vi.fn() }));

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
  authedPatch: http.authedPatch,
}));

import { HttpError } from "@api/http";
import DemandPage from "./DemandPage";

const originalConfig = window.config;

const ROWS = [
  demandRow({ variantId: "v-m", sku: "HOODIE-M", options: "M", pendingAlerts: 3, firstAlertAt: "2026-11-10T05:00:00Z", free: 0 }),
  demandRow({ variantId: "v-l", sku: "HOODIE-L", options: "L", pendingAlerts: 2, firstAlertAt: "2026-11-08T05:00:00Z", restockEta: "2026-12-12T00:00:00Z" }),
  demandRow({
    productId: "p-speaker",
    productName: "WSO2 Bluetooth Speaker",
    variantId: "v-speaker",
    sku: "SPEAKER",
    options: "",
    pendingAlerts: 1,
    firstAlertAt: "2026-11-12T05:00:00Z",
  }),
];

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

function renderPage(path = "/people-ops/swag-store/demand") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/people-ops/swag-store/demand" element={<DemandPage />} />
          <Route path="/people-ops/swag-store/demand/:productId" element={<DemandPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  Object.values(http).forEach((f) => f.mockReset());
  http.authedGet.mockResolvedValue({ items: ROWS });
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the demand board", () => {
  it("lists products most wanted first, with how many wait, since when, and the next restock date", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Demand" })).toBeInTheDocument();
    const rows = await screen.findAllByRole("row");
    const body = rows.slice(1);
    expect(body).toHaveLength(2);
    expect(within(body[0]).getByRole("link", { name: "WSO2 Hoodie" })).toHaveAttribute("href", "/people-ops/swag-store/demand/p-hoodie");
    expect(body[0]).toHaveTextContent(/5 people/);
    expect(body[0]).toHaveTextContent(/2 options/);
    expect(body[0]).toHaveTextContent(formatCivilDate("2026-12-12") ?? "missing");
    expect(body[1]).toHaveTextContent(/WSO2 Bluetooth Speaker/);
    expect(body[1]).toHaveTextContent(/1 person/);
    expect(body[1]).toHaveTextContent("Not set");
    expect(http.authedGet).toHaveBeenCalledWith("/admin/demand", "token");
  });

  it("says when nobody is waiting", async () => {
    http.authedGet.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText("Nobody is waiting for anything right now.")).toBeInTheDocument();
  });

  it("shows a failure with Retry", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/admin/demand", 503, JSON.stringify({ message: "Database is down." })));
    renderPage();
    expect(await screen.findByText(/Couldn't load the demand board/)).toBeInTheDocument();
    http.authedGet.mockResolvedValue({ items: ROWS });
    await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByRole("link", { name: "WSO2 Hoodie" })).toBeInTheDocument();
  });
});

describe("a product's drawer", () => {
  it("shows each waiting option, and links to the editor to receive stock", async () => {
    renderPage("/people-ops/swag-store/demand/p-hoodie");
    const drawer = await screen.findByRole("dialog", { name: "WSO2 Hoodie" });
    const m = within(drawer).getByRole("group", { name: "M" });
    expect(m).toHaveTextContent(/3 waiting/);
    expect(m).toHaveTextContent(/0 free/);
    expect(within(drawer).getByRole("group", { name: "L" })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Receive stock" })).toHaveAttribute("href", "/people-ops/swag-store/products/p-hoodie");
    expect(drawer).toHaveTextContent("Receiving stock emails everyone waiting for that option.");
  });

  it("saves a restock date for one option", async () => {
    http.authedPatch.mockResolvedValue(adminProduct());
    renderPage("/people-ops/swag-store/demand/p-hoodie");
    const m = within(await screen.findByRole("dialog", { name: "WSO2 Hoodie" })).getByRole("group", { name: "M" });
    const date = within(m).getByLabelText("Restock date");
    await userEvent.type(date, "2026-12-24");
    await userEvent.click(within(m).getByRole("button", { name: "Save date" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/products/p-hoodie/variants/v-m", "token", { restockEta: "2026-12-24" });
    expect(await within(m).findByText("Saved.")).toBeInTheDocument();
  });

  it("clears a restock date", async () => {
    http.authedPatch.mockResolvedValue(adminProduct());
    renderPage("/people-ops/swag-store/demand/p-hoodie");
    const l = within(await screen.findByRole("dialog", { name: "WSO2 Hoodie" })).getByRole("group", { name: "L" });
    expect(within(l).getByLabelText("Restock date")).toHaveValue("2026-12-12");
    await userEvent.clear(within(l).getByLabelText("Restock date"));
    await userEvent.click(within(l).getByRole("button", { name: "Save date" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/products/p-hoodie/variants/v-l", "token", { restockEta: null });
  });

  it("names a default option and says when nobody waits for the product any more", async () => {
    renderPage("/people-ops/swag-store/demand/p-speaker");
    const drawer = await screen.findByRole("dialog", { name: "WSO2 Bluetooth Speaker" });
    expect(within(drawer).getByRole("group", { name: "SPEAKER" })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/people-ops\/swag-store\/demand$/));
  });

  it("says when nobody is waiting for that product now", async () => {
    renderPage("/people-ops/swag-store/demand/p-gone");
    expect(await screen.findByText("Nobody is waiting for this product now.")).toBeInTheDocument();
  });
});

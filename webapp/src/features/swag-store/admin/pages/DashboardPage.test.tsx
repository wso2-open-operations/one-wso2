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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { dashboard } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn() }));

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
}));

import { HttpError } from "@api/http";
import DashboardPage from "./DashboardPage";

const originalConfig = window.config;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/people-ops/swag-store/dashboard"]}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const count = (label: string) => screen.getByRole("group", { name: label });

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  http.authedGet.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the admin dashboard", () => {
  it("names the screen in the h1 and the tab", async () => {
    http.authedGet.mockResolvedValue(dashboard());
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(document.title).toMatch(/^Dashboard · Swag Store/);
    await waitFor(() => expect(http.authedGet).toHaveBeenCalledWith("/admin/dashboard", "token"));
  });

  it("counts the orders work for fulfilment ops, and lists what needs a person", async () => {
    http.authedGet.mockResolvedValue(dashboard());
    renderPage();
    expect(await screen.findByRole("heading", { level: 2, name: "Orders" })).toBeInTheDocument();
    expect(count("To prepare")).toHaveTextContent("4");
    expect(count("Ready for pickup")).toHaveTextContent("2");
    expect(count("Payment not confirmed")).toHaveTextContent("1");
    expect(count("Collected today")).toHaveTextContent("6");
    const row = screen.getByRole("row", { name: /SS-10490/ });
    expect(within(row).getByText("Sam Shopper")).toBeInTheDocument();
    expect(within(row).getByText("Payment needs checking")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "SS-10490" })).toHaveAttribute("href", "/people-ops/swag-store/orders/SS-10490");
    expect(screen.getByRole("link", { name: /To prepare/ })).toHaveAttribute("href", "/people-ops/swag-store/orders?status=CONFIRMED");
    expect(screen.getByRole("link", { name: /Ready for pickup/ })).toHaveAttribute(
      "href",
      "/people-ops/swag-store/orders?status=READY_FOR_PICKUP",
    );
  });

  it("counts the catalog for catalog managers", async () => {
    http.authedGet.mockResolvedValue(dashboard());
    renderPage();
    expect(await screen.findByRole("heading", { level: 2, name: "Catalog" })).toBeInTheDocument();
    expect(count("Active products")).toHaveTextContent("7");
    expect(count("Drafts")).toHaveTextContent("1");
    expect(count("Removed")).toHaveTextContent("2");
    expect(count("Low stock")).toHaveTextContent("3");
    expect(count("Out of stock")).toHaveTextContent("1");
    expect(count("Waiting alerts")).toHaveTextContent("5");
  });

  it("shows only the parts the backend sent for the person's role", async () => {
    http.authedGet.mockResolvedValue(dashboard({ orders: undefined }));
    renderPage();
    expect(await screen.findByRole("heading", { level: 2, name: "Catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Orders" })).toBeNull();
  });

  it("says when no order needs attention", async () => {
    const d = dashboard();
    http.authedGet.mockResolvedValue({ ...d, orders: { ...d.orders!, needsAttention: [] } });
    renderPage();
    expect(await screen.findByText("No order needs attention.")).toBeInTheDocument();
  });

  it("shows a failure with Retry, never as zero counts", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/admin/dashboard", 503, JSON.stringify({ message: "Database is down." })));
    renderPage();
    expect(await screen.findByText(/Couldn't load the dashboard/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "To prepare" })).toBeNull();
  });
});

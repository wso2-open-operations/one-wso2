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
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { orderSummary } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn(), authedPost: vi.fn() }));

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "shopper" }, retry: () => {} }),
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
}));

import { HttpError } from "@api/http";
import OrdersPage from "./OrdersPage";

const originalConfig = window.config;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/store/orders"]}>
        <OrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  http.authedGet.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the orders page", () => {
  it("lists the shopper's orders, newest first, each linking to its page", async () => {
    http.authedGet.mockResolvedValue({
      items: [orderSummary(), orderSummary({ id: "o2", orderNo: "SS-10401", status: "COLLECTED", total: 40 })],
      total: 2,
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Your orders" })).toBeInTheDocument();
    const first = await screen.findByRole("row", { name: /SS-10482.*Colombo.*180 O2C.*Confirmed/ });
    expect(first).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SS-10482" })).toHaveAttribute("href", "/store/orders/SS-10482");
    expect(screen.getByRole("row", { name: /SS-10401.*Collected/ })).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/orders?limit=20&offset=0", "token");
  });

  it("says when there are no orders yet", async () => {
    http.authedGet.mockResolvedValue({ items: [], total: 0 });
    renderPage();
    expect(await screen.findByText("You haven't placed an order yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the store" })).toHaveAttribute("href", "/store");
  });

  it("shows a failure with Retry, never as no orders", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/orders", 503, JSON.stringify({ message: "Database is down." })));
    renderPage();
    expect(await screen.findByText(/Couldn't load your orders/)).toBeInTheDocument();
    expect(screen.queryByText("You haven't placed an order yet.")).toBeNull();
  });
});

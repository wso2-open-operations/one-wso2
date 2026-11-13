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
import { MemoryRouter } from "react-router";
import { stockAlert } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn(), authedDelete: vi.fn() }));

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
  authedDelete: http.authedDelete,
}));

import { HttpError } from "@api/http";
import AlertsPage from "./AlertsPage";

const originalConfig = window.config;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/store/alerts"]}>
        <AlertsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  http.authedGet.mockReset();
  http.authedDelete.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the alerts page", () => {
  it("lists each alert with its item, option and status, and says sold-out items have no waiting list", async () => {
    http.authedGet.mockResolvedValue({
      items: [
        stockAlert(),
        stockAlert({
          id: "alert-2",
          productSlug: "wso2-tumbler",
          productName: "WSO2 Tumbler",
          options: "Orange",
          status: "NOTIFIED",
          notifiedAt: "2026-11-12T08:00:00Z",
        }),
        stockAlert({ id: "alert-3", productSlug: "wso2-umbrella", productName: "WSO2 Umbrella", options: "", status: "CLOSED" }),
      ],
    });
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Stock alerts" })).toBeInTheDocument();
    expect(screen.getByText(/Sold-out items won't come back, so they have no waiting list/)).toBeInTheDocument();
    const waiting = await screen.findByRole("row", { name: /WSO2 Hoodie.*Heather grey · S.*Waiting/ });
    expect(within(waiting).getByRole("link", { name: "WSO2 Hoodie" })).toHaveAttribute("href", "/store/p/wso2-hoodie");
    expect(screen.getByRole("row", { name: /WSO2 Tumbler.*Orange.*Back in stock/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /WSO2 Umbrella.*Closed/ })).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/stock-alerts", "token");
  });

  it("removes a waiting alert, and offers Remove only on waiting ones", async () => {
    http.authedGet.mockResolvedValue({ items: [stockAlert(), stockAlert({ id: "alert-2", status: "NOTIFIED" })] });
    http.authedDelete.mockResolvedValue(undefined);
    renderPage();
    const remove = await screen.findAllByRole("button", { name: /^Remove the alert/ });
    expect(remove).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Remove the alert for WSO2 Hoodie, Heather grey · S" }));
    expect(http.authedDelete).toHaveBeenCalledWith("/stock-alerts/alert-1", "token");
    await waitFor(() => expect(http.authedGet).toHaveBeenCalledTimes(2));
  });

  it("explains a refused removal on the page", async () => {
    http.authedGet.mockResolvedValue({ items: [stockAlert()] });
    http.authedDelete.mockRejectedValue(new HttpError("/stock-alerts/alert-1", 404, JSON.stringify({ message: "Not found." })));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /^Remove the alert/ }));
    expect(await screen.findByText(/Couldn't remove the alert/)).toBeInTheDocument();
  });

  it("says when there are no alerts, and how to set one", async () => {
    http.authedGet.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText("You have no stock alerts.")).toBeInTheDocument();
    expect(screen.getByText(/Notify me/)).toBeInTheDocument();
  });

  it("shows a failure with Retry, never as no alerts", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/stock-alerts", 503, JSON.stringify({ message: "Database is down." })));
    renderPage();
    expect(await screen.findByText(/Couldn't load your alerts/)).toBeInTheDocument();
    expect(screen.queryByText("You have no stock alerts.")).toBeNull();
  });
});

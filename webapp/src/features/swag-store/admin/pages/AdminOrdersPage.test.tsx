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
import { adminOffice, adminOrder, adminOrderDetail } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn(), authedPost: vi.fn(), authedPatch: vi.fn(), authedPostText: vi.fn() }));
const saved = vi.hoisted(() => ({ saveCsv: vi.fn() }));

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
  authedPostText: http.authedPostText,
}));
vi.mock("../../util/saveCsv", () => saved);

import { HttpError } from "@api/http";
import AdminOrdersPage from "./AdminOrdersPage";

const originalConfig = window.config;

function backend({ detail = adminOrderDetail() }: { detail?: unknown } = {}) {
  http.authedGet.mockImplementation(async (url: string) => {
    if (url === "/admin/pickup-offices") return { items: [adminOffice()] };
    if (url.startsWith("/admin/orders/")) {
      if (detail instanceof Error) throw detail;
      return detail;
    }
    throw new Error(`unexpected ${url}`);
  });
  http.authedPost.mockImplementation(async (url: string) => {
    if (url === "/admin/orders/search") return { items: [adminOrder(), adminOrder({ id: "o2", orderNo: "SS-10483", status: "READY_FOR_PICKUP" })], total: 2 };
    if (url.endsWith("/notes")) return null;
    throw new Error(`unexpected ${url}`);
  });
}

const searches = () => http.authedPost.mock.calls.filter(([u]) => u === "/admin/orders/search").map(([, , body]) => body);

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

function renderPage(path = "/people-ops/swag-store/orders") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/people-ops/swag-store/orders" element={<AdminOrdersPage />} />
          <Route path="/people-ops/swag-store/orders/:orderNo" element={<AdminOrdersPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The drawer, once its order has loaded. */
async function openDrawer() {
  const drawer = await screen.findByRole("dialog", { name: /Order SS-10482/ });
  await within(drawer).findByText("Who collects");
  return drawer;
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  Object.values(http).forEach((f) => f.mockReset());
  saved.saveCsv.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the admin orders list", () => {
  it("lists orders with who placed them, searched through a POST so nothing personal goes in a URL", async () => {
    backend();
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Orders" })).toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /SS-10482.*Sam Shopper.*Colombo.*180 O2C.*Confirmed/ });
    expect(within(row).getByRole("link", { name: "SS-10482" })).toHaveAttribute("href", "/people-ops/swag-store/orders/SS-10482");
    expect(searches()[0]).toEqual({ filters: {}, pagination: { limit: 25, offset: 0 } });
  });

  it("names who placed an order by email when the backend has no name for them", async () => {
    backend();
    http.authedPost.mockResolvedValue({ items: [adminOrder({ userName: "", userEmail: "kim@wso2.com" })], total: 1 });
    renderPage();
    expect(await screen.findByRole("row", { name: /SS-10482.*kim@wso2\.com/ })).toBeInTheDocument();
  });

  it("filters by status chip and by search, keeping both in the address", async () => {
    backend();
    renderPage();
    await screen.findByRole("row", { name: /SS-10482/ });
    await userEvent.click(screen.getByRole("button", { name: "Ready for pickup", pressed: false }));
    await waitFor(() => expect(searches()).toContainEqual({ filters: { status: "READY_FOR_PICKUP" }, pagination: { limit: 25, offset: 0 } }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search orders" }), "sam@wso2.com{Enter}");
    await waitFor(() =>
      expect(searches()).toContainEqual({
        filters: { status: "READY_FOR_PICKUP", searchQuery: "sam@wso2.com" },
        pagination: { limit: 25, offset: 0 },
      }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent("status=READY_FOR_PICKUP");
  });

  it("exports the same search as CSV", async () => {
    backend();
    http.authedPostText.mockResolvedValue("orderNo,status\nSS-10482,CONFIRMED\n");
    renderPage("/people-ops/swag-store/orders?status=CONFIRMED");
    await screen.findByRole("row", { name: /SS-10482/ });
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(saved.saveCsv).toHaveBeenCalledWith("swag-store-orders.csv", "orderNo,status\nSS-10482,CONFIRMED\n"));
    const [url, , body, headers] = http.authedPostText.mock.calls[0];
    expect(url).toBe("/admin/orders/search");
    expect(body).toMatchObject({ filters: { status: "CONFIRMED" } });
    expect(headers).toEqual({ Accept: "text/csv" });
  });

  it("shows a list failure with Retry, never as no orders", async () => {
    backend();
    http.authedPost.mockRejectedValue(new HttpError("/admin/orders/search", 503, JSON.stringify({ message: "Database is down." })));
    renderPage();
    expect(await screen.findByText(/Couldn't load the orders/)).toBeInTheDocument();
  });
});

describe("the order drawer", () => {
  it("shows who collects, what to hand over, and the payment reference", async () => {
    backend();
    renderPage("/people-ops/swag-store/orders/SS-10482");
    const drawer = await openDrawer();
    expect(within(drawer).getByText("Sam Shopper")).toBeInTheDocument();
    expect(within(drawer).getByText("HOODIE-BLK-M")).toBeInTheDocument();
    expect(within(drawer).getByText("swag:ord:order-1")).toBeInTheDocument();
  });

  it("marks a paid order ready for pickup, the only next step", async () => {
    backend();
    http.authedPatch.mockResolvedValue(adminOrder({ status: "READY_FOR_PICKUP" }));
    renderPage("/people-ops/swag-store/orders/SS-10482");
    const drawer = await openDrawer();
    expect(within(drawer).queryByRole("button", { name: "Mark collected" })).toBeNull();
    await userEvent.click(within(drawer).getByRole("button", { name: "Mark ready for pickup" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/orders/SS-10482", "token", { status: "READY_FOR_PICKUP" });
  });

  it("can't mark an order collected until the ID check is ticked", async () => {
    backend({ detail: adminOrderDetail({ status: "READY_FOR_PICKUP", readyAt: "2026-11-15T03:00:00Z" }) });
    http.authedPatch.mockResolvedValue(adminOrder({ status: "COLLECTED" }));
    renderPage("/people-ops/swag-store/orders/SS-10482");
    const drawer = await openDrawer();
    const collect = within(drawer).getByRole("button", { name: "Mark collected" });
    expect(collect).toBeDisabled();
    await userEvent.click(within(drawer).getByRole("checkbox", { name: "I checked their WSO2 ID" }));
    await userEvent.type(within(drawer).getByRole("textbox", { name: "Note (optional)" }), "Collected by Sam");
    await userEvent.click(collect);
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/orders/SS-10482", "token", {
      status: "COLLECTED",
      idChecked: true,
      note: "Collected by Sam",
    });
  });

  it("says someone already did it when the order moved meanwhile, and reads it again", async () => {
    backend();
    http.authedPatch.mockRejectedValue(
      new HttpError("/admin/orders/SS-10482", 409, JSON.stringify({ message: "m", errorCode: "state_conflict" })),
    );
    renderPage("/people-ops/swag-store/orders/SS-10482");
    const drawer = await openDrawer();
    await userEvent.click(within(drawer).getByRole("button", { name: "Mark ready for pickup" }));
    expect(await within(drawer).findByText("Someone already did this. The order has been reloaded.")).toBeInTheDocument();
    await waitFor(() =>
      expect(http.authedGet.mock.calls.filter(([u]) => u === "/admin/orders/SS-10482").length).toBeGreaterThan(1),
    );
  });

  it("adds a note", async () => {
    backend();
    renderPage("/people-ops/swag-store/orders/SS-10482");
    const drawer = await openDrawer();
    await userEvent.type(within(drawer).getByRole("textbox", { name: "Add a note" }), "Called Sam");
    await userEvent.click(within(drawer).getByRole("button", { name: "Add note" }));
    expect(http.authedPost).toHaveBeenCalledWith("/admin/orders/SS-10482/notes", "token", { note: "Called Sam" });
  });

  it("closes back to the list, keeping the filters", async () => {
    backend();
    renderPage("/people-ops/swag-store/orders/SS-10482?status=CONFIRMED");
    const drawer = await openDrawer();
    await userEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/people-ops/swag-store/orders?status=CONFIRMED");
  });
});

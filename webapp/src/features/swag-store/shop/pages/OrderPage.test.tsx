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
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { orderDetail, placedOrder } from "../../testing/fixtures";

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
import OrderPage from "./OrderPage";

const originalConfig = window.config;

const orderReads = () => http.authedGet.mock.calls.filter(([u]) => String(u).startsWith("/orders/"));

function renderPage(path = "/store/orders/SS-10482") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store/orders/:orderNo" element={<OrderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  http.authedGet.mockReset();
  http.authedPost.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  window.config = originalConfig;
});

describe("the order page", () => {
  it("confirms a just-placed order and shows its lines, progress and pickup office", async () => {
    http.authedGet.mockResolvedValue(orderDetail());
    renderPage("/store/orders/SS-10482?placed=1");
    expect(await screen.findByRole("heading", { level: 1, name: "Order SS-10482" })).toBeInTheDocument();
    expect(document.title).toMatch(/^Order SS-10482 · Swag Store/);
    expect(screen.getByText(/Order placed\. We'll email you when it's ready/)).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /WSO2 Hoodie.*Black · M.*2.*180 O2C/ })).toBeInTheDocument();
    const progress = within(screen.getByRole("list", { name: "Order progress" }));
    expect(progress.getByText("Placed and paid")).toBeInTheDocument();
    expect(progress.getByText("Ready for pickup").closest("li")).toHaveTextContent("Not yet");
    expect(screen.getByText(/Reception, level 2/)).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/orders/SS-10482", "token");
  });

  it("tells the shopper to bring their ID once the order is ready", async () => {
    http.authedGet.mockResolvedValue(orderDetail({ status: "READY_FOR_PICKUP", readyAt: "2026-11-15T03:00:00Z" }));
    renderPage();
    expect(await screen.findByText(/Bring your WSO2 ID/)).toBeInTheDocument();
    expect(screen.getByText("Ready for pickup", { selector: ".MuiChip-label" })).toBeInTheDocument();
  });

  it("keeps asking while the payment is confirmed, and shows the result", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    http.authedGet
      .mockResolvedValueOnce(orderDetail({ status: "PENDING_PAYMENT", confirmedAt: null }))
      .mockResolvedValue(orderDetail());
    renderPage("/store/orders/SS-10482?placed=1");
    expect(await screen.findByText(/Confirming your payment/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(orderReads()).toHaveLength(2);
  });

  it("stops asking after two minutes and says it is taking longer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    http.authedGet.mockResolvedValue(orderDetail({ status: "PENDING_PAYMENT", confirmedAt: null }));
    renderPage();
    await screen.findByText(/Confirming your payment/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);
    });
    expect(await screen.findByText(/taking longer than usual/)).toBeInTheDocument();
    const reads = orderReads().length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20 * 1000);
    });
    expect(orderReads()).toHaveLength(reads);
  });

  it("doesn't offer Retry payment while the first payment may still confirm", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    http.authedGet.mockResolvedValue(
      orderDetail({ status: "PENDING_PAYMENT", confirmedAt: null, placedAt: new Date().toISOString() }),
    );
    renderPage();
    await screen.findByText(/Confirming your payment/);
    expect(screen.queryByRole("button", { name: "Retry payment" })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100);
    });
    expect(await screen.findByRole("button", { name: "Retry payment" })).toBeInTheDocument();
  });

  it("offers Retry payment at once for an order placed more than two minutes ago", async () => {
    http.authedGet.mockResolvedValue(
      orderDetail({ status: "PENDING_PAYMENT", confirmedAt: null, placedAt: "2026-01-01T00:00:00Z" }),
    );
    http.authedPost.mockResolvedValue(placedOrder());
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Retry payment" }));
    expect(http.authedPost).toHaveBeenCalledWith("/orders/SS-10482/payments", "token", {});
    await waitFor(() => expect(orderReads().length).toBeGreaterThan(1));
  });

  it("explains a failed payment and offers the way back to the cart", async () => {
    http.authedGet.mockResolvedValue(orderDetail({ status: "FAILED", failureCode: "insufficient_funds", confirmedAt: null }));
    renderPage();
    expect(await screen.findByText(/This wallet doesn't have enough O2C for this order/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to cart" })).toHaveAttribute("href", "/store/cart");
    expect(screen.queryByRole("list", { name: "Order progress" })).toBeNull();
  });

  it("doesn't say coins are safe when the payment couldn't be matched", async () => {
    http.authedGet.mockResolvedValue(orderDetail({ status: "FAILED", failureCode: "payment_mismatch", confirmedAt: null }));
    renderPage();
    expect(await screen.findByText(/The store team is checking it/)).toBeInTheDocument();
    expect(screen.queryByText(/No coins were taken/)).toBeNull();
  });

  it("says plainly when the order isn't one of the shopper's", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/orders/SS-99999", 404, JSON.stringify({ message: "Not found." })));
    renderPage("/store/orders/SS-99999");
    expect(await screen.findByText("We couldn't find that order.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your orders" })).toHaveAttribute("href", "/store/orders");
  });

  it("doesn't ask the backend about an address that isn't an order number", async () => {
    renderPage("/store/orders/not-an-order");
    expect(await screen.findByText("We couldn't find that order.")).toBeInTheDocument();
    expect(http.authedGet).not.toHaveBeenCalled();
  });
});

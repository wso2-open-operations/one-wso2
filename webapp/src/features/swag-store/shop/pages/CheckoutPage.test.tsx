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
import { office, placedOrder, quote, wallet } from "../../testing/fixtures";

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
import CheckoutPage from "./CheckoutPage";

const originalConfig = window.config;
const KANDY = office({ id: "office-kandy", name: "Kandy", address: "Kandy road", leadTimeDays: 4 });

function backend({ quotes = [quote()], order }: { quotes?: unknown[]; order?: () => Promise<unknown> } = {}) {
  http.authedGet.mockImplementation(async (url: string) => {
    if (url === "/wallets") return [wallet()];
    if (url === "/pickup-offices") return { items: [office(), KANDY], defaultOfficeId: "office-colombo" };
    throw new Error(`unexpected ${url}`);
  });
  let quoteCalls = 0;
  http.authedPost.mockImplementation(async (url: string) => {
    if (url === "/quotes") {
      const answer = quotes[Math.min(quoteCalls++, quotes.length - 1)];
      if (answer instanceof Error) throw answer;
      return answer;
    }
    if (url === "/orders") return order ? order() : placedOrder();
    throw new Error(`unexpected ${url}`);
  });
}

const quoteBodies = () => http.authedPost.mock.calls.filter(([u]) => u === "/quotes").map(([, , body]) => body);
const orderCalls = () => http.authedPost.mock.calls.filter(([u]) => u === "/orders");

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

function renderPage(path = "/store/cart/checkout") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/store/cart/checkout" element={<CheckoutPage />} />
          <Route path="/store/orders/:orderNo" element={<p>Order page</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openAndConfirm() {
  await userEvent.click(await screen.findByRole("button", { name: "Place order" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: /Place order|Try again/ }));
  return dialog;
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  window.sessionStorage.clear();
  http.authedGet.mockReset();
  http.authedPost.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the checkout page", () => {
  it("prices the cart for the shopper's own office and default wallet", async () => {
    backend();
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Checkout" })).toBeInTheDocument();
    expect(await screen.findByRole("radio", { name: /Colombo/ })).toBeChecked();
    await waitFor(() => expect(quoteBodies()).toEqual([{ pickupOfficeId: "office-colombo", walletAddress: "0xWALLET" }]));
    expect(await screen.findByText("Pickup · Free")).toBeInTheDocument();
    expect(screen.getByTestId("quote-total")).toHaveTextContent("180 O2C");
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
    expect(screen.getAllByText(/Paid orders are final/).length).toBeGreaterThan(0);
  });

  it("re-prices when the shopper picks another office, and keeps it in the address", async () => {
    backend();
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Show all 2 offices" }));
    await userEvent.click(screen.getByRole("radio", { name: /Kandy/ }));
    await waitFor(() => expect(quoteBodies()).toContainEqual({ pickupOfficeId: "office-kandy", walletAddress: "0xWALLET" }));
    expect(screen.getByTestId("where")).toHaveTextContent("?office=office-kandy");
  });

  it("shows the backend's problems and keeps Place order off", async () => {
    backend({
      quotes: [
        quote({ canPlace: false, problems: [{ code: "insufficient_funds", message: "Your wallet balance is below the order total." }] }),
      ],
    });
    renderPage();
    expect(await screen.findByText("This wallet doesn't have enough O2C for this order.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
  });

  it("asks once more, then places the order with an idempotency key and the total the shopper saw", async () => {
    backend();
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Place order" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/You'll pay 180 O2C from Default wallet/)).toBeInTheDocument();
    expect(orderCalls()).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(orderCalls()).toHaveLength(1));
    const [, , body, headers] = orderCalls()[0];
    expect(body).toEqual({ pickupOfficeId: "office-colombo", walletAddress: "0xWALLET", expectedTotal: 180 });
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/store/orders/SS-10482?placed=1"));
  });

  it("goes to the order page too when the payment is still being confirmed", async () => {
    backend({ order: async () => placedOrder({ status: "PENDING_PAYMENT" }) });
    renderPage();
    await openAndConfirm();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/store/orders/SS-10482?placed=1"));
  });

  it("can't be sent twice or closed while the order is being placed", async () => {
    let finish: (value: unknown) => void = () => {};
    backend({ order: () => new Promise((resolve) => (finish = resolve)) });
    renderPage();
    const dialog = await openAndConfirm();
    expect(within(dialog).getByRole("button", { name: "Placing order…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    finish(placedOrder());
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/store/orders/SS-10482"));
  });

  it("sends the same key when the shopper tries again after a network failure", async () => {
    let attempt = 0;
    backend({
      order: async () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError("Failed to fetch");
        return placedOrder();
      },
    });
    renderPage();
    const dialog = await openAndConfirm();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(orderCalls()).toHaveLength(2));
    expect(orderCalls()[1][3]["Idempotency-Key"]).toBe(orderCalls()[0][3]["Idempotency-Key"]);
  });

  it("uses a new key once the office changes", async () => {
    backend({ order: async () => Promise.reject(new TypeError("Failed to fetch")) });
    renderPage();
    await openAndConfirm();
    await waitFor(() => expect(orderCalls()).toHaveLength(1));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Show all 2 offices" }));
    await userEvent.click(screen.getByRole("radio", { name: /Kandy/ }));
    await waitFor(() => expect(quoteBodies()).toHaveLength(2));
    await openAndConfirm();
    await waitFor(() => expect(orderCalls()).toHaveLength(2));
    expect(orderCalls()[1][3]["Idempotency-Key"]).not.toBe(orderCalls()[0][3]["Idempotency-Key"]);
  });

  it("re-prices and explains when the cart changed underneath the shopper", async () => {
    backend({
      quotes: [quote(), quote({ total: 190 })],
      order: async () => {
        throw new HttpError("/orders", 409, JSON.stringify({ message: "m", errorCode: "quote_changed" }));
      },
    });
    renderPage();
    await openAndConfirm();
    expect(await screen.findByText("Your cart changed. Check the updated total and try again.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("quote-total")).toHaveTextContent("190 O2C"));
  });

  it("explains a refused payment in the dialog", async () => {
    backend({
      order: async () => {
        throw new HttpError("/orders", 402, JSON.stringify({ message: "m", errorCode: "insufficient_funds" }));
      },
    });
    renderPage();
    const dialog = await openAndConfirm();
    expect(await within(dialog).findByText("This wallet doesn't have enough O2C for this order.")).toBeInTheDocument();
  });

  it("says when there is nothing to check out", async () => {
    backend({ quotes: [quote({ lines: [], total: 0, canPlace: false, problems: [{ code: "empty_cart", message: "m" }] })] });
    renderPage();
    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Place order" })).toBeNull();
  });
});

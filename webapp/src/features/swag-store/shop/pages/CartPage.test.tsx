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
import { cart, cartLine, wallet } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn(), authedPatch: vi.fn(), authedDelete: vi.fn() }));

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
  authedPatch: http.authedPatch,
  authedDelete: http.authedDelete,
}));

import { HttpError } from "@api/http";
import CartPage from "./CartPage";

const originalConfig = window.config;

type Answers = { cart?: unknown; wallets?: unknown };

function backend(answers: Answers = {}) {
  http.authedGet.mockImplementation(async (url: string) => {
    const answer =
      url === "/cart" ? (answers.cart ?? cart()) : url === "/wallets" ? (answers.wallets ?? [wallet()]) : new Error(`unexpected ${url}`);
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/store/cart"]}>
        <CartPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const checkout = () => screen.getByRole("link", { name: "Checkout" });

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  window.sessionStorage.clear();
  http.authedGet.mockReset();
  http.authedPatch.mockReset();
  http.authedDelete.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the cart page", () => {
  it("lists each line with its options and total, and the cart total against the wallet", async () => {
    backend();
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Your cart" })).toBeInTheDocument();
    const line = await screen.findByRole("listitem", { name: /WSO2 Hoodie/ });
    expect(within(line).getByText("Black · M")).toBeInTheDocument();
    expect(within(line).getByRole("link", { name: "WSO2 Hoodie" })).toHaveAttribute("href", "/store/p/wso2-hoodie");
    expect(screen.getByTestId("cart-total")).toHaveTextContent("180 O2C");
    expect(await screen.findByRole("img", { name: "180 O2C of 202.50 O2C used" })).toBeInTheDocument();
    expect(checkout()).toHaveAttribute("href", "/store/cart/checkout");
    expect(checkout()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("leaves lines that can't be ordered out of the total, and says why", async () => {
    backend({
      cart: cart([
        cartLine(),
        cartLine({
          id: "line-umbrella",
          name: "WSO2 Umbrella",
          options: "Orange",
          unitPrice: 40,
          quantity: 1,
          lineTotal: 40,
          state: "REMOVED",
          reason: "This item is no longer sold.",
        }),
      ]),
    });
    renderPage();
    const umbrella = await screen.findByRole("listitem", { name: /WSO2 Umbrella/ });
    expect(within(umbrella).getByText("No longer sold")).toBeInTheDocument();
    expect(within(umbrella).getByText(/This item is no longer sold\. Not included in the total\./)).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("180 O2C");
  });

  it("turns Checkout off and says how many coins are missing", async () => {
    backend({ wallets: [wallet({ balance: "150.50" })] });
    renderPage();
    expect(await screen.findByText("This wallet is 29.50 O2C short.")).toBeInTheDocument();
    expect(checkout()).toHaveAttribute("aria-disabled", "true");
  });

  it("checks the cart against the wallet the shopper picks, and remembers the pick", async () => {
    backend({
      wallets: [
        wallet({ walletAddress: "0xDEFAULT00001111", balance: "20.00", defaultWallet: true }),
        wallet({ walletAddress: "0xSAVINGS00002222", balance: "500.00", defaultWallet: false }),
      ],
    });
    renderPage();
    expect(await screen.findByText("This wallet is 160.00 O2C short.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /500\.00 O2C/ }));
    expect(screen.queryByText(/short\./)).toBeNull();
    expect(checkout()).not.toHaveAttribute("aria-disabled", "true");
    expect(window.sessionStorage.getItem("swag-store:shopper:wallet")).toBe("0xSAVINGS00002222");
  });

  it("changes a line's quantity", async () => {
    backend();
    http.authedPatch.mockResolvedValue(null);
    renderPage();
    const line = await screen.findByRole("listitem", { name: /WSO2 Hoodie/ });
    await userEvent.click(within(line).getByRole("button", { name: "Increase quantity" }));
    expect(http.authedPatch).toHaveBeenCalledWith("/cart/lines/line-hoodie", "token", { quantity: 3 });
    await waitFor(() => expect(http.authedGet.mock.calls.filter(([u]) => u === "/cart")).toHaveLength(2));
  });

  it("removes a line", async () => {
    backend();
    http.authedDelete.mockResolvedValue(undefined);
    renderPage();
    const line = await screen.findByRole("listitem", { name: /WSO2 Hoodie/ });
    await userEvent.click(within(line).getByRole("button", { name: "Remove WSO2 Hoodie, Black · M" }));
    expect(http.authedDelete).toHaveBeenCalledWith("/cart/lines/line-hoodie", "token");
  });

  it("explains a refused change on its line", async () => {
    backend();
    http.authedPatch.mockRejectedValue(
      new HttpError("/cart/lines/line-hoodie", 409, JSON.stringify({ message: "Only 2 left.", errorCode: "out_of_stock" })),
    );
    renderPage();
    const line = await screen.findByRole("listitem", { name: /WSO2 Hoodie/ });
    await userEvent.click(within(line).getByRole("button", { name: "Increase quantity" }));
    expect(await within(line).findByText("Only 2 left.")).toBeInTheDocument();
  });

  it("says when the cart is empty, with a way back to the store", async () => {
    backend({ cart: cart([]) });
    renderPage();
    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the store" })).toHaveAttribute("href", "/store");
  });

  it("shows a cart failure with Retry, never as an empty cart", async () => {
    backend({ cart: new HttpError("/cart", 503, JSON.stringify({ message: "Database is down." })) });
    renderPage();
    expect(await screen.findByText(/Couldn't load your cart/)).toBeInTheDocument();
    expect(screen.queryByText("Your cart is empty.")).toBeNull();
  });

  it("keeps Checkout off while the wallets can't be read", async () => {
    backend({ wallets: new HttpError("/wallets", 503, JSON.stringify({ message: "m", errorCode: "coins_unavailable" })) });
    renderPage();
    expect(await screen.findByText(/Your wallets can't be reached right now/)).toBeInTheDocument();
    expect(checkout()).toHaveAttribute("aria-disabled", "true");
  });
});

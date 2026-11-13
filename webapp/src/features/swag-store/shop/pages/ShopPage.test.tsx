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
import { productCard, wallet } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn() }));

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
}));

import { HttpError } from "@api/http";
import ShopPage from "./ShopPage";

const originalConfig = window.config;

type Answers = { wallets?: unknown; categories?: unknown; products?: unknown };

/** Answers each store read by its path. A value that is an Error is thrown. */
function backend(answers: Answers = {}) {
  const pick = (url: string): unknown => {
    if (url.startsWith("/wallets")) return answers.wallets ?? [wallet()];
    if (url.startsWith("/categories")) return answers.categories ?? [];
    if (url.startsWith("/products")) return answers.products ?? { items: [productCard()], total: 1 };
    throw new Error(`unexpected ${url}`);
  };
  http.authedGet.mockImplementation(async (url: string) => {
    const answer = pick(url);
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const productCalls = (): string[] =>
  http.authedGet.mock.calls.map(([url]) => url as string).filter((url) => url.startsWith("/products"));

function renderPage(
  path = "/store",
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } }),
) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ShopPage />
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

describe("the Shop page", () => {
  it("has one h1 naming the store and the browser tab", () => {
    backend();
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Swag Store" })).toBeInTheDocument();
    expect(document.title).toMatch(/^Swag Store/);
  });

  it("shows the default wallet's balance with the backend's decimals", async () => {
    backend({
      wallets: [
        wallet({ walletAddress: "0xA", balance: "12.00", defaultWallet: false }),
        wallet({ walletAddress: "0xB", balance: "202.50", defaultWallet: true }),
      ],
    });
    renderPage();
    expect(await screen.findByText("202.50 O2C")).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/wallets", "token");
  });

  it("hides a balance from an earlier visit until this visit's read arrives", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
    client.setQueryData(["swag-store", "shopper", "wallets"], [wallet({ balance: "500.00" })]);
    let answer: (value: unknown) => void = () => {};
    backend();
    const others = http.authedGet.getMockImplementation()!;
    http.authedGet.mockImplementation((url: string) =>
      url === "/wallets" ? new Promise((resolve) => (answer = resolve)) : others(url),
    );
    renderPage("/store", client);

    expect(screen.queryByText("500.00 O2C")).toBeNull();
    expect(screen.getByLabelText("Loading your balance")).toBeInTheDocument();

    await waitFor(() => expect(http.authedGet).toHaveBeenCalledWith("/wallets", "token"));
    expect(screen.queryByText("500.00 O2C")).toBeNull();
    answer([wallet({ balance: "410.00" })]);
    expect(await screen.findByText("410.00 O2C")).toBeInTheDocument();
    expect(screen.queryByText("500.00 O2C")).toBeNull();
  });

  it("says so when there is no wallet, rather than showing a zero balance", async () => {
    backend({ wallets: [] });
    renderPage();
    expect(await screen.findByText(/don't have an O2C wallet yet/)).toBeInTheDocument();
    expect(screen.queryByText(/^0 O2C/)).toBeNull();
  });

  it("explains a wallet failure in the store's words, with Retry, and keeps the page", async () => {
    backend({
      wallets: new HttpError("/wallets", 503, JSON.stringify({ message: "upstream", errorCode: "coins_unavailable" })),
    });
    renderPage();
    expect(await screen.findByText(/Your wallets can't be reached right now/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Swag Store" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /WSO2 Hoodie/ })).toBeInTheDocument();
  });
});

describe("the Shop grid", () => {
  it("links each item to its page, with its price and stock", async () => {
    backend({
      products: {
        items: [productCard(), productCard({ id: "p2", slug: "wso2-umbrella", name: "WSO2 Umbrella", price: 40, availability: "SOLD_OUT" })],
        total: 2,
      },
    });
    renderPage();
    const hoodie = await screen.findByRole("link", { name: /WSO2 Hoodie/ });
    expect(hoodie).toHaveAttribute("href", "/store/p/wso2-hoodie");
    expect(within(hoodie).getByText("90 O2C")).toBeInTheDocument();
    expect(within(hoodie).getByText("In stock")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /WSO2 Umbrella/ })).getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("asks the backend for the filters in the address", async () => {
    backend();
    renderPage("/store?q=mug&category=drinkware&sort=price_desc&inStock=1");
    await screen.findByRole("link", { name: /WSO2 Hoodie/ });
    expect(productCalls()).toEqual(["/products?q=mug&category=drinkware&sort=price_desc&inStock=true&limit=24&offset=0"]);
    expect(screen.getByRole("searchbox", { name: "Search the store" })).toHaveValue("mug");
    expect(screen.getByRole("checkbox", { name: "In stock only" })).toBeChecked();
  });

  it("searches when the shopper submits the search", async () => {
    backend();
    renderPage();
    await screen.findByRole("link", { name: /WSO2 Hoodie/ });
    await userEvent.type(screen.getByRole("searchbox", { name: "Search the store" }), "tote{Enter}");
    await waitFor(() => expect(productCalls()).toContain("/products?q=tote&sort=popular&limit=24&offset=0"));
  });

  it("filters by a category chip, and marks the chosen one", async () => {
    backend({ categories: [{ id: "c1", slug: "apparel", name: "Apparel" }] });
    renderPage();
    expect(await screen.findByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apparel", pressed: false }));
    expect(await screen.findByRole("button", { name: "Apparel", pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(productCalls()).toContain("/products?category=apparel&sort=popular&limit=24&offset=0"));
  });

  it("re-sorts from the sort menu", async () => {
    backend();
    renderPage();
    await screen.findByRole("link", { name: /WSO2 Hoodie/ });
    await userEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    await userEvent.click(screen.getByRole("option", { name: "Newest" }));
    await waitFor(() => expect(productCalls()).toContain("/products?sort=newest&limit=24&offset=0"));
  });

  it("says nothing matches a filtered search, and clears the filters", async () => {
    backend({ products: { items: [], total: 0 } });
    renderPage("/store?q=kayak&inStock=1");
    expect(await screen.findByText("No items match your filters.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(productCalls()).toContain("/products?sort=popular&limit=24&offset=0"));
  });

  it("says the store is empty only when nothing was filtered", async () => {
    backend({ products: { items: [], total: 0 } });
    renderPage();
    expect(await screen.findByText("There's nothing in the store yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("shows a grid failure in the grid only, with Retry, never as an empty store", async () => {
    backend({ products: new HttpError("/products", 503, JSON.stringify({ message: "Database is down." })) });
    renderPage();
    expect(await screen.findByText(/Couldn't load the items/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("There's nothing in the store yet.")).toBeNull();
    expect(await screen.findByText("202.50 O2C")).toBeInTheDocument();
  });

  it("pages through a long list", async () => {
    backend({ products: { items: [productCard()], total: 30 } });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(productCalls()).toContain("/products?sort=popular&limit=24&offset=24"));
  });
});

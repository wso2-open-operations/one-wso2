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
import { hoodie, office, powerbank, productCard } from "../../testing/fixtures";

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
import ProductPage from "./ProductPage";

const originalConfig = window.config;

type Answers = { product?: unknown; offices?: unknown };

function backend(answers: Answers = {}) {
  http.authedGet.mockImplementation(async (url: string) => {
    const answer = url.startsWith("/products/")
      ? (answers.product ?? hoodie())
      : url === "/pickup-offices"
        ? (answers.offices ?? { items: [office()], defaultOfficeId: "office-colombo" })
        : new Error(`unexpected ${url}`);
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

function Address() {
  const { search } = useLocation();
  return <output data-testid="address">{search}</output>;
}

function renderPage(path = "/store/p/wso2-hoodie") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/store/p/:slug"
            element={
              <>
                <ProductPage />
                <Address />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const addButton = () => screen.getByRole("button", { name: /Add to cart|Adding/ });

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  http.authedGet.mockReset();
  http.authedPost.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the product page", () => {
  it("names the product in the h1 and the tab, with its price range and plain-text description", async () => {
    backend({ product: hoodie({ description: "<b>Warm</b> hoodie." }) });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "WSO2 Hoodie" })).toBeInTheDocument();
    expect(document.title).toMatch(/^WSO2 Hoodie · Swag Store/);
    expect(screen.getByText("From 90 O2C")).toBeInTheDocument();
    expect(screen.getByText("<b>Warm</b> hoodie.")).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/products/wso2-hoodie", "token");
  });

  it("asks for every option before it can be added", async () => {
    backend();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "WSO2 Hoodie" });
    expect(addButton()).toBeDisabled();
    expect(screen.getByText("Choose a colour and size.")).toBeInTheDocument();
  });

  it("keeps the choice in the address and shows the chosen variant's price and stock", async () => {
    backend();
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Black" }));
    await userEvent.click(screen.getByRole("button", { name: "S" }));
    expect(screen.getByTestId("address")).toHaveTextContent("?colour=Black&size=S");
    expect(screen.getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Only 2 left")).toBeInTheDocument();
    expect(screen.getByText("90 O2C")).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });

  it("reads a linked choice, and names options that can't be bought now without hiding them", async () => {
    backend();
    renderPage("/store/p/wso2-hoodie?colour=heather%20grey&size=S");
    expect(await screen.findByText(/Out of stock · back ~/)).toBeInTheDocument();
    expect(screen.getByText("95 O2C")).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    expect(screen.getByText(/It should be back around/)).toBeInTheDocument();
    const sizes = within(screen.getByRole("group", { name: /Size/ }));
    expect(sizes.getByRole("button", { name: "S, out of stock" })).toBeEnabled();
    expect(sizes.getByRole("button", { name: "M, not available in this combination" })).toBeEnabled();
  });

  it("puts the chosen variant and quantity in the cart, and says so", async () => {
    backend();
    http.authedPost.mockResolvedValue({ id: "line-1" });
    renderPage("/store/p/wso2-hoodie?colour=Black&size=M");
    await screen.findByRole("heading", { level: 1, name: "WSO2 Hoodie" });
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await userEvent.click(addButton());
    expect(http.authedPost).toHaveBeenCalledWith("/cart/lines", "token", { variantId: "v-black-m", quantity: 2 });
    expect(await screen.findByText("Added to your cart.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/store/cart");
  });

  it("stops the quantity at the per-person limit", async () => {
    backend();
    renderPage("/store/p/wso2-hoodie?colour=Black&size=M");
    await screen.findByText("Max 2 per person");
    const more = screen.getByRole("button", { name: "Increase quantity" });
    await userEvent.click(more);
    expect(more).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "Quantity" })).getByText("2")).toBeInTheDocument();
  });

  it("explains a refused add, and lets the shopper try again", async () => {
    backend();
    http.authedPost.mockRejectedValue(
      new HttpError("/cart/lines", 409, JSON.stringify({ message: "This item is not available.", errorCode: "not_available" })),
    );
    renderPage("/store/p/wso2-hoodie?colour=Black&size=M");
    await screen.findByRole("heading", { level: 1, name: "WSO2 Hoodie" });
    await userEvent.click(addButton());
    expect(await screen.findByText("This item is not available.")).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });

  it("can add a product that has no options straight away", async () => {
    backend({ product: powerbank() });
    renderPage("/store/p/wso2-powerbank");
    await screen.findByRole("heading", { level: 1, name: "WSO2 Powerbank" });
    expect(screen.getByText("70 O2C")).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });

  it("says where and when the order can be picked up", async () => {
    backend();
    renderPage();
    expect(await screen.findByText("Pick up at Colombo, about 2 working days after you pay.")).toBeInTheDocument();
    expect(screen.getByText(/Paid orders are final/)).toBeInTheDocument();
  });

  it("offers alternatives for a sold-out choice, with no waiting list", async () => {
    const limited = hoodie({
      restockPolicy: "LIMITED",
      variants: hoodie().variants.map((v) => ({ ...v, availability: "SOLD_OUT" as const, stockLeft: null })),
      alternatives: [productCard({ id: "p-tumbler", slug: "wso2-tumbler", name: "WSO2 Tumbler", price: 50 })],
    });
    backend({ product: limited });
    renderPage("/store/p/wso2-hoodie?colour=Black&size=M");
    expect(await screen.findByText(/Sold out. It won't be restocked/)).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    expect(screen.getByRole("heading", { level: 2, name: "You might also like" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WSO2 Tumbler/ })).toHaveAttribute("href", "/store/p/wso2-tumbler");
  });

  it("shows a removed product as no longer sold, with alternatives and no way to buy it", async () => {
    backend({
      product: hoodie({
        status: "REMOVED",
        options: [],
        variants: [],
        images: [],
        alternatives: [productCard({ id: "p-tumbler", slug: "wso2-tumbler", name: "WSO2 Tumbler" })],
      }),
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "WSO2 Hoodie" })).toBeInTheDocument();
    expect(screen.getByText("No longer sold")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to cart/ })).toBeNull();
    expect(screen.getByRole("link", { name: /WSO2 Tumbler/ })).toBeInTheDocument();
  });

  it("says plainly when the item isn't in the store", async () => {
    backend({ product: new HttpError("/products/x", 404, JSON.stringify({ message: "Not found." })) });
    renderPage("/store/p/x");
    expect(await screen.findByText("This item isn't in the store.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the store" })).toHaveAttribute("href", "/store");
  });

  it("offers Retry when the product can't be read", async () => {
    backend({ product: new HttpError("/products/x", 503, JSON.stringify({ message: "Database is down." })) });
    renderPage();
    expect(await screen.findByText(/Couldn't load this item/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled());
  });
});

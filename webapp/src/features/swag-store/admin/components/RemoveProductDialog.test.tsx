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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { adminProduct } from "../../testing/fixtures";

const http = vi.hoisted(() => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
  authedPatch: vi.fn(),
  authedPut: vi.fn(),
  authedDelete: vi.fn(),
}));

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
  authedPut: http.authedPut,
  authedDelete: http.authedDelete,
}));

import { HttpError } from "@api/http";
import RemoveProductDialog from "./RemoveProductDialog";

const originalConfig = window.config;
const impact = {
  openOrders: [{ orderNo: "SS-10482", status: "CONFIRMED", units: 2 }],
  openUnits: 2,
  carts: 3,
  cartUnits: 4,
  pendingAlerts: 5,
  freeStock: 8,
};
const onClose = vi.fn();

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RemoveProductDialog product={adminProduct()} onClose={onClose} />
    </QueryClientProvider>,
  );
}

const confirm = () => screen.getByRole("button", { name: /Remove from store|Removing/ });

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  Object.values(http).forEach((f) => f.mockReset());
  onClose.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("removing a product", () => {
  it("shows what the removal touches before it can be confirmed", async () => {
    let answer: (v: unknown) => void = () => {};
    http.authedGet.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderDialog();
    expect(confirm()).toBeDisabled();
    answer(impact);
    expect(await screen.findByText(/SS-10482/)).toBeInTheDocument();
    expect(screen.getByText(/still served/)).toBeInTheDocument();
    expect(screen.getByText(/3 carts/)).toBeInTheDocument();
    expect(screen.getByText(/5 people waiting/)).toBeInTheDocument();
    expect(screen.getByText(/8 units left in stock/)).toBeInTheDocument();
    expect(confirm()).toBeEnabled();
    expect(http.authedGet).toHaveBeenCalledWith("/admin/products/p-hoodie/removal-impact", "token");
  });

  it("keeps Confirm off and offers Retry when the impact can't be read", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/x", 503, JSON.stringify({ message: "Database is down." })));
    renderDialog();
    expect(await screen.findByText(/Couldn't check what removing it touches/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it("removes with the note, and can't be closed or sent twice while it removes", async () => {
    http.authedGet.mockResolvedValue(impact);
    let finish: (v: unknown) => void = () => {};
    http.authedPatch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderDialog();
    await screen.findByText(/SS-10482/);
    await userEvent.type(screen.getByRole("textbox", { name: "Note (optional)" }), "Supplier stopped.");
    await userEvent.click(confirm());
    expect(http.authedPatch).toHaveBeenCalledWith("/admin/products/p-hoodie", "token", {
      status: "REMOVED",
      removalNote: "Supplier stopped.",
    });
    expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeDisabled();
    finish(adminProduct({ status: "REMOVED" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

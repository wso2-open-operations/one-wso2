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

import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { RadioIcon } from "@wso2/oxygen-ui-icons-react";

// The MEDDPICC backend is the in-memory double, as in DealView.test.tsx.
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEchoBackendConfigured: () => true,
}));
vi.mock("@features/sales/meddpicc/api/meddpiccClient", async (importOriginal) => {
  const { mockMeddpiccClient } = await import("@features/sales/meddpicc/mock/mockStore");
  return {
    ...(await importOriginal<typeof import("@features/sales/meddpicc/api/meddpiccClient")>()),
    httpMeddpiccClient: () => mockMeddpiccClient,
  };
});
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));
// The Sales shell: an allowed caller, and the visibility hook stubbed for the reason
// SalesShell.test.tsx gives.
vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({ resolveVisible: () => true, isResolving: false, visibleLeaves: [], isError: false, retry: () => {} }),
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: "sales", label: "Sales", icon: RadioIcon, access: true, path: "/sales" }),
}));
vi.mock("../api/useSalesData", () => ({
  isSalesBackendConfigured: () => true,
  useSalesUserInfo: () => ({ isPending: false, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import DealPage from "./DealPage";
import { dealPath } from "../util/salesPaths";

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sales/deals/:opportunityId" element={<DealPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper },
  );
}

describe("DealPage", { timeout: 20000 }, () => {
  it("is the deal's own page: named in the title, with a way back to the list", async () => {
    renderAt(dealPath("006MOCK0000MERI"));
    expect(await screen.findByRole("heading", { name: "Meridian Bank – integration platform" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deals" })).toHaveAttribute("href", "/sales/deals");
    expect(screen.getByRole("complementary", { name: "About this deal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Approve all/ })).toBeInTheDocument();
  });

  it("opens filtered to a Letter from ?letter=, and ignores one that isn't a Letter", async () => {
    const { unmount } = renderAt(dealPath("006MOCK0000MERI", "E"));
    expect(await screen.findByText("Economic Buyer across every Gate")).toBeInTheDocument();
    unmount();

    renderAt("/sales/deals/006MOCK0000MERI?letter=ZZ");
    expect(await screen.findByText(/^To leave /)).toBeInTheDocument();
    expect(screen.queryByText(/across every Gate/)).not.toBeInTheDocument();
  });

  it("builds deal paths, escaping the id", () => {
    expect(dealPath("006A")).toBe("/sales/deals/006A");
    expect(dealPath("006A", "DC")).toBe("/sales/deals/006A?letter=DC");
    expect(dealPath("a/b")).toBe("/sales/deals/a%2Fb");
  });
});

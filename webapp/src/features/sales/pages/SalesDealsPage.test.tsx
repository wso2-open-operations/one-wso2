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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// The shell has its own suite; here it only frames the page.
// The backend is replaced by the in-memory test double in ../mock, behind the
// same client interface, so the real hooks, cache and mutations run against it.
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
vi.mock("../components/SalesShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import SalesDealsPage from "./SalesDealsPage";
import { resetMockStore } from "../meddpicc/mock/mockStore";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <SalesDealsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => resetMockStore());

// A drawer full of MUI selects and tooltips, driven by userEvent: well under a
// second each on an idle machine, but the default 5s is too tight on a busy runner.
describe("SalesDealsPage", { timeout: 20000 }, () => {
  it("lists the demo deals, one row each, with their stage, circles and pending count", async () => {
    renderPage();

    const brightwater = (await screen.findByRole("button", { name: "Brightwater – API Manager first sale" })).closest("tr");
    expect(brightwater).not.toBeNull();
    const row = within(brightwater as HTMLElement);
    expect(row.getByText("Brightwater Pumps Limited")).toBeInTheDocument();
    expect(row.getByText("Qualify")).toBeInTheDocument();
    expect(row.getByText("120,000 USD")).toBeInTheDocument();
    expect(row.getByText("31/12/2026")).toBeInTheDocument();
    expect(row.getByRole("group", { name: /^MEDDPICC for Brightwater/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Champion: AI suggestion waiting for approval" })).toBeInTheDocument();
    expect(row.getByLabelText(/AI proposals waiting for approval/)).toBeInTheDocument();

    for (const name of [
      "Meridian Bank – integration platform",
      "Nordlys Energi – identity expansion",
      "Harbourline – API platform",
      "Asterra Health – FHIR gateway",
      "Oakridge University – campus IAM",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    // Closed deals are hidden by default.
    expect(screen.queryByRole("button", { name: "Kestrel Telecom – API Manager expansion" })).not.toBeInTheDocument();
  });

  it("shows closed deals once Hide closed is turned off", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Brightwater – API Manager first sale" });

    await user.click(screen.getByRole("switch", { name: "Hide closed" }));

    expect(await screen.findByRole("button", { name: "Kestrel Telecom – API Manager expansion" })).toBeInTheDocument();
  });

  it("filters by search", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Brightwater – API Manager first sale" });

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "meridian{Enter}");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Brightwater – API Manager first sale" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Meridian Bank – integration platform" })).toBeInTheDocument();
  });

  it("opens the deal panel from a row", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Harbourline – API platform" }));
    expect(await screen.findByRole("heading", { name: "Harbourline – API platform" })).toBeInTheDocument();
  });
});

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
// The backend is replaced by the in-memory test double in ../testing, behind the
// same client interface, so the real hooks, cache and mutations run against it.
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEchoBackendConfigured: () => true,
}));
vi.mock("@features/sales/meddpicc/api/meddpiccClient", async (importOriginal) => {
  const { mockMeddpiccClient } = await import("@features/sales/meddpicc/testing/mockStore");
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
import { MemoryRouter, useLocation } from "react-router";
import SalesDealsPage from "./SalesDealsPage";
import { mockMeddpiccClient, resetMockStore } from "../meddpicc/testing/mockStore";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/sales/deals"]}>
      <Where />
      <QueryClientProvider client={client}>
        <SalesDealsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => resetMockStore());

// A page full of MUI selects and tooltips, driven by userEvent: well under a
// second each on an idle machine, but the default 5s is too tight on a busy runner.
describe("SalesDealsPage", { timeout: 20000 }, () => {
  it("lists the demo deals, one row each, with their stage, activity, circles and count to review", async () => {
    renderPage();

    const brightwater = (await screen.findByRole("button", { name: "Brightwater – API Manager first sale" })).closest("tr");
    expect(brightwater).not.toBeNull();
    const row = within(brightwater as HTMLElement);
    expect(row.getByText("Brightwater Pumps Limited")).toBeInTheDocument();
    expect(row.getByText("Qualify")).toBeInTheDocument();
    // Amount and close date ride under the name now, to give the timeline the width.
    expect(row.getByText("120,000 USD · closes 31/12/2026")).toBeInTheDocument();
    expect(row.getByRole("list", { name: /^Opportunity journey/ })).toBeInTheDocument();
    // The journey's key is behind the column title's info button, not spread across the header.
    expect(screen.getByRole("columnheader", { name: /^Journey/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What the journey shows" })).toBeInTheDocument();
    expect(screen.queryByText("Internal discussion")).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "What the journey shows" }));
    expect(await screen.findByText("Internal discussion")).toBeInTheDocument();
    expect(row.getByRole("group", { name: /^MEDDPICC for Brightwater/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Champion: AI suggestion waiting for approval" })).toBeInTheDocument();
    expect(row.getByLabelText(/AI proposals waiting for approval/)).toHaveTextContent(/to review$/);
    // The stage rides in the Opportunity cell, and Salesforce's score beside the circles
    // (DealScore.test covers the badge); a deal Salesforce has no score for shows nothing there.
    expect(screen.getByRole("columnheader", { name: "Opportunity" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Stage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Score" })).not.toBeInTheDocument();
    expect(row.queryByRole("img", { name: /opportunity score/i })).not.toBeInTheDocument();
    const meridian = within(
      screen.getByRole("button", { name: "Meridian Bank – integration platform" }).closest("tr") as HTMLElement,
    );
    expect(meridian.getByRole("img", { name: "Opportunity score 78.9, Strong" })).toBeInTheDocument();
    // MEDDPICC and the score beside the name, the journey after them.
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Opportunity", "MEDDPICC · Score", "Journey"]);
    // Under the journey only the activity and when it last moved: the stage and close date are beside the name.
    expect(screen.queryByText(/days to close/)).not.toBeInTheDocument();

    for (const name of [
      "Meridian Bank – integration platform",
      "Nordlys Energi – identity expansion",
      "Harbourline – API platform",
      "Oakridge University – campus IAM",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    // All opportunities is the default: a deal someone else owns is listed too.
    expect(screen.getByRole("button", { name: "Asterra Health – FHIR gateway" })).toBeInTheDocument();
    // Closed deals are hidden by default.
    expect(screen.queryByRole("button", { name: "Kestrel Telecom – API Manager expansion" })).not.toBeInTheDocument();
  });

  it("opens on All, and Mine narrows to your own", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockMeddpiccClient, "deals");
    renderPage();
    await screen.findByRole("button", { name: "Brightwater – API Manager first sale" });

    const scope = within(screen.getByRole("group", { name: "Whose opportunities to show" }));
    expect(scope.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ mine: false }));
    expect(screen.getByRole("button", { name: "Asterra Health – FHIR gateway" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Owner" })).not.toHaveAttribute("aria-disabled");

    await user.click(scope.getByRole("button", { name: "Mine" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Asterra Health – FHIR gateway" })).not.toBeInTheDocument(),
    );
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ mine: true }));
    // An owner filter means nothing on your own deals.
    expect(screen.getByRole("combobox", { name: "Owner" })).toHaveAttribute("aria-disabled", "true");
    spy.mockRestore();
  });

  it("filters by the account's region", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(mockMeddpiccClient, "deals");
    renderPage();
    await screen.findByRole("button", { name: "Brightwater – API Manager first sale" });

    await user.click(screen.getByRole("combobox", { name: "Region" }));
    await user.click(await screen.findByRole("option", { name: "APAC" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Brightwater – API Manager first sale" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Harbourline – API platform" })).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ region: "APAC", mine: false }));
    spy.mockRestore();
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

  // A deal is a page of its own now, not a drawer over the list.
  it("opens the deal's own page from a row", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Harbourline – API platform" }));
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/sales\/deals\/006MOCK0000HARB$/);
  });
});

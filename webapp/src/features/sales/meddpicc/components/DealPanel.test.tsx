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
import type { ReactNode } from "react";

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
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
const showSuccess = vi.fn();
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess, showError: vi.fn(), showWarning: vi.fn() }),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import DealPanel from "./DealPanel";
import { mockMeddpiccClient, resetMockStore } from "../mock/mockStore";

function renderPanel(opportunityId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(<DealPanel opportunityId={opportunityId} onClose={() => {}} />, { wrapper });
}

const approveButton = () => screen.getByRole("button", { name: /^Approve all/ });

beforeEach(() => {
  resetMockStore();
  showSuccess.mockClear();
});
afterEach(() => vi.restoreAllMocks());

// A drawer full of MUI selects and tooltips, driven by userEvent: well under a
// second each on an idle machine, but the default 5s is too tight on a busy runner.
describe("DealPanel", { timeout: 20000 }, () => {
  it("keeps Approve all disabled, and says why, while a proposed role has no matching contact", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });

    // Economic buyer lives in the Qualify Gate, which is collapsed; the Letter filter reaches it.
    await user.click(screen.getByRole("button", { name: /^Economic Buyer:/ }));

    expect(approveButton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pick the matching contact for economic buyer, or mark it not known.",
    );

    await user.click(screen.getByRole("combobox", { name: "Matching contact" }));
    await user.click(await screen.findByRole("option", { name: /Grace Lim-Tan/ }));

    expect(approveButton()).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("also enables Approve all when the role is marked not known", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000MERI");
    await screen.findByRole("heading", { name: "Meridian Bank – integration platform" });
    await user.click(screen.getByRole("button", { name: /^Economic Buyer:/ }));

    await user.click(screen.getByRole("combobox", { name: "Matching contact" }));
    await user.click(await screen.findByRole("option", { name: "Not known — leave unset" }));

    expect(approveButton()).toBeEnabled();
  });

  it("sends the AM's edits — a clear as null — with the suggested contact matched", async () => {
    const user = userEvent.setup();
    const approve = vi.spyOn(mockMeddpiccClient, "approve");
    renderPanel("006MOCK0000BRWT");
    await screen.findByRole("heading", { name: "Brightwater – API Manager first sale" });

    await user.click(screen.getByRole("button", { name: "Edit Decision process" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("cleared")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Decision criteria" }));
    await user.click(screen.getByRole("combobox", { name: "Decision criteria" }));
    await user.click(await screen.findByRole("option", { name: "Scalability & performance" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Use this value" }));

    await user.click(approveButton());

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(approve).toHaveBeenCalledWith("006MOCK0000BRWT", {
      edits: {
        decisionProcess: null,
        decisionCriteria: ["Technical fit / feature coverage", "Total cost of ownership", "Scalability & performance"],
      },
      roleMatches: { champion: "003MOCKK1" },
    });
    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
  });

  it("fills the header's circles after Approve all", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000BRWT");
    await screen.findByRole("heading", { name: "Brightwater – API Manager first sale" });
    const header = screen.getByRole("group", { name: /^MEDDPICC for Brightwater/ });
    expect(within(header).getByRole("button", { name: /^Champion:/ })).toHaveAccessibleName(
      "Champion: AI suggestion waiting for approval",
    );

    await user.click(approveButton());

    await waitFor(() =>
      expect(within(header).getByRole("button", { name: /^Champion:/ })).toHaveAccessibleName(
        "Champion: filled in Salesforce",
      ),
    );
  });

  it("offers Move stage once the Gate is complete, and moves it", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000NORD");
    await screen.findByRole("heading", { name: "Nordlys Energi – identity expansion" });

    await user.click(screen.getByRole("button", { name: /Move to Proposal/ }));

    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith("Moved to Proposal."));
    // Proposal's Gate is now current, and it isn't complete, so the button goes.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Move to/ })).not.toBeInTheDocument());
  });

  it("shows Salesforce's own message, and a way there, when it refuses the stage change", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000OAKR");
    await screen.findByRole("heading", { name: "Oakridge University – campus IAM" });

    await user.click(screen.getByRole("button", { name: /Move to Business Proof/ }));

    expect(await screen.findByText(/Stage can only be advanced through the Update MEDDPICC Stages flow/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open in Salesforce/ }).length).toBeGreaterThanOrEqual(2);
  });

  it("includes an unassigned call from the banner", async () => {
    const user = userEvent.setup();
    renderPanel("006MOCK0000HARB");
    await screen.findByRole("heading", { name: "Harbourline – API platform" });
    expect(screen.getByText(/2 earlier calls with Harbourline Logistics/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Include Harbourline Logistics – account catch-up" }));

    expect(await screen.findByText(/An earlier call with Harbourline Logistics/)).toBeInTheDocument();
  });

  it("is read-only for someone who can't edit the deal", async () => {
    renderPanel("006MOCK0000ASTE");
    await screen.findByRole("heading", { name: "Asterra Health – FHIR gateway" });
    expect(screen.getByText(/You can view this deal/)).toBeInTheDocument();
    expect(approveButton()).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
  });
});

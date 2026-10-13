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
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import MarketingOpsShell, { MarketingOpsRoute } from "@features/marketing-ops/components/MarketingOpsShell";
import type { MarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";

// The shell's whole job is a four-rung state ladder, and the last rung is now a
// NAVIGATION: a caller in no Marketing Ops group is sent back to the perspective
// landing, which is the one place that says so. That raises the cost of getting
// the rung wrong — three of the four states leave the gate without capabilities
// exactly as a denial does, and mistaking one of them for a denial no longer
// shows the wrong panel, it throws someone off the screen they asked for while
// the answer is still arriving. Hence a test per rung.

const configured = vi.hoisted(() => ({ value: true }));
vi.mock("@config/apiConfig", () => ({
  isMarketingOpsBackendConfigured: () => configured.value,
}));

const gate = vi.hoisted(() => ({ value: {} as MarketingOpsGate }));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", () => ({
  useMarketingOpsGate: () => gate.value,
}));

const AUTHORIZED: MarketingOpsGate = {
  canSee: () => true,
  isAuthorized: true,
  isAdmin: false,
  isResolving: false,
  isError: false,
  retry: () => {},
};

const SUBTITLE = "Campaign operations, event lists and CRM ingestion.";

function UrlProbe() {
  return <div data-testid="url">{useLocation().pathname}</div>;
}

function renderShell(g: Partial<MarketingOpsGate> = {}) {
  gate.value = { ...AUTHORIZED, ...g };
  return render(
    <MemoryRouter initialEntries={["/marketing-ops/events/mine"]}>
      <UrlProbe />
      <Routes>
        <Route
          path="/marketing-ops/events/mine"
          element={
            <MarketingOpsShell title="My Events" subtitle={SUBTITLE}>
              <div>the real page</div>
            </MarketingOpsShell>
          }
        />
        <Route path="/marketing-ops" element={<div>the landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const stayedPut = () => expect(screen.getByTestId("url")).toHaveTextContent("/marketing-ops/events/mine");

beforeEach(() => {
  configured.value = true;
});

describe("MarketingOpsShell", () => {
  it("renders the page for an authorized caller", () => {
    renderShell();
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
    stayedPut();
  });

  // A screen reached by URL by someone in no Marketing Ops group hands the
  // question back to the perspective landing rather than answering it here.
  it("sends a caller in no Marketing Ops group back to the landing", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByTestId("url")).toHaveTextContent("/marketing-ops");
    expect(screen.getByText("the landing")).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  // ---- the rungs that must NOT read as locked -----------------------------
  //
  // Each of these leaves the gate without capabilities, exactly like a denial
  // does, which is what makes them easy to collapse into one branch by accident.
  // Now that a denial navigates, collapsing one of them would bounce someone off
  // a screen they can open.

  it("shows the spinner, not a redirect, while the check is in flight", () => {
    renderShell({ isAuthorized: false, isResolving: true, canSee: () => false });
    expect(screen.getByText(/checking your marketing ops access/i)).toBeInTheDocument();
    stayedPut();
  });

  it("shows the retryable error, not a redirect, when the check fails", () => {
    renderShell({
      isAuthorized: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      canSee: () => false,
    });
    expect(screen.getByText(/couldn't check your marketing ops access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    stayedPut();
  });

  it("shows the config hint, not a redirect, when the backend URL is unset", () => {
    configured.value = false;
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByText(/isn't connected yet/i)).toBeInTheDocument();
    stayedPut();
  });

  // ---- MarketingOpsRoute ---------------------------------------------------
  //
  // An authorized caller can still type the URL of a screen the rail hides from
  // them. The route guard sends them to the landing, and like the shell it waits
  // for the gate to answer before deciding.

  describe("MarketingOpsRoute", () => {
    function renderRoute(g: Partial<MarketingOpsGate>) {
      gate.value = { ...AUTHORIZED, ...g };
      return render(
        <MemoryRouter initialEntries={["/marketing-ops/events/mine"]}>
          <UrlProbe />
          <Routes>
            <Route
              path="/marketing-ops/events/mine"
              element={
                <MarketingOpsRoute gateId="mops-events-mine">
                  <div>the real page</div>
                </MarketingOpsRoute>
              }
            />
            <Route path="/marketing-ops" element={<div>the landing</div>} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it("renders a screen the gate allows", () => {
      renderRoute({ canSee: (id) => id === "mops-events-mine" });
      expect(screen.getByText("the real page")).toBeInTheDocument();
      stayedPut();
    });

    it("sends an authorized caller away from a screen the gate refuses", () => {
      renderRoute({ canSee: (id) => id === "mops-event-platform-events" });
      expect(screen.getByText("the landing")).toBeInTheDocument();
      expect(screen.queryByText("the real page")).not.toBeInTheDocument();
    });

    it("decides nothing while the check is in flight", () => {
      renderRoute({ isResolving: true, canSee: () => false });
      expect(screen.getByText("the real page")).toBeInTheDocument();
      stayedPut();
    });

    it("decides nothing when the check fails", () => {
      renderRoute({ isError: true, canSee: () => false });
      stayedPut();
    });

    it("decides nothing when the backend URL is unset", () => {
      configured.value = false;
      renderRoute({ canSee: () => false });
      stayedPut();
    });
  });
});

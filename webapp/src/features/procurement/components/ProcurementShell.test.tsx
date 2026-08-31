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

// The shell's whole job is the ORDER of its degraded states, and the order is
// only visible from outside — each rung leaves the caller without permissions,
// so getting it wrong reports a gateway failure as a missing role and sends
// someone chasing access they already hold. These tests pin the ladder, and in
// particular that no rung ever falls through to the page's own content.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProcurementShell from "./ProcurementShell";
import type { ProcurementPermissions } from "@features/procurement/api/procurementPermissions";

const configured = vi.hoisted(() => vi.fn());
const gate = vi.hoisted(() => vi.fn());

vi.mock("@config/apiConfig", () => ({
  isPurchasingBackendConfigured: configured,
}));

vi.mock("@features/procurement/api/useProcurementGate", () => ({
  useProcurementGate: gate,
}));

const NO_PERMISSIONS: ProcurementPermissions = {
  procurement: false,
  isAdmin: false,
  canManageVendors: false,
  canManageBusinessUnits: false,
  canViewAuditLog: false,
  canViewAnalytics: false,
  isApprover: false,
};

/** A resolved, authorized viewer holding nothing. Override one field per test. */
function gateState(over: Partial<ReturnType<typeof gate>> = {}) {
  return {
    canSee: () => true,
    isAuthorized: true,
    permissions: NO_PERMISSIONS,
    isResolving: false,
    isError: false,
    errorMessage: undefined,
    retry: vi.fn(),
    ...over,
  };
}

const CONTENT = "the page itself";

function renderShell(props: { requires?: "procurement" } = {}) {
  return render(
    <ProcurementShell title="Approvals" subtitle="What's waiting on you." {...props}>
      <div>{CONTENT}</div>
    </ProcurementShell>,
  );
}

beforeEach(() => {
  configured.mockReset().mockReturnValue(true);
  gate.mockReset().mockReturnValue(gateState());
});

describe("ProcurementShell", () => {
  it("heads the page with an h1, so heading navigation has somewhere to land", () => {
    renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "Approvals" })).toBeInTheDocument();
  });

  it("names the missing config key when the backend isn't connected", () => {
    configured.mockReturnValue(false);
    renderShell();

    expect(screen.getByText(/ONE_WSO2_PURCHASING_BACKEND_URL/)).toBeInTheDocument();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("holds the page while the access check is in flight, rather than flashing a denial", () => {
    gate.mockReturnValue(gateState({ isResolving: true, isAuthorized: false }));
    renderShell({ requires: "procurement" });

    expect(screen.getByText(/Checking your Procurement access/)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/)).toBeNull();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("reports a failed access check as a failure with a retry, never as a refusal", () => {
    // The rung order that matters most: a failed /me also leaves us with no
    // permissions, so checking `requires` first would blame the user's roles for
    // a gateway timeout.
    const retry = vi.fn();
    gate.mockReturnValue(
      gateState({ isError: true, isAuthorized: false, errorMessage: "HTTP 502.", retry }),
    );
    renderShell({ requires: "procurement" });

    expect(screen.getByText(/Couldn't reach the purchasing backend/)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/)).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("retries the identity lookup on click", async () => {
    const retry = vi.fn();
    gate.mockReturnValue(gateState({ isError: true, retry }));
    renderShell();

    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says the identity lookup didn't land rather than rendering an unresolved page", () => {
    // Every WSO2 employee is authorized here — the backend self-provisions them —
    // so this is not a refusal. Without this rung the children rendered and their
    // own queries, disabled for the same reason, sat on "Loading…" forever.
    gate.mockReturnValue(gateState({ isAuthorized: false }));
    renderShell();

    expect(screen.getByText(/Couldn't confirm your identity/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("refuses a screen the viewer lacks the permission for, and says where roles come from", () => {
    renderShell({ requires: "procurement" });

    expect(screen.getByText(/don't have access to this screen/)).toBeInTheDocument();
    // The actionable half: purchasing roles are not granted in One WSO2.
    expect(screen.getByText(/purchasing administrator/)).toBeInTheDocument();
    expect(screen.queryByText(CONTENT)).toBeNull();
  });

  it("renders the page once the viewer holds the permission it requires", () => {
    gate.mockReturnValue(
      gateState({ permissions: { ...NO_PERMISSIONS, procurement: true } }),
    );
    renderShell({ requires: "procurement" });

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });

  it("renders a screen that requires nothing for any authorized viewer", () => {
    renderShell();
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });
});

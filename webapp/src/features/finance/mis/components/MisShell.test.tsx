/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MisShell from "@features/finance/mis/components/MisShell";
import type { MisGate } from "@features/finance/mis/api/useMisGate";

const configured = vi.hoisted(() => ({ value: true }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => configured.value,
}));

const gate = vi.hoisted(() => ({ value: {} as MisGate }));
vi.mock("@features/finance/mis/api/useMisGate", () => ({
  useMisGate: () => gate.value,
}));

const ALLOWED: MisGate = {
  canSee: () => true,
  isAuthorized: true,
  isResolving: false,
  isError: false,
  retry: () => {},
};

const SUBTITLE = "Recurring revenue from opening to closing balance.";

function renderShell(g: Partial<MisGate> = {}) {
  gate.value = { ...ALLOWED, ...g };
  return render(
    <MemoryRouter>
      <MisShell gateId="mis-arr-build" title="ARR Build" subtitle={SUBTITLE}>
        <div>the real page</div>
      </MisShell>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  configured.value = true;
});

describe("a screen the caller can open", () => {
  it("renders it", () => {
    renderShell();
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ARR Build" })).toBeInTheDocument();
  });
});

describe("the ladder above the page", () => {
  it("names the missing config key when the ARR backend isn't set", () => {
    configured.value = false;
    renderShell();
    expect(screen.getByText(/ONE_WSO2_MIS_ARR_BACKEND_URL/)).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  // Rendering a denial first and correcting it a moment later flashes a lock at
  // people who do have access, on every single load.
  it("holds the page while the privilege check is in flight", () => {
    renderShell({ isResolving: true, isAuthorized: false, canSee: () => false });
    expect(screen.getByText(/checking your mis access/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });

  // Checked BEFORE the locked rung. A failed request also leaves us with no
  // privileges, and reporting that as a missing permission sends someone
  // chasing an LDAP group they are already in.
  it("reports a failed check as an error with a retry, not as a denial", () => {
    renderShell({
      isError: true,
      errorMessage: "Gateway timed out.",
      isAuthorized: false,
      canSee: () => false,
    });
    expect(screen.getByText(/couldn't check your mis access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });

  it("locks someone holding no MIS privilege at all", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByText(/don't have access to finance mis/i)).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  // The rung Marketing Ops has no equivalent of. MIS has two independent
  // privileges, so "you have MIS access, just not to this screen" is an
  // ordinary state — a Flash-only person opening ARR Build — and telling them
  // they have no MIS access at all would be false.
  it("tells someone with the other privilege that it is this screen they lack", () => {
    renderShell({ isAuthorized: true, canSee: () => false });
    expect(screen.getByText(/not one of the mis screens you can open/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access to finance mis/i)).not.toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });
});

describe("the subtitle", () => {
  it("is dropped on a locked screen, since it sells something withheld", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.queryByText(SUBTITLE)).not.toBeInTheDocument();
  });

  it("survives every other rung", () => {
    renderShell({ isResolving: true, canSee: () => false });
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });
});

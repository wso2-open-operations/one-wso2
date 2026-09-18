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
import InfraShell from "@features/infra/components/InfraShell";
import type { InfraGate } from "@features/infra/api/useInfraGate";

// The shell's whole job is a four-rung state ladder, and the locked rung now
// changes the HEADER as well as the body — the subtitle is suppressed there.
// That makes the shell hold the same condition twice: once as `isLocked` for
// the header, once as the last `if` in the body. These tests exist because
// those two can drift apart silently, and the failure mode is ugly: an
// authorized caller seeing a denial for one render while /user-info is still
// in flight.

const configured = vi.hoisted(() => ({ value: true }));
vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => configured.value,
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("@features/infra/api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
}));

const AUTHORIZED: InfraGate = {
  canSee: () => true,
  isAuthorized: true,
  isEmployee: true,
  isApprover: false,
  isAdmin: false,
  isResolving: false,
  isForbidden: false,
  isError: false,
  retry: () => {},
};

const SUBTITLE = "GitHub requests, repository access and the Security Dashboard.";
const NO_ACCESS = /you don't have access to infra portal/i;

function renderShell(g: Partial<InfraGate> = {}) {
  gate.value = { ...AUTHORIZED, ...g };
  return render(
    <InfraShell title="Infra Portal" subtitle={SUBTITLE}>
      <div>the real page</div>
    </InfraShell>,
  );
}

beforeEach(() => {
  configured.value = true;
});

describe("InfraShell", () => {
  it("renders the page for an authorized caller", () => {
    renderShell();
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS)).not.toBeInTheDocument();
  });

  it("warns when the caller is in no infra group", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByText(NO_ACCESS)).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  it("drops the subtitle on the locked state only", () => {
    renderShell({ isAuthorized: false, canSee: () => false });
    // The title still says where you are; the subtitle would be selling a
    // screen that is about to refuse you.
    expect(screen.getByRole("heading", { name: "Infra Portal" })).toBeInTheDocument();
    expect(screen.queryByText(SUBTITLE)).not.toBeInTheDocument();
  });

  it("treats a 403 as the warning, not a retryable error", () => {
    renderShell({
      isAuthorized: false,
      isForbidden: true,
      canSee: () => false,
    });
    expect(screen.getByText(NO_ACCESS)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  // ---- the rungs that must NOT read as locked -----------------------------
  //
  // Each of these leaves the gate without capabilities, exactly like a denial
  // does, which is what makes them easy to collapse into one branch by accident.

  it("shows the spinner, not the warning, while the check is in flight", () => {
    renderShell({ isAuthorized: false, isResolving: true, canSee: () => false });
    expect(screen.getByText(/checking your infra portal access/i)).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS)).not.toBeInTheDocument();
    // The header is untouched here — only the locked rung suppresses the subtitle.
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it("shows the retryable error, not the warning, when the check fails", () => {
    renderShell({
      isAuthorized: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      canSee: () => false,
    });
    expect(screen.getByText(/couldn't check your infra portal access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS)).not.toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it("shows the config hint, not the warning, when the backend URL is unset", () => {
    configured.value = false;
    renderShell({ isAuthorized: false, canSee: () => false });
    expect(screen.getByText(/isn't connected yet/i)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_INFRA_BACKEND_URL")).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS)).not.toBeInTheDocument();
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });

  it("renders the page unlocked when the screen opts out of the check", () => {
    gate.value = { ...AUTHORIZED, isAuthorized: false, canSee: () => false };
    render(
      <InfraShell title="Infra Portal" subtitle={SUBTITLE} requireAuthorized={false}>
        <div>the real page</div>
      </InfraShell>,
    );
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS)).not.toBeInTheDocument();
  });
});
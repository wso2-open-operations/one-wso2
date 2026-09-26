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
import { renderHook, waitFor } from "@testing-library/react";

// The shim is the only thing that talks to the network here, so mocking it
// counts every request the gate would make.
const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));

let configured = true;
let evidenceConfigured = true;
vi.mock("@config/apiConfig", () => ({
  isSecurityBackendConfigured: () => configured,
  securityBackendUrl: "https://example.invalid",
  isEvidencePortalBackendConfigured: () => evidenceConfigured,
}));

import { useSecurityGate } from "./useSecurityGate";

function jsonOnce(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

beforeEach(() => {
  configured = true;
  evidenceConfigured = true;
  authFetch.mockReset();
  authFetch.mockImplementation((url: string) =>
    String(url).includes("involvement") ? jsonOnce({ namedOnRisk: false }) : jsonOnce({ privileges: [] }),
  );
});

afterEach(() => {
  vi.resetModules();
});

describe("useSecurityGate", () => {
  // THE regression this file exists for. The side rail asks for this gate on
  // EVERY perspective, so a gate that fetches regardless of `enabled` makes
  // every user of this app — including everyone with no GRC access at all —
  // call the GRC backend on every page load and collect 401s in their console.
  //
  // The first version did exactly that: it passed `enabled` to the derived
  // `isResolving` but called the underlying hooks unconditionally.
  it("makes NO request when disabled", async () => {
    renderHook(() => useSecurityGate(false));
    // Give any effect a chance to fire before concluding nothing did.
    await new Promise((r) => setTimeout(r, 0));
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("makes no request when the backend isn't configured, even if enabled", async () => {
    configured = false;
    renderHook(() => useSecurityGate(true));
    await new Promise((r) => setTimeout(r, 0));
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("does fetch once enabled and configured", async () => {
    renderHook(() => useSecurityGate(true));
    await waitFor(() => expect(authFetch).toHaveBeenCalled());
  });

  it("reports nothing visible and nothing resolving while disabled", () => {
    const { result } = renderHook(() => useSecurityGate(false));
    expect(result.current.isResolving).toBe(false);
    expect(result.current.isAuthorized).toBe(false);
    expect(result.current.canSee("security-risk-registers")).toBe(false);
  });

  // A disabled gate must not claim to be loading: a consumer that waits on
  // `isResolving` would wait for a request that is never going to be made.
  it("does not report resolving when unconfigured", () => {
    configured = false;
    const { result } = renderHook(() => useSecurityGate(true));
    expect(result.current.isResolving).toBe(false);
  });

  it("hides an item id nobody mapped rather than defaulting it open", async () => {
    const { result } = renderHook(() => useSecurityGate(true));
    await waitFor(() => expect(result.current.isResolving).toBe(false));
    expect(result.current.canSee("security-not-a-real-item")).toBe(false);
  });

  // The temporary rule this ticket adds: Evidence items answer off the
  // Evidence backend's own config flag, not the GRC privilege map above, and
  // not the GRC hooks' loading state either — it does not wait on them.
  describe("the Evidence item's temporary visibility rule", () => {
    it("shows the Evidence dashboard once the Evidence backend is configured", () => {
      const { result } = renderHook(() => useSecurityGate(true));
      expect(result.current.canSee("security-evidence-dashboard")).toBe(true);
    });

    it("hides the Evidence dashboard when the Evidence backend has no address", () => {
      evidenceConfigured = false;
      const { result } = renderHook(() => useSecurityGate(true));
      expect(result.current.canSee("security-evidence-dashboard")).toBe(false);
    });

    it("hides the Evidence dashboard while the gate itself is disabled", () => {
      const { result } = renderHook(() => useSecurityGate(false));
      expect(result.current.canSee("security-evidence-dashboard")).toBe(false);
    });
  });
});

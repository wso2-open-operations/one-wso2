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

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EVIDENCE_CATALOGUE_ITEM_ID, EVIDENCE_COST_ITEM_ID } from "@constants/securityApps";

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

// Evidence's own identity check, mocked at the same seam useCurrentUser
// itself calls out through (meApi.whoami) rather than at the hook level —
// same style as authFetch above, and it means the real useCurrentUser (the
// one the gate now shares with the Evidence pages) is what actually runs.
type MeResult =
  | { kind: "success"; role: "admin" | "engineer" }
  | { kind: "forbidden" }
  | { kind: "pending" }; // never settles, for the "still resolving" case

let meResult: MeResult = { kind: "success", role: "engineer" };

const meWhoami = vi.fn(() => {
  if (meResult.kind === "pending") return new Promise(() => {});
  if (meResult.kind === "forbidden") {
    return Promise.reject({ isAxiosError: true, response: { status: 403, data: { detail: "no role" } } });
  }
  return Promise.resolve({ email: "person@wso2.com", role: meResult.role });
});
vi.mock("@features/security/evidence-portal/api/client", () => ({
  meApi: { whoami: () => meWhoami() },
}));

// useCurrentUser fetches its own token directly (see its comment for why),
// so it needs a token accessor even outside the Evidence route layout that
// normally registers one.
vi.mock("@hooks/useAccessToken", () => ({
  useAccessToken: () => () => Promise.resolve("test-token"),
}));

import { useSecurityGate } from "./useSecurityGate";

function jsonOnce(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

// A fresh QueryClient per render — the gate and useCurrentUser share the
// react-query key "me" ON PURPOSE (see useCurrentUser's comment), so reusing
// one client across tests would leak one test's identity into the next.
function withQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderGate(enabled: boolean) {
  return renderHook(() => useSecurityGate(enabled), { wrapper: withQueryClient() });
}

beforeEach(() => {
  configured = true;
  evidenceConfigured = true;
  meResult = { kind: "success", role: "engineer" };
  authFetch.mockReset();
  authFetch.mockImplementation((url: string) =>
    String(url).includes("involvement") ? jsonOnce({ namedOnRisk: false }) : jsonOnce({ privileges: [] }),
  );
  meWhoami.mockClear();
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
    renderGate(false);
    // Give any effect a chance to fire before concluding nothing did.
    await new Promise((r) => setTimeout(r, 0));
    expect(authFetch).not.toHaveBeenCalled();
    expect(meWhoami).not.toHaveBeenCalled();
  });

  it("makes no request when the backend isn't configured, even if enabled", async () => {
    configured = false;
    renderGate(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("does fetch once enabled and configured", async () => {
    renderGate(true);
    await waitFor(() => expect(authFetch).toHaveBeenCalled());
  });

  it("reports nothing visible and nothing resolving while disabled", () => {
    const { result } = renderGate(false);
    expect(result.current.isResolving).toBe(false);
    expect(result.current.isAuthorized).toBe(false);
    expect(result.current.canSee("security-risk-registers")).toBe(false);
  });

  // A disabled gate must not claim to be loading: a consumer that waits on
  // `isResolving` would wait for a request that is never going to be made.
  // Both backends unconfigured, so neither half of the gate has anything to
  // resolve.
  it("does not report resolving when unconfigured", () => {
    configured = false;
    evidenceConfigured = false;
    const { result } = renderGate(true);
    expect(result.current.isResolving).toBe(false);
  });

  it("hides an item id nobody mapped rather than defaulting it open", async () => {
    const { result } = renderGate(true);
    await waitFor(() => expect(result.current.isResolving).toBe(false));
    expect(result.current.canSee("security-not-a-real-item")).toBe(false);
  });

  // Evidence's own /api/me — folded into this same
  // gate via useCurrentUser — decides engineer vs admin vs no access at all.
  describe("the Evidence item's real visibility rule", () => {
    it("shows an engineer every Evidence item except the admin-only ones", async () => {
      meResult = { kind: "success", role: "engineer" };
      const { result } = renderGate(true);
      await waitFor(() => expect(result.current.isResolving).toBe(false));
      expect(result.current.canSee("security-evidence-dashboard")).toBe(true);
      expect(result.current.canSee(EVIDENCE_CATALOGUE_ITEM_ID)).toBe(false);
      expect(result.current.canSee(EVIDENCE_COST_ITEM_ID)).toBe(false);
    });

    it("shows an admin every Evidence item, admin-only included", async () => {
      meResult = { kind: "success", role: "admin" };
      const { result } = renderGate(true);
      await waitFor(() => expect(result.current.isResolving).toBe(false));
      expect(result.current.canSee("security-evidence-dashboard")).toBe(true);
      expect(result.current.canSee(EVIDENCE_CATALOGUE_ITEM_ID)).toBe(true);
      expect(result.current.canSee(EVIDENCE_COST_ITEM_ID)).toBe(true);
    });

    it("hides every Evidence item once /api/me comes back 403", async () => {
      meResult = { kind: "forbidden" };
      const { result } = renderGate(true);
      await waitFor(() => expect(result.current.isResolving).toBe(false));
      expect(result.current.canSee("security-evidence-dashboard")).toBe(false);
      expect(result.current.canSee(EVIDENCE_CATALOGUE_ITEM_ID)).toBe(false);
    });

    // Fail closed: nothing shows before /api/me has answered even once,
    // rather than flashing an item that a forbidden answer then withdraws.
    it("shows nothing while the Evidence identity check is still resolving", () => {
      meResult = { kind: "pending" };
      const { result } = renderGate(true);
      expect(result.current.isResolving).toBe(true);
      expect(result.current.canSee("security-evidence-dashboard")).toBe(false);
    });

    it("makes no Evidence request, and hides Evidence, when the Evidence backend has no address", async () => {
      evidenceConfigured = false;
      const { result } = renderGate(true);
      await waitFor(() => expect(result.current.isResolving).toBe(false));
      expect(meWhoami).not.toHaveBeenCalled();
      expect(result.current.canSee("security-evidence-dashboard")).toBe(false);
    });

    it("makes no Evidence request, and hides Evidence, while the gate itself is disabled", async () => {
      const { result } = renderGate(false);
      // Give any effect a chance to fire before concluding nothing did.
      await new Promise((r) => setTimeout(r, 0));
      expect(meWhoami).not.toHaveBeenCalled();
      expect(result.current.canSee("security-evidence-dashboard")).toBe(false);
    });

    // Risk/Audit/Admin must not start reporting "hidden" just because
    // Evidence's own, independent query is still in flight. Evidence
    // is left permanently pending, so this only passes if Risk's own answer
    // does not wait on it.
    it("does not hold Risk/Audit/Admin visibility hostage to a slow Evidence answer", async () => {
      meResult = { kind: "pending" };
      authFetch.mockImplementation((url: string) =>
        String(url).includes("involvement")
          ? jsonOnce({ namedOnRisk: false })
          : jsonOnce({ privileges: ["RISK_VIEW_RISKS"] }),
      );
      const { result } = renderGate(true);
      await waitFor(() => expect(result.current.canSee("security-risk-registers")).toBe(true));
    });
  });
});

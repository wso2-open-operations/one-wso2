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

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShieldAlertIcon } from "@wso2/oxygen-ui-icons-react";

// The shim is the only thing that talks to the network here, same seam
// useSecurityGate.test.tsx mocks at.
const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@config/apiConfig", () => ({ securityBackendUrl: "https://example.invalid" }));

let activePerspective = {
  key: "security",
  label: "Security and Compliance",
  icon: ShieldAlertIcon,
  path: "/security",
  forwardsToFirstItem: true,
  sections: [{ id: "sec-app-risk-hub", label: "Risk Hub", icon: ShieldAlertIcon, children: [] }],
};
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => activePerspective,
}));
// Mocked at the hook seam rather than rendered for real: usePerspectiveVisibility
// pulls in a dozen+ feature gates (finance, leave, marketing...) that have
// nothing to do with this row — see useUserGuideUrl.test.tsx for the gate the
// User Guide row actually depends on.
vi.mock("./usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({ resolveVisible: () => true }),
}));

import SideRail from "./SideRail";

function renderSideRail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SideRail collapsed={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function jsonOnce(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

// The "User Guide" row is fetched from the GRC backend (useUserGuideUrl)
// rather than carried in the Security perspective's own registry data — see
// that hook's own test for the fetch itself, and perspectives.ts's comment
// on why it isn't a section there. This covers the integration: that SideRail
// only asks while Security and Compliance is active, and only shows the row
// once that answer is a real URL.
describe("SideRail's User Guide row", () => {
  afterEach(() => {
    authFetch.mockReset();
  });

  it("shows once the backend resolves a configured URL, while on Security and Compliance", async () => {
    authFetch.mockReturnValueOnce(jsonOnce({ url: "https://example.com/user-guide" }));
    renderSideRail();

    const link = await screen.findByRole("link", { name: /User Guide/i });
    expect(link.getAttribute("href")).toBe("https://example.com/user-guide");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("stays hidden when the backend has no URL configured", async () => {
    authFetch.mockReturnValueOnce(jsonOnce({ url: "" }));
    renderSideRail();

    await waitFor(() => expect(authFetch).toHaveBeenCalled());
    expect(screen.queryByText("User Guide")).toBeNull();
  });

  it("never fetches, and never shows the row, on a different perspective", async () => {
    activePerspective = { ...activePerspective, key: "finance", label: "Finance" };
    try {
      renderSideRail();
      // No row to await, so this asserts the negative directly: give any
      // stray fetch a tick to have fired before checking it didn't.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(authFetch).not.toHaveBeenCalled();
      expect(screen.queryByText("User Guide")).toBeNull();
    } finally {
      activePerspective = { ...activePerspective, key: "security", label: "Security and Compliance" };
    }
  });
});

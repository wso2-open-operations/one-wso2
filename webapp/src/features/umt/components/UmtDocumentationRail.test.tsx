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
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Book, RefreshCw } from "@wso2/oxygen-ui-icons-react";
import {
  UMT_DOCUMENTATION_ITEM_ID,
  UMT_DOCUMENTATION_URL_KEY,
  openUmtDocumentation,
} from "@features/umt/lib/umtDocumentation";

// SideRail rendered the way SideRail.userGuide.test.tsx renders it: the
// perspective and its visibility stood in for, so only the UMT group is in
// play, and the GRC fetch shim stubbed because SideRail always mounts it.
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => vi.fn(),
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "engineering",
    label: "Engineering",
    icon: RefreshCw,
    path: "/engineering",
    forwardsToFirstItem: true,
    sections: [
      {
        id: "engineering-umt",
        label: "UMT",
        icon: RefreshCw,
        alwaysGroup: true,
        children: [
          { id: "umt-overview", label: "Overview", path: "/engineering/umt" },
          {
            id: UMT_DOCUMENTATION_ITEM_ID,
            label: "Documentation",
            icon: Book,
            onSelect: openUmtDocumentation,
            opensInNewTab: true,
          },
        ],
      },
    ],
  }),
}));
vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({ resolveVisible: () => true }),
}));

const { default: SideRail } = await import("@components/side-rail/SideRail");

const DOCS = "https://docs.example/umt";

// The link is whatever useUmtDocumentationUrl fetched into the cache; seeding
// the cache is exactly what the row's action sees once that request lands.
function renderSideRail({ collapsed, url }: { collapsed: boolean; url?: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (url !== undefined) queryClient.setQueryData(UMT_DOCUMENTATION_URL_KEY, url);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/engineering/umt"]}>
        <SideRail collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UMT's Documentation row", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the documentation in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSideRail({ collapsed: false, url: DOCS });

    fireEvent.click(screen.getByRole("button", { name: /Documentation/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(DOCS, "_blank", "noopener,noreferrer");
  });

  it("opens it from the collapsed rail's flyout too", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSideRail({ collapsed: true, url: DOCS });

    fireEvent.click(screen.getByRole("button", { name: /UMT/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Documentation/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(DOCS, "_blank", "noopener,noreferrer");
  });

  it("shows an arrow saying it leaves the app, and no other row does", () => {
    renderSideRail({ collapsed: false, url: DOCS });

    const arrow = ".lucide-arrow-up-right";
    expect(screen.getByRole("button", { name: /Documentation/ }).querySelector(arrow)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Overview/ }).querySelector(arrow)).toBeNull();
  });

  it("opens nothing until the documentation link is known", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSideRail({ collapsed: false });

    fireEvent.click(screen.getByRole("button", { name: /Documentation/ }));
    expect(open).not.toHaveBeenCalled();
  });
});

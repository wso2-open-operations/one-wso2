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
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookIcon, HammerIcon, PackageIcon, WrenchIcon } from "@wso2/oxygen-ui-icons-react";

const nexusAction = vi.fn();
const docsAction = vi.fn();

// Same seams as SideRail.groupFrame.test.tsx.
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => vi.fn(),
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "engineering",
    label: "Engineering",
    icon: WrenchIcon,
    path: "/engineering",
    forwardsToFirstItem: true,
    sections: [
      {
        id: "engineering-builds-artifacts",
        label: "Builds & Artifacts",
        icon: HammerIcon,
        alwaysGroup: true,
        children: [
          {
            id: "other-app-nexus",
            label: "WSO2 Nexus Repository",
            icon: PackageIcon,
            onSelect: nexusAction,
            opensInNewTab: true,
            outboundUrl: "https://nexus.example",
          },
          { id: "docs", label: "Documentation", icon: BookIcon, onSelect: docsAction, opensInNewTab: true },
        ],
      },
    ],
  }),
}));
vi.mock("./usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({ resolveVisible: () => true }),
}));

import SideRail from "./SideRail";

function renderSideRail(collapsed = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/engineering"]}>
        <SideRail collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SideRail rows that open another site", () => {
  it("draws a row with a known address as a real new-tab link, without also running its action", async () => {
    renderSideRail();
    await userEvent.click(screen.getByText("Builds & Artifacts"));

    const nexus = screen.getByRole("link", { name: /WSO2 Nexus Repository/ });
    expect(nexus).toHaveAttribute("href", "https://nexus.example");
    expect(nexus).toHaveAttribute("target", "_blank");
    expect(nexus).toHaveAttribute("rel", "noopener noreferrer");

    await userEvent.click(nexus);
    expect(nexusAction).not.toHaveBeenCalled();
  });

  it("keeps running the action of a row whose address is only known when it is clicked", async () => {
    renderSideRail();
    await userEvent.click(screen.getByText("Builds & Artifacts"));

    expect(screen.queryByRole("link", { name: /Documentation/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Documentation"));
    expect(docsAction).toHaveBeenCalled();
  });

  // The collapsed rail's flyout draws a row without its link and only reports
  // the selection, so there the row's action is what opens the site.
  it("opens a link row from the collapsed rail's flyout", async () => {
    nexusAction.mockClear();
    renderSideRail(true);
    const user = userEvent.setup();
    // Hovering opens Oxygen's popup; a click after the hover would toggle it shut again.
    await user.hover(screen.getByRole("button", { name: /Builds & Artifacts/ }));

    await user.click(await screen.findByRole("menuitem", { name: /WSO2 Nexus Repository/ }));
    expect(nexusAction).toHaveBeenCalledTimes(1);
  });
});

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
import { RadioIcon } from "@wso2/oxygen-ui-icons-react";
import type { PerspectiveDef } from "@constants/perspectives";

// Stubbed with factories for the same reason PerspectiveLanding.test.tsx does: SalesShell
// imports NothingHere from PerspectiveLanding, whose visibility hook pulls @asgardeo/browser
// into the module graph, and that package does not resolve under vitest's ESM loader.
vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    isError: false,
    retry: () => {},
  }),
}));
const sales: PerspectiveDef = {
  key: "sales",
  label: "Sales",
  icon: RadioIcon,
  access: true,
  path: "/sales",
};
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => sales,
}));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SalesShell from "./SalesShell";
import PerspectiveLanding from "@components/perspective-landing/PerspectiveLanding";

function renderShell(props: { configured: boolean; forbidden?: boolean }) {
  return render(
    <MemoryRouter>
      <SalesShell title="Sales" configKey="ONE_WSO2_REVOPS_BACKEND_URL" {...props}>
        <div>meeting list</div>
      </SalesShell>
    </MemoryRouter>,
  );
}

describe("SalesShell", () => {
  it("says Sales is not connected, and names the key to set, when no backend URL is configured", () => {
    renderShell({ configured: false });
    expect(screen.getByText(/Sales isn't connected yet/)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_REVOPS_BACKEND_URL")).toBeInTheDocument();
    expect(screen.queryByText("meeting list")).not.toBeInTheDocument();
  });

  // The backend answers 403 on every endpoint for a caller in no authorised group; the page
  // shows the same "nothing here" card as every other perspective, not a Sales-only refusal.
  it("shows the shared no-access card, with a way home, when the backend refuses the caller", () => {
    renderShell({ configured: true, forbidden: true });
    expect(screen.getByRole("heading", { name: "Nothing here for you yet" })).toBeInTheDocument();
    expect(screen.getByText(/Sales is here, but none of it is open to you/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/me");
    expect(screen.queryByText("meeting list")).not.toBeInTheDocument();
  });

  it("never says Echo or RevOps -- the product is Sales on every state of the page", () => {
    for (const props of [{ configured: false }, { configured: true, forbidden: true }]) {
      const { container, unmount } = renderShell(props);
      // The product's former names -- neither may reach the page.
      expect(container.textContent).not.toMatch(/Echo|RevOps/);
      unmount();
    }
  });

  it("renders the page content when connected and allowed", () => {
    renderShell({ configured: true, forbidden: false });
    expect(screen.getByText("meeting list")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here for you yet")).not.toBeInTheDocument();
  });

  // The requirement is visual parity with Security and Compliance and Marketing Ops. Both reach
  // their no-access screen through PerspectiveLanding (nothing visible in the rail), so the
  // strongest check is that Sales renders that SAME markup -- title, card, button, no subtitle.
  it("renders exactly the no-access screen Security and Marketing Ops show", () => {
    const { container: sales, unmount } = renderShell({ configured: true, forbidden: true });
    const salesHtml = sales.innerHTML;
    unmount();
    const { container: landing } = render(
      <MemoryRouter>
        <PerspectiveLanding />
      </MemoryRouter>,
    );
    expect(salesHtml).toBe(landing.innerHTML);
    expect(screen.getByRole("heading", { level: 1, name: "Sales" })).toBeInTheDocument();
    expect(screen.queryByText(/Meetings recorded/)).not.toBeInTheDocument();
  });
});

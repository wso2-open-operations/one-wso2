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
import { HttpError } from "@api/http";
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

// meet-app's answer to /user-info -- the access check the shell waits on. Defaults to "allowed".
const access: { isPending: boolean; isLoading: boolean; isError: boolean; error: unknown } = {
  isPending: false,
  isLoading: false,
  isError: false,
  error: null,
};
const refetch = vi.fn();
vi.mock("../api/useSalesData", () => ({
  useSalesUserInfo: () => ({ ...access, refetch }),
}));
beforeEach(() => {
  access.isPending = false;
  access.isLoading = false;
  access.isError = false;
  access.error = null;
  refetch.mockClear();
});
const refuse = () => {
  access.isError = true;
  access.error = new HttpError("https://x/user-info", 403, "");
};

import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import SalesShell from "./SalesShell";
import PerspectiveLanding from "@components/perspective-landing/PerspectiveLanding";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderShell(props: { configured: boolean; forbidden?: boolean }, at = "/sales") {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
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

  // The flash this fixes: the meetings grid rendered while meet-app's answer was in flight, then
  // was replaced by the no-access card. Nothing of the page may show until access is known.
  it("holds the page while access is being checked -- no content, just the title and a spinner", () => {
    access.isPending = true;
    access.isLoading = true;
    renderShell({ configured: true });
    expect(screen.getByText("Checking your Sales access…")).toBeInTheDocument();
    expect(screen.queryByText("meeting list")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing here for you yet")).not.toBeInTheDocument();
  });

  // Identity still resolving: the query is disabled -- pending but not loading. Still hold.
  it("holds the page while identity is still resolving (pending, not loading)", () => {
    access.isPending = true;
    renderShell({ configured: true });
    expect(screen.getByText("Checking your Sales access…")).toBeInTheDocument();
    expect(screen.queryByText("meeting list")).not.toBeInTheDocument();
  });

  it("shows the no-access card when meet-app's access check itself says 403", () => {
    refuse();
    renderShell({ configured: true });
    expect(screen.getByRole("heading", { name: "Nothing here for you yet" })).toBeInTheDocument();
    expect(screen.queryByText("meeting list")).not.toBeInTheDocument();
  });

  // An outage is not a missing permission -- say the check failed, and offer a retry.
  it("reports a failed access check as a failure, with a retry, not as no access", async () => {
    access.isError = true;
    access.error = new HttpError("https://x/user-info", 503, "");
    renderShell({ configured: true });
    expect(screen.getByText(/Couldn't check your Sales access/)).toBeInTheDocument();
    expect(screen.queryByText("Nothing here for you yet")).not.toBeInTheDocument();
    expect(screen.queryByText("meeting list")).not.toBeInTheDocument();
    screen.getByRole("button", { name: /retry/i }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // Like MarketingOpsShell: an inner page with no access leaves for the perspective's own page,
  // which then shows the card -- not a "whole app closed" card under one meeting's URL.
  it("sends a refused caller on an inner page back to /sales, which shows the card", () => {
    refuse();
    renderShell({ configured: true }, "/sales/meetings/523");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/sales$/);
    expect(screen.getByRole("heading", { name: "Nothing here for you yet" })).toBeInTheDocument();
  });

  // The requirement is visual parity with Security and Compliance and Marketing Ops. Both reach
  // their no-access screen through PerspectiveLanding (nothing visible in the rail), so the
  // strongest check is that Sales renders that SAME markup -- title, card, button, no subtitle.
  it("renders exactly the no-access screen Security and Marketing Ops show", () => {
    const { container: sales, unmount } = renderShell({ configured: true, forbidden: true });
    // Compare a copy without the test's location probe -- React owns the real nodes.
    const copy = sales.cloneNode(true) as HTMLElement;
    copy.querySelector('[data-testid="where"]')?.remove();
    const salesHtml = copy.innerHTML;
    unmount();
    const { container: landing } = render(
      <MemoryRouter>
        <PerspectiveLanding />
      </MemoryRouter>,
    );
    expect(salesHtml).toBe(landing.innerHTML);
    expect(screen.getByRole("heading", { level: 1, name: "Sales" })).toBeInTheDocument();
    expect(screen.queryByText(/Recorded sales meetings/)).not.toBeInTheDocument();
  });
});

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
import { ShieldIcon } from "@wso2/oxygen-ui-icons-react";
import type { PerspectiveDef, PerspectiveSection } from "@constants/perspectives";
import type { PerspectiveVisibility } from "@components/side-rail/usePerspectiveVisibility";

// Both hooks are stubbed with factories rather than provided for real. That is
// not only convenience: the real visibility hook pulls @asgardeo/browser into
// this file's module graph, and that package's `buffer` directory import does
// not resolve under vitest's ESM loader — the same failure
// features/tour/tourTargets.test.tsx hits. A factory mock keeps the real module
// from ever being evaluated.
const visibility: { current: PerspectiveVisibility } = {
  current: {
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    firstVisibleLeaf: undefined,
    visibleOutbound: [],
    isError: false,
    retry: () => {},
  },
};
const perspective: { current: PerspectiveDef } = {
  current: { key: "security", label: "Security and Compliance", icon: ShieldIcon, access: true, path: "/security" },
};

vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => visibility.current,
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => perspective.current,
}));

import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import PerspectiveLanding from "./PerspectiveLanding";

function UrlProbe() {
  const { pathname, state } = useLocation();
  return (
    <>
      <div data-testid="url">{pathname}</div>
      <div data-testid="from">
        {(state as { fromPerspective?: string } | null)?.fromPerspective ?? "none"}
      </div>
    </>
  );
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/security"]}>
      <UrlProbe />
      <Routes>
        <Route path="/security" element={<PerspectiveLanding />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const leaf = (id: string, path: string): PerspectiveSection => ({ id, label: id, path });

beforeEach(() => {
  visibility.current = {
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    firstVisibleLeaf: undefined,
    visibleOutbound: [],
    isError: false,
    retry: () => {},
  };
  perspective.current = {
    key: "security",
    label: "Security and Compliance",
    icon: ShieldIcon,
    access: true,
    path: "/security",
  };
});

describe("a perspective landing that forwards to the first item", () => {
  it("opens the first item someone can see", () => {
    const leaves = [
      leaf("risk-dashboard", "/security/risk/dashboard"),
      leaf("risk-registers", "/security/risk/registers"),
    ];
    visibility.current.visibleLeaves = leaves;
    visibility.current.firstVisibleLeaf = leaves[0];
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security/risk/dashboard");
  });

  // Some destinations sit outside their perspective's path prefix — Finance and
  // People Ops both reach the shared /banking/admin — and the rail
  // reads the URL first. Without this the perspective survives only by the
  // sessionStorage memory an effect happened to write before we left.
  it("carries the perspective through the redirect", () => {
    const bankingAdmin = leaf("banking-admin", "/banking/admin");
    visibility.current.visibleLeaves = [bankingAdmin];
    visibility.current.firstVisibleLeaf = bankingAdmin;
    renderLanding();
    expect(screen.getByTestId("from")).toHaveTextContent("security");
  });

  // A leaf already decided — `firstVisibleLeaf` is rail-order-correct by
  // construction (see railActive.ts), so once it names one there is no
  // lower-ranked leaf here to later get bumped by a higher-ranked one landing
  // late — is navigable NOW. Waiting past this point would only hold the
  // reader on a backend that has nothing to do with the item they are about
  // to open. `isResolving` can still be true here (another gate hasn't
  // answered yet); it just is no longer what decides whether this redirects.
  it("redirects to a known leaf even while another gate is still answering", () => {
    const registers = leaf("risk-registers", "/security/risk/registers");
    visibility.current = {
      ...visibility.current,
      isResolving: true,
      visibleLeaves: [registers],
      firstVisibleLeaf: registers,
    };
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security/risk/registers");
  });

  // THE bug this guards, for the case that's still real: NOTHING decided yet
  // — `firstVisibleLeaf` undefined — could still resolve to a leaf once every
  // gate above it settles, so this has to wait — concluding "nothing here" on
  // an incomplete answer would send someone chasing a permission they
  // already hold.
  it("waits rather than saying 'nothing here' while nothing is decided yet and gates are still answering", () => {
    visibility.current = {
      ...visibility.current,
      isResolving: true,
      visibleLeaves: [],
      firstVisibleLeaf: undefined,
    };
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security");
    expect(screen.getByText(/Opening Security and Compliance/)).toBeInTheDocument();
  });

  // The exact case `firstVisibleLeaf` exists for: a lower-ranked leaf already
  // visible must NOT be offered as "the first" while a higher-ranked section
  // hasn't answered — `visibleLeaves` alone (the rail's own, progressive
  // list) would already have one here, but `firstVisibleLeaf` must not, since
  // nothing has ruled out something ranking above it yet.
  it("does not redirect on visibleLeaves alone when firstVisibleLeaf has not decided", () => {
    visibility.current = {
      ...visibility.current,
      isResolving: true,
      visibleLeaves: [leaf("risk-registers", "/security/risk/registers")],
      firstVisibleLeaf: undefined,
    };
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security");
    expect(screen.getByText(/Opening Security and Compliance/)).toBeInTheDocument();
  });

  it("says nothing is open to you when nothing is", () => {
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security");
    expect(screen.getByRole("heading", { name: "Nothing here for you yet" })).toBeInTheDocument();
  });

  // A failed privileges call also leaves us with no items. Reporting that as
  // "you have no access" sends someone chasing a grant they already hold, so
  // the error is checked before the empty state.
  it("reports a failed check as a failure, not as no access", async () => {
    const retry = vi.fn();
    visibility.current = { ...visibility.current, isError: true, error: new Error("boom"), retry };
    renderLanding();
    expect(screen.queryByText("Nothing here for you yet")).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn't work out what you can open/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  // A failed check is about this app's own screens; the rail still shows its
  // links to other apps, so the error page offers them too, beside Retry.
  it("keeps the rail's links to other apps beside a failed check", async () => {
    const retry = vi.fn();
    visibility.current = {
      ...visibility.current,
      isError: true,
      error: new Error("boom"),
      retry,
      visibleOutbound: [{ id: "other-app-wifi", label: "Guest WiFi", externalUrl: "https://wifi.example" }],
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/security"]}>
          <Routes>
            <Route path="/security" element={<PerspectiveLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Couldn't work out what you can open/)).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByRole("link", { name: /Guest WiFi/ })).toHaveAttribute(
      "href",
      "https://wifi.example",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  // The rail can show links to other apps (they never become a landing's
  // destination). The card offers them instead of saying nothing is open.
  it("offers the rail's links to other apps instead of saying nothing is open", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    visibility.current = {
      ...visibility.current,
      visibleOutbound: [
        { id: "other-app-site", label: "Team Site", externalUrl: "https://site.example" },
        {
          id: "other-app-repo",
          label: "Repo",
          opensInNewTab: true,
          outboundUrl: "https://repo.example",
          onSelect: () => {},
        },
        {
          id: "docs",
          label: "Docs",
          opensInNewTab: true,
          onSelect: () => {
            window.open("https://docs.example", "_blank", "noopener,noreferrer");
          },
        },
      ],
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/security"]}>
          <Routes>
            <Route path="/security" element={<PerspectiveLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByText("Nothing here for you yet")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Only links to other apps here for you" })).toBeInTheDocument();
    const list = screen.getByRole("list");
    const site = within(list).getByRole("link", { name: /Team Site/ });
    expect(site).toHaveAttribute("href", "https://site.example");
    expect(site).toHaveAttribute("target", "_blank");
    // A grouped app with a known address is a real link too, not a button.
    const repo = within(list).getByRole("link", { name: /Repo/ });
    expect(repo).toHaveAttribute("href", "https://repo.example");
    expect(repo).toHaveAttribute("target", "_blank");
    // Only a destination resolved at runtime is a button running its action.
    await userEvent.click(within(list).getByRole("button", { name: /Docs/ }));
    expect(open).toHaveBeenCalledWith("https://docs.example", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  // The same sentence for every perspective, naming only the one it is on.  // The same sentence for every perspective, naming only the one it is on.
  it("names the perspective and nothing else", () => {
    perspective.current = { ...perspective.current, key: "finance", label: "Finance" };
    renderLanding();
    expect(
      screen.getByText(/Finance is here, but none of it is open to you at the moment/),
    ).toBeInTheDocument();
  });
});

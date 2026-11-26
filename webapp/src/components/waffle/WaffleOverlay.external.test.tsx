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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactNode } from "react";

// A perspective that lives in another application. Its URL is read at module
// load, so each case imports the launcher fresh against its own window.config —
// which is also the only way to cover the unconfigured state, the one every
// other suite in this repo runs in.

const CSM_URL = "https://csm.example.test/";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: "me", label: "Me", path: "/me", access: true }),
}));

const setConfig = (config: Record<string, unknown> | undefined) => {
  (window as unknown as { config?: Record<string, unknown> }).config = config;
};

async function loadLauncher(config: Record<string, unknown> | undefined) {
  vi.resetModules();
  setConfig(config);
  const { default: WaffleOverlay } = await import("@components/waffle/WaffleOverlay");
  const favourites = await import("@features/favourites/favouritesStore");
  const landing = await import("@config/landingConfig");
  return { WaffleOverlay, favourites, landing };
}

const openCalls: [string, string, string][] = [];
let realOpen: typeof window.open;

beforeEach(() => {
  localStorage.clear();
  openCalls.length = 0;
  realOpen = window.open;
  window.open = ((url: string, target: string, features: string) => {
    openCalls.push([url, target, features]);
    return null;
  }) as typeof window.open;
});

afterEach(() => {
  window.open = realOpen;
  setConfig(undefined);
});

function show(WaffleOverlay: (p: { anchorEl: HTMLElement; onClose: () => void }) => ReactNode) {
  const onClose = vi.fn();
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  render(
    <MemoryRouter>
      <WaffleOverlay anchorEl={anchor} onClose={onClose} />
    </MemoryRouter>,
  );
  return { onClose };
}

const panel = () => screen.getByRole("dialog", { name: "All apps" });

describe("with only the standalone URL configured", () => {
  it("offers the tile as something that opens in a new tab", async () => {
    const { WaffleOverlay } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    show(WaffleOverlay);

    const tile = within(panel()).getByRole("link", { name: "Open CSM in a new tab" });
    expect(tile).toHaveAttribute("href", CSM_URL);
    expect(tile).toHaveAttribute("target", "_blank");
    // The opened page must not get a handle back on ours.
    expect(tile.getAttribute("rel")).toContain("noopener");
  });

  it("marks it with an outbound badge", async () => {
    const { WaffleOverlay } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    show(WaffleOverlay);

    const tile = within(panel()).getByRole("link", { name: "Open CSM in a new tab" });
    // Two glyphs: the app's own icon and the badge marking it as outbound.
    expect(tile.querySelectorAll("svg").length).toBe(2);
  });

  // The tile IS the mechanism. Calling window.open from its onClick as well
  // opened CSM in two tabs on every click — invisible here until this test,
  // because jsdom does not follow an anchor's href.
  it("leaves the opening to the anchor rather than opening it a second time", async () => {
    const { WaffleOverlay } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    show(WaffleOverlay);

    await userEvent.click(within(panel()).getByRole("link", { name: "Open CSM in a new tab" }));
    expect(openCalls).toHaveLength(0);
  });

  it("still closes the launcher, so it is not left over the new tab", async () => {
    const { WaffleOverlay } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    const { onClose } = show(WaffleOverlay);

    await userEvent.click(within(panel()).getByRole("link", { name: "Open CSM in a new tab" }));
    expect(onClose).toHaveBeenCalled();
  });

  // The corner holds one badge. A star there would offer to favourite an app
  // that favourites cannot resolve, so it appears to work and stores nothing.
  it("offers no favourite star on it", async () => {
    const { WaffleOverlay } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    show(WaffleOverlay);
    expect(
      within(panel()).queryByRole("button", { name: /CSM to favourites/ }),
    ).not.toBeInTheDocument();
  });

  // Both resolve a perspective to a route, and this one has none.
  it("is neither a favourite nor a landing choice", async () => {
    const { favourites, landing } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    expect(favourites.isFavouritable("csm")).toBe(false);
    expect(landing.isLandingKey("csm")).toBe(false);
  });
});

// CSM loaded into this app from its own deployment. The tile then routes like
// any other, whether or not the standalone URL is set as well.
describe("with the remote entry configured", () => {
  const REMOTE = { ONE_WSO2_CSM_REMOTE_ENTRY_URL: "https://csm.example.test/remoteEntry.js" };

  it.each([
    ["on its own", REMOTE],
    ["alongside the standalone URL", { ...REMOTE, ONE_WSO2_CSM_URL: CSM_URL }],
  ])("offers the tile as a switch inside the app, %s", async (_label, config) => {
    const { WaffleOverlay } = await loadLauncher(config);
    show(WaffleOverlay);

    expect(within(panel()).getByRole("button", { name: "Switch to CSM" })).toBeEnabled();
    expect(within(panel()).queryByRole("link", { name: /CSM/ })).not.toBeInTheDocument();
  });

  it("goes to /csm and closes the launcher, opening no tab", async () => {
    const { WaffleOverlay } = await loadLauncher({ ...REMOTE, ONE_WSO2_CSM_URL: CSM_URL });
    const onClose = vi.fn();
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    render(
      <MemoryRouter initialEntries={["/me"]}>
        <Routes>
          <Route path="/csm" element={<div>csm page</div>} />
          <Route path="*" element={<WaffleOverlay anchorEl={anchor} onClose={onClose} />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(within(panel()).getByRole("button", { name: "Switch to CSM" }));
    expect(screen.getByText("csm page")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(openCalls).toHaveLength(0);
  });

  it("can be a favourite and a landing choice, now that there is a route", async () => {
    const { favourites, landing } = await loadLauncher(REMOTE);
    expect(favourites.isFavouritable("csm")).toBe(true);
    expect(landing.landingPathFor("csm")).toBe("/csm");
  });
});

describe("with no URL configured", () => {
  it("leaves the tile in its unbuilt state rather than linking nowhere", async () => {
    const { WaffleOverlay } = await loadLauncher({});
    show(WaffleOverlay);

    expect(
      within(panel()).getByRole("button", { name: "CSM — not available yet" }),
    ).toBeDisabled();
    expect(within(panel()).queryByRole("link", { name: /CSM/ })).not.toBeInTheDocument();
  });

  it("opens nothing when the disabled tile is clicked", async () => {
    const { WaffleOverlay } = await loadLauncher({});
    show(WaffleOverlay);
    await userEvent.click(within(panel()).getByRole("button", { name: "CSM — not available yet" }));
    expect(openCalls).toHaveLength(0);
  });
});

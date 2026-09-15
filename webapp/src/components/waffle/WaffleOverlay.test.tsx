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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import WaffleOverlay from "@components/waffle/WaffleOverlay";
import { readFavourites } from "@features/favourites/favouritesStore";
import { PERSPECTIVES } from "@constants/perspectives";
import { appMark } from "@components/app-marks/appMarkRegistry";

vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));

vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: "me", label: "Me", path: "/me", access: true }),
}));

beforeEach(() => localStorage.clear());

function renderLauncher() {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  render(
    <MemoryRouter>
      <WaffleOverlay anchorEl={anchor} onClose={() => {}} />
    </MemoryRouter>,
  );
  return anchor;
}

/** The panel, so queries don't pick up the anchor or other stray nodes. */
const panel = () => screen.getByRole("dialog", { name: "All apps" });

describe("launcher favourites", () => {
  it("offers a star on an app that can be opened", () => {
    renderLauncher();
    expect(
      within(panel()).getByRole("button", { name: "Add Finance to favourites" }),
    ).toBeInTheDocument();
  });

  it("offers no star on an app that cannot be opened", () => {
    renderLauncher();
    // Named from the registry rather than hardcoded: the previous version named
    // a perspective that has since been removed, so it asserted the absence of
    // something that could not have been there.
    const unopenable = PERSPECTIVES.find((p) => !p.access);
    expect(unopenable, "no unopenable perspective left to check").toBeDefined();
    expect(
      within(panel()).queryByRole("button", {
        name: new RegExp(`${unopenable!.label} to favourites`),
      }),
    ).toBeNull();
    // And it is still offered as a tile, just not as a favourite.
    expect(
      within(panel()).getByRole("button", { name: `${unopenable!.label} — not available yet` }),
    ).toBeInTheDocument();
  });

  it("keeps the star out of the tile button, so the markup stays valid", () => {
    renderLauncher();
    const star = within(panel()).getByRole("button", { name: "Add Finance to favourites" });
    // A <button> inside a <button> is invalid HTML that browsers resolve
    // unpredictably, so the star must be a sibling of the tile.
    expect(star.closest("button")).toBe(star);
  });

  it("shows Favourites from the start, holding Me", () => {
    // Me is a default favourite. The launcher has no "For you" group any more,
    // so this is the only tile for it on a first visit.
    renderLauncher();
    expect(within(panel()).getByRole("heading", { name: "Favourites" })).toBeInTheDocument();
    expect(readFavourites("user-under-test")).toEqual(["me"]);
  });

  it("appends a newly favourited app after the default", () => {
    renderLauncher();
    return userEvent
      .setup()
      .click(within(panel()).getByRole("button", { name: "Add Finance to favourites" }))
      .then(() => {
        expect(readFavourites("user-under-test")).toEqual(["me", "finance"]);
      });
  });

  it("hides the group entirely once the user has removed everything", () => {
    // An empty "Favourites" heading is worse than no heading. This is the case
    // the group's own render guard exists for.
    localStorage.setItem("one-wso2.favourites.v1.user-under-test", JSON.stringify([]));
    renderLauncher();
    expect(within(panel()).queryByRole("heading", { name: "Favourites" })).toBeNull();
  });

  it("shows a favourited app in both Favourites and its own group", () => {
    localStorage.setItem("one-wso2.favourites.v1.user-under-test", JSON.stringify(["finance"]));
    renderLauncher();
    // Two tiles for the same app is the point of a shortcut, not a bug.
    expect(within(panel()).getAllByRole("button", { name: "Switch to Finance" })).toHaveLength(2);
  });

  it("removes a favourite again", async () => {
    localStorage.setItem("one-wso2.favourites.v1.user-under-test", JSON.stringify(["finance"]));
    renderLauncher();
    const remove = within(panel()).getAllByRole("button", {
      name: "Remove Finance from favourites",
    });
    await userEvent.setup().click(remove[0]);
    expect(readFavourites("user-under-test")).toEqual([]);
    expect(within(panel()).queryByRole("heading", { name: "Favourites" })).toBeNull();
  });
});

describe("launcher app marks", () => {
  /**
   * The launcher is meant to look unlike the rail: filled two-tone marks for
   * "this is an app", line icons for "this is somewhere to go". Asserting the
   * mark is present is not enough — a tile rendering BOTH would pass that and
   * still look wrong, so this also pins the line glyph's absence.
   */
  it("draws the filled mark on a tile, not the line glyph", () => {
    renderLauncher();
    const tile = within(panel()).getAllByRole("button", { name: "Switch to People Ops" })[0];
    const mark = tile.querySelector('svg[viewBox="0 0 48 48"]');
    expect(mark, "no app mark on the People Ops tile").not.toBeNull();
    expect(tile.querySelector("svg.lucide")).toBeNull();
  });

  /**
   * Both halves of the documented rule, per perspective: a registered mark
   * replaces the line glyph, and a perspective without one still gets a tile
   * with its glyph. The second half is the part that keeps the fallback real —
   * asserting only the marks would let it rot into unreachable code, and would
   * fail any future perspective that hasn't been drawn a mark yet.
   */
  it("draws a mark where one is registered, and the line glyph where none is", () => {
    renderLauncher();
    for (const p of PERSPECTIVES) {
      // The tile's accessible name says what activating it does, and that differs
      // for an app we host, one we only link to, and one that is not built.
      const name = p.externalUrl
        ? `Open ${p.label} in a new tab`
        : p.access
          ? `Switch to ${p.label}`
          : `${p.label} — not available yet`;
      const tile = within(panel()).getAllByRole(p.externalUrl ? "link" : "button", {
        name,
      })[0];
      const mark = tile.querySelector('svg[viewBox="0 0 48 48"]');
      const glyph = tile.querySelector("svg.lucide");
      if (appMark(p.key)) {
        expect(mark, `${p.label} should show its mark`).not.toBeNull();
        expect(glyph, `${p.label} should not show both`).toBeNull();
      } else {
        expect(mark, `${p.label} has no mark registered`).toBeNull();
        expect(glyph, `${p.label} should fall back to its line glyph`).not.toBeNull();
      }
    }
  });
});

describe("the UMT preview tile", () => {
  const originalConfig = window.config;
  afterEach(() => {
    window.config = originalConfig;
    vi.resetModules();
  });

  // UMT is behind a preview flag applied to the perspective REGISTRY itself
  // (see perspectives.ts), not just `access` — so with the flag off there must
  // be no tile at all, not a disabled "not available yet" one like a
  // perspective that is merely unbuilt (see the "offers no star" test above).
  // Loaded fresh per state, same as financeApps.test.ts, since the registry is
  // a module-level constant derived from `window.config`.
  async function renderWithFlag(umt?: boolean) {
    vi.resetModules();
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { umt },
    } as Window["config"];
    const { default: FreshWaffleOverlay } = await import("@components/waffle/WaffleOverlay");
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    render(
      <MemoryRouter>
        <FreshWaffleOverlay anchorEl={anchor} onClose={() => {}} />
      </MemoryRouter>,
    );
  }

  it("shows no UMT tile when the flag is off", async () => {
    await renderWithFlag(false);
    expect(screen.queryByRole("button", { name: /UMT/ })).toBeNull();
  });

  it("shows no UMT tile on an absent flag either", async () => {
    await renderWithFlag(undefined);
    expect(screen.queryByRole("button", { name: /UMT/ })).toBeNull();
  });

  it("shows a UMT tile when the flag is on", async () => {
    await renderWithFlag(true);
    expect(screen.getByRole("button", { name: "Switch to UMT" })).toBeInTheDocument();
  });
});

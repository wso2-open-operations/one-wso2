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
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";

// The CSM portal lives in another application. It used to be a launcher tile of
// its own and is now the first link of the Customer Success perspective. Its URL
// is read at module load, so each case imports the launcher fresh against its own
// window.config, which is also the only way to cover the unconfigured state.

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

async function customerSuccess(config: Record<string, unknown>) {
  await loadLauncher(config);
  const { PERSPECTIVES } = await import("@constants/perspectives");
  return PERSPECTIVES.find((perspective) => perspective.key === "customer-success");
}

// Each case imports the whole launcher fresh, which can pass the default 5 s
// under a busy full run; it is the import, not the assertions, that is slow.
const FRESH_IMPORT_TIMEOUT = { timeout: 20_000 };

describe("the CSM portal, with its URL configured", FRESH_IMPORT_TIMEOUT, () => {
  it("has no launcher tile of its own any more", async () => {
    const { WaffleOverlay } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    show(WaffleOverlay);

    expect(within(panel()).queryByRole("link", { name: "Open CSM in a new tab" })).not.toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: /^CSM/ })).not.toBeInTheDocument();
  });

  it("is the first link of Customer Success, opening the configured URL", async () => {
    const cs = await customerSuccess({ ONE_WSO2_CSM_URL: CSM_URL });

    expect(cs).toMatchObject({ access: true, path: "/customer-success" });
    expect(cs?.sections?.[0]).toMatchObject({ id: "other-app-csm", label: "CSM Portal", externalUrl: CSM_URL });
  });

  it("is dropped when its URL is not an http(s) address", async () => {
    const cs = await customerSuccess({ ONE_WSO2_CSM_URL: "javascript:alert(1)" });
    expect(cs?.sections?.some((section) => section.id === "other-app-csm")).toBe(false);
  });

  // Both resolve a perspective to a route, and "csm" is no longer one.
  it("is neither a favourite nor a landing choice", async () => {
    const { favourites, landing } = await loadLauncher({ ONE_WSO2_CSM_URL: CSM_URL });
    expect(favourites.isFavouritable("csm")).toBe(false);
    expect(landing.isLandingKey("csm")).toBe(false);
  });
});

describe("the CSM portal, with no URL configured", FRESH_IMPORT_TIMEOUT, () => {
  it("leaves Customer Success unoffered when none of its links has an address", async () => {
    const cs = await customerSuccess({});
    expect(cs?.access).toBe(false);
    expect(cs?.sections ?? []).toEqual([]);
  });

  it("opens nothing", async () => {
    const { WaffleOverlay } = await loadLauncher({});
    show(WaffleOverlay);
    expect(within(panel()).queryByRole("link", { name: /CSM/ })).not.toBeInTheDocument();
    expect(openCalls).toHaveLength(0);
  });
});

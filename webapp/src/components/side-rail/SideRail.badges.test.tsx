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

import type { PerspectiveSection } from "@constants/perspectives";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreditCardIcon, FileTextIcon, LayersIcon, WalletIcon } from "@wso2/oxygen-ui-icons-react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RailBadge } from "./railBadge";

const sections: PerspectiveSection[] = [
  { id: "statements", label: "Statements", icon: FileTextIcon, path: "/finance/statements" },
  {
    id: "sec-app-cc",
    label: "Credit Card Expenses",
    icon: CreditCardIcon,
    children: [
      { id: "cc-new", label: "Pending Submissions", path: "/finance/cc/new" },
      { id: "cc-settings", label: "Card Settings", path: "/finance/cc/settings" },
      { id: "cc-hidden", label: "Hidden", path: "/finance/cc/hidden" },
    ],
  },
  {
    id: "sec-app-solo",
    label: "Solo",
    icon: WalletIcon,
    children: [{ id: "solo-only", label: "Only Screen", path: "/finance/solo" }],
  },
  {
    id: "sec-app-tabs",
    label: "Tabbed",
    icon: LayersIcon,
    inTabs: true,
    path: "/finance/tabbed/a",
    children: [
      { id: "tabs-a", label: "Tab A", path: "/finance/tabbed/a" },
      { id: "tabs-b", label: "Tab B", path: "/finance/tabbed/b" },
    ],
  },
];

vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: "finance", label: "Finance", icon: WalletIcon, sections }),
}));
// Mocked at the hook seams: the real gates and badge sources call a dozen backends that have
// nothing to do with how the rail draws a badge.
vi.mock("./usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({ resolveVisible: (s: PerspectiveSection) => s.id !== "cc-hidden" }),
}));
let badges: Record<string, RailBadge> = {};
vi.mock("./useRailBadges", () => ({
  useRailBadges: () => ({ resolveBadge: (id: string) => badges[id] }),
}));

import SideRail from "./SideRail";

const outdated: RailBadge = { label: "Fix", reason: "A rule is outdated." };
const unconfigured: RailBadge = { label: "Set up", reason: "A rule needs setting up." };
/** The same badges, asking to show on a closed group's row. */
const outdatedOnGroup: RailBadge = { ...outdated, showOnGroup: true };
const unconfiguredOnGroup: RailBadge = { ...unconfigured, showOnGroup: true };

/** Longer, in ms, than MUI waits before opening a tooltip on hover. */
const TOOLTIP_SETTLE_MS = 300;

function renderSideRail(collapsed = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SideRail collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Checks a row shows a badge's label, and gives screen readers its reason. */
function expectBadge(rowEl: HTMLElement, label: string, reason: string) {
  expect(within(rowEl).getByText(label)).toBeTruthy();
  expect(within(rowEl).getByText(reason)).toBeTruthy();
}

/** The rail row (its button) carrying a label. */
function row(label: string): HTMLElement {
  const button = screen.getByText(label).closest<HTMLElement>(".MuiListItemButton-root");
  if (!button) throw new Error(`"${label}" is not inside a rail row.`);
  return button;
}

describe("SideRail badges, with the rail expanded", () => {
  afterEach(() => {
    badges = {};
  });

  it("draws no badge when nothing reports one", () => {
    renderSideRail();
    expect(document.querySelector(".MuiChip-root")).toBeNull();
  });

  it("shows a top-level row's badge on that row, named by its reason", () => {
    badges = { statements: outdated };
    renderSideRail();
    expectBadge(row("Statements"), "Fix", "A rule is outdated.");
  });

  it("shows no badge on a closed group's header unless a child's badge asks for it", () => {
    badges = { "cc-settings": outdated };
    renderSideRail();
    expect(document.querySelector(".MuiChip-root")).toBeNull();
  });

  it("marks a closed group's header with a dot, telling screen readers it needs attention", () => {
    badges = { "cc-settings": outdatedOnGroup };
    renderSideRail();
    const header = row("Credit Card Expenses");
    expect(header.querySelector(".MuiChip-root")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Credit Card Expenses Needs attention." })).toBe(header);
  });

  it("gives a group's dot no hover text, leaving the reasons to the rows inside", async () => {
    badges = { "cc-new": unconfiguredOnGroup, "cc-settings": outdatedOnGroup };
    renderSideRail();
    const dot = row("Credit Card Expenses").querySelector<HTMLElement>(".MuiChip-root");
    if (!dot) throw new Error("The group has no dot.");
    await userEvent.hover(dot);

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(within(row("Credit Card Expenses")).queryByText(/A rule/)).toBeNull();
  });

  it("moves the badge from the header to the child row once the group is opened", async () => {
    badges = { "cc-settings": outdatedOnGroup };
    renderSideRail();
    await userEvent.click(row("Credit Card Expenses"));

    expectBadge(row("Card Settings"), "Fix", "A rule is outdated.");
    expect(row("Credit Card Expenses").querySelector(".MuiChip-root")).toBeNull();
  });

  it("ignores the badge of a child the person can't see", () => {
    badges = { "cc-hidden": outdatedOnGroup };
    renderSideRail();
    expect(document.querySelector(".MuiChip-root")).toBeNull();
  });

  it("shows a lone child's badge on the row its group collapses to", () => {
    badges = { "solo-only": unconfigured };
    renderSideRail();
    expectBadge(row("Solo"), "Set up", "A rule needs setting up.");
  });

  it("shows the lone child's badge, not the group's own, on the row its group collapses to", () => {
    badges = { "sec-app-solo": outdated, "solo-only": unconfigured };
    renderSideRail();
    expectBadge(row("Solo"), "Set up", "A rule needs setting up.");
  });

  it("shows a tabbed app's own badge on its row", () => {
    badges = { "sec-app-tabs": unconfigured };
    renderSideRail();
    expectBadge(row("Tabbed"), "Set up", "A rule needs setting up.");
  });

  it("leaves a tab's badge to the tab bar, off the app's row", () => {
    badges = { "tabs-b": unconfigured };
    renderSideRail();
    expect(row("Tabbed").querySelector(".MuiChip-root")).toBeNull();
  });

  it("gives a badge without a reason no hover text, naming the row by the label alone", async () => {
    badges = { statements: { label: "12" } };
    renderSideRail();
    await userEvent.hover(screen.getByText("12"));
    // Past MUI's delay before a tooltip opens, so an absent tooltip means there is none.
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_SETTLE_MS));

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: "Statements 12" })).toBeTruthy();
  });

  it("keeps the pill's label in the row's name while the reason shows on hover", async () => {
    badges = { statements: outdated };
    renderSideRail();
    await userEvent.hover(screen.getByText("Fix"));
    await screen.findByRole("tooltip");

    expect(screen.getByRole("button", { name: "Statements Fix A rule is outdated." })).toBeTruthy();
  });
});

// Oxygen draws no Sidebar.ItemBadge on a collapsed rail, and names each row by its label alone.
describe("SideRail badges, with the rail collapsed", () => {
  afterEach(() => {
    badges = {};
  });

  it("names a top-level row with its badge's reason, for hover and screen readers", () => {
    badges = { statements: outdated };
    renderSideRail(true);
    expect(screen.getByRole("button", { name: "Statements (A rule is outdated.)" })).toBeTruthy();
  });

  it("names a row whose badge has no reason by its label alone, and still marks its icon", () => {
    badges = { statements: { label: "12" } };
    renderSideRail(true);
    const button = screen.getByRole("button", { name: "Statements" });
    expect(button.querySelector(".MuiBadge-dot")).not.toBeNull();
  });

  it("marks a top-level row's icon with a dot, at the size of every other icon", () => {
    badges = { statements: outdated };
    renderSideRail(true);
    const button = screen.getByRole("button", { name: /^Statements/ });
    expect(button.querySelector(".MuiBadge-dot")).not.toBeNull();
    expect(button.querySelector("svg")?.getAttribute("width")).toBe("20");
  });

  it("names a group as needing attention, and marks its icon", () => {
    badges = { "cc-settings": outdatedOnGroup, "cc-new": unconfiguredOnGroup };
    renderSideRail(true);
    const button = screen.getByRole("button", { name: "Credit Card Expenses (Needs attention.)" });
    expect(button.querySelector(".MuiBadge-dot")).not.toBeNull();
  });

  it("marks the badged rows in a group's popup", async () => {
    badges = { "cc-settings": outdated };
    renderSideRail(true);
    // Hovering opens Oxygen's popup; a click after the hover would toggle it shut again.
    await userEvent.hover(screen.getByRole("button", { name: /^Credit Card Expenses/ }));

    const settings = await screen.findByRole("menuitem", { name: /Card Settings$/ });
    expect(settings.querySelector(".MuiBadge-dot")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Pending Submissions" }).querySelector(".MuiBadge-dot")).toBeNull();
  });

  // Oxygen names a popup entry by its icon and label alone, so the dot's text goes with the icon.
  it("reads a badged row's reason in a group's popup", async () => {
    badges = { "cc-settings": outdated };
    renderSideRail(true);
    await userEvent.hover(screen.getByRole("button", { name: /^Credit Card Expenses/ }));

    expect(await screen.findByRole("menuitem", { name: "A rule is outdated. Card Settings" })).toBeTruthy();
  });

  it("reads the label of a badge without a reason in a group's popup", async () => {
    badges = { "cc-new": { label: "5" } };
    renderSideRail(true);
    await userEvent.hover(screen.getByRole("button", { name: /^Credit Card Expenses/ }));

    expect(await screen.findByRole("menuitem", { name: "5 Pending Submissions" })).toBeTruthy();
  });
});

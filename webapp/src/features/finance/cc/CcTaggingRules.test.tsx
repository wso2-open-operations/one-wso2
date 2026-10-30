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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CcTaggingRule } from "./ccTypes";

const rule = (over: Partial<CcTaggingRule> = {}): CcTaggingRule => ({
  id: 1,
  creditCardId: 10,
  ccNumber: "123456",
  employeeEmail: "jane@wso2.com",
  supplier: "Uber",
  account: null,
  amountMin: null,
  amountMax: null,
  expenseCategoryLabel: "Office",
  expenseTypeLabel: "Taxi",
  comment: "Client visit",
  subRegion: null,
  productUnit: "IAM",
  businessUnit: "Products",
  source: "manual",
  active: true,
  outdated: false,
  ...over,
});

const blank = {
  expenseCategoryLabel: null,
  expenseTypeLabel: null,
  comment: null,
  productUnit: null,
  businessUnit: null,
};

const state = {
  rules: [] as CcTaggingRule[],
  loading: false,
  fails: false,
  refetches: 0,
};

vi.mock("./useCc", () => ({
  useCcTaggingRules: () => ({
    data: state.loading || state.fails ? undefined : state.rules,
    isLoading: state.loading,
    isError: state.fails,
    isFetching: false,
    error: state.fails ? new Error("Gateway timeout") : null,
    refetch: () => {
      state.refetches += 1;
    },
  }),
}));

const { CcTaggingRules } = await import("./CcTaggingRules");

const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
const renderList = () => render(<CcTaggingRules {...handlers} />);

/** The supplier of each rule row, top to bottom. */
const suppliers = () =>
  screen
    .getAllByRole("row")
    .map((row) => within(row).queryAllByRole("cell")[1]?.textContent)
    .filter(Boolean);

/** The text of each group heading, top to bottom. */
const headings = () => screen.queryAllByRole("button", { expanded: true }).map((b) => b.textContent);

beforeEach(() => {
  state.rules = [];
  state.loading = false;
  state.fails = false;
  state.refetches = 0;
  vi.clearAllMocks();
});

describe("CcTaggingRules", () => {
  it("lists unconfigured rules first, then outdated, then the rest", () => {
    state.rules = [
      rule({ id: 1, supplier: "AWS" }),
      rule({ id: 2, supplier: "GitHub", outdated: true }),
      rule({ id: 3, supplier: "Uber", source: "auto", ...blank }),
    ];
    renderList();

    expect(headings()).toEqual([
      expect.stringContaining("Unconfigured rules · 1"),
      expect.stringContaining("Outdated rules · 1"),
      expect.stringContaining("Rules · 1"),
    ]);
    expect(suppliers()).toEqual(["Uber", "GitHub", "AWS"]);
  });

  it("sorts each group by card, supplier and account", () => {
    state.rules = [
      rule({ id: 1, supplier: "Uber", account: "acc-1" }),
      rule({ id: 2, supplier: "Uber" }),
      rule({ id: 3, supplier: "AWS" }),
      rule({ id: 4, supplier: "Zoom", creditCardId: 11, ccNumber: "045678" }),
    ];
    renderList();

    expect(suppliers()).toEqual(["Zoom", "AWS", "Uber", "Uber"]);
    expect(screen.getAllByRole("cell", { name: "acc-1" })).toHaveLength(1);
    expect(within(screen.getAllByRole("row")[5]).getAllByRole("cell")[2]).toHaveTextContent("acc-1");
  });

  it("files inactive rules under Rules whatever their flags", () => {
    state.rules = [
      rule({ id: 1, supplier: "GitHub", outdated: true, active: false }),
      rule({ id: 2, supplier: "Uber", active: false, ...blank }),
    ];
    renderList();

    expect(headings()).toEqual([expect.stringContaining("Rules · 2")]);
    expect(suppliers()).toEqual(["GitHub", "Uber"]);
  });

  it("folds a group away from its heading", async () => {
    state.rules = [rule({ supplier: "Uber", ...blank }), rule({ id: 2, supplier: "AWS" })];
    renderList();

    await userEvent.click(screen.getByRole("button", { name: /Unconfigured rules/ }));

    expect(suppliers()).toEqual(["AWS"]);
  });

  it("shows each rule's card, match and source", () => {
    state.rules = [rule({ account: "acme-prod", amountMin: 10, amountMax: 1500.5, source: "auto" })];
    renderList();

    const cells = within(screen.getAllByRole("row")[2]).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "123456",
      "Uber",
      "acme-prod",
      "10.00 – 1,500.50",
      "System",
      "Active",
      "",
    ]);
  });

  it("shows open values as a dash, and a manual rule as yours", () => {
    state.rules = [rule({ active: false })];
    renderList();

    const cells = within(screen.getAllByRole("row")[2]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(2, 6)).toEqual(["—", "—", "You", "Inactive"]);
  });

  it("shows a blank account as a dash too", () => {
    state.rules = [rule({ account: "" })];
    renderList();

    expect(within(screen.getAllByRole("row")[2]).getAllByRole("cell")[2]).toHaveTextContent("—");
  });

  // The minimum is inclusive and the maximum exclusive.
  it.each([
    [{ amountMin: 10 }, "≥ 10.00"],
    [{ amountMax: 100 }, "< 100.00"],
    [{ amountMin: 0, amountMax: 0.5 }, "0.00 – 0.50"],
  ])("shows an amount range of %o as %s", (amounts, shown) => {
    state.rules = [rule(amounts)];
    renderList();

    expect(within(screen.getAllByRole("row")[2]).getAllByRole("cell")[3]).toHaveTextContent(shown);
  });

  // Sized by the rows shown, the columns would move each time a group is folded or opened.
  it("keeps the column widths fixed, whichever groups are folded", async () => {
    state.rules = [rule({ supplier: "Uber", ...blank }), rule({ id: 2, supplier: "AWS" })];
    const { container } = renderList();
    const widths = () => [...container.querySelectorAll("col")].map((c) => c.style.width);

    const open = widths();
    await userEvent.click(screen.getByRole("button", { name: /Unconfigured rules/ }));

    expect(getComputedStyle(screen.getByRole("table")).tableLayout).toBe("fixed");
    expect(open).toHaveLength(7);
    expect(open.every(Boolean)).toBe(true);
    expect(widths()).toEqual(open);
  });

  it("offers Configure on unconfigured rules and Edit on the rest", async () => {
    const unconfigured = rule({ id: 1, supplier: "Uber", ...blank });
    const configured = rule({ id: 2, supplier: "AWS" });
    state.rules = [unconfigured, configured];
    renderList();

    expect(screen.queryByRole("button", { name: "Edit rule for Uber" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configure rule for AWS" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Configure rule for Uber" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit rule for AWS" }));

    expect(handlers.onEdit.mock.calls).toEqual([[unconfigured], [configured]]);
  });

  it("offers Edit, not Configure, on an inactive rule that fills in nothing", () => {
    state.rules = [rule({ supplier: "Uber", active: false, ...blank })];
    renderList();

    expect(screen.getByRole("button", { name: "Edit rule for Uber" })).toBeInTheDocument();
  });

  it("disables Delete on system rules", async () => {
    const manual = rule({ id: 1, supplier: "AWS" });
    state.rules = [manual, rule({ id: 2, supplier: "Uber", source: "auto" })];
    renderList();

    const locked = screen.getByRole("button", { name: "Delete rule for Uber" });
    expect(locked).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(locked);
    await userEvent.click(screen.getByRole("button", { name: "Delete rule for AWS" }));
    expect(handlers.onDelete.mock.calls).toEqual([[manual]]);
  });

  // Reachable by keyboard, so the reason isn't for mouse users only.
  it("says why a system rule can't be deleted, from the keyboard too", async () => {
    state.rules = [rule({ supplier: "Uber", source: "auto" })];
    renderList();
    const locked = screen.getByRole("button", { name: "Delete rule for Uber" });

    for (let i = 0; i < 10 && document.activeElement !== locked; i++) await userEvent.tab();

    // jsdom can't match :focus-visible, so the tooltip itself won't open here; the description is what it reads.
    expect(locked).toHaveFocus();
    expect(locked).toHaveAccessibleDescription("System rules can only be switched off.");
  });

  it("tints rows that need attention, unconfigured and outdated apart", () => {
    state.rules = [rule({ id: 1, supplier: "Uber", ...blank }), rule({ id: 2, supplier: "AWS", outdated: true })];
    state.rules.push(rule({ id: 3, supplier: "GitHub" }));
    renderList();

    const edge = (supplier: string) =>
      getComputedStyle(screen.getByRole("cell", { name: supplier }).previousElementSibling as Element).boxShadow;
    expect(edge("Uber")).toMatch(/^inset 3px 0 0 /);
    expect(edge("AWS")).toMatch(/^inset 3px 0 0 /);
    expect(edge("Uber")).not.toBe(edge("AWS"));
    expect(edge("GitHub")).toBe("");
  });

  it("offers Add Rule even when there are no rules", async () => {
    renderList();

    expect(screen.getByText("No rules yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add Rule" }));
    expect(handlers.onAdd).toHaveBeenCalledOnce();
  });

  it("shows Retry, not an empty list, when the rules fail to load", async () => {
    state.fails = true;
    renderList();

    expect(screen.queryByText("No rules yet.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(state.refetches).toBe(1);
  });

  it("shows a placeholder, and still Add Rule, while the rules load", () => {
    state.loading = true;
    const { container } = renderList();

    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No rules yet.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Rule" })).toBeInTheDocument();
  });
});

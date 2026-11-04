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

import { HttpError } from "@api/http";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CcTaggingRule } from "../ccTypes";

const rule: CcTaggingRule = {
  id: 7,
  creditCardId: 10,
  ccNumber: "123456",
  employeeEmail: "jane@wso2.com",
  supplier: "GitHub",
  account: "wso2",
  amountMin: 10,
  amountMax: 1500.5,
  expenseCategoryLabel: "Software",
  expenseTypeLabel: "Subscriptions",
  comment: "Team plan",
  subRegion: null,
  productUnit: "Integration",
  businessUnit: "Platform",
  source: "manual",
  active: true,
  outdated: false,
};

let result: { data?: CcTaggingRule; isPending: boolean; isError: boolean; error: Error | null };
const loaded: number[] = [];

vi.mock("../useCc", () => ({
  useCcTaggingRule: (id: number, enabled = true) => {
    if (enabled) loaded.push(id);
    return result;
  },
}));

const { CcAutoTaggedIcon } = await import("./CcAutoTaggedIcon");

beforeEach(() => {
  result = { data: rule, isPending: false, isError: false, error: null };
  loaded.length = 0;
});

const icon = () => screen.getByLabelText("Transaction 3 was filled by a rule");

async function openTooltip() {
  render(<CcAutoTaggedIcon txnId={3} ruleId={7} />);
  await userEvent.hover(icon());
  return screen.findByRole("tooltip");
}

describe("CcAutoTaggedIcon", () => {
  it("loads the rule only when the tooltip opens", async () => {
    render(<CcAutoTaggedIcon txnId={3} ruleId={7} />);
    expect(loaded).toEqual([]);

    await userEvent.hover(icon());
    await screen.findByRole("tooltip");
    expect(loaded).toContain(7);
  });

  it("opens from the keyboard", async () => {
    // jsdom can't match :focus-visible, which a browser does for a tabbed-to element, so it's matched here.
    const matches = Element.prototype.matches;
    const spy = vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector) {
      return selector === ":focus-visible" ? this === document.activeElement : matches.call(this, selector);
    });
    try {
      render(<CcAutoTaggedIcon txnId={3} ruleId={7} />);
      await userEvent.tab();
      expect(icon()).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Filled by rule");
    } finally {
      spy.mockRestore();
    }
  });

  it("can be left out of the tab order, for a grid that moves focus itself", () => {
    render(<CcAutoTaggedIcon txnId={3} ruleId={7} tabIndex={-1} />);
    expect(icon()).toHaveAttribute("tabindex", "-1");
  });

  it("shows what the rule matches and the details it fills in", async () => {
    const tip = await openTooltip();
    expect(within(tip).getByText("Filled by rule")).toBeInTheDocument();
    for (const [term, value] of [
      ["Card", "123456"],
      ["Supplier", "GitHub"],
      ["Account", "wso2"],
      ["Amount Range ($)", "10.00 – 1,500.50"],
      ["Expense Category", "Software"],
      ["Expense Type", "Subscriptions"],
      ["Comment", "Team plan"],
      ["Product Unit", "Integration"],
      ["Business Unit", "Platform"],
    ]) {
      expect(within(tip).getByText(term).nextElementSibling).toHaveTextContent(value);
    }
  });

  it("leaves out what the rule doesn't set", async () => {
    result.data = { ...rule, amountMin: null, amountMax: null, subRegion: null };
    const tip = await openTooltip();
    for (const term of ["Amount Range ($)", "Sub Region"]) {
      expect(within(tip).queryByText(term)).not.toBeInTheDocument();
    }
  });

  it("shows a rule without an account as matching none", async () => {
    // A rule without an account matches only bills that show none, so it's a condition, not a field left out.
    result.data = { ...rule, account: null };
    const tip = await openTooltip();
    const none = within(tip).getByText("(none)");
    expect(within(tip).getByText("Account").nextElementSibling).toContainElement(none);
    expect(none).toHaveStyle({ fontStyle: "italic" });
  });

  it.each([
    [{ active: false }, "Filled by rule (now inactive)"],
    [{ outdated: true }, "Filled by rule (now outdated)"],
    [{ active: false, outdated: true }, "Filled by rule (now inactive, outdated)"],
  ])("notes a rule that is %o now", async (state, heading) => {
    result.data = { ...rule, ...state };
    const tip = await openTooltip();
    expect(within(tip).getByText(heading)).toBeInTheDocument();
  });

  it("says so while the rule loads", async () => {
    result = { isPending: true, isError: false, error: null };
    expect(await openTooltip()).toHaveTextContent("Loading the rule…");
  });

  it("says the rule was deleted on a 404", async () => {
    result = { isPending: false, isError: true, error: new HttpError("/tagging-rules/7", 404, "") };
    expect(await openTooltip()).toHaveTextContent("Filled by a rule that has since been deleted.");
  });

  it("explains any other failure", async () => {
    result = { isPending: false, isError: true, error: new Error("Gateway timeout") };
    expect(await openTooltip()).toHaveTextContent("Gateway timeout");
  });
});

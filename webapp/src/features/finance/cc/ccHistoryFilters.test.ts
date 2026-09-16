/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it } from "vitest";
import {
  ALL,
  CC_HISTORY_DEFAULTS,
  ccHistoryActiveFilters,
  ccHistoryCardOptions,
  ccHistoryCardOptions as cardOptions,
  ccHistoryChipLabel,
  ccHistoryClear,
  ccHistoryFieldsShown,
  ccHistoryResetAll,
  type CcHistoryFilterState,
} from "./ccHistoryFilters";

const FINANCE = { canSeeOthers: true, isFinance: true };
const LEAD = { canSeeOthers: true, isFinance: false };
const EMPLOYEE = { canSeeOthers: false, isFinance: false };

const base = (over: Partial<CcHistoryFilterState> = {}): CcHistoryFilterState => ({
  ...CC_HISTORY_DEFAULTS,
  ...over,
});

// HistoryFilterPopover.tsx:172,223 — two of the five fields come and go.
describe("which filters are offered", () => {
  it("always offers status and card", () => {
    const shown = ccHistoryFieldsShown(base(), EMPLOYEE);
    expect(shown.status).toBe(true);
    expect(shown.card).toBe(true);
  });

  it("offers user only to someone who can see other people", () => {
    expect(ccHistoryFieldsShown(base(), LEAD).user).toBe(true);
    expect(ccHistoryFieldsShown(base(), EMPLOYEE).user).toBe(false);
  });

  it("offers lead to finance alone", () => {
    expect(ccHistoryFieldsShown(base(), FINANCE).lead).toBe(true);
    // A lead filtering by lead could only ever pick themselves.
    expect(ccHistoryFieldsShown(base(), LEAD).lead).toBe(false);
  });

  it("offers lead only where a row could have one worth filtering by", () => {
    expect(ccHistoryFieldsShown(base({ status: "submitted" }), FINANCE).lead).toBe(true);
    expect(ccHistoryFieldsShown(base({ status: "pending_finance" }), FINANCE).lead).toBe(true);
    expect(ccHistoryFieldsShown(base({ status: "pending_lead" }), FINANCE).lead).toBe(false);
    expect(ccHistoryFieldsShown(base({ status: "new" }), FINANCE).lead).toBe(false);
  });

  it("offers the period only on the default status", () => {
    expect(ccHistoryFieldsShown(base({ status: "submitted" }), FINANCE).period).toBe(true);
    expect(ccHistoryFieldsShown(base({ status: "pending_lead" }), FINANCE).period).toBe(false);
  });
});

// :67-78 — a filter counts only when it is off its default.
describe("what counts as narrowing the list", () => {
  it("counts nothing when everything is at its default", () => {
    expect(ccHistoryActiveFilters(base(), FINANCE)).toEqual([]);
  });

  it("counts a status that is not the default", () => {
    expect(ccHistoryActiveFilters(base({ status: "pending_lead" }), FINANCE)).toContain("Status");
  });

  it("counts a period that is not seven days", () => {
    expect(ccHistoryActiveFilters(base({ days: 30 }), FINANCE)).toContain("Period");
  });

  it("does not count a period while its own field is hidden", () => {
    // The control and its chip are hidden together, even though the window it
    // set is still the one the request uses.
    const state = base({ status: "pending_lead", days: 30 });
    expect(ccHistoryActiveFilters(state, FINANCE)).not.toContain("Period");
  });

  it("does not count a lead a non-finance viewer cannot even set", () => {
    const state = base({ lead: "someone@wso2.com" });
    expect(ccHistoryActiveFilters(state, LEAD)).not.toContain("Lead");
    expect(ccHistoryActiveFilters(state, FINANCE)).toContain("Lead");
  });

  it("does not count a user a plain employee cannot even set", () => {
    const state = base({ user: "someone@wso2.com" });
    expect(ccHistoryActiveFilters(state, EMPLOYEE)).not.toContain("User");
  });

  it("lists them in the source's order", () => {
    const state = base({ status: "submitted", lead: "l@x", user: "u@x", card: "1111", days: 30 });
    expect(ccHistoryActiveFilters(state, FINANCE)).toEqual(["Lead", "User", "Card", "Period"]);
  });
});

// :96-111 — a chip prints the label, not the stored value.
describe("what a chip says", () => {
  it("names the period rather than its day count", () => {
    expect(ccHistoryChipLabel("Period", base({ days: 30 }))).toBe("Period: Last 30 Days");
  });

  it("names the status rather than its enum", () => {
    expect(ccHistoryChipLabel("Status", base({ status: "pending_lead" }))).toBe("Status: Pending Lead");
    // The source's own words for the two that are not obvious.
    expect(ccHistoryChipLabel("Status", base({ status: "new" }))).toBe("Status: Pending Submission");
    expect(ccHistoryChipLabel("Status", base({ status: "submitted" }))).toBe("Status: Completed");
  });

  it("prints the value for the three that are already readable", () => {
    expect(ccHistoryChipLabel("User", base({ user: "u@wso2.com" }))).toBe("User: u@wso2.com");
    expect(ccHistoryChipLabel("Lead", base({ lead: "l@wso2.com" }))).toBe("Lead: l@wso2.com");
    expect(ccHistoryChipLabel("Card", base({ card: "1111" }))).toBe("Card: 1111");
  });
});

// :245-262 — one chip clears one filter.
describe("clearing", () => {
  it("puts a filter back to its default and touches nothing else", () => {
    expect(ccHistoryClear("Period")).toEqual({ days: 7 });
    expect(ccHistoryClear("Status")).toEqual({ status: "submitted" });
    expect(ccHistoryClear("User")).toEqual({ user: ALL });
    expect(ccHistoryClear("Card")).toEqual({ card: ALL });
    expect(ccHistoryClear("Lead")).toEqual({ lead: ALL });
  });

  it("clears exactly one key, so a caller cannot lose a filter it did not name", () => {
    expect(Object.keys(ccHistoryClear("Card"))).toEqual(["card"]);
  });

  it("resets every filter at once", () => {
    const state = base({ status: "new", lead: "l@x", user: "u@x", card: "1111", days: 365 });
    expect(ccHistoryResetAll()).toEqual(CC_HISTORY_DEFAULTS);
    expect(ccHistoryActiveFilters({ ...state, ...ccHistoryResetAll() }, FINANCE)).toEqual([]);
  });
});

// :200-221 — the card options are that person's, and say when one is closed.
describe("the card options", () => {
  const cards = [
    { ccNumber: "1111", employeeEmail: "a@wso2.com", status: "Active" },
    { ccNumber: "2222", employeeEmail: "a@wso2.com", status: "Inactive" },
    { ccNumber: "3333", employeeEmail: "b@wso2.com", status: "ACTIVE" },
  ];

  it("offers every card when nobody is selected", () => {
    expect(cardOptions(cards, ALL).map((c) => c.value)).toEqual(["1111", "2222", "3333"]);
  });

  it("narrows to the selected person's cards", () => {
    expect(cardOptions(cards, "b@wso2.com").map((c) => c.value)).toEqual(["3333"]);
  });

  it("marks a card that has been closed", () => {
    const labels = cardOptions(cards, ALL).map((c) => c.label);
    expect(labels).toContain("2222 (Inactive)");
    expect(labels).toContain("1111");
  });

  it("reads the status case-insensitively, as the backend sends it either way", () => {
    // "ACTIVE" must not be mistaken for a closed card.
    expect(cardOptions(cards, ALL).find((c) => c.value === "3333")?.label).toBe("3333");
  });

  it("keeps the value bare, so the filter never has to strip the suffix back off", () => {
    expect(ccHistoryCardOptions(cards, ALL).find((c) => c.label.includes("Inactive"))?.value).toBe("2222");
  });

  it("offers a card once however many transactions are on it", () => {
    const dupes = [...cards, { ccNumber: "1111", employeeEmail: "a@wso2.com", status: "Active" }];
    expect(cardOptions(dupes, ALL).filter((c) => c.value === "1111")).toHaveLength(1);
  });
});

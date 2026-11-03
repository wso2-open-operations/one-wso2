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

import { describe, expect, it } from "vitest";
import {
  type CcRuleFilters,
  filterRules,
  groupRules,
  NO_RULE_FILTERS,
  ruleFilterCount,
  ruleFilterOptions,
  sortRules,
} from "./ccTaggingRuleList";
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

const unconfigured = (over: Partial<CcTaggingRule> = {}) =>
  rule({
    expenseCategoryLabel: null,
    expenseTypeLabel: null,
    comment: null,
    productUnit: null,
    businessUnit: null,
    source: "auto",
    ...over,
  });

describe("groupRules", () => {
  it("files active rules that fill in nothing as unconfigured", () => {
    const r = unconfigured();
    expect(groupRules([r])).toEqual({ unconfigured: [r], outdated: [], rules: [] });
  });

  it("files active configured rules with values no longer offered as outdated", () => {
    const r = rule({ outdated: true });
    expect(groupRules([r])).toEqual({ unconfigured: [], outdated: [r], rules: [] });
  });

  it("files inactive rules under rules whatever their flags", () => {
    const off = [unconfigured({ id: 1, active: false }), rule({ id: 2, outdated: true, active: false })];
    expect(groupRules(off)).toEqual({ unconfigured: [], outdated: [], rules: off });
  });

  it("keeps the ID order within a group", () => {
    const rules = [rule({ id: 1 }), unconfigured({ id: 2 }), rule({ id: 3 }), unconfigured({ id: 4 })];
    const groups = groupRules(rules);
    expect(groups.rules.map((r) => r.id)).toEqual([1, 3]);
    expect(groups.unconfigured.map((r) => r.id)).toEqual([2, 4]);
  });
});

describe("sortRules", () => {
  it("orders rules by card number, then supplier, then account, ignoring case", () => {
    const rules = [
      rule({ id: 1, supplier: "uber", account: "b" }),
      rule({ id: 2, supplier: "AWS" }),
      rule({ id: 3, supplier: "Uber", account: "A" }),
      rule({ id: 4, supplier: "Zoom", ccNumber: "045678" }),
    ];
    expect(sortRules(rules).map((r) => r.id)).toEqual([4, 2, 3, 1]);
  });

  it("puts a rule without an account before those with one", () => {
    const rules = [rule({ id: 1, account: "acc-1" }), rule({ id: 2, account: null })];
    expect(sortRules(rules).map((r) => r.id)).toEqual([2, 1]);
  });

  it("keeps the given order of rules that tie, and leaves the list given as it was", () => {
    const rules = [rule({ id: 2 }), rule({ id: 1 }), rule({ id: 3, supplier: "AWS" })];
    expect(sortRules(rules).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(rules.map((r) => r.id)).toEqual([2, 1, 3]);
  });
});

/** Filters with inactive rules shown, so each test sees every rule its filter keeps. */
const filters = (over: Partial<CcRuleFilters>): CcRuleFilters => ({ ...NO_RULE_FILTERS, showInactive: true, ...over });
const ids = (rules: CcTaggingRule[]) => rules.map((r) => r.id);

describe("filterRules", () => {
  const rules = [
    rule({ id: 1, supplier: "Uber", account: "acme-prod", comment: "Client visit" }),
    rule({
      id: 2,
      supplier: "GitHub",
      ccNumber: "654321",
      expenseCategoryLabel: "Software",
      expenseTypeLabel: "SaaS",
      comment: "Team tools",
    }),
    rule({ id: 3, supplier: "AWS", source: "auto", active: false, comment: null }),
  ];

  it("keeps every rule with no filters", () => {
    expect(ids(filterRules(rules, filters({})))).toEqual([1, 2, 3]);
  });

  it("hides inactive rules unless they're asked for", () => {
    expect(NO_RULE_FILTERS.showInactive).toBe(false);
    expect(ids(filterRules(rules, NO_RULE_FILTERS))).toEqual([1, 2]);
  });

  it.each([
    ["the supplier", "github", [2]],
    ["the account", "ACME", [1]],
    ["the card number", "6543", [2]],
    ["the expense category", "software", [2]],
    ["the expense type", "saas", [2]],
    ["the comment", "client", [1]],
  ])("searches %s, ignoring case", (_, search, expected) => {
    expect(ids(filterRules(rules, filters({ search })))).toEqual(expected);
  });

  it("ignores spaces around the search", () => {
    expect(ids(filterRules(rules, filters({ search: "  uber " })))).toEqual([1]);
  });

  it("filters by card, category and who added the rule, all together", () => {
    expect(ids(filterRules(rules, filters({ card: "123456" })))).toEqual([1, 3]);
    expect(ids(filterRules(rules, filters({ category: "Software" })))).toEqual([2]);
    expect(ids(filterRules(rules, filters({ addedBy: "auto" })))).toEqual([3]);
    expect(ids(filterRules(rules, filters({ card: "123456", addedBy: "manual" })))).toEqual([1]);
  });
});

describe("ruleFilterCount", () => {
  it("counts the filters that narrow the list, not the search or Show inactive", () => {
    expect(ruleFilterCount(NO_RULE_FILTERS)).toBe(0);
    expect(ruleFilterCount(filters({ search: "uber", card: "123456", addedBy: "auto" }))).toBe(2);
  });
});

describe("ruleFilterOptions", () => {
  // Built from the rules, so a filter never offers a value with nothing behind it.
  it("offers each card and category the rules have, once and sorted", () => {
    const rules = [
      rule({ ccNumber: "654321", expenseCategoryLabel: "Software" }),
      rule({ ccNumber: "123456", expenseCategoryLabel: null }),
      rule({ ccNumber: "654321", expenseCategoryLabel: "Office" }),
    ];
    expect(ruleFilterOptions(rules, NO_RULE_FILTERS)).toEqual({
      cards: ["123456", "654321"],
      categories: ["Office", "Software"],
    });
  });

  // Otherwise a filter whose last rule is gone would narrow the list from a select that shows nothing.
  it("keeps offering a card or category still filtered on after its rules are gone", () => {
    const rules = [rule({ ccNumber: "123456", expenseCategoryLabel: "Office" })];
    expect(ruleFilterOptions(rules, filters({ card: "999999", category: "Travel" }))).toEqual({
      cards: ["123456", "999999"],
      categories: ["Office", "Travel"],
    });
  });
});

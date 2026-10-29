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
  type CcRuleForm,
  type CcRuleMenus,
  emptyRuleForm,
  groupRules,
  isActiveOnly,
  outdatedFields,
  ruleDetailFields,
  ruleFormErrors,
  rulePatch,
  ruleToForm,
  toRuleInput,
} from "./ccTaggingRuleForm";
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

const form = (over: Partial<CcRuleForm> = {}): CcRuleForm => ({ ...ruleToForm(rule()), ...over });

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

describe("the rule form", () => {
  it("starts empty and active, on the given card", () => {
    expect(emptyRuleForm("123456")).toEqual({
      ccNumber: "123456",
      supplier: "",
      account: "",
      amountMin: "",
      amountMax: "",
      expenseCategoryLabel: "",
      expenseTypeLabel: "",
      comment: "",
      subRegion: "",
      productUnit: "",
      businessUnit: "",
      active: true,
    });
  });

  it("holds a rule's empty values as blank text and its amounts as text", () => {
    const f = ruleToForm(rule({ amountMin: 10.5, amountMax: 100 }));
    expect(f.account).toBe("");
    expect(f.subRegion).toBe("");
    expect(f.amountMin).toBe("10.5");
    expect(f.amountMax).toBe("100");
  });
});

describe("toRuleInput", () => {
  it("trims text and sends blanks as null", () => {
    expect(toRuleInput(form({ supplier: " Uber ", account: "  ", comment: "" }))).toEqual({
      ccNumber: "123456",
      supplier: "Uber",
      account: null,
      amountMin: null,
      amountMax: null,
      expenseCategoryLabel: "Office",
      expenseTypeLabel: "Taxi",
      comment: null,
      subRegion: null,
      productUnit: "IAM",
      businessUnit: "Products",
      active: true,
    });
  });

  it("sends amounts as numbers", () => {
    const input = toRuleInput(form({ amountMin: "10.50", amountMax: " 200 " }));
    expect(input.amountMin).toBe(10.5);
    expect(input.amountMax).toBe(200);
  });

  it("never sends a source", () => {
    expect(toRuleInput(form())).not.toHaveProperty("source");
  });
});

describe("rulePatch", () => {
  it("is empty when nothing changed", () => {
    expect(rulePatch(rule({ amountMin: 10.5 }), ruleToForm(rule({ amountMin: 10.5 })))).toEqual({});
  });

  // A body of exactly {active} skips the backend's checks, so an outdated rule can be switched off.
  it("is exactly {active} when only Active changed", () => {
    expect(rulePatch(rule({ outdated: true }), form({ active: false }))).toEqual({ active: false });
  });

  it("clears a field with null", () => {
    expect(rulePatch(rule(), form({ comment: "" }))).toEqual({ comment: null });
  });

  it("ignores an amount written differently", () => {
    expect(rulePatch(rule({ amountMax: 100 }), { ...ruleToForm(rule({ amountMax: 100 })), amountMax: "100.00" }))
      .toEqual({});
  });

  it("sends each changed field", () => {
    expect(rulePatch(rule(), form({ supplier: "Uber Eats", amountMin: "5" }))).toEqual({
      supplier: "Uber Eats",
      amountMin: 5,
    });
  });
});

describe("isActiveOnly", () => {
  it("is true only for a change to Active alone", () => {
    expect(isActiveOnly({ active: false })).toBe(true);
    expect(isActiveOnly({ active: false, comment: null })).toBe(false);
    expect(isActiveOnly({ comment: null })).toBe(false);
    expect(isActiveOnly({})).toBe(false);
  });
});

describe("ruleFormErrors", () => {
  it("has none for a valid rule", () => {
    expect(ruleFormErrors(form({ amountMin: "10", amountMax: "100.25" }), false)).toEqual({});
  });

  it("asks for a card and a supplier on a manual rule", () => {
    const errors = ruleFormErrors(form({ ccNumber: "", supplier: "  " }), false);
    expect(errors.ccNumber).toBe("Pick a card.");
    expect(errors.supplier).toBe("Enter the supplier.");
  });

  it("caps the supplier and the account", () => {
    const errors = ruleFormErrors(form({ supplier: "s".repeat(51), account: "a".repeat(101) }), false);
    expect(errors.supplier).toBe("Use at most 50 characters.");
    expect(errors.account).toBe("Use at most 100 characters.");
    expect(ruleFormErrors(form({ supplier: "s".repeat(50), account: "a".repeat(100) }), false)).toEqual({});
  });

  // The card, supplier and account of a system rule come from a bill and can't be changed.
  it("doesn't check the locked fields of a system rule", () => {
    expect(ruleFormErrors(form({ supplier: "s".repeat(51), account: "a".repeat(101) }), true)).toEqual({});
  });

  it("still checks the other fields of a system rule", () => {
    const errors = ruleFormErrors(form({ amountMax: "-1", comment: "c".repeat(31) }), true);
    expect(Object.keys(errors).sort()).toEqual(["amountMax", "comment"]);
  });

  it.each(["10.123", "-5", "abc", "1,000"])("rejects %s as an amount", (value) => {
    expect(ruleFormErrors(form({ amountMax: value }), false).amountMax).toBe(
      "Enter 0 or more, with up to 2 decimal places.",
    );
  });

  it("caps an amount at 1,000,000", () => {
    expect(ruleFormErrors(form({ amountMax: "1000000.01" }), false).amountMax).toBe(
      "Enter at most 1,000,000.",
    );
    expect(ruleFormErrors(form({ amountMax: "1000000" }), false)).toEqual({});
  });

  it.each(["50", "60"])("keeps a minimum of %s below a maximum of 50", (min) => {
    expect(ruleFormErrors(form({ amountMin: min, amountMax: "50" }), false).amountMin).toBe(
      "Must be below the maximum.",
    );
  });

  it("doesn't compare the amounts while one is invalid", () => {
    expect(ruleFormErrors(form({ amountMin: "60", amountMax: "5.555" }), false)).toEqual({
      amountMax: "Enter 0 or more, with up to 2 decimal places.",
    });
  });

  it("asks for the type once a category is picked", () => {
    expect(ruleFormErrors(form({ expenseTypeLabel: "" }), false).expenseTypeLabel).toBe("Pick the expense type.");
  });

  it("asks for the category of a type", () => {
    expect(ruleFormErrors(form({ expenseCategoryLabel: "" }), false).expenseCategoryLabel).toBe(
      "Pick the expense category.",
    );
  });

  it.each([
    [{ businessUnit: "" }],
    [{ productUnit: "" }],
  ])("asks for the whole product and business unit pair, given %o", (half) => {
    expect(ruleFormErrors(form(half), false).productUnit).toBe("Pick the Product and Business Unit.");
  });

  it("caps the comment at 30 characters", () => {
    expect(ruleFormErrors(form({ comment: "c".repeat(31) }), false).comment).toBe("Use at most 30 characters.");
    expect(ruleFormErrors(form({ comment: "c".repeat(30) }), false)).toEqual({});
  });
});

describe("outdatedFields", () => {
  const menus: CcRuleMenus = {
    expenseTypes: { categories: ["Office", "Marketing"], types: { Office: ["Taxi"], Marketing: ["Events"] } },
    subRegions: ["APAC"],
    units: { productUnits: ["IAM", "IAM", "Choreo"], businessUnits: ["Products", "Services", "Cloud"] },
  };

  it("flags nothing while every value is offered", () => {
    expect(outdatedFields(form({ subRegion: "APAC" }), menus)).toEqual({});
  });

  it("flags a category no longer offered, and its type with it", () => {
    expect(outdatedFields(form({ expenseCategoryLabel: "Gone" }), menus)).toEqual({
      expenseCategoryLabel: true,
      expenseTypeLabel: true,
    });
  });

  it("flags only the type when its category still offers others", () => {
    expect(outdatedFields(form({ expenseTypeLabel: "Bus" }), menus)).toEqual({ expenseTypeLabel: true });
  });

  it("flags a sub region no longer offered", () => {
    expect(outdatedFields(form({ subRegion: "LATAM" }), menus)).toEqual({ subRegion: true });
  });

  it("flags both units when their pair is no longer offered", () => {
    expect(outdatedFields(form({ productUnit: "Gone", businessUnit: "Products" }), menus)).toEqual({
      productUnit: true,
      businessUnit: true,
    });
  });

  it("flags a product unit that is still offered, but under another business unit", () => {
    expect(outdatedFields(form({ productUnit: "Choreo", businessUnit: "Products" }), menus)).toEqual({
      productUnit: true,
      businessUnit: true,
    });
  });

  it("flags a business unit set without a product unit", () => {
    expect(outdatedFields(form({ productUnit: "" }), menus)).toEqual({ businessUnit: true });
  });

  it("never flags an empty field", () => {
    const empty = form({
      expenseCategoryLabel: "",
      expenseTypeLabel: "",
      subRegion: "",
      productUnit: "",
      businessUnit: "",
    });
    expect(outdatedFields(empty, menus)).toEqual({});
  });

  it("flags nothing against a menu that hasn't loaded", () => {
    const stale = form({ expenseCategoryLabel: "Gone", subRegion: "LATAM", productUnit: "Gone" });
    expect(outdatedFields(stale, {})).toEqual({});
  });
});

describe("ruleDetailFields", () => {
  it("leaves the units of Travel to the Job Number, with a note", () => {
    expect(ruleDetailFields("Travel")).toEqual({ subRegion: false, units: false, travelNote: true });
  });

  it.each(["Marketing", "Marketing - Digital"])("asks %s for a sub region and units", (category) => {
    expect(ruleDetailFields(category)).toEqual({ subRegion: true, units: true, travelNote: false });
  });

  it("asks any other category for units only", () => {
    expect(ruleDetailFields("Office")).toEqual({ subRegion: false, units: true, travelNote: false });
  });
});

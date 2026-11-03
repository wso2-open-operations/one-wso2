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
  ccBillsAddress,
  type CcCreditCard,
  type CcTaggingRule,
  ccCardIsActive,
  ccHolderCardName,
  ccRuleUnconfigured,
  isMarketingCategory,
  isTravelCategory,
} from "./ccTypes";

describe("isTravelCategory", () => {
  it("is Travel only, matched exactly", () => {
    expect(isTravelCategory("Travel")).toBe(true);
    expect(isTravelCategory("Travel Insurance")).toBe(false);
  });

  it("is false for no category", () => {
    expect(isTravelCategory(null)).toBe(false);
    expect(isTravelCategory(undefined)).toBe(false);
  });
});

describe("isMarketingCategory", () => {
  it("is Marketing and its sub-categories, which share its sub region rule", () => {
    expect(isMarketingCategory("Marketing")).toBe(true);
    expect(isMarketingCategory("Marketing - Digital")).toBe(true);
    expect(isMarketingCategory("Infra")).toBe(false);
  });

  it("is false for no category", () => {
    expect(isMarketingCategory(null)).toBe(false);
    expect(isMarketingCategory("")).toBe(false);
  });
});

describe("ccRuleUnconfigured", () => {
  const rule: CcTaggingRule = {
    id: 1,
    creditCardId: 1,
    ccNumber: "1111",
    employeeEmail: "jane@wso2.com",
    supplier: "Uber",
    account: null,
    amountMin: null,
    amountMax: null,
    expenseCategoryLabel: null,
    expenseTypeLabel: null,
    comment: null,
    subRegion: null,
    productUnit: null,
    businessUnit: null,
    source: "auto",
    active: true,
    outdated: false,
  };

  it("is true while the rule fills in no expense details", () => {
    expect(ccRuleUnconfigured(rule)).toBe(true);
  });

  it.each([
    ["expenseTypeLabel", "Taxi"],
    ["comment", "Client visit"],
    ["subRegion", "APAC"],
    ["productUnit", "IAM"],
    ["businessUnit", "Products"],
  ] as const)("is false once %s is set", (field, value) => {
    expect(ccRuleUnconfigured({ ...rule, [field]: value })).toBe(false);
  });
});

describe("ccHolderCardName", () => {
  const card = (id: number, label: string | null, status = "Active") => ({ id, label, status }) as CcCreditCard;
  const inactive = card(1, null, "Inactive");
  const unlabelled = card(2, null);
  const active = [unlabelled, card(3, "Travel")];

  it("names a card by its label", () => {
    expect(ccHolderCardName(card(3, "Travel"), active)).toBe("Travel");
  });

  // Counted among the active cards only, as Pending Submissions counts them.
  it("names an unlabelled card by its place among the active cards", () => {
    expect(ccHolderCardName(unlabelled, active)).toBe("Card 1");
  });

  it("names an unlabelled inactive card as inactive", () => {
    expect(ccHolderCardName(inactive, active)).toBe("Inactive card");
  });
});

describe("ccCardIsActive", () => {
  it.each([
    ["Active", true],
    ["ACTIVE", true],
    ["Inactive", false],
    [undefined, false],
  ])("treats a card with status %s as active: %s", (status, expected) => {
    expect(ccCardIsActive({ status } as CcCreditCard)).toBe(expected);
  });
});

describe("ccBillsAddress", () => {
  it("adds the user's name to the inbox as a plus alias", () => {
    expect(ccBillsAddress("card-invoices@wso2.com", "jane@wso2.com")).toBe("card-invoices+jane@wso2.com");
  });

  it.each([
    ["no inbox", "", "jane@wso2.com"],
    ["an inbox without a domain", "card-invoices", "jane@wso2.com"],
    ["no work email", "card-invoices@wso2.com", ""],
  ])("gives nothing with %s", (_, inbox, workEmail) => {
    expect(ccBillsAddress(inbox, workEmail)).toBeNull();
  });
});

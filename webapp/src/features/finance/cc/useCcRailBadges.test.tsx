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

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CcEmployee, CcTaggingRule } from "./ccTypes";

const userInfo = { data: undefined as Partial<CcEmployee> | undefined, enabled: [] as boolean[] };
/** The rules in the shared cache, once the Autofill Rules page has loaded them; `undefined` before. */
const cachedRules = { data: undefined as CcTaggingRule[] | undefined, enabled: [] as boolean[] };

vi.mock("./useCc", () => ({
  // Like React Query, a disabled query still returns what's cached.
  useCcUserInfo: (enabled: boolean) => {
    userInfo.enabled.push(enabled);
    return { data: userInfo.data };
  },
  useCcTaggingRules: (enabled: boolean) => {
    cachedRules.enabled.push(enabled);
    return { data: cachedRules.data };
  },
}));

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
  comment: null,
  subRegion: null,
  productUnit: "IAM",
  businessUnit: "Products",
  source: "manual",
  active: true,
  outdated: false,
  ...over,
});

const blank = { expenseTypeLabel: null, productUnit: null, businessUnit: null };

const { useCcRailBadges } = await import("./useCcRailBadges");

const badges = (flags: Partial<CcEmployee>, enabled = true) => {
  userInfo.data = flags;
  return renderHook(() => useCcRailBadges(enabled)).result.current;
};

beforeEach(() => {
  userInfo.data = undefined;
  userInfo.enabled = [];
  cachedRules.data = undefined;
  cachedRules.enabled = [];
});

describe("useCcRailBadges", () => {
  it("asks to fix when a rule is outdated, even with unconfigured rules", () => {
    expect(badges({ taggingRulesOutdated: true, taggingRulesUnconfigured: true })).toEqual({
      "cc-autofill-rules": { label: "Fix", reason: "Some autofill rules have outdated values", showOnGroup: true },
    });
  });

  it("flags new rules when only unconfigured ones exist", () => {
    expect(badges({ taggingRulesUnconfigured: true })).toEqual({
      "cc-autofill-rules": { label: "New", reason: "Some autofill rules need setting up", showOnGroup: true },
    });
  });

  it("shows nothing when every rule is set up and current", () => {
    expect(badges({ taggingRulesOutdated: false, taggingRulesUnconfigured: false })).toEqual({});
  });

  it("shows nothing before /user-info answers", () => {
    expect(renderHook(() => useCcRailBadges(true)).result.current).toEqual({});
  });

  it("shows nothing when /user-info omits the flags", () => {
    expect(badges({})).toEqual({});
  });

  // The flags come from /user-info, which other Finance screens read too; outside Finance nothing asks.
  it("makes no request outside Finance", () => {
    cachedRules.data = [rule({ outdated: true })];
    expect(badges({ privileges: ["cc_owner"], taggingRulesOutdated: true }, false)).toEqual({});
    expect(userInfo.enabled).not.toContain(true);
    expect(cachedRules.enabled).not.toContain(true);
  });
});

// /user-info's flags can lag behind the rules, so the rules decide once they're loaded.
describe("useCcRailBadges, once the rules are loaded", () => {
  it("clears the badge when no rule needs action, whatever /user-info says", () => {
    const inactive = [rule({ id: 2, active: false, outdated: true }), rule({ id: 3, active: false, ...blank })];
    cachedRules.data = [rule(), ...inactive];
    expect(badges({ taggingRulesOutdated: true, taggingRulesUnconfigured: true })).toEqual({});
  });

  it("asks to fix an outdated rule, even with unconfigured rules", () => {
    cachedRules.data = [rule({ outdated: true }), rule({ id: 2, ...blank })];
    expect(badges({})["cc-autofill-rules"]?.label).toBe("Fix");
  });

  it("flags new rules when only unconfigured ones need action", () => {
    cachedRules.data = [rule({ ...blank })];
    expect(badges({ taggingRulesOutdated: true })["cc-autofill-rules"]?.label).toBe("New");
  });

  // Otherwise the rules a visit to Autofill Rules left in the cache would decide, never refetched.
  it("keeps a card holder's rules up to date", () => {
    badges({ privileges: ["employee", "cc_owner"] });
    expect(cachedRules.enabled).toContain(true);
  });

  it("doesn't ask for rules for someone without a card", () => {
    badges({ privileges: ["employee", "finance"] });
    expect(cachedRules.enabled).not.toContain(true);
  });
});

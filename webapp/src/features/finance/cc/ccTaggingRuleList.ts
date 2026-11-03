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

import { CC_FILTER_ALL, type CcTaggingRule, ccRuleUnconfigured } from "./ccTypes";

/** The groups the rules list is split into, in the order they are shown. */
export type CcRuleGroup = "unconfigured" | "outdated" | "rules";

/**
 * The rules split into groups, each in the order given. An active rule that fills in nothing is
 * unconfigured; an active rule with values no longer offered is outdated; every other rule, and
 * every inactive one, is under `rules`.
 */
export function groupRules(rules: CcTaggingRule[]): Record<CcRuleGroup, CcTaggingRule[]> {
  const groups: Record<CcRuleGroup, CcTaggingRule[]> = { unconfigured: [], outdated: [], rules: [] };
  for (const r of rules) {
    if (r.active && ccRuleUnconfigured(r)) groups.unconfigured.push(r);
    else if (r.active && r.outdated) groups.outdated.push(r);
    else groups.rules.push(r);
  }
  return groups;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * The rules sorted by card number, then supplier, then account, ignoring case. A rule without an
 * account comes before those with one, and rules that tie keep their order. Returns a new list.
 */
export function sortRules(rules: CcTaggingRule[]): CcTaggingRule[] {
  return [...rules].sort(
    (a, b) =>
      byText(a.ccNumber, b.ccNumber) || byText(a.supplier, b.supplier) || byText(a.account ?? "", b.account ?? ""),
  );
}

/**
 * What the rules list is narrowed to. Each select's filter is {@link CC_FILTER_ALL} while it narrows nothing.
 */
export interface CcRuleFilters {
  /** Text to find in a rule's card number, supplier, account, expense category, type or comment. */
  search: string;
  /** A card number. */
  card: string;
  /** An expense category. */
  category: string;
  /** Who added the rule, as its source: `manual` or `auto`. */
  addedBy: string;
  /** Whether inactive rules are listed too. */
  showInactive: boolean;
}

/** The filters the list starts with: every active rule, and no inactive one. */
export const NO_RULE_FILTERS: CcRuleFilters = {
  search: "",
  card: CC_FILTER_ALL,
  category: CC_FILTER_ALL,
  addedBy: CC_FILTER_ALL,
  showInactive: false,
};

const narrows = (value: string) => value !== CC_FILTER_ALL;

/** The rules that match every filter, in the order given. The search ignores case and surrounding spaces. */
export function filterRules(rules: CcTaggingRule[], f: CcRuleFilters): CcTaggingRule[] {
  const search = f.search.trim().toLowerCase();
  return rules.filter(
    (r) =>
      (!search ||
        [r.ccNumber, r.supplier, r.account, r.expenseCategoryLabel, r.expenseTypeLabel, r.comment].some((v) =>
          v?.toLowerCase().includes(search),
        )) &&
      (!narrows(f.card) || r.ccNumber === f.card) &&
      (!narrows(f.category) || r.expenseCategoryLabel === f.category) &&
      (!narrows(f.addedBy) || r.source === f.addedBy) &&
      (f.showInactive || r.active),
  );
}

/** How many of the Filter popover's selects narrow the list. The search and Show inactive show for themselves. */
export function ruleFilterCount(f: CcRuleFilters): number {
  return [f.card, f.category, f.addedBy].filter(narrows).length;
}

/**
 * The cards and expense categories the rules have, each once and sorted, for the filters to offer. A card or
 * category still filtered on is offered too, after its last rule is gone, so its select still shows it.
 */
export function ruleFilterOptions(rules: CcTaggingRule[], f: CcRuleFilters): { cards: string[]; categories: string[] } {
  const distinct = (values: (string | null)[], current: string) =>
    [...new Set([...values, narrows(current) ? current : null].filter((v): v is string => Boolean(v)))].sort(byText);
  return {
    cards: distinct(rules.map((r) => r.ccNumber), f.card),
    categories: distinct(rules.map((r) => r.expenseCategoryLabel), f.category),
  };
}

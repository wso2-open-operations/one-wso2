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

import type { RailBadgeMap } from "@components/side-rail/railBadge";
import { CC_RULE_BADGE } from "./ccCopy";
import { groupRules } from "./ccTaggingRuleList";
import { useCcTaggingRules, useCcUserInfo } from "./useCc";

/**
 * The card holder's Autofill Rules badge, shown on its row and on the closed Credit Card Expenses group. Outdated
 * rules win over unconfigured ones: they have stopped filling in what they used to.
 *
 * `/user-info`'s flags decide until the Autofill Rules page has loaded the rules; from then on the rules do, as the
 * flags can lag behind them. The rules are read from the cache, never fetched here.
 *
 * @param enabled - Whether to ask `/user-info`. Off makes no request and shows no badge.
 */
export function useCcRailBadges(enabled: boolean): RailBadgeMap {
  const user = useCcUserInfo(enabled).data;
  const rules = useCcTaggingRules(false).data;
  const groups = enabled && rules ? groupRules(rules) : null;
  const outdated = groups ? groups.outdated.length > 0 : user?.taggingRulesOutdated;
  const unconfigured = groups ? groups.unconfigured.length > 0 : user?.taggingRulesUnconfigured;
  const badge = outdated ? CC_RULE_BADGE.fix : unconfigured ? CC_RULE_BADGE.new : null;
  return badge ? { "cc-autofill-rules": { ...badge, showOnGroup: true } } : {};
}

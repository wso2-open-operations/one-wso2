// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import type { RailBadge, RailBadgeMap } from "@components/side-rail/railBadge";
import { AMPLIFY_REVIEW_ITEM_ID } from "@constants/perspectives";
import { useWaitingReviewCount } from "./useAmplifyData";
import { useAmplifyReviewAccess } from "./useAmplifyEditorAccess";

/** The largest count a badge spells out; anything above reads "99+". */
const BADGE_MAX = 99;

/** The badge for `count` own posts waiting for review. */
export function waitingReviewBadge(count: number): RailBadge {
  return {
    label: count > BADGE_MAX ? `${BADGE_MAX}+` : String(count),
    reason: `${count} ${count === 1 ? "post" : "posts"} waiting for review`,
  };
}

/**
 * The waiting count on Review own posts' rail row, for callers granted `CAN_REVIEW_SHARES`. No badge when nothing
 * is waiting, while the count loads, or when it fails.
 *
 * @param enabled - Whether to ask /me and the count. Off makes no request and shows no badge.
 */
export function useAmplifyRailBadges(enabled: boolean): RailBadgeMap {
  const review = useAmplifyReviewAccess(enabled);
  const allowed = enabled && review.hasAccess && !review.isResolving;
  // A disabled query still returns what's cached, which would badge the row for someone who lost the grant.
  const count = useWaitingReviewCount(allowed).data;
  return allowed && count ? { [AMPLIFY_REVIEW_ITEM_ID]: waitingReviewBadge(count) } : {};
}

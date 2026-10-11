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

/** Default ratings a leadership employee may be given — "Successful" or
 * "Step Up", never NI or anything else in the cycle's configured parRatings
 * list. Used as the fallback when a cycle hasn't configured its own
 * leadershipAllowedRatings (see ParCycleConfigurations in api/types.ts);
 * ParLeadReviewPanel.tsx prefers the cycle-scoped value when present.
 *
 * Leadership status is computed server-side and stored once per cycle as
 * ParRating.parIsLeadershipEmployee — read that field directly rather than
 * re-deriving it from org-chart fields like subTeam. */
export const LEADERSHIP_ALLOWED_RATINGS = ["Successful", "Step Up"];

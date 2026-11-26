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

import type { NativeIntent, NativeRepostStatus } from "../api/amplifyTypes";

/** Where a post stands for the caller's own repost on LinkedIn: not opened yet, or the intent's status. */
export type NativeRepostState = "NONE" | NativeRepostStatus;

/** The caller's latest intent for each post, by campaign id (the API lists them newest first). */
export function intentsByCampaign(intents: readonly NativeIntent[] | undefined): Map<string, NativeIntent> {
  const byCampaign = new Map<string, NativeIntent>();
  for (const intent of intents ?? []) if (!byCampaign.has(intent.campaignId)) byCampaign.set(intent.campaignId, intent);
  return byCampaign;
}

/** The state the post card shows for `campaignId`. */
export function nativeRepostState(byCampaign: ReadonlyMap<string, NativeIntent>, campaignId: string): NativeRepostState {
  return byCampaign.get(campaignId)?.nativeStatus ?? "NONE";
}

/** The headline when Amplify has found the repost, with the points a plain repost earns when known. */
export function foundRepostText(points: number | undefined): string {
  return points === undefined ? "Found your repost" : `Found your repost · +${points}`;
}

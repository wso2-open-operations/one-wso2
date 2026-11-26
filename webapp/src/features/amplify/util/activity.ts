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

import type { LedgerEntry, LedgerSettlement, PointAction, PointsHistory } from "../api/amplifyTypes";

/** The filter chips over My points & Coins' activity list. */
export type ActivityFilter = "all" | "reposts" | "reactions" | "own-posts" | "corrections";

/** The filter chips in order, with their labels. */
export const ACTIVITY_FILTERS: readonly { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reposts", label: "Reposts" },
  { value: "reactions", label: "Reactions & comments" },
  { value: "own-posts", label: "Own posts" },
  { value: "corrections", label: "Corrections" },
];

const REPOST_ACTIONS: ReadonlySet<string> = new Set(["REPOST", "REPOST_COMMENTARY", "SHARE", "SHARE_COMMENTARY"]);
const REACTION_ACTIONS: ReadonlySet<string> = new Set(["REACTION", "COMMENT"]);
const OWN_POST_ACTIONS: ReadonlySet<string> = new Set(["OWN_POST", "OWN_POST_AMPLIFIED"]);

/** Whether a row is the PO team's: an adjustment or a reversal. */
export function isCorrection(entry: Pick<LedgerEntry, "sourceType">): boolean {
  return entry.sourceType === "ADJUSTMENT" || entry.sourceType === "REVERSAL";
}

/** Whether a row belongs under `filter`. A correction shows only under All and Corrections, whatever its action. */
export function matchesActivityFilter(entry: Pick<LedgerEntry, "sourceType" | "action">, filter: ActivityFilter): boolean {
  if (filter === "all") return true;
  if (filter === "corrections") return isCorrection(entry);
  if (isCorrection(entry)) return false;
  const action = entry.action ?? "";
  if (filter === "reposts") return REPOST_ACTIONS.has(action);
  if (filter === "reactions") return REACTION_ACTIONS.has(action);
  return OWN_POST_ACTIONS.has(action);
}

const ACTION_TEXT: Readonly<Record<PointAction, string>> = {
  REPOST: "You reposted",
  REPOST_COMMENTARY: "You reposted with your thoughts",
  SHARE: "You shared with a link",
  SHARE_COMMENTARY: "You shared with a link and your thoughts",
  REACTION: "You reacted on LinkedIn",
  COMMENT: "You commented on LinkedIn",
  OWN_POST: "Your own post was approved",
  OWN_POST_AMPLIFIED: "Your own post was featured",
  CHALLENGE_ENTRY: "You entered a challenge",
  CHALLENGE_WINNER: "You won a challenge",
};

/** What happened on a row of the caller's own history, in plain words. */
export function activityText(entry: Pick<LedgerEntry, "sourceType" | "action" | "points">): string {
  if (entry.sourceType === "REVERSAL") return "The PO team reversed points";
  if (entry.sourceType === "ADJUSTMENT") {
    return entry.points < 0 ? "The PO team removed points" : "The PO team added points";
  }
  return (entry.action && ACTION_TEXT[entry.action as PointAction]) || "Points activity";
}

/** The status an activity row shows: its Coins status, or REVERSED once another row cancelled it. */
export type ActivityStatus = LedgerSettlement | "REVERSED";

/** Each status in the employee's words. */
export const ACTIVITY_STATUS_LABELS: Readonly<Record<ActivityStatus, string>> = {
  HELD: "Counts toward next Coins",
  PAID: "Coins sent",
  ACTION_REQUIRED: "Waiting for the PO team",
  REVERSED: "Reversed",
};

/** A row's status: REVERSED once another row cancelled it, else its Coins status. Null when it has none. */
export function activityStatus(entry: Pick<LedgerEntry, "reversedBy" | "settlement">): ActivityStatus | null {
  if (entry.reversedBy) return "REVERSED";
  return entry.settlement ?? null;
}

/**
 * The rows of every page loaded so far, newest first. A row that moved onto the next page while paging (a newer row
 * arrived in between) is kept once.
 */
export function historyRows(pages: readonly Pick<PointsHistory, "items">[]): LedgerEntry[] {
  const seen = new Set<string>();
  const rows: LedgerEntry[] = [];
  for (const page of pages) {
    for (const row of page.items) {
      if (seen.has(row.reference)) continue;
      seen.add(row.reference);
      rows.push(row);
    }
  }
  return rows;
}

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

import type {
  CoinConversion,
  HistoryItem,
  LedgerEntry,
  LedgerSettlement,
  PointAction,
  PointsHistory,
} from "../api/amplifyTypes";
import { coinsText, pointsText } from "./coins";

/** The filter chips over My points & Coins' activity list. */
export type ActivityFilter = "all" | "reposts" | "reactions" | "own-posts" | "coins";

/** The filter chips in order, with their labels. */
export const ACTIVITY_FILTERS: readonly { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reposts", label: "Reposts" },
  { value: "reactions", label: "Reactions & comments" },
  { value: "own-posts", label: "Own posts" },
  { value: "coins", label: "Coins" },
];

const REPOST_ACTIONS: ReadonlySet<string> = new Set(["REPOST", "REPOST_COMMENTARY", "SHARE", "SHARE_COMMENTARY"]);
const REACTION_ACTIONS: ReadonlySet<string> = new Set(["REACTION", "COMMENT"]);
const OWN_POST_ACTIONS: ReadonlySet<string> = new Set(["OWN_POST", "OWN_POST_AMPLIFIED"]);

/** Whether a row is the PO team's: an adjustment or a reversal. */
export function isCorrection(entry: Pick<LedgerEntry, "sourceType">): boolean {
  return entry.sourceType === "ADJUSTMENT" || entry.sourceType === "REVERSAL";
}

/** Whether a history row is a Coins conversion. */
export function isCoinConversion(item: HistoryItem): item is CoinConversion {
  return item.kind === "COIN_CONVERSION";
}

/** The ledger rows of a history page, without its Coins conversions. */
export function ledgerRowsOf(items: readonly HistoryItem[]): LedgerEntry[] {
  return items.filter((i): i is LedgerEntry => !isCoinConversion(i));
}

/** What a conversion row says under "Converted to Coins", e.g. "800 points → 80 Coins". */
export function conversionText(c: Pick<CoinConversion, "points" | "coins">): string {
  return `${pointsText(c.points)} → ${coinsText(c.coins)}`;
}

/** A conversion's status pill: "80 Coins sent", or "Sending 80 Coins" while the transfer isn't confirmed. */
export function conversionStatusText(c: Pick<CoinConversion, "coins" | "conversionStatus">): string {
  return c.conversionStatus === "SENT" ? `${coinsText(c.coins)} sent` : `Sending ${coinsText(c.coins)}`;
}

/**
 * Whether a row belongs under `filter`. A correction shows only under All, whatever its action. Coins lists the
 * conversions and the activity whose points became Coins.
 */
export function matchesActivityFilter(
  entry: HistoryItem,
  filter: ActivityFilter,
): boolean {
  if (filter === "all") return true;
  if (isCoinConversion(entry)) return filter === "coins";
  if (filter === "coins") return entry.settlement === "PAID";
  if (isCorrection(entry)) return false;
  const action = entry.action ?? "";
  if (filter === "reposts") return REPOST_ACTIONS.has(action);
  if (filter === "reactions") return REACTION_ACTIONS.has(action);
  return OWN_POST_ACTIONS.has(action);
}

const ACTION_TEXT: Readonly<Record<PointAction, string>> = {
  REPOST: "Reposted",
  REPOST_COMMENTARY: "Reposted with your thoughts",
  SHARE: "Shared with a link",
  SHARE_COMMENTARY: "Shared with a link and your thoughts",
  REACTION: "Reacted on LinkedIn",
  COMMENT: "Commented on LinkedIn",
  OWN_POST: "Own post approved",
  OWN_POST_AMPLIFIED: "Own post featured",
  CHALLENGE_ENTRY: "Challenge entry",
  CHALLENGE_WINNER: "Challenge winner",
};

/**
 * What happened on a row, in plain words ("Reposted with your thoughts"). A reversal of a repost reads "Repost
 * removed"; with `forPerson` the employee's "your" becomes neutral, for the PO team's view of someone else.
 */
export function activityText(
  entry: Pick<LedgerEntry, "sourceType" | "action" | "points">,
  { forPerson = false }: { forPerson?: boolean } = {},
): string {
  if (entry.sourceType === "REVERSAL") {
    return entry.action && REPOST_ACTIONS.has(entry.action) ? "Repost removed" : "Points reversed";
  }
  if (entry.sourceType === "ADJUSTMENT") return "Corrected by the PO team";
  const text = (entry.action && ACTION_TEXT[entry.action as PointAction]) || "Points activity";
  return forPerson ? text.replace(" your ", " ") : text;
}

/** The status an activity row shows: its Coins status, or REVERSED / CORRECTED for the PO team's rows. */
export type ActivityStatus = LedgerSettlement | "REVERSED" | "CORRECTED";

/** Each status in the employee's words. */
export const ACTIVITY_STATUS_LABELS: Readonly<Record<ActivityStatus, string>> = {
  HELD: "Counts toward next Coins",
  PAID: "Coins sent",
  ACTION_REQUIRED: "Waiting for the PO team",
  REVERSED: "Reversed",
  CORRECTED: "Corrected",
};

/**
 * A row's status: REVERSED for a reversal or a row another one cancelled, CORRECTED for an adjustment, else its Coins
 * status. Null when it has none.
 */
export function activityStatus(
  entry: Pick<LedgerEntry, "reversedBy" | "settlement"> & Partial<Pick<LedgerEntry, "sourceType">>,
): ActivityStatus | null {
  if (entry.reversedBy || entry.sourceType === "REVERSAL") return "REVERSED";
  if (entry.sourceType === "ADJUSTMENT") return "CORRECTED";
  return entry.settlement ?? null;
}

/**
 * The rows of every page loaded so far, newest first. A row that moved onto the next page while paging (a newer row
 * arrived in between) is kept once.
 */
export function historyRows(pages: readonly Pick<PointsHistory, "items">[]): HistoryItem[] {
  const seen = new Set<string>();
  const rows: HistoryItem[] = [];
  for (const page of pages) {
    for (const row of page.items) {
      if (seen.has(row.reference)) continue;
      seen.add(row.reference);
      rows.push(row);
    }
  }
  return rows;
}

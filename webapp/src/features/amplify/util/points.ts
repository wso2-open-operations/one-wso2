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

import type { LedgerEntry, PointAction } from "../api/amplifyTypes";
import { num } from "./dashboardFormat";

/** The most points one correction may add or remove (amplify-api `PointsAdjustment.points`). */
export const MAX_ADJUSTMENT_POINTS = 10_000;

/** The most points a rule may award for one action (amplify-api `PointRuleDraft.points`). */
export const MAX_RULE_POINTS = 10_000;

/** The longest reason amplify-api accepts for a correction or a decline (`Reason.reason`). */
export const REASON_MAX_LENGTH = 1000;

/** Plain words for each action a rule or a ledger row can be for, in the order Amplify Admin lists them. */
export const POINT_ACTION_LABELS: Readonly<Record<PointAction, string>> = {
  REPOST: "Repost",
  REPOST_COMMENTARY: "Repost with your thoughts",
  REACTION: "Reaction on LinkedIn",
  COMMENT: "Comment on LinkedIn",
  OWN_POST: "Own post approved",
  OWN_POST_AMPLIFIED: "Own post featured (total)",
  SHARE: "Share with a link",
  SHARE_COMMENTARY: "Share with a link and your thoughts",
  CHALLENGE_ENTRY: "Challenge entry",
  CHALLENGE_WINNER: "Challenge winner",
};

const ACTION_ORDER = Object.keys(POINT_ACTION_LABELS) as PointAction[];

/** Where `action` sits in Amplify Admin's list; unknown actions go last. */
export function pointActionOrder(action: string): number {
  const i = ACTION_ORDER.indexOf(action as PointAction);
  return i === -1 ? ACTION_ORDER.length : i;
}

/** What a ledger row was for, in plain words. A featured top-up row is only the extra points, so it says so. */
export function ledgerActionLabel(entry: Pick<LedgerEntry, "sourceType" | "action">): string {
  if (entry.sourceType === "ADJUSTMENT") return "Correction by the PO team";
  if (entry.sourceType === "REVERSAL") return "Reversal";
  if (entry.action === "OWN_POST_AMPLIFIED") return "Own post featured";
  const label = entry.action ? POINT_ACTION_LABELS[entry.action as PointAction] : undefined;
  return label ?? entry.action ?? "Activity";
}

/** Points with their sign, e.g. "+10", "−2" or "0". */
export function signedPoints(points: number): string {
  if (points > 0) return `+${num(points)}`;
  if (points < 0) return `−${num(Math.abs(points))}`;
  return "0";
}

/** A total before and after a change, e.g. "1,040 → 1,038". */
export function effectPreview(current: number, change: number): string {
  return `${num(current)} → ${num(current + change)}`;
}

/** Whether a row was reversed: the history names the row that reversed it in `reversedBy`. */
export function isReversed(entry: Pick<LedgerEntry, "reversedBy">): boolean {
  return Boolean(entry.reversedBy);
}

/** Whether a row may be reversed: not a reversal itself, and not reversed already. */
export function canReverse(entry: Pick<LedgerEntry, "sourceType" | "reversedBy">): boolean {
  return entry.sourceType !== "REVERSAL" && !isReversed(entry);
}

/**
 * The points a correction field holds: a whole number, not zero, within ±10,000, with an optional sign. Null for
 * anything else (blank, a fraction, zero, too large).
 */
export function parseAdjustmentPoints(text: string): number | null {
  const value = text.trim();
  if (!/^[+-]?\d{1,6}$/.test(value)) return null;
  const n = Number(value);
  return n !== 0 && Math.abs(n) <= MAX_ADJUSTMENT_POINTS ? n : null;
}

/** The points a rule field holds: a whole number from 0 to 10,000. Null for anything else. */
export function parseRulePoints(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,6}$/.test(value)) return null;
  const n = Number(value);
  return n <= MAX_RULE_POINTS ? n : null;
}

/** The reasons the PO team picks from when reversing an activity or adding or removing points. */
export const CORRECTION_REASONS = [
  "Duplicate of another activity",
  "No longer on LinkedIn",
  "Missed activity",
  "Other",
] as const;
export type CorrectionReason = (typeof CORRECTION_REASONS)[number];

const CORRECTION_SEPARATOR = " — ";

/** The most characters the note may have after `reason`, so the whole stays within the API's limit. */
export function correctionNoteMaxLength(reason: string): number {
  return REASON_MAX_LENGTH - reason.length - CORRECTION_SEPARATOR.length;
}

/** The `reason` sent with a correction: the chosen reason, plus " — " and the note when there is one. */
export function correctionReasonText(reason: string, note: string): string {
  const text = note.trim();
  return text ? `${reason}${CORRECTION_SEPARATOR}${text}` : reason;
}

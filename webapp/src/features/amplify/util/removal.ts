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

import type { LedgerEntry, RemovalReason } from "../api/amplifyTypes";
import { isReversed } from "./points";

/** What an employee reads on a removed activity: neutral, so it never calls their activity spam. */
export const REMOVED_AFTER_REVIEW = "Removed after review by the PO team";

/** The reason codes the PO team picks from, in order, with their labels. */
export const REMOVAL_REASONS: readonly { code: RemovalReason; label: string }[] = [
  { code: "DUPLICATE", label: "Duplicate" },
  { code: "NOT_A_REAL_REPOST", label: "Not a real repost" },
  { code: "SPAM", label: "Spam" },
  { code: "OTHER", label: "Other" },
];

/** The most characters the removal note may have (amplify-api `RemoveActivity.note`). */
export const REMOVAL_NOTE_MAX_LENGTH = 1000;

/** The label of a reason code. */
export function removalReasonLabel(code: RemovalReason): string {
  return REMOVAL_REASONS.find((r) => r.code === code)?.label ?? code;
}

/** Whether a row can be removed as invalid: a LinkedIn engagement award that still stands. */
export function canRemove(entry: Pick<LedgerEntry, "sourceType" | "reversedBy">): boolean {
  return entry.sourceType === "ENGAGEMENT" && !isReversed(entry);
}

/** Whether the removal can be sent: a reason picked, and a note when it is Other. */
export function removalReady(code: RemovalReason | "", note: string): code is RemovalReason {
  return code !== "" && (code !== "OTHER" || note.trim() !== "");
}

/**
 * The second line on a removal row in the PO team's view: "Removed: Duplicate — the note", or the neutral label when
 * the code isn't sent (someone who isn't a PO, or the person themselves).
 */
export function removalRowText(entry: Pick<LedgerEntry, "removalReason" | "reason">): string | undefined {
  if (!entry.removalReason) return undefined;
  const note = entry.reason?.trim();
  const label = `Removed: ${removalReasonLabel(entry.removalReason)}`;
  return note && note !== REMOVED_AFTER_REVIEW ? `${label} — ${note}` : label;
}

/** The reason an employee sees on their own row: the neutral label on a removal, else the PO team's reason. */
export function employeeReason(entry: Pick<LedgerEntry, "removalReason" | "reason">): string | undefined {
  if (entry.removalReason) return REMOVED_AFTER_REVIEW;
  return entry.reason?.trim() || undefined;
}

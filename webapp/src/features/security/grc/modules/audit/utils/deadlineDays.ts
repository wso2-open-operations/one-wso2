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

import type {
  DeadlineCycleType,
  DeadlineDayRow,
  DeadlineHandler,
  UpdateDeadlineDaysRequest,
} from "@features/security/grc/modules/audit/types/audit";

export const DEADLINE_CYCLES: { cycleType: DeadlineCycleType; label: string }[] = [
  { cycleType: "INITIAL", label: "Initial" },
  { cycleType: "REVISION", label: "Revision" },
];

// Column order of the settings form.
export const DEADLINE_HANDLERS: DeadlineHandler[] = ["OWNER", "COMPLIANCE", "AUDITOR"];

export const MIN_ALLOWED_DAYS = 1;
export const MAX_ALLOWED_DAYS = 365;

export const ALLOWED_DAYS_ERROR = `Enter a whole number from ${MIN_ALLOWED_DAYS} to ${MAX_ALLOWED_DAYS}`;

/** Form state: the text of each input, keyed "INITIAL:OWNER" and so on. */
export type DeadlineDaysDraft = Record<string, string>;

export const deadlineCellKey = (cycleType: DeadlineCycleType, handledBy: DeadlineHandler): string =>
  `${cycleType}:${handledBy}`;

/** Draft text for every row the server returned. */
export function draftFromRows(rows: DeadlineDayRow[]): DeadlineDaysDraft {
  const draft: DeadlineDaysDraft = {};
  for (const r of rows) draft[deadlineCellKey(r.cycleType, r.handledBy)] = String(r.allowedDays);
  return draft;
}

/** The number a draft cell holds, or null unless it is a whole number from 1 to 365. */
export function parseAllowedDays(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= MIN_ALLOWED_DAYS && n <= MAX_ALLOWED_DAYS ? n : null;
}

/** Error text for one draft cell, or null when it is valid. */
export function allowedDaysError(text: string): string | null {
  return parseAllowedDays(text) === null ? ALLOWED_DAYS_ERROR : null;
}

/** Error text per invalid cell key; empty when the whole draft is valid. */
export function validateDraft(draft: DeadlineDaysDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, text] of Object.entries(draft)) {
    const err = allowedDaysError(text);
    if (err) errors[key] = err;
  }
  return errors;
}

/**
 * The PUT body: only the rows whose number differs from what the server holds,
 * so saving never rewrites a default row the admin did not touch (which would
 * stop it counting as a default). Empty when nothing changed or a cell is invalid.
 */
export function buildDeadlineDaysUpdate(
  rows: DeadlineDayRow[],
  draft: DeadlineDaysDraft,
): UpdateDeadlineDaysRequest {
  const days: UpdateDeadlineDaysRequest["days"] = [];
  for (const r of rows) {
    const n = parseAllowedDays(draft[deadlineCellKey(r.cycleType, r.handledBy)] ?? "");
    if (n !== null && n !== r.allowedDays) {
      days.push({ cycleType: r.cycleType, handledBy: r.handledBy, allowedDays: n });
    }
  }
  return { days };
}

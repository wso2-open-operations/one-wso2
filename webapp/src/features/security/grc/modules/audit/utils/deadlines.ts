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
  AuditControl,
  DeadlineHandler,
  DelayLogEntry,
} from "@features/security/grc/modules/audit/types/audit";

export const DEADLINE_HANDLER_LABELS: Record<DeadlineHandler, string> = {
  OWNER: "Owner",
  COMPLIANCE: "Compliance",
  AUDITOR: "Auditor",
};

/** "OWNER" → "Owner"; anything unrecognised is shown as received. */
export function deadlineHandlerLabel(handler: string): string {
  return DEADLINE_HANDLER_LABELS[handler as DeadlineHandler] ?? handler;
}

/**
 * Formats a delay-log entry as "Owner - 11/08" (MM/DD). The date is parsed
 * from the "YYYY-MM-DD" string itself — never through Date — so the day cannot
 * move with the reader's timezone. A malformed date is shown as received.
 */
export function formatDelayLogEntry(entry: DelayLogEntry): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(entry.date);
  const day = match ? `${match[1]}/${match[2]}` : entry.date;
  return `${deadlineHandlerLabel(entry.handledBy)} - ${day}`;
}

/** True when the backend tracks deadlines for this control. */
export function isDeadlineTracked(control: Pick<AuditControl, "deadlineTracked">): boolean {
  return control.deadlineTracked === true;
}

/**
 * True when the control's current deadline has passed. Both sides are civil
 * "YYYY-MM-DD" dates, so a string comparison is exact. A finished (no holder)
 * or untracked control is never overdue.
 */
export function isCurrentDeadlineOverdue(
  control: Pick<AuditControl, "deadlineTracked" | "currentHandler" | "currentDueDate">,
  today: string,
): boolean {
  if (!isDeadlineTracked(control) || !control.currentHandler || !control.currentDueDate) return false;
  return control.currentDueDate < today;
}

export interface DeadlineSide {
  // SubmitEvidence — the internal team that submits evidence.
  canSubmit: boolean;
  // ValidateEvidence — the external auditor that validates it.
  canValidate: boolean;
}

/**
 * The groups whose turn counts as "mine". Derived from the same privileges that
 * gate the actions each group performs, not from a new privilege or a role name.
 */
export function myDeadlineHandlers(side: DeadlineSide): DeadlineHandler[] {
  const handlers: DeadlineHandler[] = [];
  if (side.canSubmit) handlers.push("OWNER");
  if (side.canValidate) handlers.push("AUDITOR");
  return handlers;
}

/**
 * Whether the Add Control form may leave the due date empty. A new Design control
 * may: the server then sets it to today plus the audit's Owner initial days.
 * Editing a control and OE controls always need one.
 */
export function isDueDateOptional(editMode: boolean, requirementType: string): boolean {
  return !editMode && requirementType !== "OE";
}

/**
 * Key for the controls table. My Deadlines arrives ordered soonest-first, so
 * entering or leaving it remounts the table and drops any sort picked on
 * another tab, which would otherwise replace that order.
 */
export function controlsTableKey(quickFilter: string | null): string {
  return quickFilter === "myDeadlines" ? "my-deadlines" : "controls";
}

/**
 * Whether the My Deadlines view is offered: org-wide GRC viewers already see
 * every control and every deadline, so it is for everyone else who holds a turn.
 */
export function showMyDeadlines(canViewAll: boolean, side: DeadlineSide): boolean {
  return !canViewAll && myDeadlineHandlers(side).length > 0;
}

/** True when the control is currently with one of `handlers` and has a deadline. */
export function isMyDeadline(
  control: Pick<AuditControl, "deadlineTracked" | "currentHandler" | "currentDueDate">,
  handlers: DeadlineHandler[],
): boolean {
  return (
    isDeadlineTracked(control) &&
    control.currentHandler != null &&
    handlers.includes(control.currentHandler) &&
    Boolean(control.currentDueDate)
  );
}

/** The controls currently with `handlers`, soonest deadline first (stable for ties). */
export function myDeadlines(controls: AuditControl[], handlers: DeadlineHandler[]): AuditControl[] {
  return controls
    .filter((c) => isMyDeadline(c, handlers))
    .sort((a, b) => (a.currentDueDate as string).localeCompare(b.currentDueDate as string));
}

/** True when at least one control carries a delay log (it is sent to org-wide GRC viewers only). */
export function hasDelayLog(controls: Pick<AuditControl, "delayLog">[]): boolean {
  return controls.some((c) => Array.isArray(c.delayLog));
}

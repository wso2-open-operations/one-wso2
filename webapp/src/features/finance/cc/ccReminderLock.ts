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

import { useSyncExternalStore } from "react";

/**
 * Which card-lead reminders are in flight, and how many this browsing session
 * has sent. Held at module scope because a send outlives the components that
 * show it: nothing cancels the request when the "Group by" toggle swaps the
 * table out or the dashboard is navigated away from. Counts what this session
 * sent rather than what the lead received, and is not persisted beyond the tab.
 */
export interface ReminderLock {
  /** Leads whose reminder request has not settled yet. */
  readonly inFlight: ReadonlySet<string>;
  /** Reminders this session has sent, per lead. */
  readonly sentCounts: Readonly<Record<string, number>>;
}

const EMPTY: ReminderLock = { inFlight: new Set(), sentCounts: {} };

// One frozen object per change, never mutated in place: `useSyncExternalStore`
// compares snapshots by reference and re-renders forever if a fresh object
// comes back from an unchanged store.
let snapshot: ReminderLock = EMPTY;

const listeners = new Set<() => void>();

function emit(next: ReminderLock): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current lock. Re-renders the caller whenever a send starts or settles. */
export function useReminderLock(): ReminderLock {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/**
 * Claim the lock for one lead.
 *
 * Returns false when a send for that lead is already open, which is how a
 * double-click is turned away: the check and the claim happen together, in one
 * synchronous step, so both clicks of a real double-click cannot both pass it.
 * A disabled button covers whatever a render has caught up with; this covers
 * the window before React re-renders.
 */
export function beginReminder(leadEmail: string): boolean {
  if (snapshot.inFlight.has(leadEmail)) return false;
  const inFlight = new Set(snapshot.inFlight);
  inFlight.add(leadEmail);
  emit({ inFlight, sentCounts: snapshot.sentCounts });
  return true;
}

/**
 * Release one lead's lock, counting the send if it landed.
 *
 * Only ever this send's own lead, so one that finishes first does not release a
 * row still waiting on its own request.
 */
export function endReminder(leadEmail: string, sent: boolean): void {
  const inFlight = new Set(snapshot.inFlight);
  inFlight.delete(leadEmail);
  const sentCounts = sent
    ? { ...snapshot.sentCounts, [leadEmail]: (snapshot.sentCounts[leadEmail] ?? 0) + 1 }
    : snapshot.sentCounts;
  emit({ inFlight, sentCounts });
}

/**
 * Empty the lock. For tests only.
 *
 * Module state outlives a test the way it outlives a page, so a spec that
 * leaves a send deliberately open would otherwise hand the next one a disabled
 * button.
 */
export function resetReminderLock(): void {
  emit(EMPTY);
}

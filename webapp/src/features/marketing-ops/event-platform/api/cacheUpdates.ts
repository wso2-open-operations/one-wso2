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

// Pure list and session transforms behind the hooks' optimistic cache writes,
// and the unplace fan-out that track and section deletes share. Kept out of the
// hooks so the rules — which lists a session belongs in, what "unplaced" means,
// what counts as a partial failure — are testable without a QueryClient.

import type {
  Session,
  SessionFilters,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

export function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => (x.id === item.id ? item : x));
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

// Mirrors the backend's list query: same event, same day when one is asked
// for, and `scheduled` meaning "has a day" (sessions.day_id IS [NOT] NULL).
export function sessionMatchesFilters(session: Session, filters: SessionFilters): boolean {
  if (session.configId !== filters.configId) return false;
  if (filters.dayId && session.dayId !== filters.dayId) return false;
  if (filters.scheduled !== undefined && filters.scheduled !== (session.dayId !== null)) {
    return false;
  }
  return true;
}

// The body PUT /api/sessions/{id}/placement takes — these four fields and no
// others (the handler rejects unknown keys, so the source's optional `roomId`
// here is gone: nothing sent it, and it would have been a 400).
export interface Placement {
  dayId: string | null;
  trackId: string | null;
  slotIndex: number | null;
  sectionId: string | null;
}

export const UNPLACED: Placement = { dayId: null, trackId: null, slotIndex: null, sectionId: null };

export function applyPlacement(session: Session, placement: Placement): Session {
  return { ...session, ...placement };
}

// Files changed sessions into one cached list: replaced where they still
// belong, dropped where they no longer do, appended where they now do. A move
// changes which lists a session is in — a card dropped from the palette onto a
// day leaves the unscheduled list and joins that day's — so patching it in
// place would leave it in the wrong list, and these lists never refetch on
// their own (staleTime: Infinity).
//
// `filters` is what the list was fetched with (sessionFiltersOf). A list whose
// filters can't be read back is only patched, never added to.
export function refileSessions(
  list: Session[],
  filters: SessionFilters | undefined,
  changed: readonly Session[],
): Session[] {
  let next = list;
  for (const session of changed) {
    const present = next.some((s) => s.id === session.id);
    const belongs = filters ? sessionMatchesFilters(session, filters) : present;
    if (present) next = belongs ? replaceById(next, session) : removeById(next, session.id);
    else if (belongs) next = [...next, session];
  }
  return next;
}

// Every distinct session across the cached lists that `pick` selects. One
// session can sit in several lists at once (a day's and the event's), so they
// are de-duplicated by id.
export function collectSessions(
  lists: readonly (readonly [unknown, Session[] | undefined])[],
  pick: (s: Session) => boolean,
): Session[] {
  const found = new Map<string, Session>();
  for (const [, data] of lists) {
    for (const s of data ?? []) if (pick(s) && !found.has(s.id)) found.set(s.id, s);
  }
  return [...found.values()];
}

// Runs one unplace per session and waits for all of them, however many fail —
// so a failure partway can't be mistaken for the whole operation failing. The
// track or section they sat in is already gone by then; the caller reports the
// stragglers instead of claiming a revert that didn't happen.
export async function unplaceEach(
  sessionIds: readonly string[],
  unplace: (id: string) => Promise<unknown>,
): Promise<{ failed: string[]; firstError?: unknown }> {
  const results = await Promise.allSettled(sessionIds.map((id) => unplace(id)));
  const failed: string[] = [];
  let firstError: unknown;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") return;
    failed.push(sessionIds[i]);
    if (firstError === undefined) firstError = r.reason;
  });
  return { failed, firstError };
}

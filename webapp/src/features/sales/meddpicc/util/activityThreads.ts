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

// Emails folded into threads for the Activity list. Every reply is its own Salesforce
// EmailMessage with the same subject, so a conversation of six messages showed as six
// rows that read as duplicates. A thread is the emails whose subjects match once the
// reply and forward prefixes are stripped; it sits where its newest message sits, and
// opens to its messages in the order they were sent.

import type { DealActivity } from "../types";
import { parseUtc } from "../../util/salesTime";

export interface ActivityThread {
  kind: "thread";
  /** The subject without its Re:/Fwd: prefixes, as the row is titled. */
  subject: string;
  /** Oldest first, as a conversation reads. */
  messages: DealActivity[];
  /** The newest message, which places the thread in the list. */
  latest: DealActivity;
}

export type ActivityItem = { kind: "entry"; entry: DealActivity } | ActivityThread;

/** "Re:", "RE: FW:", "Fwd:", "AW:" (German), "TR:" (French), "SV:" (Swedish), repeated. */
const REPLY_PREFIXES = /^\s*(?:(?:re|fw|fwd|aw|wg|tr|sv)\s*:\s*)+/i;

/** A subject without its reply and forward prefixes; the title itself when nothing is left. */
export function threadSubject(title: string): string {
  const bare = title.replace(REPLY_PREFIXES, "").trim();
  return bare || title.trim();
}

function occurred(entry: DealActivity): number {
  return parseUtc(entry.occurredAt)?.getTime() ?? 0;
}

/**
 * The activity as the list shows it, in the order given (newest first): a thread for two
 * or more emails on one subject, placed where its newest message was; everything else,
 * and a lone email, as the entry it is.
 */
export function threadActivity(activity: readonly DealActivity[]): ActivityItem[] {
  const bySubject = new Map<string, DealActivity[]>();
  for (const entry of activity) {
    if (entry.type !== "EMAIL") continue;
    const key = threadSubject(entry.title).toLowerCase();
    const group = bySubject.get(key);
    if (group) group.push(entry);
    else bySubject.set(key, [entry]);
  }
  const placed = new Set<string>();
  const items: ActivityItem[] = [];
  for (const entry of activity) {
    if (entry.type !== "EMAIL") {
      items.push({ kind: "entry", entry });
      continue;
    }
    const key = threadSubject(entry.title).toLowerCase();
    const group = bySubject.get(key) ?? [entry];
    if (group.length < 2) {
      items.push({ kind: "entry", entry });
      continue;
    }
    if (placed.has(key)) continue;
    placed.add(key);
    const messages = [...group].sort((a, b) => occurred(a) - occurred(b));
    items.push({ kind: "thread", subject: threadSubject(entry.title), messages, latest: messages[messages.length - 1] as DealActivity });
  }
  return items;
}

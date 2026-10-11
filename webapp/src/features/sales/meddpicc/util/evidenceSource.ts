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

// Where a piece of evidence came from and who said it, read the same way whether the
// backend sends those (it does once evidence sources are deployed) or not (an older
// backend, or the demo dataset): a quote with a meeting id is a call quote, and a role
// nobody worked out is UNKNOWN. Never guessed: a rep's words must not pass as the
// customer's.

import { parseUtc } from "../../util/salesTime";
import type {
  AuthorRole,
  DealActivity,
  DealDetail,
  EvidenceQuote,
  EvidenceSource,
  EvidenceSourceType,
  LetterKey,
  SourceSummary,
} from "../types";
import { LETTER_KEYS } from "./meddpiccFormat";

export function sourceOf(quote: EvidenceQuote): EvidenceSource {
  return (
    quote.source ?? {
      type: "CALL",
      id: String(quote.meetingId),
      title: quote.meetingTitle,
      occurredAt: quote.callStart,
      url: null,
    }
  );
}

export function roleOf(quote: EvidenceQuote): AuthorRole {
  return quote.authorRole ?? "UNKNOWN";
}

/** When it was said, in ms; a quote with no readable date sorts last. */
export function occurredMs(quote: EvidenceQuote): number {
  return parseUtc(sourceOf(quote).occurredAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/** Newest first, then by position within the same call. */
export function newestFirst(evidence: readonly EvidenceQuote[]): EvidenceQuote[] {
  return [...evidence].sort((a, b) => occurredMs(b) - occurredMs(a) || a.offsetSeconds - b.offsetSeconds);
}

/** True when at least one quote is the customer's own words. */
export function hasCustomerEvidence(evidence: readonly EvidenceQuote[]): boolean {
  return evidence.some((quote) => roleOf(quote) === "CUSTOMER");
}

/** The deal's timeline, from the backend or, without it, from the deal's calls. */
export function activityOf(detail: DealDetail): DealActivity[] {
  if (detail.activity) return detail.activity;
  return detail.calls.map((call) => ({
    type: "CALL" as const,
    id: String(call.meetingId),
    title: call.title,
    occurredAt: call.start,
    actor: call.host,
    letters: LETTER_KEYS.filter((letter) => (call.coverage?.[letter] ?? 0) > 0) as LetterKey[],
    meetingId: call.meetingId,
    url: null,
  }));
}

/** The source counts, from the backend or worked out from the timeline. */
export function sourcesOf(detail: DealDetail, now: number = Date.now()): SourceSummary {
  if (detail.sources) return detail.sources;
  const activity = activityOf(detail);
  const count = (type: EvidenceSourceType) => activity.filter((a) => a.type === type).length;
  const past = activity
    .map((a) => parseUtc(a.occurredAt)?.getTime())
    .filter((ms): ms is number => ms !== undefined && ms <= now);
  return {
    calls: count("CALL"),
    emails: count("EMAIL"),
    activities: count("ACTIVITY"),
    lastActivityAt: past.length ? new Date(Math.max(...past)).toISOString() : null,
  };
}

/** "4 calls · 6 emails", leaving out the sources with none. */
export function describeSources(summary: SourceSummary): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(summary.calls, "call", "calls");
  add(summary.emails, "email", "emails");
  add(summary.activities, "activity", "activities");
  return parts.join(" · ");
}

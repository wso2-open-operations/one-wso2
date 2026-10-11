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

// What one call contributed to its deal's MEDDPICC, for the meeting page.
//
// Pure: it reads the call's coverage and the deal's detail and decides nothing the
// backend did not already say. Which Letters count, which were missed and which
// proposals are pending are the backend's answers; this only gathers the ones that
// belong to this call.

import { parseUtc } from "../../util/salesTime";
import type {
  CoverageLevel,
  DealDetail,
  EvidenceQuote,
  FieldValue,
  LetterKey,
  MeetingCoverage,
  RoleProposalValue,
} from "../types";
import { occurredMs, sourceOf } from "./evidenceSource";
import { LETTER_KEYS, letterLabel } from "./meddpiccFormat";

/** One quote from this call, with the proposal it backs when it backs one. */
export interface CallEvidence {
  quote: string;
  speaker: string;
  offsetSeconds: number;
  /** The quote as the backend sent it, with its source and who said it. */
  original: EvidenceQuote;
  /** Present when the quote backs a proposal on a Gate field. */
  proposal?: {
    fieldKey: string;
    fieldLabel: string;
    value: FieldValue | RoleProposalValue;
    confidence: number;
    pending: boolean;
  };
}

/** A moment in the recording where this call gave MEDDPICC evidence. */
export interface CallMarker {
  offsetSeconds: number;
  letters: LetterKey[];
  quote: string;
  speaker: string;
}

/** A question still open for the deal's Gate, under the Letters it would answer. */
export interface OpenQuestion {
  fieldKey: string;
  fieldLabel: string;
  letters: LetterKey[];
  question: string;
}

export interface CallInsight {
  stageAtCall: string | null;
  coverage: Record<LetterKey, CoverageLevel> | null;
  /**
   * Letters this call answered that nothing earlier on the deal had: no earlier call
   * answered them, and no earlier email or activity backs a field they feed. Null when
   * that cannot be known: no deal, or this call is not among the deal's calls.
   */
  firstAnswered: LetterKey[] | null;
  /** The current Gate's Letters this call did not cover, as the backend reports them. */
  missed: LetterKey[];
  /** Every quote from this call, by Letter, in MEDDPICC order, earliest first. */
  evidence: { letter: LetterKey; items: CallEvidence[] }[];
  /** Proposals this call's quotes back that are not yet approved. */
  pendingFromCall: number;
  /** One marker per moment, Letters merged when two share it. Earliest first. */
  markers: CallMarker[];
  /** The deal's "ask next" questions, each with the field and Letters it would fill. */
  openQuestions: OpenQuestion[];
}

const sameQuote = (a: { offsetSeconds: number; quote: string }, b: { offsetSeconds: number; quote: string }) =>
  a.offsetSeconds === b.offsetSeconds && a.quote.trim() === b.quote.trim();

/**
 * Gather what one call contributed.
 *
 * Quotes come from two places, and both are needed. The call's coverage carries up to two
 * per Letter, the same ones the table's hover shows. The deal's detail carries every quote
 * behind every proposal, each naming the meeting it came from, so filtering it to this
 * call adds the rest and says which field each quote backs. A quote in both is shown once.
 */
export function callInsight(
  meetingId: number,
  coverage: MeetingCoverage | undefined,
  detail: DealDetail | undefined,
): CallInsight {
  const byLetter = new Map<LetterKey, CallEvidence[]>();
  const add = (letter: LetterKey, item: CallEvidence) => {
    const list = byLetter.get(letter) ?? [];
    const existing = list.find((other) => sameQuote(other, item));
    if (existing) {
      // The coverage copy carries no proposal; the deal's copy of the same quote does.
      if (item.proposal && !existing.proposal) existing.proposal = item.proposal;
      // Keep whichever copy knows who said it.
      if (!existing.original.authorRole && item.original.authorRole) existing.original = item.original;
    } else {
      list.push(item);
    }
    byLetter.set(letter, list);
  };
  const fromQuote = (q: EvidenceQuote): CallEvidence => ({
    quote: q.quote,
    speaker: q.speaker,
    offsetSeconds: q.offsetSeconds,
    original: q,
  });
  // A quote from this call: a call source with this meeting's id. An email's meetingId is 0.
  const fromThisCall = (q: EvidenceQuote) => sourceOf(q).type === "CALL" && q.meetingId === meetingId;

  for (const letter of LETTER_KEYS) {
    for (const q of coverage?.quotes?.[letter] ?? []) {
      if (fromThisCall(q)) add(letter, fromQuote(q));
    }
  }

  let pendingFromCall = 0;
  for (const field of detail?.fields ?? []) {
    const proposal = field.proposal;
    const mine = proposal?.evidence.filter(fromThisCall) ?? [];
    if (!proposal || mine.length === 0) continue;
    if (proposal.pending) pendingFromCall += 1;
    for (const q of mine) {
      for (const letter of field.letters) {
        add(letter, {
          ...fromQuote(q),
          proposal: {
            fieldKey: field.key,
            fieldLabel: field.label,
            value: proposal.value,
            confidence: proposal.confidence,
            pending: proposal.pending,
          },
        });
      }
    }
  }

  const evidence = LETTER_KEYS.filter((letter) => byLetter.has(letter)).map((letter) => ({
    letter,
    items: [...(byLetter.get(letter) ?? [])].sort((a, b) => a.offsetSeconds - b.offsetSeconds),
  }));

  const markers: CallMarker[] = [];
  for (const { letter, items } of evidence) {
    for (const item of items) {
      const at = markers.find((m) => sameQuote(m, item));
      if (at) {
        if (!at.letters.includes(letter)) at.letters.push(letter);
      } else {
        markers.push({ offsetSeconds: item.offsetSeconds, letters: [letter], quote: item.quote, speaker: item.speaker });
      }
    }
  }
  markers.sort((a, b) => a.offsetSeconds - b.offsetSeconds);

  const fieldsByKey = new Map((detail?.fields ?? []).map((field) => [field.key, field]));
  const openQuestions = (detail?.askNext ?? []).map((item) => {
    const field = fieldsByKey.get(item.fieldKey);
    return {
      fieldKey: item.fieldKey,
      fieldLabel: field?.label ?? item.fieldKey,
      letters: field?.letters ?? [],
      question: item.question,
    };
  });

  return {
    stageAtCall: coverage?.stageAtCall ?? null,
    coverage: coverage?.coverage ?? null,
    firstAnswered: firstAnswered(meetingId, coverage, detail),
    missed: coverage?.missed ?? [],
    evidence,
    pendingFromCall,
    markers,
    openQuestions,
  };
}

/**
 * Letters this call answered (coverage 2) that no earlier call on the deal answered.
 *
 * Most calls go back over ground already covered, so "answered on this call" says little
 * about progress; answered here for the first time is what moved the deal.
 */
function firstAnswered(
  meetingId: number,
  coverage: MeetingCoverage | undefined,
  detail: DealDetail | undefined,
): LetterKey[] | null {
  const own = coverage?.coverage;
  const calls = detail?.calls ?? [];
  const self = calls.find((call) => call.meetingId === meetingId);
  if (!own || !self) return null;
  const selfStart = parseUtc(self.start)?.getTime();
  if (selfStart === undefined) return null;
  const earlier = calls.filter((call) => {
    const start = parseUtc(call.start)?.getTime();
    return call.meetingId !== meetingId && start !== undefined && start < selfStart;
  });
  // Letters backed before this call by something other than a call's coverage: an email
  // or a Salesforce activity quoted as evidence for a field the Letter feeds.
  const backedEarlier = new Set<LetterKey>();
  for (const field of detail?.fields ?? []) {
    const before = field.proposal?.evidence.some(
      (q) => sourceOf(q).type !== "CALL" && occurredMs(q) < selfStart,
    );
    if (before) field.letters.forEach((letter) => backedEarlier.add(letter));
  }
  return LETTER_KEYS.filter(
    (letter) =>
      own[letter] === 2 &&
      !backedEarlier.has(letter) &&
      !earlier.some((call) => call.coverage?.[letter] === 2),
  );
}

/** "Metrics, Economic Buyer" — Letters as words, for a sentence. */
export function lettersInWords(letters: readonly LetterKey[]): string {
  return letters.map(letterLabel).join(", ");
}

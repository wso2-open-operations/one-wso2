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

// How the deal page sorts a deal's Gate fields for the account manager: what the AI wants
// checked, what is still missing, and what Salesforce already has. The AM's attention goes
// to the first two; the third is there to read, not to work on.

import type { DealDetail, DealField, LetterKey } from "../types";
import type { ApprovalDraft } from "./approval";

/**
 * - review: an AI proposal waiting for approval, or a value the AM has edited and not yet
 *   approved.
 * - missing: the stage needs it and nothing is there: empty in Salesforce with no proposal,
 *   or, for the current stage, a field the backend says still blocks the stage.
 * - done: Salesforce has it (or the calls agree with what it has).
 * - optional: empty, but the stage doesn't need it.
 * - notNeeded: doesn't apply to this deal, given the answers it depends on.
 */
export type FieldBucket = "review" | "missing" | "done" | "optional" | "notNeeded";

export function bucketOf(field: DealField, detail: DealDetail, draft: ApprovalDraft): FieldBucket {
  if (!field.applicable) return "notNeeded";
  const edited = Object.prototype.hasOwnProperty.call(draft.edits, field.key);
  if (field.proposal?.pending || edited) return "review";
  const blocking = field.gate === detail.currentStage && detail.incomplete.includes(field.key);
  if (blocking) return "missing";
  if (field.state === "EMPTY") return field.optional ? "optional" : "missing";
  return "done";
}

export interface GateSummary {
  gate: string;
  review: number;
  missing: number;
  done: number;
  /** Every field the stage needs is in, and nothing waits for review. */
  complete: boolean;
}

/** Gates in the fields' own (gates.json) order, with what each still needs. */
export function gateSummaries(detail: DealDetail, draft: ApprovalDraft): GateSummary[] {
  const gates = [...new Set(detail.fields.map((field) => field.gate))];
  return gates.map((gate) => {
    const buckets = detail.fields.filter((f) => f.gate === gate).map((f) => bucketOf(f, detail, draft));
    const review = buckets.filter((b) => b === "review").length;
    const missing = buckets.filter((b) => b === "missing").length;
    const done = buckets.filter((b) => b === "done").length;
    return { gate, review, missing, done, complete: review === 0 && missing === 0 };
  });
}

export interface DealSections {
  review: DealField[];
  missing: DealField[];
  done: DealField[];
  optional: DealField[];
  notNeeded: DealField[];
}

/**
 * The fields to show, sorted into sections: one stage's, or, when a Letter is picked,
 * every stage's fields that feed that Letter.
 */
export function sectionsFor(
  detail: DealDetail,
  draft: ApprovalDraft,
  scope: { gate: string } | { letter: LetterKey },
): DealSections {
  const inScope = detail.fields.filter((field) =>
    "gate" in scope ? field.gate === scope.gate : field.letters.includes(scope.letter),
  );
  const out: DealSections = { review: [], missing: [], done: [], optional: [], notNeeded: [] };
  for (const field of inScope) out[bucketOf(field, detail, draft)].push(field);
  return out;
}

/** The stage to open on: the current one, or the first with work when the current has none. */
export function defaultGate(detail: DealDetail, summaries: readonly GateSummary[]): string {
  const current = summaries.find((s) => s.gate === detail.currentStage);
  if (current) return current.gate;
  return summaries.find((s) => !s.complete)?.gate ?? summaries[0]?.gate ?? detail.currentStage;
}

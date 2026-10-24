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

import type { ParLegacyQuestionAnswer, ParLegacyThreeSixtyReview } from "../api/types";

// Ports HistoryPanel.tsx's own hasLegacyContent: a legacy text field is
// "empty" both when it's genuinely blank and when the migration wrote the
// literal string "N/A" into it.
export function hasLegacyContent(text: string | null | undefined): boolean {
  return Boolean(text) && text!.trim() !== "" && text!.trim().toUpperCase() !== "N/A";
}

// A 360 reviewer's rating answer is free text they typed, not a constrained
// field -- some real migrated rows have values like "Rating : 5" instead of
// just "5". Showing those verbatim in a label that already says "Rating: "
// produces a doubled-up "Rating: Rating : 5". Strips that redundant
// leading "Rating"/"Rating:" prefix.
export function stripRedundantRatingPrefix(text: string): string {
  return text.replace(/^\s*rating\s*:?\s*/i, "").trim();
}

// The four 2015 canonical cycle names carry their year at the END
// ("ANNUAL PERFORMANCE REVIEW for Team Leads -2015"), unlike every other
// legacy cycle's "<year> ..." convention (e.g. "2016 Quarterly Review -
// Q2") -- real data has been seen with BOTH this raw form and the
// translated one, depending on which import path produced the row.
// Display-only -- does not touch par_cycle_name as stored. Every catalog/
// rating lookup and cycle-name display in this feature should normalize
// through this first.
const LEGACY_CYCLE_DISPLAY_NAMES: Record<string, string> = {
  "ANNUAL PERFORMANCE REVIEW -2015": "2015 ANNUAL PERFORMANCE REVIEW",
  "ANNUAL PERFORMANCE REVIEW for Team Leads -2015": "2015 ANNUAL PERFORMANCE REVIEW for Team Leads",
  "ANNUAL PERFORMANCE REVIEW for Engineering Team Leads - 2015":
    "2015 ANNUAL PERFORMANCE REVIEW for Engineering Team Leads",
  "ANNUAL PERFORMANCE REVIEW for Engineering Employees - 2015":
    "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees",
  // Real migrated data for this one -- a numbered-form export, year omitted
  // entirely -- hand-confirmed from a real sample (29 rows, the single
  // largest cycle in that sample). Maps to the same canonical 2015
  // Engineering Employees review as the "for Engineering Employees - 2015"
  // form above.
  "(3) ANNUAL PERFORMANCE REVIEW - Engineering Employees":
    "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees",
  // 2016 Q2/Q3-Q4 exported without the "2016 " prefix some of the time --
  // hand-confirmed from the same real sample (3 rows each).
  "Quarterly Review - Q2": "2016 Quarterly Review - Q2",
  "Quarterly Review - Q3/Q4": "2016 Quarterly Review - Q3/Q4",
};

// Every catalog/rating lookup throughout this feature is an exact-string
// match against a small set of cycle names hand-confirmed from one
// employee's real data -- across many employees and a decade of PeopleHR
// exports, whitespace drift in the source system is a near-certainty, not
// a hypothetical (already hit once for real: "2019
// Performance Evaluation - Q2" was exported with a double space). Collapsing
// internal whitespace here, the single funnel point every lookup already
// goes through, means a stray double space or trailing space degrades
// nowhere instead of silently falling through to the generic flat view for
// that one employee's record. Deliberately NOT case-folded -- case drift
// hasn't been observed in the real data, and folding case risks masking a
// genuinely different cycle name rather than a formatting accident.
export const formatLegacyCycleName = (cycleName: string): string => {
  const normalized = cycleName.trim().replace(/\s+/g, " ");
  return LEGACY_CYCLE_DISPLAY_NAMES[normalized] ?? normalized;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Renders each legacy question + answer as its own labeled block, separated
// by real <br/> breaks (ParCommentView's own CSS zeroes <p> margins, so a
// bare <p> join collapses visually) -- previously this just joined every
// answer with a plain "\n\n", which a raw-HTML renderer collapses entirely,
// losing both the question labels AND any visible separation between
// answers (looked like one run-on blob of every question's answer back to
// back). Output already goes through ParCommentView's own sanitizeParHtml
// before rendering; title/answer are still escaped here since they're raw
// PeopleHR export text, not markup.
export function formatLegacyQuestionAnswers(answers: ParLegacyQuestionAnswer[]): string {
  return answers
    .filter((qa) => hasLegacyContent(qa.employeeAnswer))
    .map((qa) => {
      const title = qa.title?.trim();
      const answer = escapeHtml(qa.employeeAnswer!.trim());
      return title ? `<strong>${escapeHtml(title)}:</strong> ${answer}` : answer;
    })
    .join("<br/><br/>");
}

// Ports utils/types.ts's own parseLegacyQuestionAnswers/parseLegacyFeedback360:
// both fields are raw JSON strings on the wire; a parse failure reads as "no
// data" rather than throwing.
export function parseLegacyQuestionAnswers(json: string | null): ParLegacyQuestionAnswer[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ParLegacyQuestionAnswer[]) : [];
  } catch {
    return [];
  }
}

// "360 Confirmation" is stored with a trailing period in real 2020-2023
// data and without one in 2024 -- compare the normalized title.
const THREE_SIXTY_CONFIRMATION_TITLE = "360 Confirmation";

/** Whether this answer is the "360 Confirmation" workflow note rather than real per-question feedback. */
export function isThreeSixtyConfirmation(qa: ParLegacyQuestionAnswer): boolean {
  return qa.title?.trim().replace(/\.$/, "") === THREE_SIXTY_CONFIRMATION_TITLE;
}

/**
 * "PAR Shared By" is the per-question Manager Answer By -- the lead who
 * actually reviewed that cycle -- not the record's reviewerName/reviewerEmail
 * (the employee's CURRENT lead). Returns the first non-blank name, trimmed,
 * or null when no answerer was recorded.
 */
export function getLegacySharedByName(questionAnswers: ParLegacyQuestionAnswer[]): string | null {
  return questionAnswers.map((qa) => qa.managerAnsweredBy?.trim()).find((name) => name) ?? null;
}

export function parseLegacyFeedback360(json: string | null): ParLegacyThreeSixtyReview[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ParLegacyThreeSixtyReview[]) : [];
  } catch {
    return [];
  }
}

// Legacy data has no overallRating/overallSpecialRating in the database —
// both are always null (never added to the new legacy_* tables). This
// derives a display-only rating from the manager's legacy PeopleHR score
// code instead: 1->Top 5%, 2->Top 20%, 3->Successful, 4->Needs Improvements.
// Score 5 and anything else intentionally has no mapping yet. UI-only —
// never touches par-app's own current-cycle rating logic.
export function deriveLegacyRatingFromScore(score: number | null): { rating: string | null; special: string | null } {
  switch (score) {
    case 1:
      return { rating: "Successful", special: "TOP5P" };
    case 2:
      return { rating: "Successful", special: "TOP20P" };
    case 3:
      return { rating: "Successful", special: null };
    case 4:
      return { rating: "Needs Improvements", special: null };
    default:
      return { rating: null, special: null };
  }
}

// Legacy cycle names follow the same "<Year> Performance Evaluation - H1/H2"
// convention as the current app — derive display dates from that, since the
// legacy PeopleHR system doesn't expose explicit cycle start/end dates.
// Used purely for sort ordering of the merged (real + legacy) cycle picker.
// Not every legacy cycle name fits the H1/H2 convention: 2016-2019 cycles
// are quarterly ("2017 Quarterly Review - Q1", or a combined "2016
// Quarterly Review - Q3/Q4"), and the four 2015 cycles have no half/quarter
// marker at all. Those used to fall through to {null, null} here, which
// sorted them after every dated cycle (showing "-" for Start/End) instead
// of correctly before -- 2015 is the oldest data there is.
const QUARTER_BOUNDS: Record<number, [string, string]> = {
  1: ["01-01", "03-31"],
  2: ["04-01", "06-30"],
  3: ["07-01", "09-30"],
  4: ["10-01", "12-31"],
};

export function deriveLegacyCycleDates(cycleName: string): { startDate: string | null; endDate: string | null } {
  const yearMatch = cycleName.match(/(\d{4})/);
  if (!yearMatch) {
    return { startDate: null, endDate: null };
  }
  const year = yearMatch[1];

  const halfMatch = cycleName.match(/H([12])/);
  if (halfMatch) {
    return halfMatch[1] === "1"
      ? { startDate: `${year}-01-01`, endDate: `${year}-06-30` }
      : { startDate: `${year}-07-01`, endDate: `${year}-12-31` };
  }

  // A combined "Q3/Q4" cell should span the whole second half, not just
  // its last-mentioned quarter -- take the earliest/latest quarter number
  // found rather than matching a single Q<n> greedily.
  const quarters = [...cycleName.matchAll(/Q([1-4])/g)].map((m) => Number(m[1]));
  if (quarters.length > 0) {
    const [startMonthDay] = QUARTER_BOUNDS[Math.min(...quarters)];
    const [, endMonthDay] = QUARTER_BOUNDS[Math.max(...quarters)];
    return { startDate: `${year}-${startMonthDay}`, endDate: `${year}-${endMonthDay}` };
  }

  // Bare-year cycles (the four 2015 names) -- fall back to the full
  // calendar year so they still sort chronologically instead of null.
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

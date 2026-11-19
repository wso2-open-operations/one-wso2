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

// Display helpers for MEDDPICC. Presentation only: which fields exist, which
// Gate they belong to and whether a value counts are all the backend's answer,
// carried on DealDetail, and nothing here second-guesses them.

import type {
  CoverageLevel,
  DealLetterState,
  FieldValue,
  GateLetter,
  LetterKey,
  RoleHolder,
  RoleProposalValue,
} from "../types";

/**
 * The eight Letters in display order.
 *
 * Fixed by the contract (`M E DC DP P I CH CO`) rather than read from GET /gates,
 * so the circles can draw before, or without, that request. `short` is what the
 * circle shows: the two Ds and the two Cs share a character and differ by label.
 */
export const LETTERS: readonly GateLetter[] = [
  { key: "M", short: "M", label: "Metrics" },
  { key: "E", short: "E", label: "Economic Buyer" },
  { key: "DC", short: "D", label: "Decision Criteria" },
  { key: "DP", short: "D", label: "Decision Process" },
  { key: "P", short: "P", label: "Paper Process" },
  { key: "I", short: "I", label: "Identify Pain" },
  { key: "CH", short: "C", label: "Champion" },
  { key: "CO", short: "C", label: "Competition" },
];

export const LETTER_KEYS: readonly LetterKey[] = LETTERS.map((letter) => letter.key);

export function letterLabel(key: LetterKey): string {
  return LETTERS.find((letter) => letter.key === key)?.label ?? key;
}

export const COVERAGE_LABELS: Record<CoverageLevel, string> = {
  0: "not discussed",
  1: "mentioned",
  2: "answered",
};

export const DEAL_STATE_LABELS: Record<DealLetterState, string> = {
  EMPTY: "empty",
  SUGGESTED: "AI suggestion waiting for approval",
  FILLED: "filled in Salesforce",
};

/** A role Proposal carries candidates; a role's Salesforce value does not. */
export function isRoleProposal(value: unknown): value is RoleProposalValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "candidates" in value
  );
}

function isRoleHolder(value: unknown): value is RoleHolder {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "contactId" in value;
}

/** True when a value says nothing: null, blank, or an empty list. */
export function isEmptyValue(value: FieldValue | RoleProposalValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** One line for any Gate field value, Salesforce's or a Proposal's. */
export function formatFieldValue(value: FieldValue | RoleProposalValue | undefined): string {
  if (isEmptyValue(value)) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (isRoleProposal(value)) return value.title ? `${value.name} (${value.title})` : value.name;
  if (isRoleHolder(value)) return value.name;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Whether a suggestion and what Salesforce holds are the same. A role is the same person
 * by Contact, not by wording: Salesforce holds the Contact's name alone, while the calls
 * add the title heard, and two Contacts can share a name. Without a Contact to go by, the
 * name decides. Anything else is the same when it reads the same.
 */
export function sameValue(proposed: FieldValue | RoleProposalValue | undefined, held: FieldValue): boolean {
  if (isRoleProposal(proposed)) {
    if (!isRoleHolder(held)) return false;
    return proposed.suggestedContactId !== null
      ? proposed.suggestedContactId === held.contactId
      : proposed.name === held.name;
  }
  return formatFieldValue(proposed) === formatFieldValue(held);
}

/**
 * `120,000 USD`. The currency is shown as its code rather than a symbol: the
 * list mixes currencies, and "$" does not say which dollar.
 */
export function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  const number = amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return currency ? `${number} ${currency}` : number;
}

/**
 * A Salesforce date (`2026-12-31`) as `31/12/2026`.
 *
 * Read from the string, not through Date: a date has no zone, and parsing it
 * as midnight UTC shows the previous day to anyone west of Greenwich.
 */
export function formatSalesforceDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Confidence as a word: the number means little to an AM, the band does. */
export function confidenceWord(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

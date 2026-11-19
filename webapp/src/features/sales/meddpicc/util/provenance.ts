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

// Where an AI suggestion came from, as facts the account manager can check: the quotes
// grouped by the call or record they were said in, the deal's calls that did or did not
// mention it, and how Echo arrived at the value. Presentation only; nothing here decides
// anything, it reads what the backend sent and says it in words.

import type { DealCall, DealDetail, DealField, EvidenceQuote, EvidenceSource } from "../types";
import { newestFirst, roleOf, sourceOf } from "./evidenceSource";
import { confidenceWord, formatFieldValue, isEmptyValue, isRoleProposal, sameValue } from "./meddpiccFormat";

export interface QuoteGroup {
  source: EvidenceSource;
  /** In the order they were said. */
  quotes: EvidenceQuote[];
}

/** The quotes by where they were said, the newest source first. */
export function groupBySource(evidence: readonly EvidenceQuote[]): QuoteGroup[] {
  // Keyed by source, in the order first met, so the newest source stays first.
  const groups = new Map<string, QuoteGroup>();
  for (const quote of newestFirst(evidence)) {
    const source = sourceOf(quote);
    const key = `${source.type}:${source.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { source, quotes: [] };
      groups.set(key, group);
    }
    group.quotes.push(quote);
  }
  for (const group of groups.values()) group.quotes.sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  return [...groups.values()];
}

/** The deal's analysed calls that the field's evidence came from, and the ones that did not mention it. */
export function callsBehind(field: DealField, detail: DealDetail): { contributed: DealCall[]; silent: DealCall[] } {
  const ids = new Set(
    (field.proposal?.evidence ?? []).filter((q) => sourceOf(q).type === "CALL").map((q) => q.meetingId),
  );
  return {
    contributed: detail.calls.filter((call) => ids.has(call.meetingId)),
    silent: detail.calls.filter((call) => !ids.has(call.meetingId)),
  };
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** How Echo arrived at the suggestion, as sentences in reading order. Empty without a proposal. */
export function explainProposal(field: DealField, detail: DealDetail): string[] {
  const proposal = field.proposal;
  if (!proposal) return [];
  const facts: string[] = [];
  const groups = groupBySource(proposal.evidence);
  const calls = groups.filter((g) => g.source.type === "CALL").length;
  const emails = groups.filter((g) => g.source.type === "EMAIL").length;
  const notes = groups.filter((g) => g.source.type === "ACTIVITY").length;
  const quotes = proposal.evidence.length;

  if (quotes === 0) {
    facts.push("No quote backs this. It comes from the AI's reading of the conversation as a whole.");
  } else {
    const where = [
      calls > 0 && count(calls, "call", "calls"),
      emails > 0 && count(emails, "email", "emails"),
      notes > 0 && count(notes, "Salesforce note", "Salesforce notes"),
    ]
      .filter(Boolean)
      .join(", ");
    facts.push(`Backed by ${count(quotes, "quote", "quotes")} from ${where}, shown below word for word.`);
    // Who said it, when the backend attributes the quotes; an older one attributes nobody.
    const roles = proposal.evidence.map(roleOf);
    if (roles.includes("CUSTOMER")) facts.push("At least one quote is the customer's own words.");
    else if (roles.includes("WSO2")) {
      facts.push("No quote is the customer's own words: this is WSO2's account of the customer, not the customer's.");
    }
  }
  if (groups.length > 1) facts.push("Where sources disagree, the newer one weighs more.");
  facts.push(`The AI's confidence is ${confidenceWord(proposal.confidence)} (${Math.round(proposal.confidence * 100)}%).`);

  if (field.notInSalesforce) {
    facts.push("Not a Salesforce field yet: approving keeps it in Echo.");
  } else if (isEmptyValue(field.salesforceValue)) {
    facts.push("Salesforce has nothing for this field, so the suggestion would fill it.");
  } else if (proposal.pending) {
    facts.push(`It differs from what Salesforce has (${formatFieldValue(field.salesforceValue)}), so it waits for your approval.`);
  } else if (sameValue(proposal.value, field.salesforceValue)) {
    facts.push("It matches what Salesforce has, so there is nothing to approve.");
  } else {
    // Settled, then Salesforce changed: as on the card, not pending alone does not mean they agree.
    facts.push(
      `Salesforce now holds ${formatFieldValue(field.salesforceValue)}, changed since this was settled; the calls heard ${formatFieldValue(proposal.value)}, and there is nothing to approve.`,
    );
  }

  if (field.kind === "role" && isRoleProposal(proposal.value)) {
    const { suggestedContactId, candidates } = proposal.value;
    const suggested = candidates.find((c) => c.contactId === suggestedContactId);
    const nearest = candidates[0];
    if (suggested) {
      facts.push(`Matched to the Contact ${suggested.name} by name, ${Math.round(suggested.score * 100)}% similar.`);
    } else if (nearest) {
      facts.push(
        `No Contact on the Account is a close enough match to pick for you; the nearest is ${nearest.name} at ${Math.round(nearest.score * 100)}%.`,
      );
    } else {
      facts.push("The Account has no Contacts to match against.");
    }
  }

  if (field.attest) {
    facts.push("Only you confirm this field. Check a suggestion against the customer's own words before approving.");
  }

  const { contributed, silent } = callsBehind(field, detail);
  if (contributed.length > 0 && silent.length > 0) {
    facts.push(
      silent.length === 1
        ? "One other analysed call on this deal did not mention it."
        : `${silent.length} other analysed calls on this deal did not mention it.`,
    );
  }
  return facts;
}

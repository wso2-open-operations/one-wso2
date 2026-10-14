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

// TESTS ONLY: an in-memory stand-in for echo-backend that the page and panel
// tests put behind the client interface; the app itself never imports it. Approve all fills the circles, Move
// stage advances the stage, Include pulls a call in.
//
// It follows the contract's DESCRIBED rules (§3.4 deal letter state, Gate
// complete, Ask next, Missed; §3.6 Approve all) closely enough for a demo, and
// no further. It is not the backend's logic and the live screens never run it:
// they render whatever the backend computed. State lives for the page load and
// resets on refresh.

import { HttpError } from "@api/http";
import type { DealsQuery, MeddpiccClient } from "../api/meddpiccClient";
import type {
  ApproveRequest,
  ApproveResult,
  CoverageLevel,
  DealDetail,
  DealField,
  DealLetterState,
  DealSummary,
  FieldValue,
  GateFieldDefinition,
  LetterKey,
  MeetingCoverage,
  RoleHolder,
} from "../types";
import { LETTER_KEYS, isEmptyValue, isRoleProposal } from "../util/meddpiccFormat";
import { MOCK_GATES } from "./mockGates";
import { createFixtures, mockSalesforceUrl, type MockDeal, type MockFixtures } from "./mockFixtures";

// Long enough that loading states are visible in a demo, and nothing under test.
const MOCK_LATENCY_MS = import.meta.env.MODE === "test" ? 0 : 300;
/** How long a re-analysed meeting reports RUNNING before it is DONE again. */
const REANALYSE_MS = 4000;

let state: MockFixtures = createFixtures();
const reanalysedAt = new Map<number, number>();

/** Back to the fixtures as written. For tests; a page refresh does the same. */
export function resetMockStore(): void {
  state = createFixtures();
  reanalysedAt.clear();
}

const STAGES = MOCK_GATES.stages;
const FIELDS = MOCK_GATES.fields;

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

/** The error the real client would throw, body included, so describeError reads it the same way. */
function fail(path: string, status: number, body: Record<string, unknown>): never {
  throw new HttpError(`mock:${path}`, status, JSON.stringify(body));
}

/** A copy, so cached query data never changes underneath React when the store does. */
function copy<T>(value: T): T {
  return structuredClone(value);
}

function findDeal(opportunityId: string): MockDeal {
  const deal = state.deals.find((d) => d.summary.opportunityId === opportunityId);
  if (!deal) fail(`/deals/${opportunityId}`, 404, { message: "No such Opportunity." });
  return deal;
}

// ---- value comparison ------------------------------------------------------

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/** Multi-select compared as sets, case-insensitively (contract §3.4). */
function valuesEqual(a: FieldValue, b: FieldValue): boolean {
  if (isEmptyValue(a) || isEmptyValue(b)) return isEmptyValue(a) && isEmptyValue(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    const left = new Set(a.map(norm));
    const right = new Set(b.map(norm));
    return left.size === right.size && [...left].every((v) => right.has(v));
  }
  if (typeof a === "string" && typeof b === "string") return norm(a) === norm(b);
  if (typeof a === "object" && typeof b === "object" && a && b && "contactId" in a && "contactId" in b) {
    return a.contactId === b.contactId;
  }
  return a === b;
}

// ---- derivations (§3.4) ------------------------------------------------------

function stageIndex(stage: string): number {
  const index = STAGES.indexOf(stage);
  return index === -1 ? 0 : index;
}

function salesforceValue(deal: MockDeal, def: GateFieldDefinition): FieldValue {
  if (def.notInSalesforce) return null;
  if (def.key === "productLineItems") return deal.hasLineItems ? "Line items added" : null;
  return deal.salesforce[def.key] ?? null;
}

function isPending(deal: MockDeal, def: GateFieldDefinition): boolean {
  const proposal = deal.proposals[def.key];
  if (!proposal || proposal.status !== "PROPOSED") return false;
  if (def.notInSalesforce) return true;
  const current = salesforceValue(deal, def);
  if (def.kind === "role") {
    const value = proposal.value;
    const holder = current as RoleHolder | null;
    return !(isRoleProposal(value) && value.suggestedContactId && holder?.contactId === value.suggestedContactId);
  }
  return !valuesEqual(proposal.value as FieldValue, current);
}

function dependsHolds(deal: MockDeal, def: GateFieldDefinition): boolean {
  const dependsOn = def.dependsOn;
  if (!dependsOn) return true;
  const value = deal.salesforce[dependsOn.field];
  if (dependsOn.equals !== undefined) return typeof value === "string" && norm(value) === norm(dependsOn.equals);
  if (dependsOn.includes !== undefined) {
    return Array.isArray(value) && value.some((v) => norm(v) === norm(dependsOn.includes as string));
  }
  return true;
}

function fieldState(deal: MockDeal, def: GateFieldDefinition): DealLetterState {
  if (isPending(deal, def)) return "SUGGESTED";
  return isEmptyValue(salesforceValue(deal, def)) ? "EMPTY" : "FILLED";
}

/** Whether one field of the current Gate is done, per "Gate complete". */
function counts(deal: MockDeal, def: GateFieldDefinition): boolean {
  if (def.optional || def.notInSalesforce || !dependsHolds(deal, def)) return true;
  if (def.key === "productLineItems") return deal.hasLineItems;
  const value = salesforceValue(deal, def);
  if (def.requiredValue !== undefined) return typeof value === "string" && norm(value) === norm(def.requiredValue);
  return !isEmptyValue(value);
}

function incompleteFields(deal: MockDeal): string[] {
  return FIELDS.filter((def) => def.gate === deal.summary.stage && !counts(deal, def)).map((def) => def.key);
}

function dealState(deal: MockDeal): Record<LetterKey, DealLetterState> {
  const upTo = stageIndex(deal.summary.stage);
  const inScope = FIELDS.filter((def) => stageIndex(def.gate) <= upTo);
  const result = {} as Record<LetterKey, DealLetterState>;
  for (const letter of LETTER_KEYS) {
    const states = inScope.filter((def) => def.letters.includes(letter)).map((def) => fieldState(deal, def));
    result[letter] = states.includes("SUGGESTED") ? "SUGGESTED" : states.includes("FILLED") ? "FILLED" : "EMPTY";
  }
  return result;
}

function summary(deal: MockDeal): DealSummary {
  const starts = deal.calls.map((call) => call.start).sort();
  return {
    ...deal.summary,
    lastCallAt: starts.length ? starts[starts.length - 1] : null,
    callCount: deal.calls.length,
    pendingCount: FIELDS.filter((def) => isPending(deal, def)).length,
    dealState: dealState(deal),
  };
}

function field(deal: MockDeal, def: GateFieldDefinition): DealField {
  const proposal = deal.proposals[def.key];
  return {
    key: def.key,
    gate: def.gate,
    label: def.label,
    letters: def.letters,
    kind: def.kind,
    conversational: def.conversational,
    notInSalesforce: Boolean(def.notInSalesforce),
    optional: Boolean(def.optional),
    applicable: dependsHolds(deal, def),
    options: def.options ?? [],
    salesforceValue: salesforceValue(deal, def),
    proposal: proposal
      ? {
          value: proposal.value,
          rationale: proposal.rationale,
          confidence: proposal.confidence,
          evidence: proposal.evidence,
          pending: isPending(deal, def),
        }
      : null,
    state: fieldState(deal, def),
  };
}

function detail(deal: MockDeal): DealDetail {
  const index = stageIndex(deal.summary.stage);
  const incomplete = incompleteFields(deal);
  const askNext = FIELDS.filter(
    (def) =>
      def.gate === deal.summary.stage &&
      def.conversational &&
      def.askNext &&
      dependsHolds(deal, def) &&
      isEmptyValue(salesforceValue(deal, def)) &&
      !isPending(deal, def),
  ).map((def) => ({ fieldKey: def.key, question: def.askNext as string }));

  return copy({
    deal: summary(deal),
    currentStage: deal.summary.stage,
    nextStage: deal.summary.isClosed ? null : (STAGES[index + 1] ?? null),
    gateComplete: incomplete.length === 0,
    incomplete,
    fields: FIELDS.map((def) => field(deal, def)),
    askNext,
    productsDiscussed: deal.productsDiscussed,
    calls: deal.calls,
    unassignedCalls: deal.unassigned.map((u) => u.call),
    canEdit: deal.canEdit,
    salesforceUrl: mockSalesforceUrl(deal.summary.opportunityId),
    lastApproval: deal.lastApproval,
  });
}

// ---- coverage ----------------------------------------------------------------

/** Missed: the current Gate's Letters this call did not cover. */
function missed(deal: MockDeal | undefined, coverage: Record<LetterKey, CoverageLevel> | null): LetterKey[] {
  if (!deal || !coverage) return [];
  const letters = new Set(FIELDS.filter((def) => def.gate === deal.summary.stage).flatMap((def) => def.letters));
  return LETTER_KEYS.filter((letter) => letters.has(letter) && coverage[letter] === 0);
}

/**
 * Coverage for a meeting the fixtures don't know — a real row of the meetings
 * list, when the list comes from meet-app. Made up from the id, deterministic,
 * and pointed at one of the demo deals so the row opens a panel.
 */
function synthesised(meetingId: number): MeetingCoverage {
  const open = state.deals.filter((d) => !d.summary.isClosed);
  const deal = open[meetingId % open.length];
  if (meetingId % 9 === 0) {
    return { meetingId, status: "NONE", coverage: null, missed: [], stageAtCall: null, quotes: {}, opportunityId: deal.summary.opportunityId };
  }
  const coverage = {} as Record<LetterKey, CoverageLevel>;
  LETTER_KEYS.forEach((letter, i) => {
    coverage[letter] = (((meetingId >> i) + i * 7 + meetingId) % 3) as CoverageLevel;
  });
  return {
    meetingId,
    status: "DONE",
    coverage,
    missed: missed(deal, coverage),
    stageAtCall: deal.summary.stage,
    quotes: {},
    opportunityId: deal.summary.opportunityId,
  };
}

function coverageFor(meetingId: number): MeetingCoverage {
  const known = state.coverage[meetingId];
  const base: MeetingCoverage = known
    ? {
        meetingId,
        status: known.status,
        coverage: known.coverage,
        missed: missed(
          state.deals.find((d) => d.summary.opportunityId === known.opportunityId),
          known.coverage,
        ),
        stageAtCall: known.stageAtCall,
        quotes: known.quotes,
        opportunityId: known.opportunityId,
      }
    : synthesised(meetingId);
  const since = reanalysedAt.get(meetingId);
  if (since !== undefined && Date.now() - since < REANALYSE_MS) return { ...base, status: "RUNNING" };
  return base;
}

// ---- writes (§3.6) -----------------------------------------------------------

function approve(deal: MockDeal, request: ApproveRequest): ApproveResult {
  const path = `/deals/${deal.summary.opportunityId}/approve`;
  if (!deal.canEdit) fail(path, 403, { message: "Only the Opportunity owner, a call host or a Sales admin can approve." });

  const edits = request.edits ?? {};
  const matches = request.roleMatches ?? {};
  const edited = (key: string) => Object.prototype.hasOwnProperty.call(edits, key);

  const unmatched = FIELDS.filter(
    (def) => def.kind === "role" && isPending(deal, def) && !matches[def.key] && !(edited(def.key) && edits[def.key] === null),
  );
  if (unmatched.length > 0) {
    fail(path, 400, { message: `Match or clear every proposed contact role: ${unmatched.map((d) => d.label).join(", ")}.` });
  }

  const written: string[] = [];
  const skipped: ApproveResult["skipped"] = [];

  for (const def of FIELDS) {
    const pending = isPending(deal, def);
    if (!pending && !edited(def.key)) continue;
    const proposal = deal.proposals[def.key];
    if (proposal) proposal.status = "APPROVED";

    if (def.kind === "role") {
      if (edited(def.key) && edits[def.key] === null) {
        skipped.push({ fieldKey: def.key, reason: "not known" });
        continue;
      }
      const contactId = matches[def.key];
      const candidates = isRoleProposal(proposal?.value) ? proposal.value.candidates : [];
      const contact = candidates.find((c) => c.contactId === contactId);
      if (!contactId || !contact) {
        skipped.push({ fieldKey: def.key, reason: "no contact matched" });
        continue;
      }
      const next: RoleHolder = { contactId, name: contact.name };
      if (valuesEqual(next, salesforceValue(deal, def))) {
        skipped.push({ fieldKey: def.key, reason: "unchanged" });
        continue;
      }
      deal.salesforce[def.key] = next;
      written.push(def.key);
      continue;
    }

    const final = edited(def.key) ? edits[def.key] : ((proposal?.value ?? null) as FieldValue);
    if (def.notInSalesforce) {
      skipped.push({ fieldKey: def.key, reason: "notInSalesforce" });
    } else if (valuesEqual(final, salesforceValue(deal, def))) {
      skipped.push({ fieldKey: def.key, reason: "unchanged" });
    } else {
      if (isEmptyValue(final)) delete deal.salesforce[def.key];
      else deal.salesforce[def.key] = final;
      written.push(def.key);
    }
  }

  deal.lastApproval = { by: "you", at: new Date().toISOString() };
  return { written, skipped, error: null, deal: detail(deal) };
}

function moveStage(deal: MockDeal, toStage: string): { stage: string } {
  const path = `/deals/${deal.summary.opportunityId}/move-stage`;
  if (!deal.canEdit) fail(path, 403, { message: "Only the Opportunity owner, a call host or a Sales admin can move the stage." });
  const incomplete = incompleteFields(deal);
  if (incomplete.length > 0) {
    fail(path, 409, { message: `The ${deal.summary.stage} Gate isn't complete yet.`, incomplete });
  }
  const next = STAGES[stageIndex(deal.summary.stage) + 1];
  if (toStage !== next) fail(path, 400, { message: `The next stage is ${next ?? "none"}, not ${toStage}.` });
  if (deal.moveRefusal) {
    fail(path, 422, { message: deal.moveRefusal, salesforceUrl: mockSalesforceUrl(deal.summary.opportunityId) });
  }
  deal.summary.stage = toStage;
  if (toStage === "Closed Won") deal.summary.isClosed = true;
  return { stage: toStage };
}

function includeCalls(deal: MockDeal, meetingIds: number[]): DealDetail {
  const path = `/deals/${deal.summary.opportunityId}/include-calls`;
  if (!deal.canEdit) fail(path, 403, { message: "Only the Opportunity owner, a call host or a Sales admin can include calls." });
  const taken = deal.unassigned.filter((u) => meetingIds.includes(u.call.meetingId));
  for (const { call, coverage, proposals } of taken) {
    deal.calls.push({ meetingId: call.meetingId, title: call.title, start: call.start, host: call.host, coverage });
    for (const [key, proposal] of Object.entries(proposals)) {
      if (deal.proposals[key]?.status !== "PROPOSED") deal.proposals[key] = proposal;
    }
    const known = state.coverage[call.meetingId];
    if (known) {
      known.opportunityId = deal.summary.opportunityId;
      known.stageAtCall = deal.summary.stage;
    }
  }
  deal.unassigned = deal.unassigned.filter((u) => !meetingIds.includes(u.call.meetingId));
  deal.calls.sort((a, b) => a.start.localeCompare(b.start));
  return detail(deal);
}

function listDeals(query: DealsQuery): DealSummary[] {
  const search = query.search?.trim().toLowerCase() ?? "";
  return state.deals
    .filter((deal) => !query.hideClosed || !deal.summary.isClosed)
    .filter((deal) => !query.stage || deal.summary.stage === query.stage)
    .filter(
      (deal) =>
        !query.owner || deal.summary.ownerEmail === query.owner || deal.summary.ownerName === query.owner,
    )
    .filter(
      (deal) =>
        !search ||
        deal.summary.name.toLowerCase().includes(search) ||
        deal.summary.accountName.toLowerCase().includes(search),
    )
    .map(summary)
    .sort((a, b) => (b.lastCallAt ?? "").localeCompare(a.lastCallAt ?? ""));
}

/** The demo implementation of every §3.6 route. */
export const mockMeddpiccClient: MeddpiccClient = {
  gates: async () => {
    await wait();
    return copy(MOCK_GATES);
  },
  meetingCoverage: async (meetingIds) => {
    await wait();
    return copy({ items: meetingIds.map(coverageFor) });
  },
  reanalyse: async (meetingId) => {
    await wait();
    reanalysedAt.set(meetingId, Date.now());
  },
  deals: async (query) => {
    await wait();
    return copy({ items: listDeals(query) });
  },
  deal: async (opportunityId) => {
    await wait();
    return detail(findDeal(opportunityId));
  },
  approve: async (opportunityId, request) => {
    await wait();
    return approve(findDeal(opportunityId), request);
  },
  moveStage: async (opportunityId, toStage) => {
    await wait();
    return moveStage(findDeal(opportunityId), toStage);
  },
  includeCalls: async (opportunityId, meetingIds) => {
    await wait();
    return includeCalls(findDeal(opportunityId), meetingIds);
  },
  // A plain summary from the deal's own state, whatever the question; the real answer
  // comes from Claude. Cites the first quote behind a pending proposal.
  ask: async (opportunityId) => {
    await wait();
    const d = detail(findDeal(opportunityId));
    const pending = d.fields.filter((f) => f.proposal?.pending);
    const missing = d.incomplete.map((key) => d.fields.find((f) => f.key === key)?.label ?? key);
    const quote = pending.flatMap((f) => f.proposal?.evidence ?? [])[0];
    const parts = [`${d.deal.name} is in ${d.currentStage}.`];
    if (pending.length) parts.push(`${pending.length} AI proposals wait for review: ${pending.map((f) => f.label).join(", ")}.`);
    if (missing.length) parts.push(`Still needed to leave ${d.currentStage}: ${missing.join(", ")}.`);
    if (quote) parts.push("[1]");
    return { answer: parts.join(" "), citations: quote ? [{ number: 1, quote }] : [] };
  },
};

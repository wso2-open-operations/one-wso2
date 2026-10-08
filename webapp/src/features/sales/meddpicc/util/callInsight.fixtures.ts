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

// Shared test data for one call on one deal: meeting 22 on deal 006D, after an earlier
// call 21 that already answered Metrics.

import type { DealDetail, DealField, EvidenceQuote, MeetingCoverage } from "../types";

export const quote = (overrides: Partial<EvidenceQuote> = {}): EvidenceQuote => ({
  meetingId: 22,
  meetingTitle: "Nordlys – budget sign-off",
  callStart: "2026-09-24T07:30:00Z",
  speaker: "Lars Haugen",
  quote: "Anything over 200k goes to Ingrid.",
  offsetSeconds: 760,
  ...overrides,
});

export const coverage = (overrides: Partial<MeetingCoverage> = {}): MeetingCoverage => ({
  meetingId: 22,
  status: "DONE",
  coverage: { M: 2, E: 2, DC: 0, DP: 1, P: 2, I: 1, CH: 0, CO: 0 },
  missed: ["DC"],
  stageAtCall: "Business Proof",
  quotes: { E: [quote()] },
  opportunityId: "006D",
  ...overrides,
});

export const field = (overrides: Partial<DealField> = {}): DealField => ({
  key: "economicBuyer",
  gate: "Business Proof",
  label: "Economic buyer",
  letters: ["E"],
  kind: "text",
  conversational: true,
  notInSalesforce: false,
  optional: false,
  applicable: true,
  options: [],
  salesforceValue: null,
  proposal: {
    value: "Ingrid Solberg",
    rationale: null,
    confidence: 0.86,
    evidence: [quote()],
    pending: true,
  },
  state: "SUGGESTED",
  ...overrides,
} as DealField);

export const detail = (overrides: Partial<DealDetail> = {}): DealDetail =>
  ({
    deal: { opportunityId: "006D", name: "Nordlys", accountName: "Nordlys Energi AS" },
    currentStage: "Business Proof",
    nextStage: "Proposal",
    gateComplete: false,
    incomplete: [],
    fields: [field()],
    askNext: [{ fieldKey: "decisionCriteria", question: "How will you score the shortlist?" }],
    productsDiscussed: [],
    calls: [
      { meetingId: 21, title: "Business case", start: "2026-09-01T07:00:00Z", host: "ravi@wso2.com",
        coverage: { M: 2, E: 1, DC: 0, DP: 0, P: 0, I: 2, CH: 0, CO: 0 } },
      { meetingId: 22, title: "Budget sign-off", start: "2026-09-24T07:30:00Z", host: "ravi@wso2.com",
        coverage: { M: 2, E: 2, DC: 0, DP: 1, P: 2, I: 1, CH: 0, CO: 0 } },
    ],
    unassignedCalls: [],
    canEdit: true,
    salesforceUrl: "https://sf/006D",
    lastApproval: null,
    ...overrides,
  }) as DealDetail;

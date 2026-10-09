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

import { describe, expect, it } from "vitest";
import { callInsight } from "./callInsight";
import { coverage, detail, field, quote } from "./callInsight.fixtures";

describe("callInsight", () => {
  it("shows a quote found in both the coverage and the deal once, with the proposal it backs", () => {
    const insight = callInsight(22, coverage(), detail());
    expect(insight.evidence).toHaveLength(1);
    expect(insight.evidence[0].letter).toBe("E");
    expect(insight.evidence[0].items).toHaveLength(1);
    expect(insight.evidence[0].items[0].proposal).toMatchObject({
      fieldLabel: "Economic buyer",
      value: "Ingrid Solberg",
      pending: true,
    });
    expect(insight.pendingFromCall).toBe(1);
  });

  it("leaves out quotes from other calls on the same deal", () => {
    const other = field({
      key: "metrics",
      label: "Metrics",
      letters: ["M"],
      proposal: { value: "30% faster", rationale: null, confidence: 0.9, pending: true,
        evidence: [quote({ meetingId: 21, quote: "We need 30% faster onboarding.", offsetSeconds: 90 })] },
    });
    const insight = callInsight(22, coverage(), detail({ fields: [field(), other] }));
    expect(insight.evidence.map((group) => group.letter)).toEqual(["E"]);
    expect(insight.pendingFromCall).toBe(1);
  });

  it("counts as new only the Letters no earlier call had answered", () => {
    // Call 21 already answered Metrics; this call answered M, E and P.
    expect(callInsight(22, coverage(), detail()).firstAnswered).toEqual(["E", "P"]);
  });

  it("can't say what is new when the call is not among the deal's calls", () => {
    expect(callInsight(22, coverage(), detail({ calls: [] })).firstAnswered).toBeNull();
    expect(callInsight(22, coverage(), undefined).firstAnswered).toBeNull();
  });

  it("merges two Letters that share a moment into one timeline marker", () => {
    const both = field({ key: "budget", label: "Budget", letters: ["E", "M"] });
    const insight = callInsight(22, coverage(), detail({ fields: [both] }));
    expect(insight.markers).toEqual([
      { offsetSeconds: 760, letters: ["M", "E"], quote: "Anything over 200k goes to Ingrid.", speaker: "Lars Haugen" },
    ]);
  });

  it("names the field and Letters each open question would fill", () => {
    const criteria = field({ key: "decisionCriteria", label: "Decision criteria", letters: ["DC"], proposal: null });
    const insight = callInsight(22, coverage(), detail({ fields: [field(), criteria] }));
    expect(insight.openQuestions).toEqual([
      { fieldKey: "decisionCriteria", fieldLabel: "Decision criteria", letters: ["DC"],
        question: "How will you score the shortlist?" },
    ]);
  });

  it("works from the coverage alone while the deal is unknown", () => {
    const insight = callInsight(22, coverage(), undefined);
    expect(insight.evidence[0].items[0].proposal).toBeUndefined();
    expect(insight.pendingFromCall).toBe(0);
    expect(insight.missed).toEqual(["DC"]);
    expect(insight.stageAtCall).toBe("Business Proof");
  });

  it("doesn't count a Letter as new when an earlier email already backed it", () => {
    const backed = field({
      proposal: {
        value: "Ingrid Solberg", rationale: null, confidence: 0.9, pending: true,
        evidence: [quote({
          meetingId: 0, quote: "Ingrid signs off the budget.",
          source: { type: "EMAIL", id: "02s1", title: "Re: budget", occurredAt: "2026-09-10T09:00:00Z", url: null },
          authorRole: "CUSTOMER",
        })],
      },
    });
    // Without the email, E and P are new; the September email already backed E.
    expect(callInsight(22, coverage(), detail({ fields: [backed] })).firstAnswered).toEqual(["P"]);
  });

  it("keeps an email quote out of this call's evidence and markers", () => {
    const mailed = field({
      key: "metrics", label: "Metrics", letters: ["M"],
      proposal: {
        value: "30% faster", rationale: null, confidence: 0.9, pending: true,
        evidence: [quote({
          meetingId: 0, quote: "Thirty percent faster.", offsetSeconds: 0,
          source: { type: "EMAIL", id: "02s2", title: "Re: goals", occurredAt: "2026-09-30T09:00:00Z", url: null },
        })],
      },
    });
    const insight = callInsight(22, coverage(), detail({ fields: [field(), mailed] }));
    expect(insight.evidence.map((g) => g.letter)).toEqual(["E"]);
    expect(insight.markers).toHaveLength(1);
  });
});


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
import type { EvidenceQuote } from "../types";
import {
  activityOf,
  describeSources,
  hasCustomerEvidence,
  newestFirst,
  roleOf,
  sourceOf,
  sourcesOf,
} from "./evidenceSource";
import { detail, quote } from "./callInsight.fixtures";

const email = (overrides: Partial<EvidenceQuote> = {}): EvidenceQuote =>
  quote({
    meetingId: 0,
    meetingTitle: "",
    speaker: "Ingrid Solberg",
    quote: "We've moved the cap to 200k after the audit.",
    offsetSeconds: 0,
    source: { type: "EMAIL", id: "02s1", title: "Re: commercial proposal", occurredAt: "2026-10-02T09:00:00Z", url: "https://sf/02s1" },
    authorRole: "CUSTOMER",
    ...overrides,
  });

describe("evidence sources", () => {
  it("reads a quote from an older backend as a call quote, said by nobody known", () => {
    const old = quote();
    expect(sourceOf(old)).toEqual({
      type: "CALL",
      id: "22",
      title: "Nordlys – budget sign-off",
      occurredAt: "2026-09-24T07:30:00Z",
      url: null,
    });
    expect(roleOf(old)).toBe("UNKNOWN");
  });

  it("puts the newest evidence first, whatever its source", () => {
    const call = quote({ quote: "call" });
    const mail = email({ quote: "mail" });
    expect(newestFirst([call, mail]).map((q) => q.quote)).toEqual(["mail", "call"]);
  });

  it("counts only the customer's own words as customer evidence", () => {
    expect(hasCustomerEvidence([quote({ authorRole: "WSO2" }), quote()])).toBe(false);
    expect(hasCustomerEvidence([quote({ authorRole: "WSO2" }), email()])).toBe(true);
  });

  it("builds the timeline and counts from the deal's calls when the backend sends neither", () => {
    const d = detail();
    expect(activityOf(d).map((a) => [a.type, a.meetingId, a.letters])).toEqual([
      ["CALL", 21, ["M", "E", "I"]],
      ["CALL", 22, ["M", "E", "DP", "P", "I"]],
    ]);
    expect(sourcesOf(d, Date.parse("2026-10-09T00:00:00Z"))).toEqual({
      calls: 2,
      emails: 0,
      activities: 0,
      lastActivityAt: "2026-09-24T07:30:00.000Z",
    });
  });

  it("uses the backend's counts when it sends them, and names only the sources with any", () => {
    const sources = { calls: 4, emails: 1, activities: 0, lastActivityAt: "2026-10-02T09:00:00Z" };
    expect(sourcesOf(detail({ sources }))).toBe(sources);
    expect(describeSources(sources)).toBe("4 calls · 1 email");
  });
});

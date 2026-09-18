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

import { describe, it, expect } from "vitest";
import {
  activeFilterCount,
  claimantName,
  emptyApprovalFilters,
  statusesForTab,
  tabHasYearRange,
  toApprovalSearchPayload,
  yearBounds,
  type OpdApprovalFilters,
} from "./opdApprovals";

const NOW = new Date("2026-09-18T00:00:00Z");
const base = (over: Partial<OpdApprovalFilters> = {}): OpdApprovalFilters => ({
  ...emptyApprovalFilters(NOW),
  ...over,
});

describe("what each tab asks for", () => {
  it("maps the tab to its status", () => {
    expect(statusesForTab("pending")).toEqual(["PENDING"]);
    expect(statusesForTab("approved")).toEqual(["APPROVED"]);
    expect(statusesForTab("rejected")).toEqual(["REJECTED"]);
  });

  // filteredClaimsSlice.ts:82-89 — claims filed before the status was split
  // carry PENDING_OLD, and leaving it out hides waiting work completely.
  it("brings PENDING_OLD along with the pending queue", () => {
    expect(toApprovalSearchPayload("pending", base(), NOW).status).toEqual([
      "PENDING",
      "PENDING_OLD",
    ]);
  });
});

// Approvals.tsx:74-76 — a claim waiting on a decision is waiting now, whatever
// year it was filed in. A year filter there would hide work still to be done.
describe("the year range", () => {
  it("does not apply to the pending queue", () => {
    expect(tabHasYearRange("pending")).toBe(false);
    const payload = toApprovalSearchPayload("pending", base({ period: "last" }), NOW);
    expect(payload.startYear).toBeUndefined();
    expect(payload.endYear).toBeUndefined();
  });

  it("applies to the decided queues", () => {
    expect(tabHasYearRange("approved")).toBe(true);
    expect(toApprovalSearchPayload("approved", base(), NOW)).toMatchObject({
      startYear: 2026,
      endYear: 2026,
    });
  });

  it("reads last year off the clock, not the stored years", () => {
    expect(yearBounds(base({ period: "last", startYear: 2000, endYear: 2000 }), NOW)).toEqual({
      startYear: 2025,
      endYear: 2025,
    });
  });

  // Either end can be picked first, so choosing the later year first is a
  // legitimate sequence; unordered it would come back empty.
  it("orders a backwards custom span", () => {
    expect(yearBounds(base({ period: "custom", startYear: 2026, endYear: 2023 }), NOW)).toEqual({
      startYear: 2023,
      endYear: 2026,
    });
  });
});

describe("the filters on the wire", () => {
  // This screen is everybody's claims — that is the point of it. Scoping to the
  // caller would turn the approval queue into their own history.
  it("does not scope to the person looking", () => {
    expect(toApprovalSearchPayload("pending", base(), NOW).email).toBeNull();
  });

  it("sends a typed email and claim id, trimmed", () => {
    const payload = toApprovalSearchPayload(
      "pending",
      base({ email: " someone@wso2.com ", claimId: " OPD-7 " }),
      NOW,
    );
    expect(payload.email).toBe("someone@wso2.com");
    expect(payload.ids).toEqual(["OPD-7"]);
  });

  // `[""]` would ask for a claim whose id is the empty string and find nothing.
  it("treats blanks as no filter", () => {
    const payload = toApprovalSearchPayload("pending", base({ email: "  ", claimId: "  " }), NOW);
    expect(payload.email).toBeNull();
    expect(payload.ids).toBeNull();
  });
});

describe("the Filters count", () => {
  it("is quiet on a fresh queue", () => {
    expect(activeFilterCount("pending", base())).toBe(0);
  });

  it("counts each filter", () => {
    expect(activeFilterCount("approved", base({ email: "a@wso2.com" }))).toBe(1);
    expect(activeFilterCount("approved", base({ email: "a@wso2.com", claimId: "OPD-1" }))).toBe(2);
    expect(activeFilterCount("approved", base({ period: "last" }))).toBe(1);
  });

  // The year range is not a filter on a tab that does not have one.
  it("ignores the year range on the pending queue", () => {
    expect(activeFilterCount("pending", base({ period: "last" }))).toBe(0);
  });
});

describe("whose claim it is", () => {
  const employees = [
    { firstName: "Some", lastName: "One", workEmail: "someone@wso2.com", employeeThumbnail: null },
  ];

  it("names the claimant from the directory", () => {
    expect(claimantName("someone@wso2.com", employees)).toBe("Some One");
  });

  // An employee the directory has never heard of is still somebody whose claim
  // is waiting, so the row must never come out blank.
  it("falls back to the address", () => {
    expect(claimantName("nobody@wso2.com", employees)).toBe("nobody@wso2.com");
    expect(claimantName("someone@wso2.com", undefined)).toBe("someone@wso2.com");
  });
});

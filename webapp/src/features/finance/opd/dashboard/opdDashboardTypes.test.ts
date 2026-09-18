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
  claimLimitOf,
  normalizeDashboardSummary,
  utilizationName,
  utilizationPercent,
  utilizationTone,
  type OpdUtilizationRow,
} from "./opdDashboardTypes";

const row = (over: Partial<OpdUtilizationRow> = {}): OpdUtilizationRow => ({
  employeeEmail: "someone@wso2.com",
  firstName: "Some",
  lastName: "One",
  submittedAmount: 1000,
  claimLimit: 40000,
  percentUsed: 2.5,
  ...over,
});

describe("who a row is about", () => {
  it("uses the name when there is one", () => {
    expect(utilizationName(row())).toBe("Some One");
  });

  // An employee with no name on file is still somebody whose spend finance
  // needs to see, so the row must never come out blank.
  it("falls back to the work email", () => {
    expect(utilizationName(row({ firstName: "", lastName: "" }))).toBe("someone@wso2.com");
  });

  it("copes with only one of the two names", () => {
    expect(utilizationName(row({ lastName: "" }))).toBe("Some");
  });
});

describe("the percentage shown", () => {
  it("rounds", () => {
    expect(utilizationPercent(80.6)).toBe(81);
  });

  // The backend divides submitted by the limit, so a corrected claim can put
  // this above 100 and a zero limit makes it Infinity. Neither is a number to
  // put in front of anyone.
  it("clamps above 100", () => {
    expect(utilizationPercent(140)).toBe(100);
  });

  it("clamps below zero", () => {
    expect(utilizationPercent(-5)).toBe(0);
  });

  it("survives a non-finite value", () => {
    expect(utilizationPercent(Infinity)).toBe(0);
    expect(utilizationPercent(NaN)).toBe(0);
  });
});

// ClaimUtilizationTable.tsx:86 — 90 and over is over-spend territory, 70 and
// over is worth noticing, below that is unremarkable.
describe("the colour band", () => {
  it("marks 90% and over as high", () => {
    expect(utilizationTone(90)).toBe("high");
    expect(utilizationTone(99.9)).toBe("high");
  });

  it("marks 70% up to 90% as medium", () => {
    expect(utilizationTone(70)).toBe("medium");
    expect(utilizationTone(89.9)).toBe("medium");
  });

  it("leaves anything under 70% unmarked", () => {
    expect(utilizationTone(69.9)).toBe("normal");
    expect(utilizationTone(0)).toBe("normal");
  });
});

describe("the limit quoted beside the title", () => {
  it("is read off the first row", () => {
    expect(claimLimitOf([row(), row({ claimLimit: 999 })])).toBe(40000);
  });

  // With no rows there is no limit to quote, and inventing one would put a
  // figure on screen the backend never said.
  it("is absent when nobody has claimed", () => {
    expect(claimLimitOf([])).toBeNull();
  });
});

// authedGet's type parameter is a claim about the body, not a check on it. A
// missing `utilization` reached claimLimitOf, which reads `.length`, and took
// the screen down rather than rendering an empty table.
describe("making the response safe to render", () => {
  it("survives a body with nothing in it", () => {
    const summary = normalizeDashboardSummary({});
    expect(summary.utilization).toEqual([]);
    expect(summary.claimsProcessed).toBe(0);
    expect(claimLimitOf(summary.utilization)).toBeNull();
  });

  it("survives a null body", () => {
    expect(normalizeDashboardSummary(null).utilization).toEqual([]);
  });

  it("treats a null utilization as no rows", () => {
    expect(normalizeDashboardSummary({ utilization: null }).utilization).toEqual([]);
  });

  it("keeps the figures it was actually given", () => {
    const summary = normalizeDashboardSummary({
      claimsProcessed: 6,
      valuePending: 172342.2,
      utilization: [
        { employeeEmail: "a@wso2.com", firstName: "A", lastName: "B", submittedAmount: 10, claimLimit: 40000, percentUsed: 0.025 },
      ],
    });
    expect(summary.claimsProcessed).toBe(6);
    expect(summary.valuePending).toBe(172342.2);
    expect(summary.utilization).toHaveLength(1);
  });

  it("drops a row with no email, since that is the table's key", () => {
    const summary = normalizeDashboardSummary({
      utilization: [{ firstName: "No" }, { employeeEmail: "a@wso2.com" }],
    });
    expect(summary.utilization.map((r) => r.employeeEmail)).toEqual(["a@wso2.com"]);
  });

  it("fills in a row's missing names and numbers rather than dropping it", () => {
    const [row] = normalizeDashboardSummary({
      utilization: [{ employeeEmail: "a@wso2.com" }],
    }).utilization;
    expect(row).toEqual({
      employeeEmail: "a@wso2.com",
      firstName: "",
      lastName: "",
      submittedAmount: 0,
      claimLimit: 0,
      percentUsed: 0,
    });
  });

  it("refuses a non-finite figure", () => {
    expect(normalizeDashboardSummary({ claimsPending: Infinity }).claimsPending).toBe(0);
    expect(normalizeDashboardSummary({ claimsPending: "51" }).claimsPending).toBe(0);
  });
});

// The colour band has to classify the number on screen, not the raw one: 89.6
// prints as 90%, and banding the raw value coloured it amber beside a figure
// reading 90.
describe("the band matches the figure shown", () => {
  it("bands 89.6 the way it is printed", () => {
    const percent = utilizationPercent(89.6);
    expect(percent).toBe(90);
    expect(utilizationTone(percent)).toBe("high");
  });

  it("bands a non-finite value as the 0% it prints", () => {
    const percent = utilizationPercent(Infinity);
    expect(percent).toBe(0);
    expect(utilizationTone(percent)).toBe("normal");
  });
});

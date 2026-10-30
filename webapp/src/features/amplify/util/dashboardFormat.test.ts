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

import { describe, expect, it } from "vitest";
import type { ScorecardMeasure } from "../api/amplifyTypes";
import {
  announcementLabel,
  commentedReposts,
  plainReposts,
  updatedStamp,
  changePercent,
  deltaText,
  fraction,
  measureValue,
  num,
  percentOf,
  rate,
  scoreBar,
  targetText,
} from "./dashboardFormat";

const measure = (over: Partial<ScorecardMeasure>): ScorecardMeasure => ({
  key: "connected",
  label: "Employees connected",
  unit: "PERCENT",
  value: 18.04,
  target: 25,
  comparison: "AT_LEAST",
  status: "WATCH",
  ...over,
});

describe("dashboardFormat", () => {
  it("formats numbers and rates", () => {
    expect(num(1840)).toBe("1,840");
    expect(num(null)).toBe("0");
    expect(rate(0.667)).toBe("67%");
    expect(percentOf(150, 830)).toBe("18%");
    expect(percentOf(1, 0)).toBe("-");
    expect(percentOf(1, null)).toBe("-");
  });

  it("describes change without inventing a base", () => {
    expect(deltaText(187, 164, "last month")).toBe("+23 vs last month");
    expect(deltaText(5, 9)).toBe("-4 vs previous period");
    expect(deltaText(3, 3)).toBe("same as previous period");
    expect(changePercent(138, 100)).toBe("+38%");
    expect(changePercent(5, 0)).toBe("-");
  });

  it("words the Chat card state, with the retry the worker is on", () => {
    expect(announcementLabel(undefined)).toBe("Not announced");
    expect(announcementLabel({ status: "NONE" })).toBe("Not announced");
    expect(announcementLabel({ status: "SENT" })).toBe("Sent");
    expect(announcementLabel({ status: "FAILED" })).toBe("Failed after retries");
    expect(announcementLabel({ status: "QUEUED", attempts: 3 })).toBe("Retrying · attempt 3");
    expect(announcementLabel({ status: "QUEUED", attempts: 0 })).toBe("Queued");
  });

  it("shows a scorecard value against its target and the API's own counts", () => {
    expect(measureValue(measure({}))).toBe("18%");
    expect(measureValue(measure({ unit: "COUNT", value: 1500 }))).toBe("1,500");
    expect(targetText(measure({}))).toBe("At least 25%");
    expect(targetText(measure({ comparison: "AT_MOST", target: 5 }))).toBe("At most 5%");
    expect(fraction(measure({ numerator: 150, denominator: 830 }))).toBe("150 / 830");
    expect(fraction(measure({}))).toBeNull();
  });
});

describe("updatedStamp", () => {
  it("shows Sri Lanka, US Eastern and UTC on one line (EDT in summer, with the +5:30 offset)", () => {
    expect(updatedStamp("2026-07-15T09:35:00Z")).toBe(
      "Updated 3:05 PM LK | Updated 5:35 AM EDT | Updated 9:35 AM UTC",
    );
  });

  it("uses EST in winter and rolls the clock past midnight per zone", () => {
    expect(updatedStamp("2026-01-15T20:10:00Z")).toBe(
      "Updated 1:40 AM LK | Updated 3:10 PM EST | Updated 8:10 PM UTC",
    );
  });

  it("is empty for a bad timestamp", () => {
    expect(updatedStamp("nope")).toBe("");
  });
});

describe("reposts split", () => {
  it("adds up to the total, and treats a missing split as no comments", () => {
    expect(plainReposts({ reposts: 48, repostsWithCommentary: 18 })).toBe(30);
    expect(commentedReposts({ reposts: 48, repostsWithCommentary: 18 })).toBe(18);
    expect(plainReposts({ reposts: 48 })).toBe(48);
    expect(commentedReposts({ reposts: 48 })).toBe(0);
  });
});

describe("scoreBar", () => {
  const m = (over: Partial<ScorecardMeasure>) => measure(over);

  it("scales percent measures 0 to 100 and puts the target mark where the target is", () => {
    const b = scoreBar(m({ value: 18, target: 25, comparison: "AT_LEAST" }));
    expect(b.fill).toBeCloseTo(0.18);
    expect(b.tick).toBeCloseTo(0.25);
    expect(b.tickLabel).toBe("Target 25%");
    expect(b.max).toBe(100);
    expect(b.now).toBe(18);
    expect(b.text).toBe("18% of 25% target");
  });

  it("marks the ceiling for an at-most percent measure, filling past it on a breach", () => {
    const ok = scoreBar(m({ value: 2.7, target: 5, comparison: "AT_MOST" }));
    expect(ok.fill).toBeCloseTo(0.027);
    expect(ok.tick).toBeCloseTo(0.05);
    expect(ok.tickLabel).toBe("Ceiling 5%");
    expect(ok.text).toBe("2.7% against a 5% ceiling");
    const breach = scoreBar(m({ value: 20, target: 5, comparison: "AT_MOST" }));
    expect(breach.fill).toBeCloseTo(0.2);
    expect(breach.fill).toBeGreaterThan(breach.tick);
  });

  it("scales count measures to max(value, target) * 1.25, so the mark stays inside the bar", () => {
    const under = scoreBar(m({ value: 25, target: 100, unit: "COUNT", comparison: "AT_LEAST" }));
    expect(under.max).toBe(125);
    expect(under.fill).toBeCloseTo(0.2);
    expect(under.tick).toBeCloseTo(0.8);
    expect(under.tickLabel).toBe("Target 100");
    const over = scoreBar(m({ value: 187, target: 150, unit: "COUNT", comparison: "AT_LEAST" }));
    expect(over.max).toBeCloseTo(233.75);
    expect(over.fill).toBeCloseTo(0.8);
    expect(over.tick).toBeCloseTo(150 / 233.75);
    expect(over.now).toBe(187);
    expect(over.text).toBe("187 of 150 target");
  });

  it("does not divide by zero: a zero target and zero value is an empty bar with the mark at the start", () => {
    const none = scoreBar(m({ value: 0, target: 0, unit: "COUNT", comparison: "AT_LEAST" }));
    expect(none.fill).toBe(0);
    expect(none.tick).toBe(0);
    expect(none.max).toBe(1);
    const zeroTarget = scoreBar(m({ value: 4, target: 0, unit: "COUNT", comparison: "AT_LEAST" }));
    expect(zeroTarget.fill).toBeCloseTo(0.8);
    expect(zeroTarget.tick).toBe(0);
  });

  it("clamps a percent over 100 and treats a bad number as zero", () => {
    expect(scoreBar(m({ value: 250, target: 25 })).fill).toBe(1);
    expect(scoreBar(m({ value: Number.NaN, target: 25 })).fill).toBe(0);
    expect(scoreBar(m({ value: 10, target: -5 })).tick).toBe(0);
  });
});

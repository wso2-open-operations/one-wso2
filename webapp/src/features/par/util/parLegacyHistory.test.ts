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
import {
  deriveLegacyCycleDates,
  deriveLegacyRatingFromScore,
  formatLegacyCycleName,
  getLegacySharedByName,
  isThreeSixtyConfirmation,
  parseLegacyFeedback360,
  parseLegacyQuestionAnswers,
} from "./parLegacyHistory";

describe("formatLegacyCycleName", () => {
  it("normalizes every known raw 2015 variant to its canonical display name", () => {
    expect(formatLegacyCycleName("ANNUAL PERFORMANCE REVIEW -2015")).toBe("2015 ANNUAL PERFORMANCE REVIEW");
    expect(formatLegacyCycleName("ANNUAL PERFORMANCE REVIEW for Team Leads -2015")).toBe(
      "2015 ANNUAL PERFORMANCE REVIEW for Team Leads",
    );
    expect(formatLegacyCycleName("ANNUAL PERFORMANCE REVIEW for Engineering Team Leads - 2015")).toBe(
      "2015 ANNUAL PERFORMANCE REVIEW for Engineering Team Leads",
    );
    expect(formatLegacyCycleName("ANNUAL PERFORMANCE REVIEW for Engineering Employees - 2015")).toBe(
      "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees",
    );
  });

  // Hand-confirmed from a real migration sample -- these raw forms were
  // previously unrecognized, falling through to the uncatalogued/"Not
  // Assigned" path for real employee data.
  it("normalizes the numbered no-year 2015 Engineering Employees variant", () => {
    expect(formatLegacyCycleName("(3) ANNUAL PERFORMANCE REVIEW - Engineering Employees")).toBe(
      "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees",
    );
  });

  it("normalizes 2016 cycle names exported without the year prefix", () => {
    expect(formatLegacyCycleName("Quarterly Review - Q2")).toBe("2016 Quarterly Review - Q2");
    expect(formatLegacyCycleName("Quarterly Review - Q3/Q4")).toBe("2016 Quarterly Review - Q3/Q4");
  });

  it("collapses internal whitespace drift (e.g. a double space) without otherwise changing an uncatalogued name", () => {
    expect(formatLegacyCycleName("2019  Performance Evaluation - Q2")).toBe("2019 Performance Evaluation - Q2");
  });

  it("passes through an already-canonical or genuinely-uncatalogued name unchanged", () => {
    expect(formatLegacyCycleName("2022 Performance Evaluation - H1")).toBe("2022 Performance Evaluation - H1");
    expect(formatLegacyCycleName("2099 Some Future Cycle")).toBe("2099 Some Future Cycle");
  });
});

describe("parseLegacyQuestionAnswers", () => {
  it("parses a valid JSON array", () => {
    const json = JSON.stringify([{ title: "Q1", employeeAnswer: "A1", managerFeedback: "F1" }]);
    expect(parseLegacyQuestionAnswers(json)).toEqual([{ title: "Q1", employeeAnswer: "A1", managerFeedback: "F1" }]);
  });

  it("returns an empty array for null", () => {
    expect(parseLegacyQuestionAnswers(null)).toEqual([]);
  });

  it("returns an empty array for malformed JSON instead of throwing", () => {
    expect(parseLegacyQuestionAnswers("{not json")).toEqual([]);
  });
});

describe("parseLegacyFeedback360", () => {
  it("parses a valid JSON array", () => {
    const json = JSON.stringify([{ reviewerName: "Jane", reviewRating: "Successful", reviewComment: "Great" }]);
    expect(parseLegacyFeedback360(json)).toEqual([
      { reviewerName: "Jane", reviewRating: "Successful", reviewComment: "Great" },
    ]);
  });

  it("returns an empty array for null or malformed JSON", () => {
    expect(parseLegacyFeedback360(null)).toEqual([]);
    expect(parseLegacyFeedback360("nope")).toEqual([]);
  });
});

describe("deriveLegacyRatingFromScore", () => {
  it("maps each known score code", () => {
    expect(deriveLegacyRatingFromScore(1)).toEqual({ rating: "Successful", special: "TOP5P" });
    expect(deriveLegacyRatingFromScore(2)).toEqual({ rating: "Successful", special: "TOP20P" });
    expect(deriveLegacyRatingFromScore(3)).toEqual({ rating: "Successful", special: null });
    expect(deriveLegacyRatingFromScore(4)).toEqual({ rating: "Needs Improvements", special: null });
  });

  it("maps an unknown score or null to nothing", () => {
    expect(deriveLegacyRatingFromScore(5)).toEqual({ rating: null, special: null });
    expect(deriveLegacyRatingFromScore(null)).toEqual({ rating: null, special: null });
  });
});

describe("deriveLegacyCycleDates", () => {
  it("derives H1 as Jan 1 - Jun 30", () => {
    expect(deriveLegacyCycleDates("2023 Performance Evaluation - H1")).toEqual({
      startDate: "2023-01-01",
      endDate: "2023-06-30",
    });
  });

  it("derives H2 as Jul 1 - Dec 31", () => {
    expect(deriveLegacyCycleDates("2023 Performance Evaluation - H2")).toEqual({
      startDate: "2023-07-01",
      endDate: "2023-12-31",
    });
  });

  it("returns nulls for a name that doesn't match the convention", () => {
    expect(deriveLegacyCycleDates("Some Other Cycle")).toEqual({ startDate: null, endDate: null });
  });
});

describe("isThreeSixtyConfirmation", () => {
  const qa = (title: string | null) => ({ title, employeeAnswer: null, managerFeedback: null });

  it("matches the title with or without a trailing period", () => {
    expect(isThreeSixtyConfirmation(qa("360 Confirmation."))).toBe(true);
    expect(isThreeSixtyConfirmation(qa(" 360 Confirmation "))).toBe(true);
    expect(isThreeSixtyConfirmation(qa("360 Feedback"))).toBe(false);
    expect(isThreeSixtyConfirmation(qa(null))).toBe(false);
  });
});

describe("getLegacySharedByName", () => {
  const qa = (managerAnsweredBy?: string | null) => ({
    title: "Q",
    employeeAnswer: null,
    managerFeedback: null,
    managerAnsweredBy,
  });

  it("returns the first recorded Manager Answer By", () => {
    expect(getLegacySharedByName([qa(null), qa("Lead One"), qa("Lead Two")])).toBe("Lead One");
  });

  it("skips blank names and trims the one it returns", () => {
    expect(getLegacySharedByName([qa("   "), qa("  Lead One ")])).toBe("Lead One");
  });

  it("returns null when no answerer was recorded", () => {
    expect(getLegacySharedByName([qa()])).toBeNull();
    expect(getLegacySharedByName([qa("  ")])).toBeNull();
    expect(getLegacySharedByName([])).toBeNull();
  });
});

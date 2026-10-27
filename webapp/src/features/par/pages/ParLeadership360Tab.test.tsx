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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Leadership360ResultsEntry, Leadership360Survey } from "../api/leadership360Types";

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });

let surveys: Leadership360Survey[] = [];
let results: Leadership360ResultsEntry[] = [];
const resultsViews: string[] = [];

vi.mock("../api/useLeadership360", async (importOriginal) => ({
  resultsSurveys: (await importOriginal<typeof import("../api/useLeadership360")>()).resultsSurveys,
  useCurrentLeadership360Survey: () => query(null),
  useLeadership360Leaders: () => query([]),
  useMyLeadership360Feedback: () => query({ drafts: [], submittedLeaderEmails: [] }),
  useLeadership360Surveys: () => query(surveys),
  useLeadership360Results: (_surveyId: number | undefined, view: string) => {
    resultsViews.push(view);
    return query(results);
  },
  useLeadership360Summary: () => query(undefined),
  useLeadership360SurveyWithTemplate: () => query(undefined),
}));

const { default: ParLeadership360Tab } = await import("./ParLeadership360Tab");

const closedSurvey: Leadership360Survey = {
  surveyId: 3,
  surveyName: "Leadership 360 2026",
  formTemplateId: 1,
  startDate: "2026-11-01",
  endDate: "2026-11-20",
  status: "CLOSED",
};

beforeEach(() => {
  surveys = [];
  results = [];
  resultsViews.length = 0;
});

describe("ParLeadership360Tab", () => {
  it("says so when no survey is open, and shows no results to someone with none", () => {
    surveys = [closedSurvey];
    render(<ParLeadership360Tab />);
    expect(screen.getByText("No Leadership 360° survey is open right now.")).toBeInTheDocument();
    expect(screen.queryByText("Leadership 360° results")).not.toBeInTheDocument();
  });

  it("asks only for your own results, never other leaders'", () => {
    surveys = [closedSurvey];
    render(<ParLeadership360Tab />);
    expect(new Set(resultsViews)).toEqual(new Set(["SELF"]));
  });

  it("shows a leader their own results once available", () => {
    surveys = [closedSurvey];
    results = [
      {
        leader: { workEmail: "a@wso2.com", employeeName: "Ada", jobRole: null, employeeThumbnail: null },
        responseCount: 4,
        available: true,
      },
    ];
    render(<ParLeadership360Tab />);
    expect(screen.getByText("Your Leadership 360° results")).toBeInTheDocument();
    expect(screen.getByText("4 responses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View results" })).toBeInTheDocument();
  });

  it("says when a leader's own results aren't available yet", () => {
    surveys = [closedSurvey];
    results = [
      {
        leader: { workEmail: "a@wso2.com", employeeName: "Ada", jobRole: null, employeeThumbnail: null },
        responseCount: 2,
        available: false,
      },
    ];
    render(<ParLeadership360Tab />);
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View results" })).not.toBeInTheDocument();
  });
});

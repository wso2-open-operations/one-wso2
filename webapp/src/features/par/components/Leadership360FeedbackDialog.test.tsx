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
import { fireEvent, render, screen } from "@testing-library/react";
import type { Leadership360CurrentSurvey } from "../api/leadership360Types";

const submitMutate = vi.fn();
const draftMutate = vi.fn();

vi.mock("../api/useLeadership360", () => ({
  useSaveLeadership360Draft: () => ({ mutate: draftMutate, isPending: false, isError: false, isSuccess: false }),
  useSubmitLeadership360Feedback: () => ({ mutate: submitMutate, isPending: false, isError: false }),
}));

const { default: Leadership360FeedbackDialog } = await import("./Leadership360FeedbackDialog");

const survey: Leadership360CurrentSurvey = {
  survey: {
    surveyId: 7,
    surveyName: "Leadership 360 2026",
    formTemplateId: 1,
    startDate: "2026-11-01",
    endDate: "2026-11-20",
    status: "OPEN",
  },
  template: {
    formTemplateId: 1,
    formKind: "LEADERSHIP_360",
    formVersion: 1,
    definition: {
      kind: "LEADERSHIP_360",
      version: 1,
      title: "Leadership 360° feedback",
      scales: { agreement: { min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" } },
      sections: [
        {
          id: "relationship",
          title: "How you work with them",
          display: "HEADER",
          questions: [
            {
              id: "relationship",
              type: "CHOICE",
              text: "How do you work with this leader?",
              required: true,
              options: [{ value: "DIRECT_LEAD", label: "They are my direct lead" }],
            },
          ],
        },
        {
          id: "traits",
          title: "Personal traits",
          questions: [{ id: "integrity", type: "RATING", scale: "agreement", text: "Shows integrity", required: true }],
        },
        {
          id: "other",
          title: "Other feedback",
          questions: [{ id: "other", type: "TEXT", text: "Anything else?", required: false }],
        },
      ],
    },
  },
};

const leader = { workEmail: "lead@wso2.com", employeeName: "Ada Lead", jobRole: "Director", employeeThumbnail: null };

function renderDialog() {
  render(
    <Leadership360FeedbackDialog open onClose={() => {}} survey={survey} leader={leader} onSubmitted={() => {}} />,
  );
}

beforeEach(() => {
  submitMutate.mockReset();
  draftMutate.mockReset();
});

describe("Leadership360FeedbackDialog", () => {
  it("is anonymous by default and says nobody will see who you are", () => {
    renderDialog();
    expect(screen.getByRole("switch", { name: "Submit anonymously" })).toBeChecked();
    expect(screen.getByText(/Nobody — not the leader, their manager or People Ops — can see who you are/)).toBeInTheDocument();
  });

  it("says who will see the name once anonymity is switched off", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("switch", { name: "Submit anonymously" }));
    expect(screen.getByText(/People Ops and Ada Lead's manager will see your name/)).toBeInTheDocument();
  });

  it("doesn't submit while a required question is unanswered", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit anonymously" }));
    expect(screen.getByText("2 required questions still need an answer.")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("asks for confirmation, then submits only the answers given", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "They are my direct lead" }));
    fireEvent.click(screen.getByRole("button", { name: "4 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit anonymously" }));

    expect(screen.getByText("Submit feedback on Ada Lead?")).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Submit anonymously" }).at(-1)!;
    fireEvent.click(confirm);
    expect(submitMutate).toHaveBeenCalledWith(
      { leaderEmail: "lead@wso2.com", answers: { relationship: "DIRECT_LEAD", integrity: 4 }, anonymous: true },
      expect.anything(),
    );
  });
});

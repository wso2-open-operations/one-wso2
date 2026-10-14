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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DealJourney, { DealJourneyLegend } from "./DealJourney";
import type { Journey, SourceSummary, TimelineMark } from "../types";

const NOW = Date.parse("2026-10-14T09:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
const sources = (overrides: Partial<SourceSummary> = {}): SourceSummary => ({
  calls: 3, emails: 1, activities: 0, lastActivityAt: day(-4), ...overrides,
});
const STAGES = ["Qualify", "Validate", "Technical Proof", "Business Proof", "Proposal"];

const marks: TimelineMark[] = [
  { type: "CALL", kind: "CUSTOMER_CALL", at: day(-60), title: "Intro", meetingId: 1 },
  { type: "CALL", kind: "INTERNAL_CALL", at: day(-40), title: "Deal review", meetingId: 2 },
  { type: "EMAIL", kind: "EMAIL", at: day(-4), title: "Re: proposal", meetingId: null },
  { type: "CALL", kind: "CUSTOMER_CALL", at: day(5), title: "POC review", meetingId: 3 },
];
const journey: Journey = {
  startedAt: day(-80),
  stages: [
    { stage: "Qualify", at: day(-60), source: "CALL" },
    { stage: "Technical Proof", at: day(-20), source: "CALL" },
    { stage: "Business Proof", at: day(0), source: "CURRENT" },
  ],
};

const renderJourney = (props: Partial<Parameters<typeof DealJourney>[0]> = {}) =>
  render(
    <DealJourney
      marks={marks}
      journey={journey}
      sources={sources()}
      closeDate="2026-12-31"
      stageOrder={STAGES}
      now={NOW}
      {...props}
    />,
  );

describe("DealJourney", () => {
  it("names each mark by what it was: customer call, internal discussion, email", () => {
    renderJourney();
    const track = screen.getByRole("list", { name: /^Deal journey/ });
    expect(within(track).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText(/^Customer call · Intro/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Internal discussion · Deal review/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email · Re: proposal/)).toBeInTheDocument();
  });

  it("draws the stages it moved through, and the stretch before the first call as not recorded", () => {
    renderJourney();
    expect(screen.getByLabelText("Stage not recorded before the first call")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Qualify · /)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Technical Proof · /)).toBeInTheDocument();
    expect(screen.getByLabelText("Business Proof · now, until the close")).toBeInTheDocument();
    expect(screen.getByLabelText("Close date 31/12/2026")).toBeInTheDocument();
    expect(screen.getByText(/^Qualify › Technical Proof › Business Proof · started/)).toBeInTheDocument();
    expect(screen.getByText(/day 81 · 78 days to close/)).toBeInTheDocument();
  });

  it("counts down to the close, and up once it has passed", () => {
    const { unmount } = renderJourney({ closeDate: "2026-10-14" });
    expect(screen.getByText(/closes today/)).toBeInTheDocument();
    unmount();
    renderJourney({ closeDate: "2026-10-13" });
    expect(screen.getByText(/1 day past close/)).toBeInTheDocument();
  });

  it("counts the activity by kind and says when it last moved", () => {
    renderJourney();
    expect(screen.getByText(/2 customer calls · 1 internal discussion · 1 email/)).toBeInTheDocument();
    expect(screen.getByText(/last 4 days ago/)).toBeInTheDocument();
  });

  it("opens a call, upcoming or past, on its analysis", async () => {
    const onOpenCall = vi.fn();
    renderJourney({ onOpenCall });
    await userEvent.click(screen.getByRole("button", { name: /^Open Customer call \(upcoming\) · POC review/ }));
    expect(onOpenCall).toHaveBeenCalledWith(3);
  });

  it("flags a deal that has gone quiet, and copes with nothing at all", () => {
    const { unmount } = renderJourney({ sources: sources({ lastActivityAt: day(-34) }) });
    expect(screen.getByText(/quiet for 34 days/)).toBeInTheDocument();
    unmount();
    renderJourney({
      marks: [],
      journey: { startedAt: null, stages: [] },
      sources: { calls: 0, emails: 0, activities: 0, lastActivityAt: null },
      closeDate: null,
    });
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText(/^No stage recorded/)).toBeInTheDocument();
  });

  it("has a legend for every kind, the stages and the close date", () => {
    render(<DealJourneyLegend />);
    for (const label of ["Customer call", "Internal discussion", "Email", "Salesforce activity", "Upcoming (hollow)", "Stage: darker further along", "Stage not recorded before the first call", "Today", "Close date"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

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
import DealTimeline, { DealTimelineLegend } from "./DealTimeline";
import type { SourceSummary, TimelineMark } from "../types";

const NOW = Date.parse("2026-10-14T09:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
const sources = (overrides: Partial<SourceSummary> = {}): SourceSummary => ({
  calls: 2, emails: 1, activities: 0, lastActivityAt: day(-4), ...overrides,
});

describe("DealTimeline", () => {
  const marks: TimelineMark[] = [
    { type: "CALL", at: day(-200), title: "Intro", meetingId: 1 },
    { type: "CALL", at: day(-30), title: "Business case", meetingId: 2 },
    { type: "EMAIL", at: day(-4), title: "Re: proposal", meetingId: null },
    { type: "CALL", at: day(5), title: "POC review", meetingId: 3 },
  ];

  it("draws the window's marks, counts older ones at the edge, and says when it last moved", () => {
    render(<DealTimeline marks={marks} sources={sources()} now={NOW} />);
    const track = screen.getByRole("list", { name: "Activity over the last 90 days" });
    expect(within(track).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText(/2 calls · 1 email/)).toBeInTheDocument();
    expect(screen.getByText(/last 4 days ago/)).toBeInTheDocument();
  });

  it("names an upcoming call as upcoming, and opens a call's analysis", async () => {
    const onOpenCall = vi.fn();
    render(<DealTimeline marks={marks} sources={sources()} now={NOW} onOpenCall={onOpenCall} />);
    await userEvent.click(screen.getByRole("button", { name: /^Open Call \(upcoming\) · POC review/ }));
    expect(onOpenCall).toHaveBeenCalledWith(3);
    // The email is not a call, so it has no click; its label says what it is.
    expect(screen.getByLabelText(/^Email · Re: proposal/)).toBeInTheDocument();
  });

  it("flags a deal that has gone quiet", () => {
    render(<DealTimeline marks={[]} sources={sources({ lastActivityAt: day(-34) })} now={NOW} />);
    expect(screen.getByText(/quiet for 34 days/)).toBeInTheDocument();
  });

  it("says when there's nothing yet", () => {
    render(
      <DealTimeline marks={[]} sources={{ calls: 0, emails: 0, activities: 0, lastActivityAt: null }} now={NOW} />,
    );
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("has a legend for the shapes", () => {
    render(<DealTimelineLegend />);
    for (const label of ["Call", "Email", "Activity", "Upcoming"]) expect(screen.getByText(label)).toBeInTheDocument();
  });
});

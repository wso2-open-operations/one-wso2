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
import { render, screen } from "@testing-library/react";
import MeetingCoverageCell from "./MeetingCoverageCell";
import type { MeetingCoverage } from "../types";

const coverage = (overrides: Partial<MeetingCoverage> = {}): MeetingCoverage => ({
  meetingId: 7,
  status: "DONE",
  coverage: { M: 2, E: 0, DC: 1, DP: 2, P: 0, I: 1, CH: 2, CO: 0 },
  missed: [],
  stageAtCall: "Technical Proof",
  quotes: {},
  opportunityId: "006X",
  ...overrides,
});

const renderCell = (value: MeetingCoverage) =>
  render(
    <MeetingCoverageCell
      meetingTitle="Brightwater – POC review"
      coverage={value}
      loading={false}
      canReanalyse={false}
      reanalysing={false}
      onReanalyse={() => {}}
    />,
  );

describe("MeetingCoverageCell", () => {
  // One line: the stage sits in the same row as the circles rather than beneath them.
  it("puts the stage, the circles and what the call missed in one row", () => {
    const { container } = renderCell(coverage({ missed: ["DC", "CO"] }));
    const row = container.firstElementChild as HTMLElement;
    const circles = screen.getByRole("group", { name: "MEDDPICC coverage for Brightwater – POC review" });
    const stage = screen.getByText("Technical Proof");
    const missed = screen.getByText(/^Missed:/);
    for (const part of [circles, stage, missed]) expect(row.contains(part)).toBe(true);
    // Stage first, then the circles, then the miss: each is in a different direct child.
    const slot = (el: Element) => [...row.children].findIndex((child) => child.contains(el));
    expect([slot(stage), slot(circles), slot(missed)]).toEqual([0, 1, 2]);
  });

  it("keeps the stage's space when the call has no stage, so circles line up across rows", () => {
    const { container } = renderCell(coverage({ stageAtCall: null }));
    const row = container.firstElementChild as HTMLElement;
    expect(row.children[0].textContent).toBe("");
    expect(row.children[1].contains(screen.getByRole("group"))).toBe(true);
  });
});

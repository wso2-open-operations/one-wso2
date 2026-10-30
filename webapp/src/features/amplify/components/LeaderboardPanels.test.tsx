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

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Leaderboard } from "../api/amplifyTypes";
import { TeamLeaderboardPanel } from "./LeaderboardPanels";

vi.mock("./PersonLink", () => ({ default: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

function board(): Leaderboard {
  return {
    topN: 3,
    company: [],
    me: { employeeId: "e1", points: 10, rank: 1, pointsToNextRank: 0, pointsToTopN: 0, inTopN: true },
    myTeam: {
      teamName: "Digital Engineering",
      headcount: 2,
      activeCount: 2,
      entries: [
        { employeeId: "e1", displayName: "Ada Lovelace", email: "ada@example.com", points: 10, teamRank: 1, companyRank: 1, houseName: "Oak", isMe: true },
        { employeeId: "e2", displayName: "Grace Hopper", email: "grace@example.com", points: 5, teamRank: 2, companyRank: 2, houseName: null, isMe: false },
      ],
    },
    teamStatus: "OK",
  };
}

describe("TeamLeaderboardPanel", () => {
  it("shows each member's house, and a dash for a member with none", () => {
    render(<TeamLeaderboardPanel board={board()} people={new Map()} />);
    expect(screen.getByRole("columnheader", { name: "House" })).toBeTruthy();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Oak")).toBeTruthy();
    expect(within(rows[2]).getByText("—")).toBeTruthy();
  });
});

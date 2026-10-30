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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  DashboardGlance,
  DashboardOperations,
  DashboardParticipation,
  DashboardCampaigns,
  DashboardScorecard,
  GroupBoard,
} from "../../api/amplifyTypes";
import { exportRange, exportRangeProblem, nextSort } from "../../util/dashboardFormat";
import { GlanceBoard } from "./GlanceBoard";
import { OperationsBoard } from "./OperationsBoard";
import { ExportPanel, Funnel, HouseTable, TeamTable } from "./ParticipationBoard";
import { PostPerformanceBoard } from "./PostPerformanceBoard";
import { ScorecardBoard } from "./ScorecardBoard";

const showError = vi.fn();
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess: vi.fn() }),
}));

vi.mock("../../api/useAmplifyEditorAccess", () => ({
  useAmplifyDashboardAccess: () => ({ hasAccess: true, isResolving: false, retry: vi.fn() }),
}));
vi.mock("../../api/useAmplifyDashboards", () => ({
  useDashboardPerson: () => ({
    isPending: false,
    isError: false,
    data: {
      employeeId: "e1",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      reposts: 1,
      repostsWithCommentary: 1,
      pointsThisMonth: 40,
      campaigns: [{ campaignId: "c1", title: "Launch", categoryCode: "PRODUCT", categoryLabel: "Product", isPriority: true, opensAt: "2026-10-19T00:00:00Z", closesAt: "2026-11-18T00:00:00Z", reposts: 1, repostsWithCommentary: 1, points: 25 }],
      byCategory: [{ code: "PRODUCT", label: "Product", reposts: 1, repostsWithCommentary: 1, points: 25 }],
    },
  }),
  useDashboardExport: () => vi.fn(),
  useDashboardParticipation: vi.fn(),
  useGroupBoard: vi.fn(),
}));
vi.mock("@features/org-chart/api/useOrgChart", () => ({
  useEmployeeDirectory: () => ({
    data: [{ employeeId: "E1", firstName: "Ada", lastName: "Lovelace", workEmail: "ada@example.com", employeeThumbnail: null, team: "Digital Engineering", businessUnit: "Engineering" }],
  }),
}));

const operations: DashboardOperations = {
  asOf: "2026-10-22T09:15:00Z",
  headcount: 830,
  kpis: {
    campaignsLive: 6,
    campaignsLivePriority: 2,
    campaignsClosingWithin7Days: 1,
    repostsThisMonth: 187,
    repostsPrevMonth: 164,
    peopleConnected: 150,
    connectionsExpired: 4,
    pointsThisMonth: 1840,
    peopleWithPoints: 128,
  },
  campaigns: [
    {
      campaignId: "c1",
      title: "WSO2 at KubeCon",
      categoryCode: "EVENT",
      categoryLabel: "Event",
      isPriority: true,
      opensAt: "2026-10-20T00:00:00Z",
      closesAt: "2026-11-19T00:00:00Z",
      reposts: 48,
      announcement: { status: "QUEUED", attempts: 3 },
    },
  ],
  shareHealth: { windowStart: "2026-10-01T00:00:00Z", published: 187, queued: 2, failed: 5, failedByReason: { NEEDS_RECONNECT: 4, PROVIDER_REJECTED: 1 } },
  connections: { active: 140, expiring: 6, expired: 4, revoked: 0, neverConnected: 680 },
};

describe("OperationsBoard", () => {
  it("shows the API's numbers and the retry the worker is on, with no reminder or retry buttons", () => {
    render(<OperationsBoard data={operations} />);
    expect(screen.getByText("187 / 0")).toBeTruthy();
    expect(screen.getByText("+23 vs last month")).toBeTruthy();
    expect(screen.getByText("Retrying · attempt 3")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Novera" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Reposts" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Reposts/Comments" })).toBeTruthy();
    expect(screen.getByText("Updated 2:45 PM LK | Updated 5:15 AM EDT | Updated 9:15 AM UTC")).toBeTruthy();
    expect(screen.getByText(/680 employees have never connected/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /remind|retry/i })).toBeNull();
  });

  it("switches the points tile between month and year, and splits this month's reposts", () => {
    const withPeriods: DashboardOperations = {
      ...operations,
      kpis: { ...operations.kpis, repostsThisMonth: 8, repostsPrevMonth: 5, repostsThisMonthWithCommentary: 2, pointsThisMonth: 1840, pointsThisYear: 9000 },
    };
    render(<OperationsBoard data={withPeriods} />);
    const tile = screen.getByRole("region", { name: "Points awarded" });
    expect(within(tile).getByText("1,840")).toBeTruthy();
    expect(within(tile).getByRole("button", { name: "Month" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(tile).queryByRole("button", { name: "Week" })).toBeNull();
    fireEvent.click(within(tile).getByRole("button", { name: "Year" }));
    expect(within(tile).getByText("9,000")).toBeTruthy();
    const reposts = screen.getByRole("region", { name: "Reposts / Reposts with Comments" });
    expect(within(reposts).getByText("6 / 2")).toBeTruthy();
    expect(within(reposts).getByText(/\+3 vs last month/)).toBeTruthy();
  });

  it("treats a missing split or year as 0", () => {
    render(<OperationsBoard data={operations} />);
    const tile = screen.getByRole("region", { name: "Points awarded" });
    fireEvent.click(within(tile).getByRole("button", { name: "Year" }));
    expect(within(tile).getByText("0")).toBeTruthy();
  });

  it("says so when there are no posts", () => {
    render(<OperationsBoard data={{ ...operations, campaigns: [] }} />);
    expect(screen.getByText(/No posts are live/)).toBeTruthy();
  });
});

const campaigns: DashboardCampaigns = {
  asOf: "2026-10-22T09:15:00Z",
  windowDays: 30,
  campaigns: [
    { campaignId: "c1", title: "Launch", categoryCode: "PRODUCT", categoryLabel: "Product", isPriority: true, opensAt: "2026-10-19T00:00:00Z", closesAt: "2026-11-18T00:00:00Z", reposts: 112 },
    { campaignId: "c2", title: "Hiring", categoryCode: "CAREERS", categoryLabel: "Careers", isPriority: false, opensAt: "2026-10-21T00:00:00Z", closesAt: "2026-11-20T00:00:00Z", reposts: 22 },
  ],
  selected: {
    campaignId: "c1",
    title: "Launch",
    categoryCode: "PRODUCT",
    categoryLabel: "Product",
    isPriority: true,
    opensAt: "2026-10-19T00:00:00Z",
    closesAt: "2026-11-18T00:00:00Z",
    reposts: 112,
    shareOfConnected: 0.747,
    first24Hours: 61,
    announcement: { status: "SENT" },
    byDay: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, reposts: 10 * day })),
  },
  byCategory: [{ code: "PRODUCT", label: "Product", reposts: 186 }],
};

describe("PostPerformanceBoard", () => {
  const withPeople: DashboardCampaigns = {
    ...campaigns,
    selected: {
      ...campaigns.selected!,
      repostsWithCommentary: 2,
      summary: "AI-native integration.",
      imageUrl: null,
      resourceUrl: "https://www.linkedin.com/feed/update/urn:li:share:1/",
      resourceUrn: "urn:li:share:1",
      people: {
        reposts: [{ employeeId: "e1", displayName: "Ada Lovelace", email: "ada@example.com" }, { employeeId: "e3", displayName: "01900000-0000-7000-8000-000000000030" }],
        withComments: [{ employeeId: "e2", displayName: "Grace Hopper" }],
      },
    },
  };

  it("lists every post with Reposts and With comments columns and selects a post on click", () => {
    const onSelect = vi.fn();
    render(<PostPerformanceBoard data={{ ...campaigns, campaigns: [{ ...campaigns.campaigns[0], repostsWithCommentary: 12 }, campaigns.campaigns[1]] }} onSelect={onSelect} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const table = screen.getByRole("table", { name: "Reposts per post" });
    expect(within(table).getByRole("columnheader", { name: "Reposts" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "With comments" })).toBeTruthy();
    const launch = within(table).getByRole("button", { name: /Launch/ }).closest("[role=row]")!;
    expect(within(launch as HTMLElement).getByText("100")).toBeTruthy();
    expect(within(launch as HTMLElement).getByText("12")).toBeTruthy();
    fireEvent.click(within(table).getByRole("button", { name: /Hiring/ }));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("shows the normal post card with the default image, the numbers box and who reposted, never a bare id", () => {
    const onClose = vi.fn();
    render(<PostPerformanceBoard data={withPeople} onSelect={() => undefined} detailOpen onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Post detail")).toBeTruthy();
    expect(within(dialog).getByText("AI-native integration.")).toBeTruthy();
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/amplify/default-post-image.svg");
    expect(within(dialog).getByText("75%")).toBeTruthy();
    expect(within(dialog).getByText("Novera: Sent")).toBeTruthy();
    expect(within(dialog).getByRole("img", { name: /Reposts per day/ })).toBeTruthy();
    const reposts = within(dialog).getByRole("region", { name: "Reposts" });
    expect(within(reposts).getByText("Ada Lovelace")).toBeTruthy();
    expect(within(reposts).getByText("Unknown employee")).toBeTruthy();
    expect(within(reposts).queryByText("Grace Hopper")).toBeNull();
    expect(within(within(dialog).getByRole("region", { name: "With comments" })).getByText("Grace Hopper")).toBeTruthy();
    for (const c of within(dialog).getAllByRole("button", { name: "Close" })) fireEvent.click(c);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("steps through the listed posts with the arrows", () => {
    const onSelect = vi.fn();
    render(<PostPerformanceBoard data={withPeople} onSelect={onSelect} detailOpen />);
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous post" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next post" }));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("hands a clicked name to the person popup and closes the post popup", () => {
    const onPerson = vi.fn();
    const { rerender } = render(<PostPerformanceBoard data={withPeople} onSelect={() => undefined} detailOpen onPerson={onPerson} />);
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    expect(onPerson).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "e1" }));
    rerender(<PostPerformanceBoard data={withPeople} onSelect={() => undefined} detailOpen person={{ employeeId: "e1", displayName: "Ada Lovelace", email: "ada@example.com" }} />);
    expect(screen.queryByText("Post detail")).toBeNull();
    expect(screen.getByText("Ada Lovelace Amplify Details")).toBeTruthy();
    expect(screen.getByText(/Team: Digital Engineering/)).toBeTruthy();
    expect(screen.getByText(/BU: Engineering/)).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "Posts reposted by this person" })).getByText("Launch")).toBeTruthy();
    // Points: this month in the top box, on the post row, and on the category row.
    expect(screen.getByText("Points this month")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    const postRow = within(screen.getByRole("table", { name: "Posts reposted by this person" })).getByText("Launch").closest("tr") as HTMLElement;
    expect(within(postRow).getByText("25")).toBeTruthy();
    const categoryRow = within(screen.getByRole("table", { name: "Reposts by category by this person" })).getByText("Product").closest('[role="row"]') as HTMLElement;
    expect(within(categoryRow).getByText("25")).toBeTruthy();
  });

  it("says nobody yet when no one reposted", () => {
    render(<PostPerformanceBoard data={{ ...campaigns, selected: { ...campaigns.selected!, people: { reposts: [], withComments: [] } } }} onSelect={() => undefined} detailOpen />);
    expect(screen.getAllByText("Nobody yet.")).toHaveLength(2);
  });

  it("gives each category a Reposts and a With comments column", () => {
    render(
      <PostPerformanceBoard
        data={{ ...campaigns, byCategory: [{ code: "PRODUCT", label: "Product", reposts: 45, repostsWithCommentary: 12 }, { code: "EVENT", label: "Event", reposts: 10 }] }}
        onSelect={() => undefined}
      />,
    );
    const table = screen.getByRole("table", { name: "Reposts by category" });
    const product = within(table).getByRole("rowheader", { name: "Product" }).parentElement!;
    expect(within(product).getByText("33")).toBeTruthy();
    expect(within(product).getByText("12")).toBeTruthy();
    const event = within(table).getByRole("rowheader", { name: "Event" }).parentElement!;
    expect(within(event).getByText("10")).toBeTruthy();
    expect(within(event).getByText("0")).toBeTruthy();
  });
});

describe("Participation", () => {
  const funnel: DashboardParticipation = {
    asOf: "2026-10-22T09:15:00Z",
    funnel: { employees: 830, connected: 150, reposted: 128, active30Days: 104, expired: 4 },
  };
  const board: GroupBoard = {
    period: "ALL",
    by: "TEAM",
    asOf: "2026-10-22T09:15:00Z",
    totals: { headcount: 95, participants: 30, points: 412 },
    entries: [
      { rank: 1, key: "Eng/Digital", name: "Digital Engineering", businessUnit: "Engineering", points: 412, participants: 30, headcount: 95, participationRate: 0.316 },
    ],
    unassigned: { participants: 2, points: 20 },
  };

  it("shows the funnel with expired connections and never-connected employees", () => {
    render(<Funnel data={funnel} />);
    expect(screen.getByText("128 · 85% of connected")).toBeTruthy();
    expect(screen.getByText(/4 connections have expired\./)).toBeTruthy();
    expect(screen.getByText(/680 employees have never connected/)).toBeTruthy();
  });

  it("shows one pill per BU with exactly one selected, and no All BUs pill", () => {
    const onBu = vi.fn();
    render(<TeamTable board={board} bus={["Engineering", "Sales"]} bu="Engineering" onBu={onBu} sort="rank" dir="asc" onSort={vi.fn()} />);
    expect(screen.queryByText("All BUs")).toBeNull();
    expect(screen.getByRole("button", { name: "Engineering" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Sales" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Digital Engineering")).toBeTruthy();
    expect(screen.getByText(/2 people with 20 points aren't placed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sales" }));
    expect(onBu).toHaveBeenCalledWith("Sales");
  });

  it("shows a house leaderboard like the team one, without a BU column", () => {
    const onSort = vi.fn();
    render(<HouseTable board={{ ...board, by: "HOUSE" }} sort="rank" dir="asc" onSort={onSort} />);
    expect(screen.getByText("House leaderboard")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /House/ })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "BU" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Points/ }));
    expect(onSort).toHaveBeenCalledWith("points");
  });

  it("makes every sortable header a button with aria-sort and an arrow on the active one", () => {
    const onSort = vi.fn();
    render(<TeamTable board={board} bus={["Engineering"]} bu="Engineering" onBu={vi.fn()} sort="points" dir="desc" onSort={onSort} />);
    const points = screen.getByRole("columnheader", { name: /Points/ });
    expect(points.getAttribute("aria-sort")).toBe("descending");
    expect(points.textContent).toContain("↓");
    expect(screen.getByRole("columnheader", { name: /Team/ }).getAttribute("aria-sort")).toBe("none");
    for (const name of ["#", "Team", "Points", "Participants", "Headcount", "Participation"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
    }
    expect(onSort.mock.calls.map((c) => c[0])).toEqual(["rank", "name", "points", "participants", "headcount", "participation"]);
  });

  it("starts numeric columns largest-first, names A to Z, and toggles the active one", () => {
    expect(nextSort({ sort: "rank", dir: "asc" }, "points")).toEqual({ sort: "points", dir: "desc" });
    expect(nextSort({ sort: "rank", dir: "asc" }, "participation")).toEqual({ sort: "participation", dir: "desc" });
    expect(nextSort({ sort: "points", dir: "desc" }, "name")).toEqual({ sort: "name", dir: "asc" });
    expect(nextSort({ sort: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc" });
    expect(nextSort({ sort: "points", dir: "desc" }, "points")).toEqual({ sort: "points", dir: "asc" });
    expect(nextSort({ sort: "points", dir: "desc" }, "rank")).toEqual({ sort: "rank", dir: "asc" });
  });
});

describe("GlanceBoard", () => {
  const glance: DashboardGlance = {
    asOf: "2026-10-22T09:15:00Z",
    month: "2026-10",
    reposts: { thisMonth: 612, previousMonth: 443 },
    monthly: [
      { monthStart: "2026-09-01", reposts: 21 },
      { monthStart: "2026-10-01", reposts: 187 },
    ],
    participants: 128,
    headcount: 830,
    campaignsLive: 6,
    campaignsReachingTarget: { reached: 4, live: 6, thresholdPercent: 25 },
    shareSuccess: { published: 187, attempts: 192 },
    bestCampaign: { campaignId: "c1", title: "Launch", categoryLabel: "Product", isPriority: true, reposts: 112 },
  };

  it("shows medal pills for 1st, 2nd and 3rd, and plain numbers after", () => {
    render(
      <GlanceBoard
        data={glance}
        people={[
          { employeeId: "a", displayName: "A", email: "a@wso2.com", points: 30, rank: 1 },
          { employeeId: "b", displayName: "B", email: "b@wso2.com", points: 20, rank: 2 },
          { employeeId: "c", displayName: "C", email: "c@wso2.com", points: 10, rank: 3 },
        ]}
        teams={[{ rank: 4, key: "k", name: "Fourth", points: 1, participants: 1, headcount: 2, participationRate: 0.5 }]}
      />,
    );
    expect(screen.getByRole("img", { name: "1st place" }).textContent).toBe("1");
    expect(screen.getByRole("img", { name: "2nd place" }).textContent).toBe("2");
    expect(screen.getByRole("img", { name: "3rd place" }).textContent).toBe("3");
    expect(screen.getByRole("img", { name: "1st place" }).querySelector("svg")).not.toBeNull();
    const widths = ["1st place", "2nd place", "3rd place"].map((n) => getComputedStyle(screen.getByRole("img", { name: n })).width);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe("36px");
    expect(screen.getByRole("img", { name: "2nd place" }).querySelector("svg")).toBeNull();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("shows the directory name for a person, never the id or the API's fallback", () => {
    render(
      <GlanceBoard
        data={glance}
        people={[{ employeeId: "emp-7f3a", displayName: "Person emp-7f3a", email: "J@WSO2.com", points: 120, rank: 1 }]}
        teams={[]}
        directory={new Map([["j@wso2.com", { name: "Jane Doe", photoUrl: null }]])}
      />,
    );
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.queryByText(/emp-7f3a/)).toBeNull();
  });

  it("shows the month, top people and top teams from the API data", () => {
    render(
      <GlanceBoard
        data={glance}
        people={[{ employeeId: "e1", displayName: "Jane Doe", email: "j@wso2.com", points: 120, rank: 1 }]}
        teams={[{ rank: 1, key: "k", name: "Marketing", points: 366, participants: 22, headcount: 30, participationRate: 0.73 }]}
      />,
    );
    expect(screen.getByText("612")).toBeTruthy();
    expect(screen.getByText(/\+38% on last month/)).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("Marketing")).toBeTruthy();
    expect(screen.getByText("97%")).toBeTruthy();
  });

  it("says so with no best post, people or teams", () => {
    render(<GlanceBoard data={{ ...glance, bestCampaign: null }} people={[]} teams={[]} />);
    expect(screen.getByText(/No reposts this month yet/)).toBeTruthy();
    expect(screen.getByText(/No points yet/)).toBeTruthy();
    expect(screen.getByText(/No teams to show/)).toBeTruthy();
  });
});

describe("ScorecardBoard", () => {
  const card: DashboardScorecard = {
    asOf: "2026-10-22T09:15:00Z",
    measures: [
      { key: "connected", label: "Employees connected", unit: "PERCENT", value: 18, numerator: 150, denominator: 830, target: 25, comparison: "AT_LEAST", status: "WATCH" },
      { key: "expired", label: "Connections expired", unit: "PERCENT", value: 2.7, numerator: 4, denominator: 150, target: 5, comparison: "AT_MOST", status: "ON_TRACK" },
    ],
  };

  it("renders value, target and the API's status, with no Novera box", () => {
    render(<ScorecardBoard data={card} />);
    expect(screen.getByText("At least 25%")).toBeTruthy();
    expect(screen.getByText("At most 5%")).toBeTruthy();
    expect(screen.getByText("Watch", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("1 on track")).toBeTruthy();
    expect(screen.queryByText(/novera/i)).toBeNull();
  });

  it("gives every measure a progress bar with words, in the status colour's place as well as beside the chip", () => {
    render(<ScorecardBoard data={card} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0].getAttribute("aria-valuetext")).toBe("18% of 25% target");
    expect(bars[0].getAttribute("aria-valuemin")).toBe("0");
    expect(bars[0].getAttribute("aria-valuemax")).toBe("100");
    expect(bars[0].getAttribute("aria-valuenow")).toBe("18");
    expect(bars[1].getAttribute("aria-valuetext")).toBe("2.7% against a 5% ceiling");
    expect(screen.getByText("Watch", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Target 25%")).toBeTruthy();
    expect(screen.getByText("Ceiling 5%")).toBeTruthy();
    expect(screen.getByText("Bar = current value. Line = target (or ceiling for expired).")).toBeTruthy();
  });

  it("says so with no measures", () => {
    render(<ScorecardBoard data={{ ...card, measures: [] }} />);
    expect(screen.getByText(/No measures yet/)).toBeTruthy();
  });
});

describe("Export", () => {
  const thursday = new Date("2026-10-22T20:00:00Z");

  it("turns each pill into a UTC date range ending today", () => {
    expect(exportRange("day", thursday)).toEqual({ from: "2026-10-22", to: "2026-10-22" });
    expect(exportRange("week", thursday)).toEqual({ from: "2026-10-19", to: "2026-10-22" });
    expect(exportRange("month", thursday)).toEqual({ from: "2026-10-01", to: "2026-10-22" });
    expect(exportRange("year", thursday)).toEqual({ from: "2026-01-01", to: "2026-10-22" });
    expect(exportRange("week", new Date("2026-10-18T10:00:00Z")).from).toBe("2026-10-12");
  });

  it("refuses ranges the API would", () => {
    expect(exportRangeProblem("2026-10-01", "2026-10-22")).toBeNull();
    expect(exportRangeProblem("", "2026-10-22")).toBe("Pick both dates.");
    expect(exportRangeProblem("2026-10-22", "2026-10-01")).toMatch(/before/);
    expect(exportRangeProblem("2025-01-01", "2026-10-22")).toMatch(/at most 366/);
  });

  it("downloads the chosen range as a CSV and follows the pill", async () => {
    const created = vi.fn(() => "blob:csv");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    const onExport = vi.fn().mockResolvedValue(new Blob(["a,b"], { type: "text/csv" }));
    render(<ExportPanel onExport={onExport} now={thursday} />);
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-10-01");
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-10-19");
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-20" } });
    expect(screen.getByRole("button", { name: "Week" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith("2026-10-19", "2026-10-20"));
    await waitFor(() => expect(created).toHaveBeenCalled());
  });

  it("blocks the download for a bad range and reports a failed one", async () => {
    const onExport = vi.fn().mockRejectedValue(new Error("boom"));
    render(<ExportPanel onExport={onExport} now={thursday} />);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-01" } });
    expect((screen.getByRole("button", { name: "Download CSV" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/before/);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith("boom"));
  });
});

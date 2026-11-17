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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamPage } from "../../api/amplifyTypes";
import TeamBoard, { TEAM_PAGE_SIZE } from "./TeamBoard";

const useAmplifyTeamPage = vi.fn();
vi.mock("../../api/useAmplifyData", () => ({
  useAmplifyTeamPage: (params: unknown) => useAmplifyTeamPage(params),
}));
vi.mock("../../components/AmplifyShell", () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));
vi.mock("../../components/PersonLink", () => ({
  default: ({ children }: { children: React.ReactNode }) => <span data-testid="person-link">{children}</span>,
}));

function page(overrides: Partial<TeamPage> = {}): TeamPage {
  return {
    period: "ALL",
    scope: "COMPANY",
    page: 0,
    size: TEAM_PAGE_SIZE,
    total: 2,
    summary: { headcount: 3, activeCount: 1 },
    teamStatus: "OK",
    entries: [
      {
        employeeId: "e1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        points: 10,
        rank: 1,
        teamRank: 1,
        previousRank: null,
        lastActivityAt: null,
        houseName: "Oak",
        actions: { canAdjust: false, canReverse: false },
      },
      {
        employeeId: null,
        displayName: "Linus Torvalds",
        email: "linus@example.com",
        points: 0,
        rank: null,
        teamRank: 2,
        previousRank: null,
        lastActivityAt: null,
        actions: { canAdjust: false, canReverse: false },
      },
    ],
    ...overrides,
  };
}

function loaded(data: TeamPage) {
  useAmplifyTeamPage.mockReturnValue({ isPending: false, isError: false, isFetching: false, data, refetch: vi.fn() });
}

describe("TeamBoard", () => {
  beforeEach(() => {
    useAmplifyTeamPage.mockReset();
  });

  it("shows each person's house, and a dash for someone with none", () => {
    loaded(page());
    render(<TeamBoard />);
    expect(screen.getByRole("columnheader", { name: "House" })).toBeTruthy();
    const rows = screen.getAllByRole("row");
    // Columns: company rank, team rank, team member, house.
    expect(within(rows[1]).getAllByRole("cell")[3].textContent).toBe("Oak");
    expect(within(rows[2]).getAllByRole("cell")[3].textContent).toBe("—");
  });

  it("links only members with a standing row, and shows a dash for a null company rank", () => {
    loaded(page());
    render(<TeamBoard />);
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByTestId("person-link").textContent).toBe("Ada Lovelace");
    expect(within(rows[2]).queryByTestId("person-link")).toBeNull();
    expect(within(rows[2]).getByText("Linus Torvalds")).toBeTruthy();
    expect(within(rows[2]).getAllByRole("cell")[0].textContent).toBe("—");
  });

  it("states the active count against the headcount", () => {
    loaded(page());
    render(<TeamBoard />);
    expect(screen.getByText("1 with points of 3 people")).toBeTruthy();
  });

  it("says the list is partial when the company directory is down", () => {
    loaded(page({ teamStatus: "UNAVAILABLE", summary: { headcount: null, activeCount: 1 } }));
    render(<TeamBoard />);
    expect(screen.getByText(/Partial list/)).toBeTruthy();
    expect(screen.getByText("1 with points")).toBeTruthy();
  });

  it("says only the caller is shown when the team roster is down", () => {
    loaded(page({ scope: "TEAM", teamStatus: "UNAVAILABLE", total: 1, entries: [page().entries[0]] }));
    render(<TeamBoard />);
    expect(screen.getByText(/Only you are shown/)).toBeTruthy();
  });

  it("shows the no-team message", () => {
    loaded(page({ teamStatus: "NO_TEAM", entries: [], total: 0 }));
    render(<TeamBoard />);
    expect(screen.getByText("We couldn't find your team.")).toBeTruthy();
  });

  it("pages forward and back through the roster", () => {
    loaded(page({ total: TEAM_PAGE_SIZE + 1 }));
    render(<TeamBoard />);
    expect(useAmplifyTeamPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, size: TEAM_PAGE_SIZE }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(useAmplifyTeamPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("returns to the first page when the search changes", () => {
    loaded(page({ total: TEAM_PAGE_SIZE + 1 }));
    render(<TeamBoard />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Search by name or email"), { target: { value: "ada" } });
    expect(useAmplifyTeamPage).toHaveBeenLastCalledWith(expect.objectContaining({ q: "ada", page: 0 }));
  });
});

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
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { MyPoints } from "../api/amplifyTypes";

type Query = {
  data: MyPoints | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

const h = vi.hoisted(() => ({
  all: undefined as unknown as Query,
  month: undefined as unknown as Query,
  scopes: [] as string[],
}));

vi.mock("../api/useAmplifyData", () => ({
  useMyPoints: (scope: "ALL" | "MONTH") => {
    h.scopes.push(scope);
    return scope === "ALL" ? h.all : h.month;
  },
}));

import PointsTiles from "./PointsTiles";

const coins = {
  walletsEnabled: false,
  blockPoints: 100,
  blockCoins: 10,
  schedule: "MONTHLY" as const,
  heldPoints: 240,
  pointsTowardNext: 40,
  coinsReceived: 120,
};

const loaded = (period: string, points: number | null, rank: number | null): Query => ({
  data: { period, standing: { employeeId: "e-1", points, rank, inTopN: false }, coins, monthly: [] },
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

beforeEach(() => {
  h.all = loaded("ALL", 1240, 12);
  h.month = loaded("2026-11", 85, 4);
  h.scopes.length = 0;
});

const tile = (name: string) => screen.getByRole("region", { name });

describe("PointsTiles", () => {
  it("shows this month's points and rank, all-time points, Coins received and progress to the next Coins", () => {
    render(<PointsTiles />);
    expect(new Set(h.scopes)).toEqual(new Set(["ALL", "MONTH"]));
    expect(tile("This month").textContent).toContain("85 points");
    expect(tile("This month").textContent).toContain("Rank #4");
    expect(tile("All-time points").textContent).toContain("1,240 points");
    expect(tile("Coins received").textContent).toContain("120 WSO2 Coins");
    expect(tile("Next Coins").textContent).toContain("40 / 100 points");
    expect(tile("Next Coins").textContent).toContain("60 more points to 10 Coins");
    const bar = within(tile("Next Coins")).getByRole("progressbar", { name: "Progress to your next Coins" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
  });

  it("says when the caller has no rank this month", () => {
    h.month = loaded("2026-11", null, null);
    render(<PointsTiles />);
    expect(tile("This month").textContent).toContain("0 points");
    expect(tile("This month").textContent).toContain("Not ranked yet");
  });

  it("isn't a link on My points & Coins itself", () => {
    render(<PointsTiles />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links every tile to the given page", () => {
    render(
      <MemoryRouter>
        <PointsTiles linkTo="/amplify/my-points" />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) expect(link.getAttribute("href")).toBe("/amplify/my-points");
  });

  it("shows placeholders while either period loads", () => {
    h.month = { ...h.month, data: undefined, isPending: true };
    render(<PointsTiles />);
    expect(screen.queryByRole("region", { name: "This month" })).toBeNull();
  });

  it("offers a retry of both when either fails", () => {
    h.month = { ...h.month, data: undefined, isError: true, error: new Error("down") };
    render(<PointsTiles />);
    expect(screen.getByText(/Couldn't load your points/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.all.refetch).toHaveBeenCalled();
    expect(h.month.refetch).toHaveBeenCalled();
  });
});

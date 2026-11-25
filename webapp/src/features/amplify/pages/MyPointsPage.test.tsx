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
import type { ReactNode } from "react";
import type { ExternalShare, LedgerEntry } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  myId: "e-1" as string | undefined,
  activityIds: [] as unknown[],
  activity: {
    data: undefined as { pages: { items: unknown[] }[] } | undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    error: null as unknown,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
  claims: { data: [] as unknown[] | undefined, isError: false, error: null as unknown, refetch: vi.fn() },
  walletsEnabled: false,
}));

vi.mock("../api/useAmplifyData", () => ({
  isAmplifyBackendConfigured: () => true,
  useAmplifyMe: () => ({
    data: h.myId ? { employee: { employeeId: h.myId } } : undefined,
    isPending: !h.myId,
    isError: false,
  }),
  useMyActivity: (id: unknown) => {
    h.activityIds.push(id);
    return h.activity;
  },
  useMyExternalShares: () => h.claims,
  useMyPoints: () => ({
    data: {
      period: "ALL",
      standing: { employeeId: "e-1", points: 1240, rank: 12, inTopN: false },
      coins: {
        walletsEnabled: h.walletsEnabled,
        blockPoints: 100,
        blockCoins: 10,
        schedule: "WEEKLY",
        heldPoints: 240,
        pointsTowardNext: 40,
        coinsReceived: 120,
      },
      monthly: [],
    },
  }),
}));
vi.mock("../components/PointsTiles", () => ({ default: () => <div>points tiles</div> }));
vi.mock("../components/AmplifyShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  AmplifyPanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

import MyPointsPage from "./MyPointsPage";

const row = (reference: string, points: number, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  reference,
  employeeId: "e-1",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points,
  createdAt: "2026-11-20T10:00:00Z",
  settlement: "HELD",
  reversedBy: null,
  ...extra,
});

const claim = (id: string, status: ExternalShare["status"]): ExternalShare => ({
  id,
  employeeId: "e-1",
  action: "OWN_POST",
  evidenceUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
  evidenceHost: "www.linkedin.com",
  evidenceProvider: "linkedin",
  status,
  createdAt: "2026-11-22T10:00:00Z",
  version: 1,
});

const history = [
  row("REV-1", -2, { sourceType: "REVERSAL", action: null, reason: "No longer on LinkedIn", reversesReference: "ENG-3" }),
  row("ADJ-1", 30, { sourceType: "ADJUSTMENT", action: null, reason: "Event bonus", settlement: "PAID" }),
  row("OWN-1", 10, { sourceType: "EXTERNAL_SHARE", action: "OWN_POST", settlement: "ACTION_REQUIRED" }),
  row("ENG-3", 2, { campaignTitle: "Integrator launch", reversedBy: "REV-1" }),
  row("ENG-2", 1, { action: "REACTION", campaignTitle: "Integrator launch" }),
  row("ENG-1", 5, { action: "REPOST_COMMENTARY", campaignTitle: "Choreo GA", settlement: "PAID" }),
];

beforeEach(() => {
  h.myId = "e-1";
  h.activityIds.length = 0;
  h.activity = {
    ...h.activity,
    data: { pages: [{ items: history }] },
    isPending: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
  h.claims = { data: [claim("x-1", "PENDING"), claim("x-2", "APPROVED")], isError: false, error: null, refetch: vi.fn() };
  h.walletsEnabled = false;
});

const list = () => screen.getByRole("list", { name: "Your activity" });
const items = () => within(list()).getAllByRole("listitem");
const chip = (name: string) => screen.getByRole("button", { name });

describe("the top of My points & Coins", () => {
  it("shows the tiles and the conversion rate in plain words", () => {
    render(<MyPointsPage />);
    expect(screen.getByRole("heading", { name: "My points & Coins" })).toBeTruthy();
    expect(screen.getByText("points tiles")).toBeTruthy();
    expect(screen.getByText("Every 100 points becomes 10 Coins, automatically, every Monday.")).toBeTruthy();
  });

  it("says Coins aren't sent yet while wallets are off", () => {
    render(<MyPointsPage />);
    expect(screen.getByText("Coins aren't being sent yet; your points keep counting toward them.")).toBeTruthy();
  });

  it("drops the note once wallets are on", () => {
    h.walletsEnabled = true;
    render(<MyPointsPage />);
    expect(screen.queryByText(/Coins aren't being sent yet/)).toBeNull();
  });
});

describe("the activity list", () => {
  it("reads the caller's own history by their employee id", () => {
    render(<MyPointsPage />);
    expect(h.activityIds.at(-1)).toBe("e-1");
  });

  it("puts own posts waiting for review first, at 0 points", () => {
    render(<MyPointsPage />);
    const first = items()[0];
    expect(first.textContent).toContain("You sent your own post for review");
    expect(first.textContent).toContain("Waiting for review");
    expect(within(first).getByText("0")).toBeTruthy();
    expect(within(first).getByRole("link", { name: /Open on LinkedIn/ })).toBeTruthy();
    // Only the waiting claim; the approved one shows as its points row.
    expect(items()).toHaveLength(history.length + 1);
  });

  it("shows what happened, the post, the signed points and the status of each row", () => {
    render(<MyPointsPage />);
    const rows = items().slice(1);
    expect(rows[0].textContent).toContain("The PO team reversed points");
    expect(rows[0].textContent).toContain("Reason: No longer on LinkedIn");
    expect(rows[0].textContent).toContain("−2");
    expect(rows[1].textContent).toContain("The PO team added points");
    expect(rows[1].textContent).toContain("Reason: Event bonus");
    expect(rows[1].textContent).toContain("+30");
    expect(rows[1].textContent).toContain("Coins sent");
    expect(rows[2].textContent).toContain("Your own post was approved");
    expect(rows[2].textContent).toContain("Waiting for the PO team");
    expect(rows[3].textContent).toContain("Integrator launch");
    expect(rows[3].textContent).toContain("Reversed");
    expect(rows[4].textContent).toContain("You reacted on LinkedIn");
    expect(rows[4].textContent).toContain("Counts toward next Coins");
    expect(rows[5].textContent).toContain("You reposted with your thoughts");
    expect(rows[5].textContent).toContain("Choreo GA");
    expect(rows[5].textContent).toContain("+5");
  });

  it("filters by kind with the chips", () => {
    render(<MyPointsPage />);
    expect(chip("All").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(chip("Reposts"));
    expect(items().map((i) => i.textContent)).toEqual([
      expect.stringContaining("Reversed"),
      expect.stringContaining("You reposted with your thoughts"),
    ]);

    fireEvent.click(chip("Reactions & comments"));
    expect(items()).toHaveLength(1);
    expect(items()[0].textContent).toContain("You reacted on LinkedIn");

    fireEvent.click(chip("Own posts"));
    expect(items().map((i) => i.textContent)).toEqual([
      expect.stringContaining("You sent your own post for review"),
      expect.stringContaining("Your own post was approved"),
    ]);

    fireEvent.click(chip("Corrections"));
    expect(items().map((i) => i.textContent)).toEqual([
      expect.stringContaining("The PO team reversed points"),
      expect.stringContaining("The PO team added points"),
    ]);
  });

  it("says when a filter has nothing in the activity shown so far, and still offers more", () => {
    h.activity = { ...h.activity, data: { pages: [{ items: [row("ENG-1", 2)] }] }, hasNextPage: true };
    h.claims = { ...h.claims, data: [] };
    render(<MyPointsPage />);
    fireEvent.click(chip("Corrections"));
    expect(screen.getByText("Nothing of this kind in the activity shown so far.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show more activity" })).toBeTruthy();
  });

  it("loads the next page with Show more activity", () => {
    h.activity = { ...h.activity, hasNextPage: true };
    render(<MyPointsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Show more activity" }));
    expect(h.activity.fetchNextPage).toHaveBeenCalled();
  });

  it("has no Show more once the whole history is shown", () => {
    render(<MyPointsPage />);
    expect(screen.queryByRole("button", { name: "Show more activity" })).toBeNull();
  });

  it("invites a first amplify when there are no points yet", () => {
    h.activity = { ...h.activity, data: { pages: [{ items: [] }] } };
    h.claims = { ...h.claims, data: [] };
    render(<MyPointsPage />);
    expect(screen.getByText(/No points yet/)).toBeTruthy();
  });

  it("offers a retry when the history fails, and keeps the rest of the page", () => {
    h.activity = { ...h.activity, data: undefined, isError: true, error: new Error("down") };
    render(<MyPointsPage />);
    expect(screen.getByText(/Couldn't load your activity/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.activity.refetch).toHaveBeenCalled();
    expect(screen.getByText("points tiles")).toBeTruthy();
  });

  it("still lists the history when the waiting claims fail to load", () => {
    h.claims = { ...h.claims, data: undefined, isError: true, error: new Error("down") };
    render(<MyPointsPage />);
    expect(screen.getByText(/Couldn't load the own posts you sent for review/)).toBeTruthy();
    expect(items()).toHaveLength(history.length);
  });
});

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
import { HttpError } from "@api/http";
import type { CoinWallet, ExternalShare, LedgerEntry } from "../api/amplifyTypes";

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
  wallet: null as CoinWallet | null,
  capture: { mutate: vi.fn(), isSuccess: false, isError: false, error: null as unknown },
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
        heldPoints: 0,
        carryPoints: 40,
        pointsTowardNext: 40,
        coinsReceived: 120,
        wallet: h.wallet,
      },
      monthly: [],
    },
  }),
}));
vi.mock("../api/useAmplifyMutations", () => ({ useCaptureCoinsWallet: () => h.capture }));
vi.mock("../components/SubmitOwnPostDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>submit dialog</div> : null),
}));
vi.mock("../components/AmplifyShell", () => ({
  default: ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {action}
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

const claim = (id: string, status: ExternalShare["status"], extra: Partial<ExternalShare> = {}): ExternalShare => ({
  id,
  employeeId: "e-1",
  action: "OWN_POST",
  evidenceUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
  evidenceHost: "www.linkedin.com",
  evidenceProvider: "linkedin",
  status,
  createdAt: "2026-11-22T10:00:00Z",
  version: 1,
  ...extra,
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
  h.wallet = null;
  h.capture = { mutate: vi.fn(), isSuccess: false, isError: false, error: null };
});

const problem = (status: number, code: string) =>
  new HttpError("/me/coins/wallet", status, JSON.stringify({ status, code }));

const table = () => screen.getByRole("table", { name: "Your activity" });
const items = () => within(table()).getAllByRole("row").slice(1);
const chip = (name: string) => screen.getByRole("button", { name });

describe("the top of My points & Coins", () => {
  it("shows Coins received, progress to the next Coins with the rule, and the all-time numbers", () => {
    render(<MyPointsPage />);
    expect(screen.getByRole("heading", { name: "My points & Coins" })).toBeTruthy();
    const band = screen.getByRole("region", { name: "Your Coins" });
    expect(band.textContent).toContain("120 Coins");
    expect(band.textContent).toContain("40 of 100 points toward your next 10 Coins");
    expect(band.textContent).toContain("Every 100 points becomes 10 Coins, automatically.");
    expect(band.textContent).toContain("All-time points1,240");
    expect(band.textContent).toContain("Converted to Coins1,200");
    expect(band.textContent).toContain("Next conversion");
    expect(within(band).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
  });

  it("says Coins aren't sent yet while wallets are off", () => {
    render(<MyPointsPage />);
    expect(screen.getByText("Coins aren't being sent yet; your points keep counting toward them.")).toBeTruthy();
  });

  it("says where the Coins went once wallets are on", () => {
    h.walletsEnabled = true;
    render(<MyPointsPage />);
    expect(screen.queryByText(/Coins aren't being sent yet/)).toBeNull();
    expect(screen.getByText("Sent to your WSO2 Coins wallet")).toBeTruthy();
  });

  it("checks the caller's wallet once when the page opens, not on every render", () => {
    const { rerender } = render(<MyPointsPage />);
    rerender(<MyPointsPage />);
    fireEvent.click(chip("Reposts"));
    expect(h.capture.mutate).toHaveBeenCalledTimes(1);
  });

  it("shows the band while the wallet check runs, with no wallet line yet", () => {
    render(<MyPointsPage />);
    const band = screen.getByRole("region", { name: "Your Coins" });
    expect(band.textContent).toContain("120 Coins");
    expect(band.textContent).not.toMatch(/wallet 0x|Set up your WSO2 Coins wallet|couldn't be checked/);
  });

  it("names the wallet the Coins go to, masked", () => {
    h.walletsEnabled = true;
    h.wallet = { walletAddress: "0x12ab…9f3c", capturedAt: "2026-11-26T08:00:00Z" };
    h.capture = { ...h.capture, isSuccess: true };
    render(<MyPointsPage />);
    expect(screen.getByText("Sent to your WSO2 Coins wallet")).toBeTruthy();
    expect(screen.getByText("Coins go to wallet 0x12ab…9f3c")).toBeTruthy();
  });

  it("guides the caller to set up a WSO2 Coins wallet when they have none", () => {
    h.capture = { ...h.capture, isError: true, error: problem(404, "NO_WALLET") };
    render(<MyPointsPage />);
    expect(screen.getByText("Set up your WSO2 Coins wallet to receive Coins. Your points keep counting.")).toBeTruthy();
  });

  it("shows a neutral note when the Coins service can't be asked and no wallet is on record", () => {
    h.capture = { ...h.capture, isError: true, error: problem(503, "COINS_UNAVAILABLE") };
    render(<MyPointsPage />);
    expect(
      screen.getByText("Your WSO2 Coins wallet couldn't be checked just now. Your points keep counting."),
    ).toBeTruthy();
  });

  it("keeps the wallet on record when the Coins service can't be asked", () => {
    h.wallet = { walletAddress: "0x12ab…9f3c", capturedAt: "2026-11-20T08:00:00Z" };
    h.capture = { ...h.capture, isError: true, error: problem(503, "COINS_UNAVAILABLE") };
    render(<MyPointsPage />);
    expect(screen.getByText("Coins go to wallet 0x12ab…9f3c")).toBeTruthy();
    expect(screen.queryByText(/couldn't be checked/)).toBeNull();
  });

  it("opens Submit your own post from the top right", () => {
    render(<MyPointsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit your own post" }));
    expect(screen.getByText("submit dialog")).toBeTruthy();
  });
});

describe("the activity list", () => {
  it("reads the caller's own history by their employee id", () => {
    render(<MyPointsPage />);
    expect(h.activityIds.at(-1)).toBe("e-1");
  });

  it("lists own posts waiting for review by date, with no points yet", () => {
    render(<MyPointsPage />);
    const first = items()[0];
    expect(first.textContent).toContain("Own post submitted");
    expect(first.textContent).toContain("Waiting for review");
    expect(first.textContent).toContain("—");
    expect(within(first).getByRole("link", { name: /Open on LinkedIn/ })).toBeTruthy();
    // Only the waiting claim; the approved one shows as its points row.
    expect(items()).toHaveLength(history.length + 1);
  });

  it("lists a declined own post with the reason", () => {
    h.claims = {
      ...h.claims,
      data: [claim("x-3", "REJECTED", { decisionReason: "Not about Choreo Labs", note: "Weekend hike" })],
    };
    render(<MyPointsPage />);
    const first = items()[0];
    expect(first.textContent).toContain("Own post declined");
    expect(first.textContent).toContain("Not about Choreo Labs");
    expect(first.textContent).toContain("Weekend hike");
    expect(first.textContent).toContain("Declined");
  });

  it("shows the date, what happened, the post, the signed points and the status of each row", () => {
    render(<MyPointsPage />);
    expect(within(table()).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Date",
      "Activity",
      "Post",
      "Points",
      "Status",
    ]);
    const rows = items().slice(1);
    expect(rows[0].textContent).toContain("Nov 20");
    expect(rows[0].textContent).toContain("Points reversed");
    expect(rows[0].textContent).toContain("No longer on LinkedIn");
    expect(rows[0].textContent).toContain("−2");
    expect(rows[0].textContent).toContain("Reversed");
    expect(rows[1].textContent).toContain("Corrected by the PO team");
    expect(rows[1].textContent).toContain("Event bonus");
    expect(rows[1].textContent).toContain("+30");
    expect(rows[1].textContent).toContain("Corrected");
    expect(rows[2].textContent).toContain("Own post approved");
    expect(rows[2].textContent).toContain("Waiting for the PO team");
    expect(rows[3].textContent).toContain("Integrator launch");
    expect(rows[3].textContent).toContain("Reversed");
    expect(rows[4].textContent).toContain("Reacted on LinkedIn");
    expect(rows[4].textContent).toContain("Counts toward next Coins");
    expect(rows[5].textContent).toContain("Reposted with your thoughts");
    expect(rows[5].textContent).toContain("Choreo GA");
    expect(rows[5].textContent).toContain("+5");
    expect(rows[5].textContent).toContain("Coins sent");
    expect(screen.getByText(/Something look wrong\? Ask the PO team/)).toBeTruthy();
  });

  it("filters by kind with the chips", () => {
    render(<MyPointsPage />);
    expect(chip("All").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(chip("Reposts"));
    expect(items().map((i) => i.textContent)).toEqual([
      expect.stringContaining("Reversed"),
      expect.stringContaining("Reposted with your thoughts"),
    ]);

    fireEvent.click(chip("Reactions & comments"));
    expect(items()).toHaveLength(1);
    expect(items()[0].textContent).toContain("Reacted on LinkedIn");

    fireEvent.click(chip("Own posts"));
    expect(items().map((i) => i.textContent)).toEqual([
      expect.stringContaining("Own post submitted"),
      expect.stringContaining("Own post approved"),
    ]);

    fireEvent.click(chip("Coins"));
    expect(items().map((i) => i.textContent)).toEqual([
      expect.stringContaining("Corrected by the PO team"),
      expect.stringContaining("Reposted with your thoughts"),
    ]);
  });

  it("says when a filter has nothing in the activity shown so far, and still offers more", () => {
    h.activity = { ...h.activity, data: { pages: [{ items: [row("ENG-1", 2)] }] }, hasNextPage: true };
    h.claims = { ...h.claims, data: [] };
    render(<MyPointsPage />);
    fireEvent.click(chip("Coins"));
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
    expect(screen.getByRole("region", { name: "Your Coins" })).toBeTruthy();
  });

  it("still lists the history when the waiting claims fail to load", () => {
    h.claims = { ...h.claims, data: undefined, isError: true, error: new Error("down") };
    render(<MyPointsPage />);
    expect(screen.getByText(/Couldn't load the own posts you sent for review/)).toBeTruthy();
    expect(items()).toHaveLength(history.length);
  });
});

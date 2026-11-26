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
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { LedgerEntry } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  searched: [] as string[],
  debounced: [] as [unknown, unknown][],
  matches: [] as unknown[],
  history: {
    data: undefined as
      | { items: unknown[]; page: number; size: number; total: number; totalPoints?: number; heldPoints?: number }
      | undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    error: null as unknown,
    refetch: () => undefined,
  },
  historyIds: [] as unknown[],
  historyPages: [] as unknown[][],
  myId: "me-1",
}));

vi.mock("@hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: unknown, delay: unknown) => {
    h.debounced.push([value, delay]);
    return value;
  },
}));
vi.mock("../api/useAmplifyData", () => ({
  PEOPLE_SEARCH_MIN_LENGTH: 2,
  isAmplifyBackendConfigured: () => true,
  usePoPeopleSearch: (q: string) => {
    h.searched.push(q);
    return { data: q.trim().length >= 2 ? h.matches : undefined, isFetching: false, isError: false };
  },
  usePointsHistoryPage: (id: unknown, page: unknown, size: unknown) => {
    h.historyIds.push(id);
    h.historyPages.push([id, page, size]);
    return h.history;
  },
  useAmplifyMe: () => ({ data: { employee: { employeeId: h.myId } } }),
}));
vi.mock("../api/usePersonLookup", () => ({
  UNKNOWN_EMPLOYEE: "Unknown employee",
  usePersonLookup: () => () => ({ name: "Jane Doe", photoUrl: null, team: "Engineering", businessUnit: null, location: "Colombo" }),
}));
vi.mock("../components/AmplifyShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AmplifyPanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("../components/ReversePointsPanel", () => ({
  default: ({ entry, total }: { entry: LedgerEntry; total: number | null }) => (
    <div>
      reverse dialog: {entry.reference} total {String(total)}
    </div>
  ),
}));
vi.mock("../components/AdjustPointsPanel", () => ({
  default: ({ employeeId, total }: { employeeId: string; total: number | null }) => (
    <div>
      adjust dialog: {employeeId} total {String(total)}
    </div>
  ),
}));

import PointsCorrectionsPage, { OWN_POINTS_NOTE, PEOPLE_SEARCH_DEBOUNCE_MS } from "./PointsCorrectionsPage";

const jane = { employeeId: "e-9", displayName: "Jane Doe", email: "jane@choreolabs.test" };

const row = (reference: string, points: number, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  reference,
  employeeId: "e-9",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points,
  createdAt: "2026-11-10T00:00:00Z",
  ...extra,
});

// Types into the search box the way a person does: focused first (the box clears itself when it isn't).
function typeSearch(value: string) {
  const input = screen.getByRole("combobox", { name: /Find a person/ });
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
}

function pick(person = jane) {
  typeSearch("ja");
  fireEvent.click(screen.getByRole("option", { name: new RegExp(person.email) }));
}

beforeEach(() => {
  h.searched.length = 0;
  h.debounced.length = 0;
  h.historyIds.length = 0;
  h.historyPages.length = 0;
  h.matches = [jane];
  h.myId = "me-1";
  h.history = {
    data: {
      page: 0,
      size: 25,
      total: 4,
      // The all-time total from the server; more than this page's rows add up to.
      totalPoints: 1040,
      heldPoints: 140,
      items: [
        row("REV-1", -2, { sourceType: "REVERSAL", action: null, reversesReference: "ENG-2", reason: "Counted twice" }),
        row("ADJ-1", 30, { sourceType: "ADJUSTMENT", action: null, reason: "Event bonus" }),
        row("ENG-2", 2, { campaignId: "c-1", campaignTitle: "Integrator launch", reversedBy: "REV-1" }),
        row("ENG-1", 10, { campaignId: "c-1", campaignTitle: "Integrator launch", action: "REPOST_COMMENTARY", settlement: "PAID" }),
      ],
    },
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: () => undefined,
  };
});

describe("finding a person", () => {
  it("searches the debounced text and asks for nothing until a person is picked", () => {
    render(<PointsCorrectionsPage />);
    expect(h.historyIds).toEqual([]);
    typeSearch("ja");
    expect(h.debounced.at(-1)).toEqual(["ja", PEOPLE_SEARCH_DEBOUNCE_MS]);
    expect(h.searched.at(-1)).toBe("ja");
    expect(screen.getByRole("option", { name: /jane@choreolabs.test/ })).toBeTruthy();
  });

  it("asks for two characters before offering anyone", () => {
    render(<PointsCorrectionsPage />);
    typeSearch("j");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText(/Type at least 2 letters/)).toBeTruthy();
  });
});

describe("a picked person", () => {
  it("shows their name, team and location, all-time points and points toward the next Coins, reading five rows", () => {
    render(<PointsCorrectionsPage />);
    pick();
    expect(h.historyIds.at(-1)).toBe("e-9");
    expect(new Set(h.historyPages.map((p) => JSON.stringify(p)))).toEqual(new Set([JSON.stringify(["e-9", 0, 5])]));
    expect(screen.getByRole("region", { name: "All-time points" }).textContent).toContain("1,040");
    expect(screen.getByRole("region", { name: "Toward next Coins" }).textContent).toContain("140");
    expect(screen.getByRole("heading", { name: "Jane Doe" })).toBeTruthy();
    expect(screen.getByText("Engineering · Colombo")).toBeTruthy();
  });

  it("shows a dash while the server sends no all-time total", () => {
    h.history = { ...h.history, data: { page: 0, size: 5, total: 1, items: [row("ENG-1", 10)] } };
    render(<PointsCorrectionsPage />);
    pick();
    expect(screen.getByRole("region", { name: "All-time points" }).textContent).toContain("—");
    fireEvent.click(screen.getByRole("button", { name: "Add or remove points…" }));
    expect(screen.getByText("adjust dialog: e-9 total null")).toBeTruthy();
  });

  it("lists every activity with its date, what happened, the post, points and status", () => {
    render(<PointsCorrectionsPage />);
    pick();
    const table = screen.getByRole("table", { name: "Every activity" });
    expect(within(table).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Date",
      "Activity",
      "Post",
      "Points",
      "Status",
      "",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Points reversed")).toBeTruthy();
    expect(within(rows[0]).getByText("Counted twice")).toBeTruthy();
    expect(within(rows[0]).getByText("−2")).toBeTruthy();
    expect(within(rows[1]).getByText("Corrected by the PO team")).toBeTruthy();
    expect(within(rows[1]).getByText("Event bonus")).toBeTruthy();
    expect(within(rows[3]).getByText("Reposted with thoughts")).toBeTruthy();
    expect(within(rows[3]).getByText("Integrator launch")).toBeTruthy();
    expect(within(rows[3]).getByText("+10")).toBeTruthy();
    expect(within(rows[3]).getByText("Converted")).toBeTruthy();
  });

  it("offers Reverse only on rows that are neither reversals nor reversed (reversedBy)", () => {
    render(<PointsCorrectionsPage />);
    pick();
    const rows = within(screen.getByRole("table", { name: "Every activity" })).getAllByRole("row").slice(1);
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(within(rows[2]).queryByRole("button")).toBeNull();
    expect(within(rows[2]).getByText("Reversed")).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: /Reverse/ })).toBeTruthy();
    fireEvent.click(within(rows[3]).getByRole("button", { name: /Reverse/ }));
    expect(screen.getByText("reverse dialog: ENG-1 total 1040")).toBeTruthy();
    expect(within(rows[3]).getByRole("button", { name: /Reverse/ }).textContent).toBe("Reversing");
  });

  it("marks a row reversed on a later page, whose reversal isn't on screen", () => {
    h.history = {
      ...h.history,
      data: { page: 0, size: 5, total: 1, totalPoints: 0, items: [row("ENG-7", 5, { reversedBy: "REV-9" })] },
    };
    render(<PointsCorrectionsPage />);
    pick();
    const rows = within(screen.getByRole("table", { name: "Every activity" })).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Reversed")).toBeTruthy();
    expect(within(rows[0]).queryByRole("button")).toBeNull();
  });

  it("lists only the ledger rows, not the Coins conversions, and offers no Reverse on a conversion", () => {
    const conversion = {
      kind: "COIN_CONVERSION",
      reference: "CNV-1",
      employeeId: "e-9",
      points: 800,
      coins: 80,
      createdAt: "2026-11-01T02:00:00Z",
      conversionStatus: "SENT",
      transferReference: null,
    };
    h.history = {
      ...h.history,
      data: { page: 0, size: 5, total: 2, totalPoints: 5, items: [conversion, row("ENG-8", 5, { kind: "LEDGER" })] },
    };
    render(<PointsCorrectionsPage />);
    pick();
    const rows = within(screen.getByRole("table", { name: "Every activity" })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).not.toContain("Converted to Coins");
  });

  it("falls back to a plain label when a post has no title", () => {
    h.history = {
      ...h.history,
      data: { page: 0, size: 5, total: 1, totalPoints: 5, items: [row("ENG-8", 5, { campaignId: "c-9", campaignTitle: null })] },
    };
    render(<PointsCorrectionsPage />);
    pick();
    expect(screen.getByText("A Choreo Labs post")).toBeTruthy();
  });

  it("opens Add or remove points with the person and their total", () => {
    render(<PointsCorrectionsPage />);
    pick();
    fireEvent.click(screen.getByRole("button", { name: "Add or remove points…" }));
    expect(screen.getByText("adjust dialog: e-9 total 1040")).toBeTruthy();
  });

  it("doesn't offer corrections on the caller's own points", () => {
    h.myId = "e-9";
    render(<PointsCorrectionsPage />);
    pick();
    expect(screen.getByText(OWN_POINTS_NOTE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add or remove points…" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reverse/ })).toBeNull();
  });

  it("shows five rows, then every row a page at a time after Show all", () => {
    h.history = {
      ...h.history,
      data: { page: 0, size: 5, total: 63, totalPoints: 63, items: Array.from({ length: 5 }, (_, i) => row(`R-${i}`, 1)) },
    };
    render(<PointsCorrectionsPage />);
    pick();
    expect(screen.getByText(/Showing 5 of 63/)).toBeTruthy();
    h.history = {
      ...h.history,
      data: { page: 0, size: 25, total: 63, totalPoints: 63, items: Array.from({ length: 25 }, (_, i) => row(`R-${i}`, 1)) },
    };
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(h.historyPages.at(-1)).toEqual(["e-9", 0, 25]);
    expect(within(screen.getByRole("table", { name: "Every activity" })).getAllByRole("row")).toHaveLength(26);
    expect(screen.getByText(/1–25 of 63/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(h.historyPages.at(-1)).toEqual(["e-9", 1, 25]);
  });

  it("offers a retry when the history fails to load", () => {
    h.history = { ...h.history, data: undefined, isError: true, error: new Error("down") };
    render(<PointsCorrectionsPage />);
    pick();
    expect(screen.getByText(/Couldn't load this person's points/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

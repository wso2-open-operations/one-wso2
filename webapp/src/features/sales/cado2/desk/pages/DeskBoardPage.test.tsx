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
import { MemoryRouter } from "react-router";
import type { DeskCard, DeskColumnKey } from "../api/deskTypes";
import DeskBoardPage from "./DeskBoardPage";

const card = (over: Partial<DeskCard>): DeskCard => ({
  quoteId: 1, quoteNumber: "Q-26-01042", versionNumber: 2, status: "SUBMITTED", accountName: "Acme Logistics", opportunityName: "APIM renewal 2027",
  ownerEmail: "jane@wso2.com", region: "NA", dealType: "RENEWAL", channel: "DIRECT", partnerName: null, isPrimary: true, currency: "USD",
  tcv: "412500.00", tcvUsd: "412500.00", submittedAt: "2026-11-03T09:00:00Z", dueAt: null, resubmitted: true, submittedByYou: false,
  waitingOn: [], waitingOnRoles: [], approvedSteps: 0, totalSteps: 3, overdueOnBehalf: false, returnedBy: null, returnComment: null,
  changedAt: "2026-11-03T09:00:00Z", approvedAt: null, ...over,
});

const columns: Record<DeskColumnKey, { total: number; items: DeskCard[] }> = {
  review: { total: 14, items: [card({}), card({ quoteId: 4, quoteNumber: "Q-26-01050", accountName: "Initech", submittedByYou: true })] },
  others: { total: 1, items: [card({ quoteId: 2, quoteNumber: "Q-26-01019", accountName: "Umbrella Health", waitingOn: ["Area GM · NA"], approvedSteps: 2, totalSteps: 5, overdueOnBehalf: true })] },
  back: { total: 1, items: [card({ quoteId: 3, quoteNumber: "Q-26-01007", status: "RETURNED", accountName: "Soylent Foods", returnedBy: "CFO", returnComment: "Net 90 needs a reason" })] },
  approved: { total: 0, items: [] },
};
const calls: { column: DeskColumnKey; query: string }[] = [];
vi.mock("../api/useDeskApi", () => ({
  useDeskColumn: (column: DeskColumnKey, query: string) => {
    calls.push({ column, query });
    return { data: { column, ...columns[column] }, isPending: false, error: null, isFetching: false, refetch: vi.fn() };
  },
}));

// D130: Deal Desk's board: four columns, filters for all, a sort and a quick
// filter per column, more cards, and a column as a list.
describe("DeskBoardPage", () => {
  it("shows every quote in flight by what it needs from Deal Desk", () => {
    render(<MemoryRouter><DeskBoardPage /></MemoryRouter>);
    const review = screen.getByRole("region", { name: "Your review" });
    expect(within(review).getByLabelText("14 quotes")).toBeInTheDocument();
    expect(within(review).getByRole("link", { name: "Q-26-01042 · Acme Logistics" })).toHaveTextContent("Resubmitted");
    expect(review).toHaveTextContent("Showing 2 of 14");
    const others = screen.getByRole("region", { name: "With other approvers" });
    expect(others).toHaveTextContent("Waiting on Area GM · NA");
    expect(within(others).getByRole("link", { name: "Approve on behalf…" })).toHaveAttribute("href", "/sales/cado2/quotes/2/approvals?from=desk");
    const back = screen.getByRole("region", { name: "Back with the AM" });
    expect(back).toHaveTextContent("Returned by CFO");
    expect(within(back).getByRole("link", { name: "Revise as Deal Desk" })).toHaveAttribute("href", "/sales/cado2/quotes/3/quote?from=desk&do=revise");
    // Deal Desk's own approval: Approve opens the quote; who submitted it gets Recall.
    expect(within(review).getByRole("link", { name: "Approve" })).toHaveAttribute("href", "/sales/cado2/quotes/1/quote?from=desk");
    expect(within(review).getByRole("link", { name: "Recall as Deal Desk" })).toHaveAttribute("href", "/sales/cado2/quotes/4/quote?from=desk&do=recall");
    // With other approvers, or approved but not issued: Recall first (then Revise).
    expect(within(others).getByRole("link", { name: "Recall as Deal Desk" })).toBeInTheDocument();
    expect(within(back).queryByRole("link", { name: "Recall as Deal Desk" })).toBeNull();
    expect(screen.getByRole("region", { name: "Approved, not issued" })).toHaveTextContent("Nothing here.");
  });

  it("narrows every column with the filters, and a column with its own quick filter", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DeskBoardPage /></MemoryRouter>);
    calls.length = 0;
    await user.click(screen.getByRole("combobox", { name: "Region" }));
    await user.click(screen.getByRole("option", { name: "EU" }));
    expect(new Set(calls.filter((c) => c.query.includes("region=EU")).map((c) => c.column))).toEqual(new Set(["review", "others", "back", "approved"]));
    expect(screen.getByText("EU", { selector: "span" })).toBeInTheDocument(); // "Filtered by: EU"

    calls.length = 0;
    const others = screen.getByRole("region", { name: "With other approvers" });
    await user.click(within(others).getByRole("combobox", { name: "Waiting on" }));
    await user.click(screen.getByRole("option", { name: "CFO" }));
    expect(calls.some((c) => c.column === "others" && c.query.includes("quick=CFO"))).toBe(true);
    expect(calls.some((c) => c.column === "review" && c.query.includes("quick="))).toBe(false);
  });

  it("shows ten more, and opens a column as a paged list", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DeskBoardPage /></MemoryRouter>);
    const review = screen.getByRole("region", { name: "Your review" });
    calls.length = 0;
    await user.click(within(review).getByRole("button", { name: "Show 10 more" }));
    expect(calls.some((c) => c.column === "review" && c.query.includes("limit=20"))).toBe(true);

    await user.click(within(screen.getByRole("region", { name: "Your review" })).getByRole("button", { name: "Open as list" }));
    expect(screen.getByRole("table", { name: "Your review" })).toHaveTextContent("Acme Logistics");
    expect(screen.getByText("14 quotes")).toBeInTheDocument();
    expect(calls.some((c) => c.query.includes("limit=25") && c.query.includes("offset=0"))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.getByRole("region", { name: "Your review" })).toBeInTheDocument();
  });
});

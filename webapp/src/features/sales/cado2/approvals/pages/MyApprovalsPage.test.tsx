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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ApprovalInboxItem } from "@features/sales/cado2/approvals/api/approvalTypes";
import MyApprovalsPage from "./MyApprovalsPage";

const inbox = { data: [] as ApprovalInboxItem[], isPending: false, error: null, isFetching: false, refetch: vi.fn() };
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({ useApprovalInbox: () => inbox }));

function renderPage() {
  render(
    <MemoryRouter>
      <MyApprovalsPage />
    </MemoryRouter>,
  );
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const item = (o: Partial<ApprovalInboxItem> & { stepId: number; accountName: string }): ApprovalInboxItem => ({
  role: "DEAL_DESK", roleLabel: "Deal Desk", requestedAt: hoursFromNow(-2), quoteId: o.stepId, quoteNumber: `Q-26-0000${o.stepId}`,
  versionNumber: 1, sfAccountId: `001${o.accountName}`, sfOpportunityId: `006${o.stepId}`, opportunityName: `${o.accountName} Opp`,
  currencyIsoCode: "USD", tcv: "1000.00", submittedByEmail: "rep@wso2.com", submittedAt: null, ...o,
});
const bodyRows = () => screen.getAllByRole("row").slice(1); // after the header

// My Approvals laid out like the Quotes list (D144).
describe("MyApprovalsPage", () => {
  beforeEach(() => localStorage.clear());

  it("says so when nothing is waiting", () => {
    inbox.data = [];
    renderPage();
    expect(screen.getByText("Nothing is waiting for you")).toBeInTheDocument();
    expect(screen.queryByText("Deal Desk")).not.toBeInTheDocument(); // no role chips beside the title
  });

  it("shows each step under named columns, the quote linking to its page", () => {
    inbox.data = [
      item({ stepId: 5, quoteNumber: "Q-26-00005", versionNumber: 2, accountName: "Northwind Logistics", opportunityName: "API Platform 2027", tcv: "19440.00" }),
    ];
    renderPage();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Quote", "Account", "Opportunity", "Approving as", "Submitted by", "Value (TCV)", "Deadline", "Waiting"]);
    expect(screen.getByRole("link", { name: "Q-26-00005" })).toHaveAttribute("href", "/sales/quickquote/quotes/5/quote?from=approvals");
    const row = bodyRows()[0];
    expect(row).toHaveTextContent("v2");
    expect(row).toHaveTextContent("Northwind Logistics");
    expect(row).toHaveTextContent("Deal Desk");
    expect(row).toHaveTextContent("rep@wso2.com");
    expect(row).toHaveTextContent("USD 19,440.00");
    expect(row).toHaveTextContent("2 h");
    expect(screen.getByText("Waiting for you").parentElement).toHaveTextContent("1");
  });

  it("starts most urgent first, and sorts on any column", async () => {
    const user = userEvent.setup();
    inbox.data = [
      item({ stepId: 1, accountName: "Overdue Co", dueAt: hoursFromNow(-6), slaState: "BREACHED", tcv: "500.00" }),
      item({ stepId: 2, accountName: "Soon Co", dueAt: hoursFromNow(4), slaState: "AT_RISK", tcv: "9000.00" }),
    ];
    renderPage();
    expect(bodyRows()[0]).toHaveTextContent("Overdue by 6 h");
    expect(bodyRows()[1]).toHaveTextContent("Due in 4 h");
    await user.click(screen.getByRole("button", { name: "Value (TCV)" }));
    expect(bodyRows()[0]).toHaveTextContent("Overdue Co"); // 500 first
    await user.click(screen.getByRole("button", { name: "Value (TCV)" }));
    expect(bodyRows()[0]).toHaveTextContent("Soon Co"); // then 9,000 first
  });

  it("searches and filters by deadline", async () => {
    const user = userEvent.setup();
    inbox.data = [
      item({ stepId: 1, accountName: "Overdue Co", dueAt: hoursFromNow(-6), slaState: "BREACHED" }),
      item({ stepId: 2, accountName: "Soon Co", dueAt: hoursFromNow(4), slaState: "AT_RISK", submittedByEmail: "anna@wso2.com", accountSalesRegion: "EU" }),
    ];
    renderPage();
    await user.type(screen.getByRole("textbox", { name: "Search approvals" }), "anna");
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent("Soon Co");
    await user.clear(screen.getByRole("textbox", { name: "Search approvals" }));

    await user.click(screen.getByRole("combobox", { name: "Deadline" }));
    await user.click(screen.getByRole("option", { name: "Overdue" }));
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent("Overdue Co");

    await user.type(screen.getByRole("textbox", { name: "Search approvals" }), "Soon");
    expect(screen.getByText("No approvals match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(bodyRows()).toHaveLength(2);

    // The customer's region, not the approval step's.
    await user.click(screen.getByRole("combobox", { name: "Region" }));
    await user.click(screen.getByRole("option", { name: "EU" }));
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent("Soon Co");
    await user.click(screen.getByRole("combobox", { name: "Region" }));
    await user.click(screen.getByRole("option", { name: "APAC" }));
    expect(screen.getByText("No approvals match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(bodyRows()).toHaveLength(2);
  });

  it("groups by account and opportunity in the tree, and remembers the layout", async () => {
    const user = userEvent.setup();
    inbox.data = [
      item({ stepId: 1, accountName: "Harborview", sfAccountId: "001H", sfOpportunityId: "006H1", opportunityName: "API Platform 2027" }),
      item({ stepId: 2, accountName: "Harborview", sfAccountId: "001H", sfOpportunityId: "006H2", opportunityName: "Support uplift" }),
    ];
    renderPage();
    await user.click(screen.getByRole("button", { name: "Tree" }));
    const table = screen.getByRole("table", { name: /by account and opportunity/ });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Quote", "Approving as", "Submitted by", "Value (TCV)", "Deadline", "Waiting",
    ]);
    expect(within(table).getAllByText("Harborview")).toHaveLength(1); // one account branch
    expect(within(table).getByText("API Platform 2027")).toBeInTheDocument();
    expect(within(table).getByText("Support uplift")).toBeInTheDocument();
    expect(localStorage.getItem("cado2.approvals.layout")).toBe("tree");

    await user.click(screen.getByRole("button", { name: "Collapse Harborview" }));
    expect(within(table).queryByText("API Platform 2027")).not.toBeInTheDocument();
  });
});

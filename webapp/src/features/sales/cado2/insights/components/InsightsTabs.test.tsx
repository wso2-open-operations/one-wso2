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
import ApprovalOperationsTab from "./ApprovalOperationsTab";
import QuoteReportTab from "./QuoteReportTab";
import { DEFAULT_FILTERS } from "../utils/reportFilters";
import type { ApprovalOperations, QuoteReport, QuoteSummary } from "../api/insightsTypes";

const ops = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const report = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const summary = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const fetchAll = vi.fn();
const saveReport = vi.fn();
const notify = vi.fn();

// Mocked so the tabs are tested without Asgardeo, the network or charts' sizing.
vi.mock("../api/useInsights", () => ({
  useApprovalOperations: () => ops,
  useQuoteReport: () => report,
  useReportExportFetch: () => fetchAll,
  useQuoteSummary: (id: number | null) => (id === null ? { ...summary, data: undefined, isPending: true } : summary),
}));
vi.mock("../utils/reportExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/reportExport")>()),
  saveReport: (...args: unknown[]) => saveReport(...args),
}));
vi.mock("@features/sales/cado2/components/toast/toastContext", () => ({ useCado2Toast: () => notify }));

const meta = { currency: "USD", ratesAvailable: true, ratesAsOf: "2026-10-19T00:00:00Z", unconverted: [{ currency: "KES", quotes: 1 }] };

const attention = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    stepId: i + 1, quoteId: 31 + i, quoteNumber: `Q-26-000${31 + i}`, versionNumber: 1, accountName: "Northwind", region: "NA",
    currency: "EUR", tcv: "738000.00", value: "820000.00", waitingOn: "CFO", requestedAt: "2026-10-18T10:00:00Z",
    dueAt: "2026-10-21T10:00:00Z", slaState: "BREACHED" as const,
  }));

const opsData: ApprovalOperations = {
  ...meta, region: null, regions: ["NA", "EU"], inApproval: 17, inApprovalValue: "6400000.00", overdueSteps: 7, dueSoonSteps: 4,
  averageApprovalHours: 13.1, approvedInWindow: 12, approvalWindowDays: 30, submittedLastDay: 8,
  byRole: [
    { role: "DEAL_DESK", label: "Deal Desk", onTrack: 5, dueSoon: 2, overdue: 2, regions: [] },
    { role: "REGIONAL_DIRECTOR", label: "Regional Director", onTrack: 0, dueSoon: 1, overdue: 2, regions: ["EU", "NA"] },
  ],
  speed: [
    { role: "CEO", label: "CEO", averageHours: 44, decisions: 3, slaHours: 24 },
    { role: "DEAL_DESK", label: "Deal Desk", averageHours: 4.5, decisions: 20, slaHours: 24 },
  ],
  oldest: { quoteId: 32, quoteNumber: "Q-26-90032", accountName: "Woodgrove Bank", days: 8.3, waitingOn: ["CEO"] },
  aging: [
    { key: "LT_1D", label: "Under 1 day", quotes: 8, value: "2100000.00" },
    { key: "D1_3", label: "1–3 days", quotes: 6, value: "2600000.00" },
    { key: "D3_7", label: "3–7 days", quotes: 2, value: "1200000.00" },
    { key: "GT_7D", label: "Over 7 days", quotes: 1, value: "500000.00" },
  ],
  attention: attention(11),
};

const reportData: QuoteReport = {
  ...meta, total: 120, page: 1, pageSize: 50, truncated: false,
  rows: [{
    quoteId: 31, quoteNumber: "Q-26-00031", versionNumber: 2, status: "SUBMITTED", accountName: "Northwind", opportunityName: "Renewal",
    region: "NA", partnerName: null, channel: "DIRECT", dealKind: "RENEWAL", recordTypeName: "Renewal", currency: "EUR", tcv: "738000.00", tcvConverted: "820000.00",
    arrConverted: "273333.33", maxDiscretionaryPercent: "12.50", ownerEmail: "rep@wso2.com", createdAt: "2026-10-01T09:00:00Z",
    submittedAt: "2026-10-18T09:00:00Z", approvedAt: null, daysInApproval: 4, waitingOn: ["CFO"],
  }],
};

const summaryData: QuoteSummary = {
  ...meta, quoteId: 31, quoteNumber: "Q-26-00031", versionNumber: 2, status: "SUBMITTED", accountName: "Northwind",
  opportunityName: "Northwind Renewal 2027", region: "NA", dealKind: "RENEWAL", recordTypeName: "Renewal", channel: "PARTNER",
  partnerName: "Meridian IT", ownerEmail: "rep@wso2.com", quoteCurrency: "EUR", tcv: "738000.00", tcvConverted: "820000.00",
  arr: "246000.00", arrConverted: "273333.33", termYears: 3, startDate: "2027-01-01", endDate: "2029-12-31",
  createdAt: "2026-10-01T09:00:00Z", submittedAt: "2026-10-18T09:00:00Z", approvedAt: null,
  lines: [{ lineNumber: 1, productName: "WSO2 API Manager", productCode: "APIM", quantity: 20, volumeDiscountPercent: "5.00",
    discretionaryDiscountPercent: "12.50", tcv: "700000.00" }],
  approvals: [
    { role: "DEAL_DESK", label: "Deal Desk", status: "APPROVED", slaState: null, requestedAt: "2026-10-18T09:00:00Z",
      dueAt: "2026-10-19T09:00:00Z", actedAt: "2026-10-18T15:00:00Z", actedBy: "dd@wso2.com", comment: "Pricing checked" },
    { role: "CFO", label: "CFO", status: "PENDING", slaState: "BREACHED", requestedAt: "2026-10-18T15:00:00Z",
      dueAt: "2026-10-19T15:00:00Z", actedAt: null, actedBy: null, comment: null },
    { role: "CEO", label: "CEO", status: "WAITING", slaState: null, requestedAt: null, dueAt: null, actedAt: null, actedBy: null, comment: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(summary, { data: summaryData, isPending: false, error: null });
  Object.assign(ops, { data: opsData, isPending: false, error: null });
  Object.assign(report, { data: reportData, isPending: false, error: null });
});

describe("Approval Operations (D106, v2)", () => {
  it("starts on Global, with the headline figures", () => {
    render(<MemoryRouter><ApprovalOperationsTab region="" onRegionChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Global" })).toHaveAttribute("aria-pressed", "true");
    const kpi = (name: string) => within(screen.getByRole("region", { name }));
    expect(kpi("Quotes in approval").getByText("17")).toBeInTheDocument();
    expect(kpi("Quotes in approval").getByText("8 submitted in the last day")).toBeInTheDocument();
    expect(kpi("Value in approval").getByText("$6.4")).toBeInTheDocument();
    expect(kpi("Value in approval").getByText("M")).toBeInTheDocument();
    expect(kpi("Overdue approvals").getByText("4 more due within hours")).toBeInTheDocument();
    expect(kpi("Average approval time").getByText("13.1")).toBeInTheDocument();
  });

  it("draws SLA health, the waiting bars, approval time by role and the longest wait", () => {
    render(<MemoryRouter><ApprovalOperationsTab region="" onRegionChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("img", { name: "12 approvals waiting: 5 on track, 3 due soon, 4 overdue" })).toBeInTheDocument();
    expect(screen.getByLabelText("Deal Desk: 5 on track · 2 due soon · 2 overdue")).toBeInTheDocument();
    expect(screen.getByText("EU, NA")).toBeInTheDocument();
    expect(screen.getByLabelText("CEO: average 44 h, SLA 24 h")).toBeInTheDocument();
    expect(screen.getByText("SLA (24 h)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Q-26-90032" })).toHaveAttribute("href", "/sales/cado2/quotes/32/approvals");
    expect(screen.getByText(/now with CEO/)).toBeInTheDocument();
  });

  it("shows the top 10 that need attention, then all on request", async () => {
    render(<MemoryRouter><ApprovalOperationsTab region="" onRegionChange={vi.fn()} /></MemoryRouter>);
    const table = screen.getByRole("table", { name: "Approvals that need attention" });
    expect(within(table).getAllByRole("row")).toHaveLength(11); // the heading + 10
    expect(screen.getByText(/10 of 11 shown/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show all 11" }));
    expect(within(table).getAllByRole("row")).toHaveLength(12);
    expect(within(table).getAllByText("820,000.00")[0]).toBeInTheDocument();
    expect(screen.getByText(/Not included in totals \(no rate\): 1 in KES/)).toBeInTheDocument();
  });

  it("picks a region", async () => {
    const onRegionChange = vi.fn();
    render(<MemoryRouter><ApprovalOperationsTab region="" onRegionChange={onRegionChange} /></MemoryRouter>);
    await userEvent.setup().click(screen.getByRole("button", { name: "EU" }));
    expect(onRegionChange).toHaveBeenCalledWith("EU");
  });

  it("says so when the rates couldn't be read", () => {
    Object.assign(ops, { data: { ...opsData, ratesAvailable: false, inApprovalValue: null } });
    render(<MemoryRouter><ApprovalOperationsTab region="" onRegionChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/exchange rates couldn't be read/)).toBeInTheDocument();
  });
});

describe("Quote Report (D106)", () => {
  it("lists quotes with their count, and sorts from the headings", async () => {
    const onChange = vi.fn();
    render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={onChange} /></MemoryRouter>);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.queryByText(/total contract value/)).toBeNull();
    const table = screen.getByRole("table", { name: "Quote report" });
    expect(within(table).getByText("Q-26-00031")).toBeInTheDocument();
    expect(within(table).getByText("In approval")).toBeInTheDocument();
    await userEvent.setup().click(within(table).getByRole("button", { name: "TCV (USD)" }));
    expect(onChange).toHaveBeenCalledWith({ sort: "VALUE", order: "desc", page: 1 });
  });

  it("exports every matching row, and says when the cap cut it short", async () => {
    fetchAll.mockResolvedValue({ ...reportData, rows: reportData.rows });
    render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: "Excel (.xlsx)" }));
    expect(fetchAll).toHaveBeenCalledWith(DEFAULT_FILTERS, 5000);
    expect(saveReport).toHaveBeenCalledWith(reportData.rows, "USD", expect.stringContaining("19 Oct 2026"), "xlsx");
    expect(notify).toHaveBeenCalledWith("Exported the first 1 of 120 quotes");
  });

  it("keeps the extra filters in a panel, with a badge and one line of what's applied", async () => {
    const onChange = vi.fn();
    const filters = { ...DEFAULT_FILTERS, status: "SUBMITTED" as const, dealKind: "RENEWAL" as const, size: "250000-1000000" as const };
    render(<MemoryRouter><QuoteReportTab filters={filters} onChange={onChange} /></MemoryRouter>);
    expect(screen.getByText("In approval · Renewal · $250K – $1M")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "More filters" })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "More filters" }));
    const panel = within(screen.getByRole("region", { name: "More filters" }));
    expect(panel.getByText("Deal")).toBeInTheDocument();
    expect(panel.getByRole("group", { name: "Channel" })).toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Partner" }));
    expect(onChange).toHaveBeenCalledWith({ page: 1, channel: "PARTNER" });
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: "", dealKind: "", size: "", page: 1 }));
  });

  it("shows From and To only for a custom period", () => {
    const { rerender } = render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByLabelText("From")).toBeNull();
    rerender(<MemoryRouter><QuoteReportTab filters={{ ...DEFAULT_FILTERS, period: "custom", from: "2026-08-01" }} onChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-01");
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByText("Submitted 1 Aug 2026 – today")).toBeInTheDocument();
  });

  it("keeps the grid to 7 columns, combining related facts", () => {
    const { rerender } = render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    const table = within(screen.getByRole("table", { name: "Quote report" }));
    expect(table.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Quote", "Account", "Status", "Deal", "TCV (USD)", "Submitted", "Days in approval",
    ]);
    expect(table.getByText("Version 2")).toBeInTheDocument();
    expect(table.getByText("Waiting on CFO")).toBeInTheDocument();
    expect(table.getAllByText("Renewal")).toHaveLength(2); // the deal type, and this test opportunity's name
    expect(table.getByText("NA · Direct")).toBeInTheDocument();
    expect(table.getByText("18 Oct 2026")).toBeInTheDocument();
    // The date column follows which date the period applies to.
    rerender(<MemoryRouter><QuoteReportTab filters={{ ...DEFAULT_FILTERS, dateField: "CREATED" }} onChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "Created" })).toBeInTheDocument();
    expect(screen.getByText("1 Oct 2026")).toBeInTheDocument();
  });

  it("opens a quote in the side panel from its row, keeping the results", async () => {
    render(<MemoryRouter initialEntries={["/sales/cado2/insights/report?q=north"]}><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("complementary", { name: "Quote summary" })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("row", { name: /Show Q-26-00031 in the side panel/ }));
    const panel = within(screen.getByRole("complementary", { name: "Quote summary" }));
    expect(panel.getByRole("heading", { name: "Northwind" })).toBeInTheDocument();
    expect(panel.getByText("Renewal")).toBeInTheDocument();
    expect(panel.getByText("Meridian IT")).toBeInTheDocument();
    expect(panel.getByText("738,000.00")).toBeInTheDocument();
    expect(panel.getByText(/≈ USD 820,000 at Salesforce's rate on the day it was submitted/)).toBeInTheDocument();
    expect(panel.getByText("3 years")).toBeInTheDocument();
    // Only where the approval stands now, not the whole chain.
    expect(panel.getByText("Waiting on CFO")).toBeInTheDocument();
    expect(panel.getByText("1 of 3 approvals done")).toBeInTheDocument();
    expect(panel.getByText(/Overdue by/)).toBeInTheDocument();
    expect(panel.queryByText(/dd@wso2.com/)).toBeNull();
    expect(panel.queryByText("CEO")).toBeNull();
    expect(panel.getByText("WSO2 API Manager")).toBeInTheDocument();
    expect(panel.getByText("12.5% discretionary")).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "Open full quote" })).toHaveAttribute(
      "href",
      `/sales/cado2/quotes/31/quote?${new URLSearchParams({ from: "insights", back: "/sales/cado2/insights/report?q=north" })}`,
    );
    // The results stay on screen; Esc closes the panel.
    expect(screen.getByRole("table", { name: "Quote report" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Quote summary" })).toBeNull();
  });

  it("says when an approved quote was approved, and who returned a returned one", async () => {
    Object.assign(summary, { data: { ...summaryData, status: "APPROVED", approvedAt: "2026-10-20T15:00:00Z",
      approvals: summaryData.approvals.map((x) => ({ ...x, status: "APPROVED" })) } });
    const { unmount } = render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("row", { name: /Show Q-26-00031/ }));
    expect(screen.getByText("Approved on 20 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("2.3 days after submission, 3 approvals")).toBeInTheDocument();
    unmount();

    Object.assign(summary, { data: { ...summaryData, status: "RETURNED",
      approvals: [{ ...summaryData.approvals[1], status: "RETURNED", actedAt: "2026-10-20T10:00:00Z", comment: "Fix the discount" }] } });
    render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByRole("row", { name: /Show Q-26-00031/ }));
    expect(screen.getByText("Returned by CFO on 20 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText(/Fix the discount/)).toBeInTheDocument();
  });

  it("doesn't link the quote number: the row opens the side panel instead", () => {
    render(<MemoryRouter initialEntries={["/sales/cado2/insights/report"]}><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    const table = within(screen.getByRole("table", { name: "Quote report" }));
    expect(table.getByText("Q-26-00031")).toBeInTheDocument();
    expect(table.queryByRole("link")).toBeNull();
  });

  it("says when nothing matches", () => {
    Object.assign(report, { data: { ...reportData, rows: [], total: 0 } });
    render(<MemoryRouter><QuoteReportTab filters={DEFAULT_FILTERS} onChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("No quotes match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });
});

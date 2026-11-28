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
import type { Person } from "../types";
import { emptyBudget, emptyDetails, emptyEvent, emptyVendor } from "../request-form/requestFormModel";
import RequestSummary, { type RequestView } from "./RequestSummary";

const requester: Person = { id: "u-1", name: "Emery Quinn", email: "emery.quinn@example.com" };
const lead: Person = { id: "u-2", name: "Jordan Ellis", email: "jordan.ellis@example.com" };

const view = (patch: Partial<RequestView> = {}): RequestView => ({
  category: "IT",
  requester,
  teamLead: lead,
  details: { ...emptyDetails(), product: "ZoomInfo", plan: "Enterprise", description: "Data", usagePeriod: "1 year", businessJustification: "Needed", sensitiveData: "no", externalPii: "no", employeePii: "no", integrates: "no" },
  event: emptyEvent(),
  vendors: [{ ...emptyVendor(), name: "ZoomInfo" }],
  budget: emptyBudget(),
  additionalApprovers: [],
  budgetApprover: "Budget Owner",
  notes: "",
  ...patch,
});

describe("RequestSummary", () => {
  it("has one card per form step and puts the key facts up front", () => {
    render(<RequestSummary view={view({ date: { label: "Raised", iso: "2026-11-06T00:00:00.000Z" } })} />);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Requester",
      "Requirement details",
      "Vendors",
      "Budget",
      "Notes",
    ]);
    expect(screen.getByText("IT request")).toBeInTheDocument();
    expect(screen.getByText("Team lead: Jordan Ellis")).toBeInTheDocument();
    expect(screen.getByText(/^Raised /)).toBeInTheDocument();
  });

  it("shows the team lead and any additional approvers, and Not provided when there is no team lead", () => {
    const { rerender } = render(<RequestSummary view={view({ additionalApprovers: ["other@example.com", "third@example.com"] })} />);
    expect(screen.getByText("Jordan Ellis, jordan.ellis@example.com")).toBeInTheDocument();
    expect(screen.getByText(/other@example.com/)).toBeInTheDocument();
    rerender(<RequestSummary view={view({ teamLead: null })} />);
    expect(screen.queryByText("Jordan Ellis, jordan.ellis@example.com")).toBeNull();
  });

  it("names a Marketing & Events request, which it only reads", () => {
    render(<RequestSummary view={view({ category: "EVENTS" })} />);
    expect(screen.getByText("Marketing & Events request")).toBeInTheDocument();
    expect(screen.getByText("Marketing & Events Procurement")).toBeInTheDocument();
  });

  it("shows the budget approver of a Marketing & Events request, with Not provided when none was chosen", () => {
    const { rerender } = render(<RequestSummary view={view({ category: "EVENTS" })} />);
    expect(screen.getByText("Budget approver")).toBeInTheDocument();
    expect(screen.getByText("Budget Owner")).toBeInTheDocument();
    rerender(<RequestSummary view={view({ category: "EVENTS", budgetApprover: "" })} />);
    const row = screen.getByText("Budget approver").parentElement as HTMLElement;
    expect(within(row).getByText("Not provided")).toBeInTheDocument();
  });

  it("says Not provided for a skipped optional field and leaves out a required one that is empty", () => {
    render(<RequestSummary view={view()} />);
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.getByText("Engagement code")).toBeInTheDocument();
    expect(screen.getByText("Notes for Procurement")).toBeInTheDocument();
  });

  it("treats budget details as required for Non-IT, so a blank one is not offered as skipped", () => {
    render(<RequestSummary view={view({ category: "NON-IT", details: { ...emptyDetails(), description: "Chairs", businessJustification: "Worn out" } })} />);
    expect(screen.queryByText("Engagement code")).toBeNull();
    expect(screen.getByText("Additional specifications or document links")).toBeInTheDocument();
  });

  it("cuts long text with Show more, and short text is left alone", async () => {
    const user = userEvent.setup();
    const long = "A long justification. ".repeat(20);
    render(<RequestSummary view={view({ details: { ...view().details, businessJustification: long } })} />);
    const more = screen.getByRole("button", { name: "Show more" });
    expect(screen.getAllByRole("button", { name: "Show more" })).toHaveLength(1);
    await user.click(more);
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("offers Edit on each card only when asked to, naming the step that holds it", async () => {
    const onEditStep = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<RequestSummary view={view()} />);
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    rerender(<RequestSummary view={view()} onEditStep={onEditStep} />);
    await user.click(screen.getByRole("button", { name: "Edit Requester" }));
    await user.click(screen.getByRole("button", { name: "Edit Budget" }));
    expect(onEditStep.mock.calls).toEqual([[1], [4]]);
    expect(within(screen.getByRole("button", { name: "Edit Requirement details" })).getByText("Edit")).toBeInTheDocument();
  });

  it("shows a control given for the requester in the Requester card, and nowhere else", () => {
    render(<RequestSummary view={view()} requesterAction={<button type="button">Change lead</button>} />);
    const card = screen.getByText("Requester", { selector: "h6, .MuiTypography-subtitle1" }).closest(".MuiCard-root") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Change lead" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Change lead" })).toHaveLength(1);
  });

  it("shows a control given for the budget in the Budget card, and nowhere else", () => {
    render(<RequestSummary view={view()} budgetAction={<button type="button">Change budget</button>} />);
    const card = screen.getByText("Budget", { selector: "h6, .MuiTypography-subtitle1" }).closest(".MuiCard-root") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Change budget" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Change budget" })).toHaveLength(1);
  });

  it("shows an event with its costs and total, and no vendors card", () => {
    const event = {
      ...emptyEvent(),
      eventType: "INDUSTRY_EVENT_SPONSORSHIP" as const,
      shortlisted: "no" as const,
      name: "KubeCon",
      startDate: "2027-03-01",
      endDate: "2027-03-03",
      audience: "Platform engineers",
      packageName: "Gold sponsor",
      packageInclusions: ["BOOTH_SPACE" as const, "SPEAKING_SLOT" as const],
      attendedBefore: "no" as const,
      costs: { ...emptyEvent().costs, SPONSORSHIP_FEE: "60000", SWAG: "500" },
      targetAccounts: "10",
      keyAccounts: "Acme",
      newPipeline: "500000",
      roiCalculatorUrl: "https://example.com/roi",
    };
    render(<RequestSummary view={view({ category: "EVENTS", event, vendors: [] })} />);
    expect(screen.getByText("Industry event sponsorship")).toBeInTheDocument();
    expect(screen.getByText("Booth space, Speaking slot")).toBeInTheDocument();
    expect(screen.getByText("$60,500.00")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vendors" })).toBeNull();
  });

  it("shows links as links that open in a new tab, and anything else as plain text", () => {
    const details = { ...view().details, integrates: "yes" as const, vendorDocs: "yes" as const, vendorDocsLink: "https://example.com/docs, not-a-link" };
    render(<RequestSummary view={view({ details, vendors: [{ ...emptyVendor(), name: "Acme", website: "https://www.acme.example.com" }] })} />);
    const docs = screen.getByRole("link", { name: "https://example.com/docs" });
    expect(docs).toHaveAttribute("href", "https://example.com/docs");
    expect(docs).toHaveAttribute("target", "_blank");
    expect(docs).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: "https://www.acme.example.com" })).toBeInTheDocument();
    expect(screen.getByText("not-a-link")).not.toHaveAttribute("href");
  });

  it("lists the attachments with a Download only for those that can be downloaded", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <RequestSummary
        view={view({
          attachments: [
            { key: "1", name: "quote.pdf", sizeBytes: 2048, onDownload },
            { key: "2", name: "scan.pdf", sizeBytes: 100, note: "Blocked: the scan found a problem" },
          ],
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Attachments" })).toBeInTheDocument();
    expect(screen.getByText("Blocked: the scan found a problem")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Download/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Download quote.pdf" }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("opens the step that holds the attachments: the event step for an industry sponsorship, the budget step for other requests", async () => {
    const user = userEvent.setup();
    const onEditStep = vi.fn();
    const attachments = [{ key: "1", name: "quote.pdf", sizeBytes: 10 }];
    const event = { ...emptyEvent(), eventType: "INDUSTRY_EVENT_SPONSORSHIP" as const };
    const { rerender } = render(<RequestSummary view={view({ category: "EVENTS", event, attachments })} onEditStep={onEditStep} />);
    await user.click(screen.getByRole("button", { name: "Edit Attachments" }));
    rerender(<RequestSummary view={view({ category: "EVENTS", event: { ...event, eventType: "WSO2CON" }, attachments })} onEditStep={onEditStep} />);
    await user.click(screen.getByRole("button", { name: "Edit Attachments" }));
    rerender(<RequestSummary view={view({ attachments })} onEditStep={onEditStep} />);
    await user.click(screen.getByRole("button", { name: "Edit Attachments" }));
    expect(onEditStep.mock.calls).toEqual([[3], [4], [4]]);
  });

  it("has no Attachments card when there are none", () => {
    render(<RequestSummary view={view({ attachments: [] })} />);
    expect(screen.queryByRole("heading", { name: "Attachments" })).toBeNull();
  });

  it("does not show a vendor the requester left empty, and says none was proposed", () => {
    render(<RequestSummary view={view({ vendors: [emptyVendor()] })} />);
    const row = screen.getByText("Proposed vendor").parentElement as HTMLElement;
    expect(within(row).getByText("Not provided")).toBeInTheDocument();
  });

  it("numbers only the vendors that have a name", () => {
    render(<RequestSummary view={view({ vendors: [{ ...emptyVendor(), name: "Acme" }, emptyVendor(), { ...emptyVendor(), name: "Globex" }] })} />);
    expect(screen.getByText("Proposed vendor 1")).toBeInTheDocument();
    expect(screen.getByText("Proposed vendor 2")).toBeInTheDocument();
    expect(screen.queryByText("Proposed vendor 3")).toBeNull();
  });
});

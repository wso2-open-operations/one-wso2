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
import type { Person, ProcurementLookups, ProcurementMe } from "../types";
import RequestForm from "./RequestForm";
import { emptyDraft, emptyEvent, type RequestDraft } from "./requestFormModel";

const { directorySearch } = vi.hoisted(() => ({ directorySearch: vi.fn() }));

// Everything the form asks the backend for, answered the way the backend would.
vi.mock("../api/useProcurement", () => {
  const settled = { isFetching: false, isError: false, error: null };
  return {
    // Everyone the search might return, including the requester and the team lead.
    useDirectorySearch: (query: string, leadsOnly: boolean) => {
      directorySearch(query, leadsOnly);
      return {
        ...settled,
        data: [
          { id: "other@example.com", name: "Other Approver", email: "other@example.com" },
          { id: "lead@example.com", name: "Team Lead", email: "lead@example.com" },
          { id: "requester@example.com", name: "Req Uester", email: "requester@example.com" },
        ],
      };
    },
    useEngagementCodes: (unitName: string) => ({ ...settled, data: unitName ? [{ value: "ENG-1", label: "ENG-1 - Platform" }] : [] }),
    useBudgetApprovers: ({ businessUnit, region }: { businessUnit: string; region: string }) => ({
      ...settled,
      data: businessUnit || region ? [{ id: "10", name: "Budget Owner" }] : [],
    }),
  };
});

const lead: Person = { id: "lead@example.com", name: "Team Lead", email: "lead@example.com" };
const me: ProcurementMe = { id: "requester@example.com", name: "Req Uester", email: "requester@example.com", roles: [], teamLead: lead, approvalExempt: false };
const lookups: ProcurementLookups = {
  budgetCategories: [{ value: "CAT-1", label: "Facilities & Office" }],
  businessUnits: [
    { value: "BU-1", label: "Sales" },
    { value: "BU-2", label: "Legal" },
  ],
  products: [{ value: "PRD-1", label: "Choreo" }],
  regions: [{ value: "REG-1", label: "Global" }],
};

function renderForm(user: ProcurementMe = me, initialDraft: RequestDraft = emptyDraft()) {
  const onSubmit = vi.fn();
  render(<RequestForm initialDraft={initialDraft} me={user} lookups={lookups} submitLabel="Submit request" submitting={false} onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
}

const nonIt = (): RequestDraft => {
  const draft = emptyDraft();
  return { ...draft, category: "NON-IT", details: { ...draft.details, description: "Chairs", businessJustification: "Worn out" } };
};

describe("RequestForm, the requester step", () => {
  it("shows the backend's team lead read-only and the sign-in identity locked", () => {
    renderForm();
    expect(screen.getByLabelText("Member email")).toBeDisabled();
    expect(screen.getByLabelText("Your full name")).toHaveValue("Req Uester");
    const teamLead = screen.getByLabelText(/Team lead \(for approval\)/);
    expect(teamLead).toBeDisabled();
    expect(teamLead).toHaveValue("Team Lead (lead@example.com)");
  });

  it("moves on with the manager as team lead and no additional approver", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Procurement category" })).toBeInTheDocument();
  });

  it("keeps additional approvers out of sight until the requester asks, and folds them away again", async () => {
    const { user } = renderForm();
    expect(screen.queryByLabelText(/Additional approvers/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add an additional approver" }));
    expect(screen.queryByRole("button", { name: "Add an additional approver" })).toBeNull();
    await user.type(screen.getByLabelText(/Additional approvers/), "oth");
    await user.click(await screen.findByRole("option", { name: "Other Approver (other@example.com)" }));
    expect(screen.getByText("Other Approver (other@example.com)")).toBeInTheDocument();

    await user.click(screen.getByTestId("CancelIcon"));
    expect(screen.queryByLabelText(/Additional approvers/)).toBeNull();
    expect(screen.getByRole("button", { name: "Add an additional approver" })).toBeInTheDocument();
  });

  it("opens no list, and says nothing, until three characters are typed", async () => {
    const { user } = renderForm({ ...me, teamLead: null });
    const field = screen.getByLabelText(/Additional approvers/);
    await user.click(field);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByText(/at least 3 characters/i)).toBeNull();
    await user.type(field, "ot");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.type(field, "h");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("searches for leads only, because only leads can approve", async () => {
    directorySearch.mockClear();
    const { user } = renderForm({ ...me, teamLead: null });
    await user.type(screen.getByLabelText(/Additional approvers/), "oth");
    expect(directorySearch).toHaveBeenCalled();
    expect(directorySearch.mock.calls.every(([, leadsOnly]) => leadsOnly === true)).toBe(true);
  });

  it("shows the field at once, as required, when there is no manager", () => {
    renderForm({ ...me, teamLead: null });
    expect(screen.getByLabelText(/Additional approvers/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add an additional approver" })).toBeNull();
  });

  it("needs an additional approver when there is no manager, and accepts one picked from the directory", async () => {
    const { user } = renderForm({ ...me, teamLead: null });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Add a team lead or an additional approver")).toBeInTheDocument();
    expect(screen.getByText("Complete the 1 highlighted field to continue.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Additional approvers/), "oth");
    await user.click(await screen.findByRole("option", { name: "Other Approver (other@example.com)" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Procurement category" })).toBeInTheDocument();
  });

  it("does not let the requester or the team lead be picked as an additional approver", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Add an additional approver" }));
    await user.type(screen.getByLabelText(/Additional approvers/), "oth");
    expect(await screen.findByRole("option", { name: "Other Approver (other@example.com)" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: "Team Lead (lead@example.com)" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: "Req Uester (requester@example.com)" })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("RequestForm, the steps after it", () => {
  it("will not move past the category step until one is chosen, then asks that category's questions", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Choose a category")).toBeInTheDocument();
    expect(screen.getByText("Complete the 1 highlighted field to continue.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^IT Related Procurement/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "IT requirement details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/Complete the \d+ highlighted fields to continue\./)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Product \/ solution name/ })).toBeInvalid();
    expect(screen.getAllByText("Required").length).toBeGreaterThan(0);
  });

  it("clears a field's message, and counts the rest, as it is filled in", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /^IT Related Procurement/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const before = Number(screen.getByText(/Complete the \d+ highlighted fields/).textContent?.match(/\d+/)?.[0]);
    await user.type(screen.getByRole("textbox", { name: /Product \/ solution name/ }), "Figma");
    expect(screen.getByRole("textbox", { name: /Product \/ solution name/ })).toBeValid();
    expect(screen.getByText(`Complete the ${before - 1} highlighted ${before - 1 === 1 ? "field" : "fields"} to continue.`)).toBeInTheDocument();
  });

  it("asks every IT request for users, administrators and the security assessment", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /^IT Related Procurement/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Number of users/)).toBeInTheDocument();
    expect(screen.getByText(/Data & security assessment/)).toBeInTheDocument();
  });

  it("marks the IT requirement as required", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /^IT Related Procurement/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("textbox", { name: /requirement to use this software/ })).toBeRequired();
  });

  it("offers Marketing & Events as a choice that asks the event questions", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByText("Coming soon")).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Marketing/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Event details" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Event type/ })).toBeRequired();
    expect(screen.getByText("What is the total investment?")).toBeInTheDocument();
    expect(screen.queryByText("What is the sponsorship package, and what does it include?")).toBeNull();
  });

  it("asks only an industry event sponsorship for its package and whether it was attended before", async () => {
    const draft = { ...emptyDraft(), category: "EVENTS" as const, event: { ...emptyEvent(), eventType: "WSO2CON" as const } };
    const { user } = renderForm(me, draft);
    for (let i = 0; i < 2; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.queryByRole("textbox", { name: /Package name/ })).toBeNull();
    expect(screen.queryByRole("group", { name: /Previous attendance/ })).toBeNull();
  });

  it("asks a shortlisted industry event neither for its pipeline nor for earlier attendance", async () => {
    const draft = { ...emptyDraft(), category: "EVENTS" as const, event: { ...emptyEvent(), eventType: "INDUSTRY_EVENT_SPONSORSHIP" as const } };
    const { user } = renderForm(me, draft);
    for (let i = 0; i < 2; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByRole("group", { name: /Previous attendance/ })).toBeInTheDocument();
    await user.click(within(screen.getByRole("group", { name: /EVENT_SHORTLIST/ })).getByRole("button", { name: "Yes" }));
    expect(screen.queryByRole("group", { name: /Previous attendance/ })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Completed ROI calculator/ })).toBeNull();
  });

  it("lets the other costs be several lines, and shows the partner and Choreo Labs shares", async () => {
    const draft = { ...emptyDraft(), category: "EVENTS" as const, event: { ...emptyEvent(), eventType: "WSO2CON" as const } };
    const { user } = renderForm(me, draft);
    for (let i = 0; i < 2; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    await user.type(screen.getByRole("spinbutton", { name: "Payment to partner" }), "1000");
    await user.type(screen.getByRole("textbox", { name: "What it is for" }), "Stickers");
    await user.type(screen.getByRole("spinbutton", { name: "Amount" }), "200");
    await user.click(screen.getByRole("button", { name: "Add another cost" }));
    expect(screen.getAllByRole("textbox", { name: "What it is for" })).toHaveLength(2);
    expect(screen.getByText("Total investment: $1,200.00")).toBeInTheDocument();
    await user.type(screen.getByRole("spinbutton", { name: /Partner's share/ }), "25");
    expect(screen.getByText(/Choreo Labs investment: 75%/)).toBeInTheDocument();
  });

  it("adds the costs up", async () => {
    const draft = { ...emptyDraft(), category: "EVENTS" as const, event: { ...emptyEvent(), eventType: "WSO2CON" as const } };
    const { user } = renderForm(me, draft);
    for (let i = 0; i < 2; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    await user.type(screen.getByRole("spinbutton", { name: "Sponsorship fee" }), "1000");
    await user.type(screen.getByRole("spinbutton", { name: /^SWAG/ }), "500");
    expect(screen.getByText("Total investment: $1,500.00")).toBeInTheDocument();
  });

  it("offers to attach files on the budget step of a Non-IT request, and the prospectus file for an industry event", async () => {
    const first = renderForm(me, { ...nonIt(), budget: { category: "CAT-1", businessUnit: "BU-1", product: "PRD-1", region: "REG-1", engagementCode: "ENG-1", salesforceCampaign: "" }, budgetApproverId: "10" });
    for (let i = 0; i < 3; i += 1) await first.user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText("Attachments")).toBeInTheDocument();
    expect(screen.getByText(/PDF, Word, Excel, PowerPoint, PNG or JPEG, up to 10 MB each, at most 10 files\./)).toBeInTheDocument();
  });

  it("asks for the prospectus as a file as well as a link, for an industry event sponsorship", async () => {
    const draft = { ...emptyDraft(), category: "EVENTS" as const, event: { ...emptyEvent(), eventType: "INDUSTRY_EVENT_SPONSORSHIP" as const } };
    const { user } = renderForm(me, draft);
    for (let i = 0; i < 2; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByRole("textbox", { name: /prospectus or contract \(link\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
  });

  it("moves between the category cards with the arrow keys, wrapping round, and keeps one card as the tab stop", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const cards = screen.getAllByRole("radio");
    const stops = () => cards.map((c) => c.getAttribute("tabindex"));
    expect(stops()).toEqual(["0", "-1", "-1"]);
    await user.click(cards[0]);
    await user.keyboard("{ArrowRight}");
    expect(cards[1]).toBeChecked();
    expect(cards[1]).toHaveFocus();
    expect(stops()).toEqual(["-1", "0", "-1"]);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(cards[2]).toBeChecked();
  });

  it("marks the category group as required, and invalid with its message once none is chosen", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const group = screen.getByRole("radiogroup", { name: "Procurement category" });
    expect(group).toHaveAttribute("aria-required", "true");
    expect(group).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(group.getAttribute("aria-describedby") ?? "")).toHaveTextContent("Choose a category");
  });

  it("marks a Yes/No question whose answer is missing as invalid and ties it to its message", async () => {
    const { user } = renderForm(me, { ...emptyDraft(), category: "IT" });
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    const question = screen.getByRole("group", { name: /interact with this platform/ });
    expect(question).toHaveAttribute("aria-invalid", "true");
    const message = document.getElementById(question.getAttribute("aria-describedby") ?? "");
    expect(message).toHaveTextContent("Select an option");
  });

  it("asks for the budget and an optional budget approver, without vendors, on the next step", async () => {
    const draft = {
      ...emptyDraft(),
      category: "EVENTS" as const,
      event: {
        ...emptyEvent(),
        eventType: "WSO2CON" as const,
        shortlisted: "yes" as const,
        shortlistLineId: "L-42",
        name: "WSO2CON",
        startDate: "2027-03-01",
        endDate: "2027-03-03",
        audience: "Customers",
        costs: { ...emptyEvent().costs, SWAG: "100" },
      },
    };
    const { user } = renderForm(me, draft);
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Budget approver" })).toBeInTheDocument();
    expect(screen.queryByText("Proposed vendor")).toBeNull();
  });

  it("asks for the engagement code and budget approver only after a business unit, and clears them when it changes", async () => {
    const { user } = renderForm(me, nonIt());
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByRole("heading", { name: "Vendor & budget" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Engagement code/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: /Budget approver/ })).toHaveAttribute("aria-disabled", "true");

    const pick = async (field: RegExp, option: string) => {
      await user.click(screen.getByRole("combobox", { name: field }));
      await user.click(await screen.findByRole("option", { name: option }));
    };
    await pick(/Business unit/, "Sales");
    await pick(/Engagement code/, "ENG-1 - Platform");
    await pick(/Budget approver/, "Budget Owner");
    expect(screen.getByRole("combobox", { name: /Engagement code/ })).toHaveTextContent("ENG-1 - Platform");
    expect(screen.getByRole("combobox", { name: /Budget approver/ })).toHaveTextContent("Budget Owner");

    await pick(/Business unit/, "Legal");
    expect(screen.getByRole("combobox", { name: /Engagement code/ })).toHaveTextContent("Select");
    expect(screen.getByRole("combobox", { name: /Budget approver/ })).toHaveTextContent("Select");
  });

  it("on the review page keeps Submit enabled, asks for the declaration, then submits once it is ticked", async () => {
    const complete: RequestDraft = {
      ...nonIt(),
      budget: { category: "CAT-1", businessUnit: "BU-1", product: "PRD-1", region: "REG-1", engagementCode: "ENG-1", salesforceCampaign: "" },
      budgetApproverId: "10",
    };
    const { user, onSubmit } = renderForm(me, complete);
    for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole("button", { name: /Continue|Next: review/ }));
    expect(screen.getByRole("heading", { name: "Review & submit" })).toBeInTheDocument();
    expect(screen.getByText("Budget Owner")).toBeInTheDocument();
    expect(screen.getByText("ENG-1 - Platform")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "Submit request" });
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(screen.getByRole("alert")).toHaveTextContent("Tick the declaration to submit.");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox"));
    expect(screen.queryByText("Tick the declaration to submit.")).toBeNull();
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ budgetApproverId: "10", additionalApprovers: [] });
  });
});

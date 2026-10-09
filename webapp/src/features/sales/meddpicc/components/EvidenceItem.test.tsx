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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import EvidenceItem from "./EvidenceItem";
import DealFieldRow from "./DealFieldRow";
import { EMPTY_DRAFT } from "../util/approval";
import { field, quote } from "../util/callInsight.fixtures";

const renderIn = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("EvidenceItem", () => {
  it("tags the customer's words, and plays a quote from the call on screen", async () => {
    const onSeek = vi.fn();
    renderIn(<EvidenceItem quote={quote({ authorRole: "CUSTOMER" })} currentMeetingId={22} onSeek={onSeek} />);
    expect(screen.getByText("Customer")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Play from 12:40, Lars Haugen" }));
    expect(onSeek).toHaveBeenCalledWith(760);
  });

  it("links a quote from another call to that call's page", () => {
    renderIn(<EvidenceItem quote={quote({ authorRole: "WSO2", speaker: "Ravi Kumar" })} />);
    expect(screen.getByText("WSO2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nordlys – budget sign-off" })).toHaveAttribute("href", "/sales/meetings/22");
  });

  it("opens an email quote in Salesforce", () => {
    renderIn(
      <EvidenceItem
        quote={quote({
          meetingId: 0,
          source: { type: "EMAIL", id: "02s1", title: "Re: proposal", occurredAt: "2026-10-02T09:00:00Z", url: "https://sf/02s1" },
          authorRole: "CUSTOMER",
        })}
      />,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open email/ })).toHaveAttribute("href", "https://sf/02s1");
  });

  it("says when a rep's note is the only source", () => {
    renderIn(
      <EvidenceItem
        quote={quote({
          meetingId: 0,
          source: { type: "ACTIVITY", id: "00T1", title: "Call notes", occurredAt: "2026-10-05T09:00:00Z", url: null },
          authorRole: "WSO2",
          speaker: "Ravi Kumar",
        })}
      />,
    );
    expect(screen.getByText(/reported by the rep/)).toBeInTheDocument();
  });
});

describe("DealFieldRow on an attest field", () => {
  const row = (role: "CUSTOMER" | "WSO2") => (
    <DealFieldRow
      field={field({
        key: "budgetConfirmed",
        label: "Budget confirmed by economic buyer",
        attest: true,
        kind: "picklist",
        proposal: { value: "Yes", rationale: null, confidence: 0.8, pending: true, evidence: [quote({ authorRole: role })] },
      })}
      draft={EMPTY_DRAFT}
      readOnly={false}
      salesforceUrl="https://sf/006D"
      onEdit={() => {}}
      onUndo={() => {}}
      onRoleMatch={() => {}}
    />
  );

  it("is marked as the account manager's to confirm", () => {
    renderIn(row("CUSTOMER"));
    expect(screen.getByText("You confirm")).toBeInTheDocument();
    expect(screen.queryByText(/Needs customer evidence/)).not.toBeInTheDocument();
  });

  it("warns when only WSO2's words back the proposal", () => {
    renderIn(row("WSO2"));
    expect(screen.getByText(/Needs customer evidence/)).toBeInTheDocument();
  });
});

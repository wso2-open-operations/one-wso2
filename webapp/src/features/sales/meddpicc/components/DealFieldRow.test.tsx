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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_DRAFT } from "../util/approval";
import { field } from "../util/callInsight.fixtures";
import DealFieldRow from "./DealFieldRow";

function renderRow(
  overrides: Parameters<typeof field>[0],
  props: Partial<Pick<Parameters<typeof DealFieldRow>[0], "readOnly" | "onReject">> = {},
) {
  render(
    <MemoryRouter>
      <DealFieldRow
        field={field(overrides)}
        draft={EMPTY_DRAFT}
        readOnly={props.readOnly ?? false}
        onReject={props.onReject}
        salesforceUrl="https://sf/006D"
        onEdit={() => {}}
        onUndo={() => {}}
        onRoleMatch={() => {}}
        onNewContact={() => {}}
        onExplain={() => {}}
        accountName="Brightwater Pumps Limited"
      />
    </MemoryRouter>,
  );
}

const heard = { value: "Ingrid Solberg", rationale: null, confidence: 0.86, evidence: [], pending: false };

describe("DealFieldRow's decision line", () => {
  // Only when Salesforce holds the same value: an approved suggestion stays "not pending"
  // after Salesforce is changed, so not pending alone says nothing about agreement.
  it("says the calls agree with an approved suggestion Salesforce still holds", () => {
    renderRow({ salesforceValue: "Ingrid Solberg", proposal: heard, state: "FILLED" });
    expect(screen.getByText("Salesforce:")).toBeInTheDocument();
    expect(screen.getByText("· the calls agree")).toBeInTheDocument();
  });

  it("says what the calls heard once Salesforce holds something else", () => {
    renderRow({ salesforceValue: "Lars Haugen", proposal: heard, state: "FILLED" });
    expect(screen.getByText("Lars Haugen")).toBeInTheDocument();
    expect(screen.queryByText("· the calls agree")).not.toBeInTheDocument();
    expect(screen.getByText("· the calls heard Ingrid Solberg")).toBeInTheDocument();
  });

  it("keeps a field not in Salesforce yet in Echo, with nothing to compare", () => {
    renderRow({ notInSalesforce: true, proposal: heard, state: "FILLED" });
    expect(screen.queryByText("In Salesforce")).not.toBeInTheDocument();
    expect(screen.getByText("Kept in Echo:")).toBeInTheDocument();
    expect(screen.getByText("· the calls agree")).toBeInTheDocument();
  });

  it("leads a pending suggestion with Salesforce beside what the calls heard, marked as Echo's", () => {
    renderRow({});
    expect(screen.getByText("In Salesforce")).toBeInTheDocument();
    expect(screen.getByText("Heard on calls")).toBeInTheDocument();
    expect(screen.getByText("Echo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Where .* came from$/ })).toBeInTheDocument();
    expect(screen.queryByText(/matches Salesforce/)).not.toBeInTheDocument();
  });
});

describe("DealFieldRow's Reject", () => {
  it("offers Reject beside a pending suggestion, and hands the field up", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    renderRow({}, { onReject });
    await user.click(screen.getByRole("button", { name: "Reject the suggestion for Economic buyer" }));
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ key: "economicBuyer" }));
  });

  it("offers no Reject to someone who can't edit the deal", () => {
    renderRow({}, { onReject: vi.fn(), readOnly: true });
    expect(screen.queryByRole("button", { name: /^Reject the suggestion/ })).not.toBeInTheDocument();
  });

  it("offers no Reject once the calls agree with Salesforce: there is nothing pending", () => {
    renderRow({ salesforceValue: "Ingrid Solberg", proposal: heard, state: "FILLED" }, { onReject: vi.fn() });
    expect(screen.queryByRole("button", { name: /^Reject the suggestion/ })).not.toBeInTheDocument();
  });
});

describe("DealFieldRow's merge caveat", () => {
  const pending = { value: "Ingrid Solberg", rationale: null, confidence: 0.86, evidence: [], pending: true };

  it("says plainly when combining the calls failed and the value is the latest call's alone", () => {
    renderRow({ proposal: { ...pending, mergeStatus: "FALLBACK" } });
    expect(screen.getByText("From the latest call only — couldn't combine calls")).toBeInTheDocument();
    expect(screen.getByText("Heard on the latest call")).toBeInTheDocument();
    expect(screen.queryByText("Heard on calls")).not.toBeInTheDocument();
  });

  it("says it on a suggestion that is no longer pending too", () => {
    renderRow({ salesforceValue: "Ingrid Solberg", proposal: { ...heard, mergeStatus: "FALLBACK" }, state: "FILLED" });
    expect(screen.getByText("From the latest call only — couldn't combine calls")).toBeInTheDocument();
  });

  it("says nothing for a combined value", () => {
    renderRow({ proposal: { ...pending, mergeStatus: "MERGED" } });
    expect(screen.queryByText(/couldn't combine calls/)).not.toBeInTheDocument();
    expect(screen.getByText("Heard on calls")).toBeInTheDocument();
  });
});

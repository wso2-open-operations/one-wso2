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
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import MeetingsTable from "./MeetingsTable";
import type { Meeting } from "../api/salesTypes";
import type { CallContextView } from "../callContext/util/callContext";
import type { ContextAccount, ContextOpportunity } from "../callContext/types";

const meeting = (overrides: Partial<Meeting>): Meeting => ({
  meetingId: 1,
  title: "Call",
  googleEventId: "evt",
  host: "amal@wso2.com",
  startTime: "2026-09-10 10:00:00",
  endTime: "2026-09-10 10:45:00",
  internalParticipants: "amal@wso2.com",
  meetingStatus: "ACTIVE",
  timeStatus: "PAST",
  isRecurring: false,
  ...overrides,
});

function renderTable(
  meetings: Meeting[],
  extra: Partial<Parameters<typeof MeetingsTable>[0]> = {},
) {
  return render(
    <MemoryRouter>
      <MeetingsTable
        {...extra}
        meetings={meetings}
        totalCount={meetings.length}
        loading={false}
        page={0}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onOpenAttachments={() => {}}
      />
    </MemoryRouter>,
  );
}

const bodyRows = () => screen.getAllByRole("row").slice(1);

const HEADERS = ["Account", "Meeting", "Call type", "Opportunity", "Opportunity Owner (AM)", "Region", "Start", "Files"];

const OPP = "006AA000001aBcDEF1";
const ACC = "001AA000001aBcDEF1";

const opportunity = (overrides: Partial<ContextOpportunity> = {}): ContextOpportunity => ({
  id: OPP,
  name: "Harbourline – API platform",
  ownerName: "Nadia Perera",
  ownerEmail: "nadia@wso2.com",
  salesRegion: "APAC",
  stage: "Qualify",
  recordType: "First Sale",
  amount: 120000,
  currency: "USD",
  closeDate: "2026-12-15",
  isClosed: false,
  accountId: ACC,
  accountName: "Harbourline",
  ...overrides,
});

const account = (overrides: Partial<ContextAccount> = {}): ContextAccount => ({
  id: ACC,
  name: "Harbourline",
  region: "Europe",
  salesRegion: "EU",
  ownerName: "Ola Berg",
  ownerEmail: "ola@wso2.com",
  technicalOwnerName: null,
  technicalOwnerEmail: null,
  ...overrides,
});

const ready = (
  opportunities: ContextOpportunity[] = [],
  accounts: ContextAccount[] = [],
): CallContextView => ({
  status: "ready",
  opportunities: Object.fromEntries(opportunities.map((o) => [o.id, o])),
  accounts: Object.fromEntries(accounts.map((a) => [a.id, a])),
});

/** The cells of the first body row, by column header. */
function firstRowCells() {
  const cells = within(bodyRows()[0]).getAllByRole("cell");
  return Object.fromEntries(HEADERS.map((header, i) => [header, cells[i]]));
}

describe("MeetingsTable", () => {
  it("lists the latest meeting first, whatever order the page arrives in", () => {
    renderTable([
      meeting({ meetingId: 1, title: "Oldest", startTime: "2026-08-01 09:00:00" }),
      meeting({ meetingId: 2, title: "Newest", startTime: "2026-10-01 09:00:00" }),
      meeting({ meetingId: 3, title: "Middle", startTime: "2026-09-01 09:00:00" }),
    ]);
    const titles = bodyRows().map((row) => within(row).getByRole("link").textContent);
    expect(titles).toEqual(["Newest", "Middle", "Oldest"]);
  });

  it("puts the account, title and call type in their own columns, and leaves attendee emails out", () => {
    renderTable([
      meeting({
        title: "Nordlys – budget sign-off",
        accountName: "Nordlys Energi AS",
        meetingType: "renewal",
        externalParticipants: "lars.haugen@nordlys.example",
      }),
    ]);
    const cells = firstRowCells();
    expect(cells.Account).toHaveTextContent(/^Nordlys Energi AS$/);
    expect(cells.Meeting).toHaveTextContent(/^Nordlys – budget sign-off$/);
    expect(within(cells.Meeting).getByRole("link")).toHaveTextContent("Nordlys – budget sign-off");
    expect(cells["Call type"]).toHaveTextContent(/^Renewal \/ convert/);
    expect(screen.queryByText(/lars\.haugen/)).not.toBeInTheDocument();
  });

  it("leaves the account blank for a call with none, and the call type blank when it has none", () => {
    renderTable([meeting({ meetingType: "internal", externalParticipants: null })]);
    expect(firstRowCells().Account).toBeEmptyDOMElement();
    expect(firstRowCells()["Call type"]).toHaveTextContent(/^Internal prep/);

    cleanup();
    renderTable([meeting({ accountName: "Nordlys Energi AS", meetingType: null })]);
    expect(firstRowCells()["Call type"]).toBeEmptyDOMElement();
  });

  it("marks a lead's company in the Account column", () => {
    renderTable([meeting({ leadId: "00QAA000001aBcDEF1", leadCompany: "Kestrel Labs" })]);
    const account = firstRowCells().Account;
    expect(account).toHaveTextContent("Kestrel Labs");
    expect(within(account).getByText("Lead")).toBeInTheDocument();
  });

  it("shows the host's full email, and no End column", () => {
    renderTable([meeting({})]);
    expect(within(bodyRows()[0]).getByText("amal@wso2.com")).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(HEADERS);
  });

  // A meeting row is a meeting: it opens the call.
  it("opens the meeting from a row", async () => {
    const onOpenMeeting = vi.fn();
    const m = meeting({ meetingId: 7, opportunityId: "006X" });
    renderTable([m], { onOpenMeeting });

    await userEvent.click(within(bodyRows()[0]).getByText("amal@wso2.com"));
    expect(onOpenMeeting).toHaveBeenLastCalledWith(m);
  });

  // The calls are the recordings: a deal's MEDDPICC lives under Opportunities, a call's on its page.
  it("has no MEDDPICC column", () => {
    renderTable([meeting({ meetingId: 7, opportunityId: "006X" })]);
    expect(screen.queryByRole("columnheader", { name: "MEDDPICC" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(HEADERS);
  });
});

describe("MeetingsTable — opportunity, owner and region", () => {
  it("shows the opportunity by name, linking to its deal, with its owner and Sales Region", () => {
    renderTable([meeting({ opportunityId: OPP })], { context: ready([opportunity()]) });
    const cells = firstRowCells();
    const link = within(cells.Opportunity).getByRole("link", { name: "Harbourline – API platform" });
    expect(link).toHaveAttribute("href", `/sales/deals/${OPP}`);
    expect(cells["Opportunity Owner (AM)"]).toHaveTextContent(/^Nadia Perera$/);
    expect(within(cells["Opportunity Owner (AM)"]).getByText("Nadia Perera")).toHaveAttribute(
      "title",
      "nadia@wso2.com",
    );
    expect(cells.Region).toHaveTextContent("APAC");
  });

  it("opens the deal from its link without also opening the meeting", async () => {
    const onOpenMeeting = vi.fn();
    renderTable([meeting({ opportunityId: OPP })], { context: ready([opportunity()]), onOpenMeeting });
    await userEvent.click(screen.getByRole("link", { name: "Harbourline – API platform" }));
    expect(onOpenMeeting).not.toHaveBeenCalled();
  });

  it("falls back to the host, marked, for a call with no opportunity", () => {
    renderTable([meeting({ accountId: ACC, accountName: "Harbourline" })], { context: ready([], [account()]) });
    const cells = firstRowCells();
    expect(cells["Opportunity Owner (AM)"]).toHaveTextContent("amal@wso2.com");
    expect(within(cells["Opportunity Owner (AM)"]).getByText("Host")).toBeInTheDocument();
    expect(cells.Opportunity).toHaveTextContent("—");
  });

  it("uses the account's region for a call linked only to an account", () => {
    renderTable([meeting({ accountId: ACC, accountName: "Harbourline" })], { context: ready([], [account()]) });
    const region = firstRowCells().Region;
    expect(region).toHaveTextContent("EU");
    expect(within(region).getByText("EU")).toHaveAttribute("title", "Europe");
  });

  it("uses the account's region when the opportunity has none", () => {
    renderTable(
      [meeting({ opportunityId: OPP, opportunityDetails: JSON.stringify({ customerId: ACC }) })],
      { context: ready([opportunity({ salesRegion: null })], [account()]) },
    );
    expect(firstRowCells().Region).toHaveTextContent("EU");
  });

  it("leaves a call linked to nothing blank, a lead's call included", () => {
    renderTable([meeting({ leadId: "00QAA000001aBcDEF1", leadCompany: "Kestrel Labs" })], {
      context: ready(),
    });
    const cells = firstRowCells();
    expect(cells.Opportunity).toBeEmptyDOMElement();
    expect(cells.Region).toBeEmptyDOMElement();
    expect(within(cells["Opportunity Owner (AM)"]).getByText("Host")).toBeInTheDocument();
  });

  it("shows the host and skeletons while the details load", () => {
    const { container } = renderTable([meeting({ opportunityId: OPP })], {
      context: { status: "loading", opportunities: {}, accounts: {} },
    });
    const cells = firstRowCells();
    expect(cells["Opportunity Owner (AM)"]).toHaveTextContent(/^amal@wso2\.com$/);
    expect(within(cells["Opportunity Owner (AM)"]).queryByText("Host")).not.toBeInTheDocument();
    expect(cells.Opportunity.querySelector(".MuiSkeleton-root")).not.toBeNull();
    expect(cells.Region.querySelector(".MuiSkeleton-root")).not.toBeNull();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(2);
  });

  it("falls back to the meeting's own data without live details", () => {
    renderTable([
      meeting({
        opportunityId: OPP,
        opportunityDetails: JSON.stringify({ customerName: "Harbourline", stage: "Qualify" }),
      }),
    ]);
    const cells = firstRowCells();
    expect(within(cells.Opportunity).getByRole("link", { name: "Harbourline" })).toHaveAttribute(
      "href",
      `/sales/deals/${OPP}`,
    );
    expect(cells["Opportunity Owner (AM)"]).toHaveTextContent("amal@wso2.com");
    expect(within(cells["Opportunity Owner (AM)"]).getByText("Host")).toBeInTheDocument();
    expect(cells.Region).toHaveTextContent("—");
  });

  it("falls back for an opportunity Salesforce did not return, and keeps the others live", () => {
    const other = "006AA000002aBcDEF2";
    renderTable(
      [
        meeting({ meetingId: 1, opportunityId: OPP, startTime: "2026-09-10 10:00:00" }),
        meeting({ meetingId: 2, opportunityId: other, accountName: "Gone Ltd", startTime: "2026-09-09 10:00:00" }),
      ],
      { context: ready([opportunity()]) },
    );
    const [first, second] = bodyRows();
    expect(within(first).getByRole("link", { name: "Harbourline – API platform" })).toBeInTheDocument();
    expect(within(second).getAllByRole("link").map((link) => link.textContent)).toContain("Gone Ltd");
    expect(within(second).getByText("Host")).toBeInTheDocument();
  });
});

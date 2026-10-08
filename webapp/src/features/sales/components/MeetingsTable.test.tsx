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

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MeetingsTable from "./MeetingsTable";
import type { Meeting } from "../api/salesTypes";

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

function renderTable(meetings: Meeting[]) {
  return render(
    <MemoryRouter>
      <MeetingsTable
        meetings={meetings}
        totalCount={meetings.length}
        loading={false}
        scope="past"
        page={0}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onOpenAttachments={() => {}}
        onCancelMeeting={() => {}}
        canCancel={() => false}
      />
    </MemoryRouter>,
  );
}

const bodyRows = () => screen.getAllByRole("row").slice(1);

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

  it("leads with the account and its call type, and leaves attendee emails out", () => {
    renderTable([
      meeting({
        title: "Nordlys – budget sign-off",
        accountName: "Nordlys Energi AS",
        meetingType: "renewal",
        externalParticipants: "lars.haugen@nordlys.example",
      }),
    ]);
    const cells = within(bodyRows()[0]).getAllByRole("cell");
    expect(within(cells[0]).getByText("Nordlys Energi AS")).toBeInTheDocument();
    expect(within(cells[0]).getByText("Renewal / convert")).toBeInTheDocument();
    expect(within(cells[1]).getByRole("link")).toHaveTextContent("Nordlys – budget sign-off");
    expect(screen.queryByText(/lars\.haugen/)).not.toBeInTheDocument();
  });

  it("leads with the call type when there is no account", () => {
    renderTable([meeting({ meetingType: "internal", externalParticipants: null })]);
    expect(within(bodyRows()[0]).getByText("Internal prep")).toBeInTheDocument();
  });

  it("shows the owner's full email, and no End column", () => {
    renderTable([meeting({})]);
    expect(within(bodyRows()[0]).getByText("amal@wso2.com")).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Account", "Title", "Account Owner", "Start", "Files"]);
  });
});

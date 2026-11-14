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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ControlsTable from "./ControlsTable";
import { CONTROL_COLUMNS } from "./controlColumns";
import { controlsTableKey } from "@features/security/grc/modules/audit/utils/deadlines";
import type { AuditControl } from "@features/security/grc/modules/audit/types/audit";

const control = (id: number, over: Partial<AuditControl> = {}): AuditControl =>
  ({
    id,
    auditId: 1,
    controlNumber: `CA-${id}`,
    description: "desc",
    requirementType: "DESIGN",
    controlType: "CONFIG",
    scope: "COMMON",
    status: "EVIDENCE_PENDING",
    dueDate: "2026-12-01",
    isOverdue: false,
    ...over,
  }) as AuditControl;

// The body row of a control, so a header that shares a label ("Delayed") is not matched.
const rowOf = (controlNumber: string) => within(screen.getByText(controlNumber).closest("tr") as HTMLElement);

const ALL_IDS = CONTROL_COLUMNS.map((c) => c.id);

function renderTable(controls: AuditControl[], visibleColumnIds = ALL_IDS) {
  render(
    <ControlsTable
      controls={controls}
      allControls={controls}
      filters={{}}
      onFiltersChange={vi.fn()}
      isLoading={false}
      onRowClick={vi.fn()}
      visibleColumnIds={visibleColumnIds}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ControlsTable deadline columns", () => {
  it("shows the current deadline with the holder chip and the Delayed badge", () => {
    renderTable([
      control(1, {
        deadlineTracked: true,
        currentHandler: "COMPLIANCE",
        currentDueDate: "2026-11-20",
        plannedOwnerDate: "2026-11-01",
        plannedComplianceDate: "2026-11-10",
        plannedAuditorDate: "2026-11-20",
        delayed: true,
      }),
    ]);
    const row = rowOf("CA-1");
    expect(row.getAllByText("Nov 20, 2026")).toHaveLength(2); // current deadline + auditor plan
    expect(row.getByText("Compliance")).toBeInTheDocument();
    expect(row.getByText("Delayed")).toBeInTheDocument();
    expect(row.getByText("Nov 1, 2026")).toBeInTheDocument();
  });

  it("marks a current deadline in the past as overdue", () => {
    renderTable([control(1, { deadlineTracked: true, currentHandler: "OWNER", currentDueDate: "2026-11-05" })]);
    expect(rowOf("CA-1").getAllByText("Nov 5, 2026")[0]).toHaveStyle({ fontWeight: 600 });
  });

  it("shows dashes, not an error, for an untracked control, and keeps the old due date", () => {
    renderTable([control(1)]);
    expect(screen.getByText("Dec 1, 2026")).toBeInTheDocument();
    expect(rowOf("CA-1").queryByText("Delayed")).not.toBeInTheDocument();
    expect(rowOf("CA-1").queryByText("Owner")).not.toBeInTheDocument();
  });

  it("leaves the Delay Log column out when no control carries a delay log", () => {
    renderTable([control(1, { deadlineTracked: true, currentHandler: "OWNER", currentDueDate: "2026-11-20" })]);
    expect(screen.queryByText("Delay Log")).not.toBeInTheDocument();
  });

  it("renders the delay log entries when the server sent them", () => {
    renderTable([
      control(1, {
        deadlineTracked: true,
        currentHandler: "OWNER",
        currentDueDate: "2026-11-20",
        delayed: true,
        delayLog: [
          { handledBy: "OWNER", date: "2026-11-08" },
          { handledBy: "OWNER", date: "2026-11-09" },
          { handledBy: "COMPLIANCE", date: "2026-11-11" },
        ],
      }),
    ]);
    expect(screen.getByText("Delay Log")).toBeInTheDocument();
    expect(screen.getByText("Owner - 11/08, Owner - 11/09 +1")).toBeInTheDocument();
  });

  it("does not show a hidden deadline column", () => {
    renderTable(
      [control(1, { deadlineTracked: true, currentHandler: "OWNER", currentDueDate: "2026-11-20" })],
      ["controlNumber", "dueDate"],
    );
    expect(screen.queryByText("Current Deadline")).not.toBeInTheDocument();
  });
});

describe("ControlsTable sort across tabs", () => {
  const rowOrder = () => screen.getAllByText(/^CA-\d$/).map((el) => el.textContent);

  // Same order the page hands over for My Deadlines: soonest deadline first.
  const soonestFirst = [control(3), control(1), control(2)];

  function tableFor(quickFilter: string | null) {
    return (
      <ControlsTable
        key={controlsTableKey(quickFilter)}
        controls={soonestFirst}
        allControls={soonestFirst}
        filters={{}}
        onFiltersChange={vi.fn()}
        isLoading={false}
        onRowClick={vi.fn()}
        visibleColumnIds={ALL_IDS}
      />
    );
  }

  it("starts My Deadlines soonest-first even after All was sorted by Control No.", () => {
    const { rerender } = render(tableFor("allPending"));
    fireEvent.click(screen.getByText("Control No."));
    expect(rowOrder()).toEqual(["CA-1", "CA-2", "CA-3"]);

    rerender(tableFor("myDeadlines"));
    expect(rowOrder()).toEqual(["CA-3", "CA-1", "CA-2"]);
  });

  it("keeps the sort when moving between the other tabs", () => {
    const { rerender } = render(tableFor("allPending"));
    fireEvent.click(screen.getByText("Control No."));

    rerender(tableFor("approved"));
    expect(rowOrder()).toEqual(["CA-1", "CA-2", "CA-3"]);
  });
});

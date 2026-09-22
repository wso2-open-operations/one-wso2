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
import MisFlashDetailDialog from "./MisFlashDetailDialog";
import { FLASH_UNIT_COLUMNS } from "./flashPnlRows";
import { flashMonthlyRanges } from "../util/misFlashPeriods";
import { MIS_SCALES } from "../util/misViewVocabulary";
import type { FlashDetailState } from "../api/useFlashDetail";

vi.setConfig({ testTimeout: 20_000 });

// One business unit's P&L, month by month.
//
// The page suite covers opening and closing this and which unit it asks about.
// What is here is what only this component can answer: the month a column is
// HEADED with — a documented correction to the source (spec §8) that nothing
// else asserts — and the three states the page's happy path never reaches.

const IAM = FLASH_UNIT_COLUMNS.find((column) => column.key === "iam")!;

/** The thirteen months a Flash opens on, of which twelve are drawn. */
const RANGES = flashMonthlyRanges({ year: 2025, month: 9 }, { year: 2026, month: 9 });

const ANSWERED: FlashDetailState = {
  sales: {
    arr: [
      {
        id: "1",
        title: "Opening ARR",
        // Index 0 is the month that is fetched and never drawn, so a view that
        // read the response from the wrong end would show 999 first.
        summary: [{ value: 999 }, { value: 100 }, { value: 200 }],
      },
    ],
  },
  accounts: {
    grossMargin: [{ id: "1", title: "Recurring Margin", summary: [{ value: 9 }, { value: 77.5 }] }],
    revenue: [{ id: "1", title: "Recurring Revenue", summary: [{ value: 9 }, { value: 1234567 }] }],
  },
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
};

const retry = vi.fn();
const FAILED: FlashDetailState = {
  sales: {},
  accounts: {},
  isLoading: false,
  isError: true,
  errorMessage: "Gateway timed out.",
  retry,
};

function show(state: FlashDetailState = ANSWERED, ranges = RANGES) {
  return render(
    <MisFlashDetailDialog
      open
      onClose={() => {}}
      unit={IAM}
      ranges={ranges}
      state={state}
      scale={MIS_SCALES.UNITS}
    />,
  );
}

const detail = () => screen.getByRole("table", { name: "Monthly detail for IAM" });
const headers = () =>
  Array.from(detail().querySelectorAll("thead tr th")).map((cell) => cell.textContent);
const rowLabelled = (label: string) =>
  Array.from(detail().querySelectorAll("tbody tr")).find((row) =>
    within(row as HTMLElement).queryByText(label),
  )!;

describe("the months a detail view is headed with", () => {
  // Spec §8. `MonthlyViewTable.js`'s `formatHeader` reads `period.endDate`, and
  // a range runs from the first of its month to the first of the NEXT — so the
  // source heads September's figures "Oct 2025". The port heads a column with
  // the month it COVERS, which is a correction rather than a reproduction: a
  // column of figures under the wrong month is not a disagreement a reconciler
  // could settle.
  it("names the month each column covers, not the month after it", () => {
    show();
    expect(headers()[1]).toBe("Oct 2025");
    expect(headers()[headers().length - 1]).toBe("Sep 2026");
  });

  // The oldest of the thirteen is requested and never drawn — the source's own
  // behaviour, reproduced. Its month is Sep 2025, so its absence is visible.
  it("draws twelve of the thirteen months asked for, dropping the oldest", () => {
    show();
    expect(headers()).toHaveLength(13); // the label column, then twelve months
    expect(headers()).not.toContain("Sep 2025");
  });

  it("heads the span with the months it drew, not the ones it fetched", () => {
    show();
    expect(screen.getByText("2025-10-01 to 2026-10-01")).toBeInTheDocument();
  });
});

describe("the figures in it", () => {
  // Each column carries the index it came from, so a row read from the wrong
  // end of the response would be off by a month everywhere.
  it("reads each month at the position the response holds it", () => {
    show();
    const cells = Array.from(rowLabelled("Opening ARR").querySelectorAll("td")).map(
      (cell) => cell.textContent,
    );
    expect(cells[0]).toBe("100.00");
    expect(cells[1]).toBe("200.00");
    expect(cells).not.toContain("999.00");
  });

  it("leaves Gross Margin unscaled here too, because a margin is a rate", () => {
    show();
    const margin = Array.from(rowLabelled("Recurring Margin").querySelectorAll("td")).map(
      (cell) => cell.textContent,
    );
    expect(margin[0]).toBe("77.50");
  });

  it("opens with the sections showing and the sub-levels folded", () => {
    show();
    expect(screen.getAllByText("Recurring Revenue").length).toBeGreaterThan(0);
  });
});

describe("when it has nothing to show", () => {
  it("reports a failure with the backend's message and a way to try again", async () => {
    show(FAILED);
    expect(screen.getByText(/Couldn't load the monthly detail for IAM/)).toBeInTheDocument();
    expect(screen.getByText(/Gateway timed out/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Retry|Try again/ }));
    expect(retry).toHaveBeenCalled();
  });

  it("holds a fixed height while loading, so the dialog does not jump", () => {
    show({ ...ANSWERED, isLoading: true });
    expect(screen.queryByRole("table", { name: "Monthly detail for IAM" })).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  // One month asked for leaves nothing once the oldest is dropped — which a
  // reader can reach by setting both pickers to the same month.
  it("says so when the range has no months left to break down", () => {
    show(ANSWERED, flashMonthlyRanges({ year: 2026, month: 9 }, { year: 2026, month: 9 }));
    expect(screen.getByText("No months in this range to break down.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Monthly detail for IAM" })).not.toBeInTheDocument();
  });
});

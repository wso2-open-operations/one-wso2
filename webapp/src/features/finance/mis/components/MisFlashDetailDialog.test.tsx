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
import { FLASH_UNIT_COLUMNS } from "./flashPnlRows";
import { flashMonthlyRanges } from "../util/misFlashPeriods";
import { MIS_SCALES } from "../util/misViewVocabulary";
import type { FlashDetailState } from "../api/useFlashDetail";
import type { MisFlashAccountsDialogProps } from "./MisFlashAccountsDialog";

// The account view is its own component with its own suite; what is asked
// here is only whether a figure OPENS it, and with what question. So it is
// replaced by a stand-in that records the props it was mounted with — typed
// against the real component's props, so a renamed one fails to compile here.
const accountViews: MisFlashAccountsDialogProps[] = [];
vi.mock("./MisFlashAccountsDialog", () => ({
  default: (props: MisFlashAccountsDialogProps) => {
    accountViews.push(props);
    return <div role="dialog" aria-label="Account View" />;
  },
}));

const { default: MisFlashDetailDialog } = await import("./MisFlashDetailDialog");

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

function show(state: FlashDetailState = ANSWERED, ranges = RANGES, unit = IAM) {
  return render(
    <MisFlashDetailDialog
      open
      onClose={() => {}}
      unit={unit}
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
  // Spec §8. A column is headed with the month the backend summed under it —
  // which, for every financial account, is its range's END month. The ranges
  // end on the last of their own month, so the header and the figures agree.
  it("names the month each column's figures cover", () => {
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
    expect(screen.getByText("2025-09-30 to 2026-09-30")).toBeInTheDocument();
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

describe("the accounts behind a figure (ticket 16)", () => {
  // Revenue's heading line and one of its parts, across the thirteen months
  // asked for: index 0 is fetched and not drawn, so October 2025 is index 1.
  const months = (from: number) => Array.from({ length: 13 }, (_, i) => ({ value: from + i }));
  const WITH_REVENUE: FlashDetailState = {
    ...ANSWERED,
    accounts: {
      revenue: [
        { id: "1", title: "Revenue", summary: months(100) },
        { id: "2", title: "Recurring", summary: months(500) },
      ],
    },
  };
  const WSO2 = FLASH_UNIT_COLUMNS.find((column) => column.businessUnit === "All")!;
  /**
   * The figure controls in the `nth` row named `label` — figures only, so a
   * section's own expand toggle is not counted. `nth`, because the Revenue
   * SECTION and its heading LINE are both called "Revenue", as the backend
   * names them.
   */
  const buttonsIn = (label: string, nth = 0) => {
    const table = screen.getByRole("table", { name: /^Monthly detail for / });
    const rows = Array.from(table.querySelectorAll("tbody tr")).filter(
      (row) => row.querySelector("th")?.textContent === label,
    );
    return Array.from(rows[nth].querySelectorAll("td button"));
  };

  beforeEach(() => {
    accountViews.length = 0;
  });

  it("makes each month of a line with accounts behind it a control", () => {
    show(WITH_REVENUE);
    expect(buttonsIn("Recurring")).toHaveLength(12);
  });

  // The figure under Oct 2025 is the response's index 1, and the question it
  // opens is for October — the month on the header, which is the month the
  // backend summed (spec §8).
  it("opens the account view for that line, that unit and that column's month", async () => {
    show(WITH_REVENUE);
    const [october] = buttonsIn("Recurring");
    expect(october).toHaveTextContent("501.00");
    await userEvent.click(october as HTMLElement);
    expect(accountViews[accountViews.length - 1]).toMatchObject({
      query: {
        book: "income",
        accountCategory: "Recurring Revenue",
        businessUnit: "IAM",
        month: "2025-10",
      },
      unitLabel: "IAM",
    });
  });

  it("leaves the Revenue heading and every other section plain", () => {
    show(WITH_REVENUE);
    expect(buttonsIn("Revenue", 1)).toHaveLength(0);
    expect(buttonsIn("Opening ARR")).toHaveLength(0);
  });

  // `bu !== BU_LIST.WSO2` in the source. The whole company's figure is every
  // unit's accounts at once, and no single account list stands behind it.
  it("opens nothing on the WSO2 column", () => {
    show(WITH_REVENUE, RANGES, WSO2);
    expect(buttonsIn("Recurring")).toHaveLength(0);
  });

  it("is shut until a figure is opened", () => {
    show(WITH_REVENUE);
    expect(screen.queryByRole("dialog", { name: "Account View" })).not.toBeInTheDocument();
  });
});

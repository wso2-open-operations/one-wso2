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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FlashBalanceStatement } from "../api/misFlashTypes";

// Vitest's 5s default is the wrong one for this file: every test mounts the
// whole screen, which is a hand-rolled table of fourteen sections under a panel
// of real controls, and in jsdom under the full suite's parallelism that runs
// past five seconds while taking well under one on its own. Nothing here waits
// on a timer or a network.
vi.setConfig({ testTimeout: 20_000 });

// The Flash Dashboard, end to end from the gate down to a figure in a cell.
//
// What is under test is the SCREEN's reading of its parts: that the P&L reaches
// the table, that Scale reaches currency and not Gross Margin (ticket 15's
// named criterion, spec §3), that Search commits the draft filters and asks a
// different question from the one the load asked (spec §8), and that a column
// header opens that business unit's monthly detail.
//
// The row and period arithmetic is pinned where it lives — `flashPnlRows`,
// `flashDetailRows`, `misFlashPeriods` — and the access rules by ticket 01's
// `MisRouting.test.tsx` and `misRail.test.tsx` (§10.10–§10.12). None of that is
// re-asserted here.

const state = {
  privileges: [789] as number[],
  statement: {} as FlashBalanceStatement,
  statementLoading: false,
  statementError: false,
};
const retryStatement = vi.fn();

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  isMisFlashConfigured: () => true,
  misArrServiceUrls: { userInfo: "https://mis.example/user-info" },
  misFlashServiceUrls: {
    balanceStatement: "https://flash.example/balance-statement",
    customerSummary: "https://flash.example/customer-summary",
    accountSummary: "https://flash.example/account-summary",
    subRegions: "https://flash.example/sub-regions",
  },
}));

// Mocked at the query hook, not at the gate: the gate's own reading of a
// privilege list is ticket 01's, and leaving it real is what makes "a Flash
// reader gets the screen" mean anything here.
vi.mock("../api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({
    data: { privileges: state.privileges },
    isPending: false,
    isError: false,
    error: null,
    refetch: () => {},
  }),
}));
vi.mock("../api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({
    options: {},
    analysisEnabled: false,
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

/** Every balance-statement read the screen made, in order. */
const statementReads: { startDate: string; endDate: string; subRegions: readonly string[] }[] = [];
vi.mock("../api/useFlashBalanceStatement", () => ({
  useFlashBalanceStatement: (
    range: { startDate: string; endDate: string },
    subRegions: readonly string[],
  ) => {
    statementReads.push({ ...range, subRegions: [...subRegions] });
    return {
      statement: state.statement,
      isLoading: state.statementLoading,
      isError: state.statementError,
      errorMessage: state.statementError ? "Gateway timed out." : "",
      retry: retryStatement,
    };
  },
}));

vi.mock("../api/useFlashSubRegions", () => ({
  useFlashSubRegions: () => ({
    groups: [
      { region: "EU", subRegions: ["EU : EU 1", "EU : EU 2"] },
      { region: "NA", subRegions: ["NA - WEST"] },
    ],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

/** Every detail read, so a test can say which business unit was asked about. */
const detailReads: ({ businessUnit: string; ranges: unknown[]; subRegions: readonly string[] } | null)[] =
  [];
vi.mock("../api/useFlashDetail", () => ({
  useFlashDetail: (
    request: { businessUnit: string; ranges: unknown[]; subRegions: readonly string[] } | null,
  ) => {
    detailReads.push(request);
    return {
      sales: {
        arr: [{ id: "1", title: "Opening ARR", summary: [{ value: 1 }, { value: 2 }] }],
      },
      accounts: {},
      isLoading: false,
      isError: false,
      errorMessage: "",
      retry: () => {},
    };
  },
}));

const { default: MisFlashPage } = await import("./MisFlashPage");

/** A statement with one currency line and one percentage line. */
const STATEMENT: FlashBalanceStatement = {
  revenue: [
    { id: "1", title: "Recurring Revenue", integrationSoftware: 1234567, iam: 1000, wso2: 2234567 },
  ],
  costOfSales: [
    {
      id: "1",
      title: "Recurring Revenue COS",
      wso2: 500000,
      subLevel: [{ id: "1", title: "Cloud Hosting", wso2: 300000 }],
    },
  ],
  // Titled differently from its section, deliberately: a section HEADING and
  // the line under it both carry figures-or-not, and a fixture that named them
  // alike would let a row lookup land on the blank heading and pass.
  grossMargin: [{ id: "1", title: "Recurring Margin", integrationSoftware: 77.5, wso2: 62.25 }],
};

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/finance/mis/flash"]}>
        <MisFlashPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pnl = () => screen.getByRole("table", { name: "Monthly P&L flash" });
const rowLabelled = (label: string) =>
  Array.from(pnl().querySelectorAll("tbody tr")).find((row) =>
    within(row as HTMLElement).queryByText(label),
  )!;
const figuresOf = (label: string) =>
  Array.from(rowLabelled(label).querySelectorAll("td")).map((cell) => cell.textContent);

beforeEach(() => {
  state.privileges = [789];
  state.statement = STATEMENT;
  state.statementLoading = false;
  state.statementError = false;
  statementReads.length = 0;
  detailReads.length = 0;
  localStorage.clear();
});

describe("the screen a Flash reader gets", () => {
  it("is headed by its own name", () => {
    show();
    expect(screen.getByRole("heading", { name: "Flash Dashboard" })).toBeInTheDocument();
  });

  it("draws the statement's sections as the rows of one table", () => {
    show();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Cost of Sales")).toBeInTheDocument();
    expect(screen.getByText("Net Profit/Loss")).toBeInTheDocument();
  });

  it("heads the figures with the six business units, and nothing under them", () => {
    show();
    const header = pnl().querySelectorAll("thead tr");
    expect(header).toHaveLength(1);
    expect(Array.from(header[0].querySelectorAll("th")).map((cell) => cell.textContent)).toEqual([
      "Line",
      "Integration",
      "IAM",
      "APIM",
      "Choreo",
      "Corporate",
      "WSO2",
    ]);
  });

  it("opens with the sections showing and the sub-levels folded away", async () => {
    show();
    expect(screen.getByText("Recurring Revenue")).toBeInTheDocument();
    expect(screen.queryByText("Cloud Hosting")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Recurring Revenue COS" }));
    expect(screen.getByText("Cloud Hosting")).toBeInTheDocument();
  });

  it("says nothing in the cells of a section heading, rather than nought", () => {
    show();
    expect(figuresOf("Revenue").every((text) => text === "")).toBe(true);
  });

  it("puts the line's figures under the business unit they came in", () => {
    show();
    expect(figuresOf("Recurring Revenue")).toEqual([
      "1,234,567.00",
      "1,000.00",
      "",
      "",
      "",
      "2,234,567.00",
    ]);
  });
});

// Ticket 15's named criterion and spec §3, exercised through the screen rather
// than asserted about the formatter: Scale is a control on THIS page, and what
// it may touch is decided three files away.
describe("what the units/thousands control may touch", () => {
  const thousands = () => screen.getByRole("checkbox", { name: /Values in/ });

  it("shows currency in units until asked otherwise", () => {
    show();
    expect(figuresOf("Recurring Revenue")[0]).toBe("1,234,567.00");
  });

  it("divides currency by a thousand when asked", async () => {
    show();
    await userEvent.click(thousands());
    expect(figuresOf("Recurring Revenue")[0]).toBe("1,234.57");
  });

  it("leaves a Gross Margin line alone, because a margin is a rate", async () => {
    show();
    expect(figuresOf("Recurring Margin")[0]).toBe("77.50");
    await userEvent.click(thousands());
    expect(figuresOf("Recurring Margin")[0]).toBe("77.50");
  });

  it("says which magnitude the table is in, beside the table", async () => {
    show();
    expect(screen.getByText("All amounts in USD")).toBeInTheDocument();
    await userEvent.click(thousands());
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();
  });
});

// Spec §8. The source asks a DIFFERENT range depending on which button got it
// there, and the port reproduces all three rather than choosing one.
describe("the range the screen asks for", () => {
  it("asks for the first of each month on load", () => {
    show();
    expect(statementReads[0].startDate.endsWith("-01")).toBe(true);
    expect(statementReads[0].endDate.endsWith("-01")).toBe(true);
  });

  // The source converts a picker to its month END only when the reader MOVED
  // it: `DateFilter.js` writes `startMonthFilter` from its own change handler
  // and nowhere else, and `handleFilter` sends whatever the two hold. So Search
  // with neither picker touched re-asks exactly what the load asked.
  it("re-asks the load's own question when Search is pressed with nothing moved", async () => {
    show();
    const onLoad = statementReads[0];
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const afterSearch = statementReads[statementReads.length - 1];
    expect(afterSearch.startDate).toBe(onLoad.startDate);
    expect(afterSearch.endDate).toBe(onLoad.endDate);
  });

  it("converts only the picker the reader moved, leaving the other alone", async () => {
    show();
    const onLoad = statementReads[0];
    setStartMonth("2024-01");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const afterSearch = statementReads[statementReads.length - 1];
    // Moved: the month END. Untouched: still the first-of-month the load sent.
    expect(afterSearch.startDate).toBe("2024-01-31");
    expect(afterSearch.endDate).toBe(onLoad.endDate);
    expect(afterSearch.endDate.endsWith("-01")).toBe(true);
  });

  it("converts both once both have been moved", async () => {
    show();
    setStartMonth("2024-01");
    fireEvent.change(screen.getByLabelText("End Month"), { target: { value: "2024-06" } });
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    const afterSearch = statementReads[statementReads.length - 1];
    expect(afterSearch).toMatchObject({ startDate: "2024-01-31", endDate: "2024-06-30" });
  });

  // Reset writes two month ENDS into both pickers at once, and a month earlier
  // again than the screen opened on — so it is neither of the two above.
  it("goes somewhere else again on Reset, which is not where it opened", async () => {
    show();
    const onLoad = statementReads[0];
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    const afterReset = statementReads[statementReads.length - 1];
    expect(afterReset.startDate).not.toBe(onLoad.startDate);
    expect(afterReset.endDate).not.toBe(onLoad.endDate);
    expect(afterReset.startDate.endsWith("-01")).toBe(false);
    expect(afterReset.endDate.endsWith("-01")).toBe(false);
  });

  // `fireEvent.change` rather than typing: jsdom's month input holds a value but
  // does not assemble one out of keystrokes, so `type` leaves it untouched and
  // the test would pass against a screen that ignored the picker entirely.
  const setStartMonth = (value: string) =>
    fireEvent.change(screen.getByLabelText("Start Month"), { target: { value } });

  // The pickers are a draft: nothing is re-read until Search commits them.
  it("does not re-read the P&L while a month is being edited", () => {
    show();
    const before = statementReads.length;
    setStartMonth("2024-01");
    // One question, however many times the edit re-rendered the page.
    expect(new Set(statementReads.map((read) => read.startDate)).size).toBe(1);
    expect(statementReads.length).toBeGreaterThanOrEqual(before);
  });

  // A half-typed value is what a month input reports mid-edit. Jumping to
  // whatever `new Date` made of it would move the other picker's bounds.
  it("keeps the month it had when the picker reports a fragment", async () => {
    show();
    setStartMonth("2024-01");
    setStartMonth("2024-1");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(statementReads[statementReads.length - 1].startDate).toBe("2024-01-31");
  });
});

describe("narrowing the P&L by sub region", () => {
  it("sends nothing at all until a region is chosen", () => {
    show();
    expect(statementReads[0].subRegions).toEqual([]);
  });

  // The control offers REGIONS and the backend takes sub-regions, so what a
  // reader picks and what is sent are deliberately not the same list.
  it("sends every sub-region under the region that was picked", async () => {
    show();
    await userEvent.click(screen.getByRole("combobox", { name: /Sub Region/ }));
    await userEvent.click(screen.getByRole("option", { name: "EU" }));
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(statementReads[statementReads.length - 1].subRegions).toEqual([
      "EU : EU 1",
      "EU : EU 2",
    ]);
  });
});

describe("the monthly detail behind a business unit", () => {
  it("is shut until a column header is opened", () => {
    show();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(detailReads[detailReads.length - 1]).toBeNull();
  });

  it("opens on the unit whose header was clicked", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "IAM" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Monthly View — IAM")).toBeInTheDocument();
  });

  // The header says "WSO2" and the backend has never heard of it: `BU_LIST`
  // calls that unit "All". Getting this wrong would answer with an empty view
  // rather than an error.
  it("asks the backend by the name the backend knows, not the column header", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "WSO2" }));
    expect(detailReads[detailReads.length - 1]?.businessUnit).toBe("All");
  });

  // Spec §8. The source's five lower-case `subregions=` props mean the filter
  // reaches only Integration's monthly view; the other five see the whole
  // company even while the P&L behind them is narrowed.
  it("passes the reader's sub regions to Integration's view and to no other", async () => {
    show();
    await userEvent.click(screen.getByRole("combobox", { name: /Sub Region/ }));
    await userEvent.click(screen.getByRole("option", { name: "EU" }));
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await userEvent.click(screen.getByRole("button", { name: "Integration" }));
    expect(detailReads[detailReads.length - 1]?.subRegions).toEqual(["EU : EU 1", "EU : EU 2"]);

    // Waited out: the dialog is modal and stays in the document through its
    // exit transition, so the column headers behind it are unreachable until
    // it has actually gone.
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "IAM" }));
    expect(detailReads[detailReads.length - 1]?.subRegions).toEqual([]);
  });

  it("asks for thirteen months and draws twelve of them", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "IAM" }));
    expect(detailReads[detailReads.length - 1]?.ranges).toHaveLength(13);
    const table = screen.getByRole("table", { name: "Monthly detail for IAM" });
    expect(table.querySelectorAll("thead tr th")).toHaveLength(13); // a label column + 12 months
  });

  it("closes again", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "IAM" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    // Waited for: the dialog stays in the document through its exit transition,
    // so an immediate assertion would pass only by being slow enough.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  // It is modal, which is what makes the page's filters unreachable while it is
  // open — and therefore why nothing on this screen has to close it when they
  // are applied.
  it("puts the filters out of reach while it is open", async () => {
    show();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "IAM" }));
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
  });
});

describe("when the P&L cannot be read", () => {
  it("says so, with the backend's own message and a way to try again", async () => {
    state.statementError = true;
    show();
    expect(screen.getByText(/Couldn't load the P&L/)).toBeInTheDocument();
    expect(screen.getByText(/Gateway timed out/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Retry|Try again/ }));
    expect(retryStatement).toHaveBeenCalled();
  });

  it("holds the page rather than drawing an empty statement while it loads", () => {
    state.statementLoading = true;
    show();
    expect(screen.queryByRole("table", { name: "Monthly P&L flash" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Loading the P&L/).length).toBeGreaterThan(0);
  });

  // Every section is still drawn when the statement came back with nothing in
  // it: a P&L with no lines is an answer, and it is not the same answer as a
  // P&L that failed.
  it("draws the headings when the statement is empty", () => {
    state.statement = {};
    show();
    expect(screen.getByRole("table", { name: "Monthly P&L flash" })).toBeInTheDocument();
    expect(screen.getByText("Gross Margin")).toBeInTheDocument();
  });
});

describe("someone without the Flash privilege", () => {
  // §10.11's other half is ticket 01's routing suite; what this pins is that
  // the screen itself is behind the gate rather than beside it.
  it("is refused, and the P&L is not rendered at all", () => {
    state.privileges = [987];
    show();
    expect(screen.queryByRole("table", { name: "Monthly P&L flash" })).not.toBeInTheDocument();
    expect(statementReads).toHaveLength(0);
  });
});

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
import { MemoryRouter } from "react-router";
import { inZone } from "@/test/timeZone";
import { misPaths } from "@constants/misApps";
import { defaultAppliedFilters } from "@features/finance/mis/util/misViewState";
import {
  MIS_PERIODS,
  MIS_TABLES,
  MIS_WINDOWS,
} from "@features/finance/mis/util/misViewVocabulary";
import {
  annualColumnLabel,
  buildColumnRanges,
  pacificAnnualRanges,
} from "@features/finance/mis/util/misPeriods";
import type { ArrSummaryState } from "@features/finance/mis/api/useArrSummary";
import type { CustomerAccountsState } from "@features/finance/mis/api/useCustomerAccounts";
import type { DrillDownState } from "@features/finance/mis/api/useDrillDownCustomers";

// The first real figures on screen. Everything below the shell: the Build's
// rows, one column group per Annual Period, at default filters.
//
// The fetch is stubbed at `useArrSummary` — the seam its own tests cover — so
// this file is about what a reader sees, not about how it was fetched.

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: { userInfo: "https://mis.example/user-info" },
}));

// The page no longer calls /user-info, but MisShell's module graph still
// reaches @asgardeo/browser, which does not resolve under Node's ESM loader.
vi.mock("@features/finance/mis/api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({ data: undefined, isPending: false, isError: false }),
}));

vi.mock("@features/finance/mis/api/useMisGate", () => ({
  useMisGate: () => ({
    canSee: () => true,
    isAuthorized: true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

const summary = { value: {} as ArrSummaryState };
vi.mock("@features/finance/mis/api/useArrSummary", () => ({
  useArrSummary: () => summary.value,
}));

const drillDown = { value: {} as DrillDownState, asked: [] as unknown[] };
vi.mock("@features/finance/mis/api/useDrillDownCustomers", () => ({
  useDrillDownCustomers: (request: unknown) => {
    drillDown.asked.push(request);
    return drillDown.value;
  },
}));

const customers = { value: {} as CustomerAccountsState };
vi.mock("@features/finance/mis/api/useCustomerAccounts", () => ({
  useCustomerAccounts: () => customers.value,
}));

// The filter bar's menus, stubbed at the same seam as the figures and for the
// same reason: this file is about what a reader sees, and `useMisAppConfigs`
// has its own tests. It also reaches @asgardeo/browser, which does not resolve
// under Node's ESM loader.
vi.mock("@features/finance/mis/api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({
    options: {
      salesRegions: ["APAC", "EMEA"],
      subRegions: [],
      countries: ["Sri Lanka"],
      industries: ["BFSI"],
      subIndustries: [],
      accountOwners: [],
      technicalOwners: [],
      channelManagers: [],
      businessUnits: ["APIM_BU"],
      productUnits: [],
    },
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

const MisArrBuildPage = (await import("@features/finance/mis/pages/MisArrBuildPage")).default;

// Driving MUI Autocompletes through userEvent is slow — each click is a full
// pointer-event sequence re-rendered through the Oxygen theme — and the whole
// suite runs 119 files in parallel. The default 5s is enough alone and not
// under that load, which is how a passing file becomes an intermittent red.
// The source's own filter-bar suite raised its timeout for the same reason
// ("Forty rendered tests over a 1700-line component with MUI Autocompletes:
// give each room under load").
vi.setConfig({ testTimeout: 20_000 });

/**
 * The newest of the five columns, computed rather than written down.
 *
 * It is derived from today's date in Pacific Time, so a literal here is correct
 * only until the next Pacific midnight — and a stale one does not fail loudly:
 * it silently stops matching the ranges the page computes, so figures vanish
 * and a drill-down cannot find its column. Built with the same helpers the page
 * uses, in the same zone the page is rendered in.
 */
const THIS_YEAR = inZone("Asia/Colombo", () => {
  const filters = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SUBSCRIPTION);
  const annuallyDateRanges = pacificAnnualRanges(MIS_WINDOWS.CALENDAR, filters);
  const columns = buildColumnRanges(MIS_WINDOWS.CALENDAR, { ...filters, annuallyDateRanges });
  return annualColumnLabel(columns[columns.length - 1]);
});

const loaded = (response: Record<string, unknown>): ArrSummaryState => ({
  columns: [{ label: THIS_YEAR, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

function renderPage(search = "") {
  return inZone("Asia/Colombo", () =>
    render(
      <MemoryRouter initialEntries={[`${misPaths.arrBuild}${search}`]}>
        <MisArrBuildPage />
      </MemoryRouter>,
    ),
  );
}

const NORTHWIND = {
  id: "0018000001abcXYZ",
  name: "Northwind Bank",
  accountOwnerName: "John Doe",
  partnerType: "Direct",
  naicsIndustry: "Technology",
  salesRegions: "EMEA",
  arrSoftwareTotal: 600_000,
  arrCloudTotal: 150_000,
  arrGrandTotal: 750_000,
};

const customerBook = (accounts: Record<string, unknown>[]): CustomerAccountsState => ({
  columns: [{ label: THIS_YEAR, accounts: accounts as never, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

beforeEach(() => {
  localStorage.clear();
  summary.value = loaded({ openingArr: 1_234_567.5 });
  customers.value = customerBook([NORTHWIND]);
  drillDown.asked = [];
  drillDown.value = {
    customers: [
      {
        accountId: "0018000001abcXYZ",
        name: "Northwind Bank",
        salesRegion: "EMEA",
        subRegion: "Northern Europe",
        amount: 750_000,
      },
    ],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  };
});

describe("opening the customers behind a figure", () => {
  // Ticket 10's drill-down. Only fourteen rows of the Build have a customer
  // list behind them; the rest are arithmetic over other rows.
  //
  // The Period label is read off the rendered header rather than hard-coded.
  // It is derived from today's date in Pacific Time, so a constant here would
  // be correct only until midnight — and the drill-down's dates come from that
  // same range, which is exactly what these tests are checking.
  const periodHeader = () =>
    within(screen.getAllByRole("rowgroup")[0]).getAllByRole("columnheader")[1].textContent!;

  const openNew = async () => {
    const newRow = screen.getByText("New").closest("tr")!;
    await userEvent.click(within(newRow).getAllByRole("button")[0]);
    return screen.findByRole("dialog");
  };

  it("offers no way in on a row that is arithmetic over other rows", () => {
    renderPage();
    // `Net New` is Opening minus Closing — there is no set of customers that IS
    // it, so the source leaves the cell inert and so does this.
    const netNew = screen.getByText("Net New").closest("tr")!;
    expect(within(netNew).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the dialog on a figure that has customers behind it", async () => {
    renderPage();
    const dialog = await openNew();
    expect(within(dialog).getByText("Northwind Bank")).toBeInTheDocument();
  });

  it("names the row and the Period it was opened from", async () => {
    renderPage();
    const period = periodHeader();
    const dialog = await openNew();
    expect(dialog).toHaveAccessibleName(`New · ${period}`);
  });

  it("asks the backend for that row's movement, at that column's dates", async () => {
    renderPage();
    // The column header is `{opening} - {end}` in slash form; the wire wants
    // the closing half in dashes.
    const endDate = periodHeader().split(" - ")[1].replace(/\//g, "-");
    await openNew();
    const request = drillDown.asked.at(-1) as Record<string, unknown>;
    expect(request).toMatchObject({ customerArrType: "New", endDate });
  });

  it("asks for nothing at all while the dialog is shut", () => {
    renderPage();
    expect(drillDown.asked.every((one) => one === null)).toBe(true);
  });

  it("closes again, and stops asking", async () => {
    renderPage();
    const newRow = screen.getByText("New").closest("tr")!;
    await userEvent.click(within(newRow).getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(drillDown.asked.at(-1)).toBeNull();
  });
});

describe("the Software/Cloud Customers table", () => {
  // Ticket 10. `?table=customers` is the whole switch — the URL contract for it
  // landed in 02 and the per-Table filter rules in 09, so what is new here is
  // that a different table appears under the same bar.

  it("shows the customer book, one row per account", () => {
    renderPage("?table=customers");
    expect(screen.getByRole("table", { name: /Customers/ })).toBeInTheDocument();
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
  });

  it("shows the Subscription Build when the link names no Table", () => {
    // Subscription is the default and is never written to the URL, so "no
    // table" and "the Build" are the same state — 02 pinned that in the
    // contract and this is the page honouring it.
    renderPage();
    expect(screen.getByRole("table", { name: /Subscription/ })).toBeInTheDocument();
    expect(screen.queryByText("Northwind Bank")).not.toBeInTheDocument();
  });

  it("falls back to the Build rather than erroring on a Table it does not know", () => {
    renderPage("?table=not-a-table");
    expect(screen.getByRole("table", { name: /Subscription/ })).toBeInTheDocument();
  });

  it("gives each account its identity columns before the first figure", () => {
    renderPage("?table=customers");
    const row = screen.getByText("Northwind Bank").closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    // Account ID, Owner, Source — read off the fields the wire sends them under.
    expect(cells[0]).toHaveTextContent("0018000001abcXYZ");
    expect(cells[1]).toHaveTextContent("John Doe");
    expect(cells[2]).toHaveTextContent("Direct");
  });

  it("heads the figure columns so the three Totals can be told apart", () => {
    // The source separates them with a Software/Cloud grouping row; this port
    // renders two header rows, so the labels have to carry it. Deviation, §7.
    renderPage("?table=customers");
    expect(screen.getAllByText("Software Total").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cloud Total").length).toBeGreaterThan(0);
  });

  it("says so when the whole customer book failed, and offers a retry", () => {
    customers.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway said no.",
      retry: () => {},
    };
    renderPage("?table=customers");
    expect(screen.getByText(/Gateway said no/)).toBeInTheDocument();
  });

  it("holds the space rather than showing an empty book while it loads", () => {
    customers.value = { ...customerBook([]), isLoading: true, columns: [] };
    renderPage("?table=customers");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("while the figures are loading", () => {
  it("holds the space rather than showing an empty Build", () => {
    summary.value = { ...loaded({}), isLoading: true, columns: [] };
    renderPage();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("when every column fails", () => {
  it("says so, and offers the reader a way to try again", () => {
    summary.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage();
    expect(screen.getByText(/couldn't load the build/i)).toBeInTheDocument();
    // "Retry" is ErrorNotice's own word, shared by every screen in this app.
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("the Build itself", () => {
  it("renders the movement from an Opening balance to a Closing one", () => {
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Opening ARR")).toBeInTheDocument();
    expect(within(table).getByText("Ending ARR")).toBeInTheDocument();
  });

  it("heads each column with the two balance dates it spans", () => {
    renderPage();
    expect(screen.getByText(THIS_YEAR)).toBeInTheDocument();
  });

  it("opens every section, since a Subscription Build is a summary already", () => {
    renderPage();
    const table = screen.getByRole("table");
    for (const section of ["ARR movement", "Dollar retention", "Customers"]) {
      expect(within(table).getByText(section)).toBeInTheDocument();
    }
  });
});

describe("the filter bar above the Build", () => {
  it("is there, bound to the same view the grid is drawn from", () => {
    renderPage("?type=Closed+Won+ARR&years=3");
    expect(screen.getByLabelText("ARR Type")).toHaveValue("Only Closed Won ARR");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("survives a Build that is still loading, so the reader can change it", () => {
    summary.value = { ...loaded({}), isLoading: true, columns: [] };
    renderPage();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ARR Type")).toBeInTheDocument();
  });

  it("survives a Build that failed, which is when it is most needed", () => {
    summary.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage();
    expect(screen.getByText(/couldn't load the build/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear All" })).toBeInTheDocument();
  });

  it("survives a custom selection that asks for no units at all", () => {
    // `arrSummaryRequests` answers with nothing here, deliberately — and the
    // reader needs the units control still on screen to get out of it.
    summary.value = { ...loaded({}), columns: [] };
    renderPage("?unit=custom");
    expect(screen.getByText(/no periods to show/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Business Units" })).toBeInTheDocument();
  });
});

describe("the figures", () => {
  it("are written as money at full value", () => {
    renderPage();
    expect(screen.getByText("1,234,567.50")).toBeInTheDocument();
  });

  it("are divided by a thousand when the link asks for thousands", () => {
    renderPage("?scale=k");
    expect(screen.getByText("1,234.57")).toBeInTheDocument();
  });

  it("leave a headcount alone at either Scale", () => {
    // Spec §3, the rule the whole of ticket 05 exists for: 1,234 customers are
    // 1,234 customers however the amounts are shown.
    summary.value = loaded({ openingSubscriptionCustomers: 1234 });
    renderPage("?scale=k");
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("say what they are in, so a cropped screenshot still states its units", () => {
    renderPage("?scale=k");
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();
  });

  it("leave a cell blank when the backend had nothing for that row", () => {
    summary.value = loaded({ openingArr: null });
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).queryByText("NaN")).not.toBeInTheDocument();
  });
});

describe("choosing which of the Build's tables to read", () => {
  // Ticket 10. Until now `?table=` could only be reached by editing the address
  // bar, which is not a feature. In the source these tabs live in
  // `TableNavigation.js` and they COMMIT ON CLICK — a different table is a
  // different report, not a narrowing of this one — which is the same rule the
  // unit tabs already follow.

  it("offers the four tables the source offers", () => {
    renderPage();
    const tabs = screen.getByRole("group", { name: /table/i });
    for (const name of ["Subscription", "Customers", "Region Summary", "BU Summary"]) {
      expect(within(tabs).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks the table being read", () => {
    renderPage("?table=customers");
    const tabs = screen.getByRole("group", { name: /table/i });
    expect(within(tabs).getByRole("button", { name: "Customers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows Subscription as the one being read when the link names no Table", () => {
    renderPage();
    const tabs = screen.getByRole("group", { name: /table/i });
    expect(within(tabs).getByRole("button", { name: "Subscription" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("puts the chosen table in the address, so the view can be shared", async () => {
    renderPage();
    const tabs = screen.getByRole("group", { name: /table/i });
    await userEvent.click(within(tabs).getByRole("button", { name: "Customers" }));
    expect(screen.getByRole("table", { name: /Customers/ })).toBeInTheDocument();
  });

  it("says a table is not built yet rather than quietly showing the Build instead", () => {
    // `region-summary` is a RECOGNISED Table — 02 parses it and the filter rules
    // key off it — it is just not built. Falling through to the Subscription
    // Build would show the reader a different report than the one they asked
    // for, under a heading that says Subscription and an address that says
    // Region Summary. An unrecognised value is the other case and still
    // degrades to the Build, which 02 pinned.
    renderPage("?table=region-summary");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/not been ported yet/i)).toBeInTheDocument();
  });
});

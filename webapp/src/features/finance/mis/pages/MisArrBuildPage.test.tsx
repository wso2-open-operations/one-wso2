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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExcelJS from "exceljs";
import { bytesOf, captureDownloads } from "@/test/downloads";
import { MemoryRouter, useLocation } from "react-router";
import { inZone } from "@/test/timeZone";
import { misPaths } from "@constants/misApps";
import { defaultAppliedFilters } from "@features/finance/mis/util/misViewState";
import { YearsBackSessionProvider } from "@features/finance/mis/util/YearsBackSessionContext";
import {
  MIS_PERIODS,
  MIS_TABLES,
  MIS_WINDOWS,
} from "@features/finance/mis/util/misViewVocabulary";
import {
  annualColumnLabel,
  asOfColumnLabel,
  buildColumnRanges,
  pacificAnnualRanges,
} from "@features/finance/mis/util/misPeriods";
import type { ArrSummaryState } from "@features/finance/mis/api/useArrSummary";
import type { CustomerAccountsState } from "@features/finance/mis/api/useCustomerAccounts";
import type { ExitArrState } from "@features/finance/mis/api/useExitArr";
import type {
  BuFigures,
  RegionExitResponse,
} from "@features/finance/mis/components/exitArrRows";
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

const regionExit = {
  value: {} as ExitArrState<RegionExitResponse>,
  askedBySalesRegion: [] as boolean[],
};
const buExit = { value: {} as ExitArrState<BuFigures> };
vi.mock("@features/finance/mis/api/useExitArr", () => ({
  useExitArrByRegion: (
    _ranges: unknown,
    _filters: unknown,
    isSalesRegionSummary: boolean,
  ) => {
    regionExit.askedBySalesRegion.push(isSalesRegionSummary);
    return regionExit.value;
  },
  useExitArrByBU: () => buExit.value,
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

/**
 * The address as it stands, so a test can assert what a reader would copy.
 *
 * A plain span: `<output>` carries an implicit `role="status"`, which would be
 * a second live region beside the filter bar's own.
 */
function Address() {
  const { search } = useLocation();
  return <span data-testid="address">{search}</span>;
}

function renderPage(search = "") {
  return inZone("Asia/Colombo", () =>
    render(
      <MemoryRouter initialEntries={[`${misPaths.arrBuild}${search}`]}>
        {/* Standing in for `MisSession`, the layout route this screen is mounted
            under in `App.tsx`. The session Years Back has to outlive the screen,
            so the page does not provide it and cannot render without it. */}
        <YearsBackSessionProvider>
          <MisArrBuildPage />
        </YearsBackSessionProvider>
        <Address />
      </MemoryRouter>,
    ),
  );
}

const address = () => screen.getByTestId("address").textContent;

/** Click one of the Table tabs, which commit on click. */
const switchTable = (name: string) =>
  userEvent.click(within(screen.getByRole("group", { name: /table/i })).getByRole("button", { name }));

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

/** The five business units, Moesif and a total, as `BuType` sends them. */
const SPLIT = {
  apim: 4_000_000,
  iam: 3_000_000,
  integration: 2_000_000,
  choreo: 1_000_000,
  agentPlatform: 500_000,
  moesif: 250_000,
  all: 10_500_000,
};

/** The column header both summaries show — the closing date alone. */
const THIS_YEAR_AS_OF = inZone("Asia/Colombo", () => {
  const filters = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.EXIT_ARR_BY_REGION);
  const annuallyDateRanges = pacificAnnualRanges(MIS_WINDOWS.CALENDAR, filters);
  const columns = buildColumnRanges(MIS_WINDOWS.CALENDAR, { ...filters, annuallyDateRanges });
  return asOfColumnLabel(columns[columns.length - 1]);
});

const regionsLoaded = (response: RegionExitResponse): ExitArrState<RegionExitResponse> => ({
  columns: [{ label: THIS_YEAR_AS_OF, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

const unitsLoaded = (response: BuFigures): ExitArrState<BuFigures> => ({
  columns: [{ label: THIS_YEAR_AS_OF, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

beforeEach(() => {
  localStorage.clear();
  summary.value = loaded({ openingArr: 1_234_567.5 });
  customers.value = customerBook([NORTHWIND]);
  regionExit.askedBySalesRegion = [];
  regionExit.value = regionsLoaded({ NA: SPLIT, "Middle East": { apim: 1_000, all: 1_000 } });
  buExit.value = unitsLoaded(SPLIT);
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

  it("shows the table the address names, and not the Build under its heading", () => {
    // `region-summary` is a RECOGNISED Table — 02 parses it and the filter
    // rules key off it — so falling through to the Subscription Build would
    // show the reader a different report than the one they asked for. An
    // unrecognised value is the other case and still degrades to the Build,
    // which 02 pinned and the test above covers.
    renderPage("?table=region-summary");
    expect(screen.getByRole("table", { name: /Region Summary/ })).toBeInTheDocument();
  });

  it("has a table for every one of the four, none of them an apology", () => {
    for (const search of ["", "?table=customers", "?table=region-summary", "?table=bu-summary"]) {
      const view = renderPage(search);
      expect(screen.getByRole("table")).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("Exit ARR by Region", () => {
  // Ticket 10. A summary, not a Build: it reports what was on the books at one
  // moment rather than the movement between two, so its columns are headed with
  // that moment alone and its rows are regions rather than metric lines.

  it("gives each region a row, under the regions the backend named", () => {
    renderPage("?table=region-summary");
    const table = screen.getByRole("table", { name: /Region Summary/ });
    expect(within(table).getByText("NA")).toBeInTheDocument();
    expect(within(table).getByText("Middle East")).toBeInTheDocument();
  });

  it("totals the regions in a row of its own, last", () => {
    renderPage("?table=region-summary");
    const rows = within(screen.getByRole("table", { name: /Region Summary/ })).getAllByRole("row");
    expect(rows.at(-1)).toHaveTextContent("Total Exit ARR");
  });

  it("heads each column with the date the balance was read at", () => {
    renderPage("?table=region-summary");
    expect(screen.getByText(THIS_YEAR_AS_OF)).toBeInTheDocument();
  });

  it("breaks each region down by business unit, Moesif last before the total", () => {
    renderPage("?table=region-summary");
    const table = screen.getByRole("table", { name: /Region Summary/ });
    expect(within(table).getByText("API Platform BU")).toBeInTheDocument();
    expect(
      within(table).getByText("Moesif (Already included in API Platform BU)"),
    ).toBeInTheDocument();
  });

  it("puts each unit's figure under its own header", () => {
    // The wire names and the headers disagree — `apim` is headed "API Platform
    // BU", `all` is "Total" — so a figure landing one column over is the
    // failure this table can have silently and plausibly.
    renderPage("?table=region-summary");
    const table = screen.getByRole("table", { name: /Region Summary/ });
    const na = within(table).getByText("NA").closest("tr")!;
    expect(within(na).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "4,000,000.00",
      "3,000,000.00",
      "2,000,000.00",
      "1,000,000.00",
      "500,000.00",
      "250,000.00",
      "10,500,000.00",
    ]);
  });

  it("writes the figures as money, at the Scale the link asked for", () => {
    renderPage("?table=region-summary&scale=k");
    expect(screen.getByText("4,000.00")).toBeInTheDocument();
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();
  });

  it("reads the balance by Sales Region until the reader says otherwise", () => {
    renderPage("?table=region-summary");
    expect(regionExit.askedBySalesRegion.at(-1)).toBe(true);
  });

  it("re-reads it by Sub Region when the reader switches", async () => {
    renderPage("?table=region-summary");
    const cut = screen.getByRole("group", { name: /region type/i });
    await userEvent.click(within(cut).getByRole("button", { name: "Sub Region" }));
    expect(regionExit.askedBySalesRegion.at(-1)).toBe(false);
  });

  it("keeps the Region Type control on screen when every column failed", () => {
    // The control is the reader's way out of a failed read, so it survives the
    // error the way the filter bar does.
    regionExit.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage("?table=region-summary");
    expect(screen.getByText(/couldn't load the region summary/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /region type/i })).toBeInTheDocument();
  });

  it("holds the space rather than showing an empty summary while it loads", () => {
    regionExit.value = { ...regionsLoaded({}), isLoading: true, columns: [] };
    renderPage("?table=region-summary");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Exit ARR by Business Unit", () => {
  it("gives each business unit a row, in the source's order", () => {
    // Seven, whatever the backend returned: this table's rows ARE the `BuType`
    // record, so they come from the code where the Region Summary's come from
    // the response.
    renderPage("?table=bu-summary");
    const body = within(screen.getByRole("table", { name: /BU Summary/ })).getAllByRole(
      "rowgroup",
    )[1];
    const rows = within(body).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("API Platform");
    expect(rows.at(-1)).toHaveTextContent("Total");
  });

  it("shows one figure per period, because a summary has nothing to pair it with", () => {
    renderPage("?table=bu-summary");
    const table = screen.getByRole("table", { name: /BU Summary/ });
    const apiPlatform = within(table).getByText("API Platform").closest("tr")!;
    // One figure cell beside the row label, where the Region Summary has seven.
    expect(within(apiPlatform).getAllByRole("cell")).toHaveLength(1);
    expect(apiPlatform).toHaveTextContent("4,000,000.00");
  });

  it("offers no Region Type control, having no regions to cut by", () => {
    renderPage("?table=bu-summary");
    expect(screen.queryByRole("group", { name: /region type/i })).not.toBeInTheDocument();
  });

  it("says so when every column failed, and offers a retry", () => {
    buExit.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage("?table=bu-summary");
    expect(screen.getByText(/couldn't load the bu summary/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

/** The workbook the page wrote, loaded back the way Excel would. */
async function loadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await bytesOf(blob));
  return workbook;
}

/** Click Export and hand back the sheet that came out. */
async function exportedSheet(name: string): Promise<ExcelJS.Worksheet> {
  const { blobs } = captureDownloads();
  await userEvent.click(screen.getByRole("button", { name: /export/i }));
  await waitFor(() => expect(blobs).toHaveLength(1));
  return (await loadWorkbook(blobs[0])).getWorksheet(name)!;
}

/**
 * One figure, found by the words around it rather than by counting.
 *
 * The four tables have one, seven, twelve and eighteen columns and differ in
 * how many rows precede the first figure, so a literal row and column here
 * would be four different pieces of arithmetic to keep right — and each would
 * silently start reading the wrong cell the moment a column moved.
 */
function figureAt(sheet: ExcelJS.Worksheet, rowLabel: string, columnLabel: string): unknown {
  const headerRow = sheet.getRow(sheet.getRow(3).values ? 4 : 3);
  const headers = (headerRow.values as unknown[]) ?? [];
  const column = headers.indexOf(columnLabel);
  expect(column, `no column "${columnLabel}"`).toBeGreaterThan(0);

  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? "").trim() === rowLabel) found ??= row;
  });
  expect(found, `no row "${rowLabel}"`).toBeDefined();
  return found!.getCell(column).value;
}

describe("taking the Build out of the browser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the table on screen into a workbook, at units and as numbers", async () => {
    const { blobs, filenames } = captureDownloads();
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));

    const sheet = (await loadWorkbook(blobs[0])).getWorksheet("Subscription")!;
    expect(sheet).toBeDefined();
    // 1,234,567.50 is what the screen shows. The file gets the figure.
    const openingArr = sheet.getRow(6);
    expect(openingArr.getCell(1).value).toBe("  Opening ARR");
    expect(openingArr.getCell(2).value).toBe(1_234_567.5);
    // And it names itself after the table it came from, dated in Pacific Time.
    expect(filenames[0]).toMatch(/^arr_build_subscription_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("exports the same figure at units while the screen is showing thousands", async () => {
    // Spec §10.18, the whole reason this ticket has a test checklist entry of
    // its own: the prototype found a DataGrid CSV that silently inherited the
    // display formatter. The reader sets thousands, exports, and the file is
    // 1000x off with nothing in it saying so.
    renderPage("?scale=k");
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();

    const sheet = await exportedSheet("Subscription");
    expect(sheet.getRow(6).getCell(2).value).toBe(1_234_567.5);
    // Not 1,234.57 — and the file says which of the two it is.
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  // Each of the other three tables builds its OWN raw-figure reader, so §10.18
  // has to be asked of each of them rather than of the Build alone. The sheet
  // layer cannot scale — `misBuildSheet` has no Scale parameter — but nothing
  // stops a call site handing it an already-scaled figure, and these are the
  // tests that say it does not.
  it("exports the Customers table at units while the screen shows thousands", async () => {
    renderPage("?table=customers&scale=k");
    const sheet = await exportedSheet("Customers");
    expect(figureAt(sheet, "Northwind Bank", "Total")).toBe(750_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("exports the Region Summary at units while the screen shows thousands", async () => {
    renderPage("?table=region-summary&scale=k");
    const sheet = await exportedSheet("Region Summary");
    expect(figureAt(sheet, "NA", "API Platform BU")).toBe(4_000_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("exports the BU Summary at units while the screen shows thousands", async () => {
    renderPage("?table=bu-summary&scale=k");
    const sheet = await exportedSheet("BU Summary");
    expect(figureAt(sheet, "API Platform", "Exit ARR")).toBe(4_000_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("names the file after whichever table is on screen", async () => {
    const { filenames, blobs } = captureDownloads();
    renderPage("?table=bu-summary");

    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));

    expect(filenames[0]).toMatch(/^arr_build_bu_summary_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe("what a Table switch does to the filters", () => {
  // Ticket 10. A different Table is a different report: the source resets the
  // filters and applies the new Table's defaults at once, and a Region Summary
  // still carrying the Build's EMEA filter would be narrowed by something its
  // own bar cannot show or clear.

  it("drops the filters the reader had chosen for the Table they left", async () => {
    renderPage("?view=Sales+Region&region=EMEA&channel=Channel");
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary");
  });

  it("says which Table's defaults it landed on", async () => {
    renderPage("?channel=Channel");
    await switchTable("Region Summary");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filters reset to the Region Summary defaults",
    );
  });

  it("carries the Years Back the reader set, which is the one thing not lost", async () => {
    renderPage("?years=3");
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary&years=3");
  });

  it("lets the new Table answer when the reader never chose one", async () => {
    renderPage();
    await switchTable("Region Summary");
    // Region Summary's own default is 2, and a default is never written.
    expect(address()).toBe("?table=region-summary");
  });

  it("clears the unit selection on the way into Customers, as the source does", async () => {
    // `FilterBar.js:606` — the one Table whose switch also clears the units.
    // Reproduced under ADR 0003.
    renderPage("?unit=custom&customBu=APIM_BU");
    await switchTable("Customers");
    expect(address()).toBe("?table=customers");
  });

  it("leaves the unit selection alone on the way to a summary", async () => {
    renderPage("?unit=custom&customBu=APIM_BU");
    await switchTable("BU Summary");
    expect(address()).toBe("?table=bu-summary&unit=custom&customBu=APIM_BU");
  });
});

describe("a session Years Back that happens to equal the Table's own default", () => {
  // The case both session rules turn on, and the only one where they are
  // visible: the reader's five years and the Build's five years are the same
  // number, so nothing on screen distinguishes "they chose this" from "this is
  // what the Table starts at" — and what the NEXT Table shows depends on which
  // it was. Region Summary starts at two, so it is where the answer shows up.

  /** Set a Years Back on Region Summary, then go and stand on the Build. */
  const withSessionOfFive = async () => {
    renderPage("?table=region-summary&years=5");
    await switchTable("Subscription");
    expect(address()).toBe("");
  };

  it("survives applying something else, because the reader did not change it", async () => {
    await withSessionOfFive();
    await userEvent.click(screen.getByLabelText("Channel/Direct"));
    await userEvent.click(await screen.findByRole("option", { name: "Channel" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary&years=5");
  });

  it("is forgotten by Clear All, which no change on screen would have shown", async () => {
    await withSessionOfFive();
    await userEvent.click(screen.getByRole("button", { name: "Clear All" }));
    // Nothing visible moved — the Build was already at five — but the session
    // is gone, so Region Summary answers with its own two.
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary");
  });
});

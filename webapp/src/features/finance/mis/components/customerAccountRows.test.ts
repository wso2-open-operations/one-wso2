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
import {
  CUSTOMER_BU_SUB_COLUMNS,
  CUSTOMER_SUB_COLUMN_BY_KEY,
  CUSTOMER_TOTAL_ROW_ID,
  customerIdentityText,
  customerTotal,
  CUSTOMER_BU_SUB_COLUMN_BY_KEY,
  CUSTOMER_SUB_COLUMNS,
  customerLeadColumns,
  customerAccountRows,
  customerFigure,
  type AccountsResponse,
} from "./customerAccountRows";

// The Software/Cloud Customers table, which is where the Build stops being a
// fixed list of metric lines and becomes one row per customer. Ported from
// digiops-finance `arrDashboard/hooks/useCustomerAccounts.js` (`transformApiData`)
// and `arrDashboard/utils/tableConstants.js`
// (`generateCloudBusinessUnitColumns`).
//
// THE SHAPE IS INVERTED FROM THE SUBSCRIPTION BUILD, and that is the whole
// reason this table exists as its own module. There the rows are named metric
// lines and the figures arrive as columns, so the grid is 34 rows whatever the
// data says. Here the ROWS are the data: one per account in the customer book,
// hundreds per business unit. This is the table ADR 0004's row windowing was
// written for.

/** One account as `/accounts` returns it, with only what the table reads. */
const account = (id: string, name: string, over: Partial<AccountsResponse> = {}): AccountsResponse => ({
  id,
  name,
  apimSoftwareTotal: 0,
  iamSoftwareTotal: 0,
  integrationSoftwareTotal: 0,
  arrSoftwareTotal: 0,
  apimCloudTotal: 0,
  iamCloudTotal: 0,
  integrationCloudTotal: 0,
  choreoCloudTotal: 0,
  agentPlatformCloudTotal: 0,
  moesifBuTotal: 0,
  arrCloudTotal: 0,
  arrGrandTotal: 0,
  ...over,
});

/**
 * The customer rows alone, with the Total row above them dropped.
 *
 * These tests are about which CUSTOMERS the book yields and in what order; the
 * Total row pinned over them is its own describe block below.
 */
const customerRowsOf = (columns: readonly (readonly AccountsResponse[])[]) =>
  customerAccountRows(columns).rows.filter((row) => row.id !== CUSTOMER_TOTAL_ROW_ID);

describe("which customers the table has rows for", () => {
  it("gives one row per account, labelled with the account name", () => {
    const rows = customerRowsOf([[account("a1", "Northwind Bank"), account("a2", "Contoso")]]);
    expect(rows.map((row) => row.label)).toEqual(["Northwind Bank", "Contoso"]);
  });

  it("carries the account id, which is what a drill-down will be opened by", () => {
    const [row] = customerRowsOf([[account("a1", "Northwind Bank")]]);
    expect(row.id).toBe("a1");
  });

  it("has no tree — a customer has nothing under it", () => {
    // Worth pinning because the Build beside it is all tree. A customer row
    // with children would be a section header, and windowing releases a closed
    // section's rows: a customer that could be collapsed would be a customer
    // whose figures could go missing.
    const { rows } = customerAccountRows([[account("a1", "Northwind Bank")]]);
    expect(rows.every((row) => row.children === undefined)).toBe(true);
  });
});

describe("a customer book that changes between columns", () => {
  // Every column is its own `POST /accounts`, read at that column's closing
  // date. A customer won in the second year is absent from the first response
  // and present in the second, and a churned one is the reverse. The table has
  // to show a row for both, or a customer disappears from a report the moment
  // they churn — which is exactly the figure the reader is looking for.

  it("unions the accounts across every column", () => {
    const rows = customerRowsOf([[account("a1", "Northwind Bank")], [account("a2", "Contoso")]]);
    expect(rows.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("keeps one row for a customer present in several columns", () => {
    const rows = customerRowsOf([
      [account("a1", "Northwind Bank"), account("a2", "Contoso")],
      [account("a1", "Northwind Bank")],
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("orders by first appearance, oldest column first", () => {
    // The source builds its union with a Map keyed by id, which is
    // insertion-ordered, and iterates the periods oldest first. Pinned because
    // an unstable order makes the table reshuffle whenever a filter changes.
    const rows = customerRowsOf([
      [account("a2", "Contoso")],
      [account("a1", "Northwind Bank"), account("a3", "Fabrikam")],
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a2", "a1", "a3"]);
  });

  it("takes the name from the first column that names them", () => {
    const rows = customerRowsOf([
      [account("a1", "Northwind Bank")],
      [account("a1", "Northwind Bank PLC")],
    ]);
    expect(rows.map((row) => row.label)).toEqual(["Northwind Bank"]);
  });

  it("has no rows at all when no column answered", () => {
    expect(customerRowsOf([])).toEqual([]);
    expect(customerRowsOf([[], []])).toEqual([]);
  });
});

describe("the columns a customer's revenue is broken down by", () => {
  it("reads Software, then Cloud, then the overall Total", () => {
    // The order is the source's and it is a reading order, not an arbitrary
    // one: the two halves of the book, each with its own total, and then the
    // figure that is both.
    expect(CUSTOMER_SUB_COLUMNS.map((column) => column.key)).toEqual([
      "software-apim",
      "software-iam",
      "software-integration",
      "software-total",
      "cloud-apim",
      "cloud-iam",
      "cloud-integration",
      "cloud-choreo",
      "cloud-agent-platform",
      "cloud-moesif",
      "cloud-total",
      "grand-total",
    ]);
  });

  // The source groups these under a THIRD header row — Period, then
  // Software/Cloud, then the product — and this port renders two header rows.
  // So the grouping has to survive in the labels or it does not survive at all,
  // and the three columns the source can afford to label plainly "Total" cannot
  // be labelled that here. Recorded as a deviation in mis.md §7.
  it("names every column so it reads without a grouping row above it", () => {
    expect(CUSTOMER_SUB_COLUMNS.map((column) => column.label)).toEqual([
      "API Platform",
      "IAM",
      "Integration",
      "Software Total",
      "API Platform Private Cloud + Bjira",
      "IAM Private Cloud + Asgardeo",
      "Integration Private Cloud + Devant",
      "Choreo",
      "Agent Platform",
      "Moesif",
      "Cloud Total",
      "Total",
    ]);
  });

  it("leaves no two columns sharing a label, which is the whole point", () => {
    // The source has three columns reading "Total" and tells them apart by the
    // group header above them. With two header rows there is nothing above
    // them, so a duplicate label here is a figure the reader cannot place — and
    // the `headers` wiring a screen reader follows would announce two different
    // figures under the same name.
    const labels = CUSTOMER_SUB_COLUMNS.map((column) => column.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("gives every column a key of its own as well", () => {
    const keys = CUSTOMER_SUB_COLUMNS.map((column) => column.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the figure in a cell", () => {
  const NORTHWIND = account("a1", "Northwind Bank", {
    apimSoftwareTotal: 100,
    iamSoftwareTotal: 200,
    integrationSoftwareTotal: 300,
    arrSoftwareTotal: 600,
    apimCloudTotal: 10,
    iamCloudTotal: 20,
    integrationCloudTotal: 30,
    choreoCloudTotal: 40,
    agentPlatformCloudTotal: 50,
    moesifBuTotal: 5,
    arrCloudTotal: 150,
    arrGrandTotal: 750,
  });

  const figureFor = (key: string, from: AccountsResponse | undefined = NORTHWIND) =>
    customerFigure(from, CUSTOMER_SUB_COLUMNS.find((column) => column.key === key)!);

  it("reads each product off the field the backend sends it under", () => {
    // The wire names and the column names disagree everywhere — `apimCloudTotal`
    // is headed "API Platform Private Cloud + Bjira" — so this mapping is the
    // one place a figure can land under the wrong product, silently and
    // plausibly.
    expect(figureFor("software-apim")).toBe(100);
    expect(figureFor("software-iam")).toBe(200);
    expect(figureFor("software-integration")).toBe(300);
    expect(figureFor("software-total")).toBe(600);
    expect(figureFor("cloud-apim")).toBe(10);
    expect(figureFor("cloud-iam")).toBe(20);
    expect(figureFor("cloud-integration")).toBe(30);
    expect(figureFor("cloud-choreo")).toBe(40);
    expect(figureFor("cloud-agent-platform")).toBe(50);
    expect(figureFor("cloud-moesif")).toBe(5);
    expect(figureFor("cloud-total")).toBe(150);
    expect(figureFor("grand-total")).toBe(750);
  });

  it("falls back to Software plus Cloud when the backend sends no grand total", () => {
    // Verbatim from the source: `arrGrandTotal || arrSoftwareTotal + arrCloudTotal || 0`.
    // A missing total is filled from the two halves rather than shown as zero,
    // because a customer with revenue and a blank Total reads as a customer
    // with none.
    const noTotal = account("a2", "Contoso", { arrSoftwareTotal: 600, arrCloudTotal: 150 });
    expect(customerFigure(noTotal, CUSTOMER_SUB_COLUMNS.at(-1)!)).toBe(750);
  });

  it("is undefined for a customer absent from that column, not zero", () => {
    // The distinction the whole table turns on. A customer who was not in the
    // book at that date has NO figure; a customer who was, with nothing owing,
    // has zero. Rendering the first as 0 invents a data point, and on this
    // table that reads as a customer who churned to nothing rather than one who
    // had not been won yet.
    for (const column of CUSTOMER_SUB_COLUMNS) {
      expect(customerFigure(undefined, column)).toBeUndefined();
    }
  });

  it("is zero when the backend genuinely says zero", () => {
    expect(figureFor("software-apim", account("a3", "Fabrikam"))).toBe(0);
  });
});

describe("the account behind a row, for the identity columns", () => {
  // The eighteen columns left of the first figure — Account ID, Owner, Source,
  // both countries, Industry, Region, the dates — are facts about the ACCOUNT,
  // not about any one column's reading of it. So they come from one base
  // record per customer rather than being re-read per Period, which is what the
  // source's `baseAccount` is.

  it("hands back the account each row was built from", () => {
    const { accountById } = customerAccountRows([
      [account("a1", "Northwind Bank", { accountOwnerName: "John Doe", subRegion: "Northeast" })],
    ]);
    expect(accountById.get("a1")).toMatchObject({
      accountOwnerName: "John Doe",
      subRegion: "Northeast",
    });
  });

  it("takes the account's facts from the first column that carries them", () => {
    // Same rule as the name, and for the same reason: a Build read beside last
    // quarter's must agree with it about who was in it and where they were.
    const { accountById } = customerAccountRows([
      [account("a1", "Northwind Bank", { salesRegions: "EMEA" })],
      [account("a1", "Northwind Bank", { salesRegions: "APAC" })],
    ]);
    expect(accountById.get("a1")?.salesRegions).toBe("EMEA");
  });

  it("knows nothing about a customer it never saw", () => {
    const { accountById } = customerAccountRows([[account("a1", "Northwind Bank")]]);
    expect(accountById.get("a2")).toBeUndefined();
  });
});

describe("the identity columns, left of the first figure", () => {
  // Eighteen of them in the source, before a single number. This is the table
  // that made `BuildTable` take a LIST of identity columns rather than one
  // pinned label — ADR 0004's frozen pane, widened.

  it("names them the way the source's header does", () => {
    expect(customerLeadColumns("Total ARR").map((column) => column.label)).toEqual([
      "Account Name",
      "Account ID",
      "Account Owner",
      "Source",
      "Primary Partner Name",
      "Partner Role",
      "Billing Country",
      "Shipping Country",
      "Industry",
      "Sub Industry",
      "Sales Region",
      "Sub Region",
      "Activation Date",
      "Churn Date",
      "Lost Reason Category",
      "Account Rating",
      "Employee Count",
    ]);
  });

  it("freezes Account Name and nothing else", () => {
    // The source pins exactly one column. Pinning more would eat the width the
    // figures need, and `leadColumnOffsets` only honours a contiguous run from
    // the left anyway — so pinning a later one without this first would be a
    // layout that cannot be drawn.
    expect(customerLeadColumns("Total ARR").filter((c) => c.pinned).map((c) => c.key)).toEqual([
      "name",
    ]);
  });

  it("reads each fact off the field the backend sends it under", () => {
    // The header and the wire disagree on four of these — "Source" is
    // `partnerType`, "Industry" is `naicsIndustry`, "Sales Region" is
    // `salesRegions`, "Delayed Day Count" is `delayedDateCount` — which is
    // exactly where a value can land under the wrong heading and still look
    // plausible.
    const full = account("a1", "Northwind Bank", {
      accountOwnerName: "John Doe",
      partnerType: "Direct",
      naicsIndustry: "Technology",
      salesRegions: "EMEA",
      subRegion: "Northeast",
      delayedDateCount: 12,
      churnDate: "2026-01-31",
      employeeCount: 4200,
    });
    const read = (key: string) =>
      customerLeadColumns("Delayed ARR").find((c) => c.key === key)!.value(full);
    expect(read("owner")).toBe("John Doe");
    expect(read("source")).toBe("Direct");
    expect(read("industry")).toBe("Technology");
    expect(read("sales-region")).toBe("EMEA");
    expect(read("sub-region")).toBe("Northeast");
    expect(read("delayed-days")).toBe("12");
    expect(read("churn-date")).toBe("2026-01-31");
    expect(read("employees")).toBe("4200");
  });

  it("shows an empty cell for a fact the backend did not send, not the word undefined", () => {
    const bare = account("a1", "Northwind Bank");
    for (const column of customerLeadColumns("Delayed ARR")) {
      expect(column.value(bare)).not.toMatch(/undefined|null|NaN/);
    }
  });

  it("shows a genuine zero rather than blanking it", () => {
    // Delayed Day Count and Employee Count are counts: zero is a fact, and a
    // blank there would read as "not known" for a customer who is not delayed.
    const zeroed = account("a1", "Northwind Bank", { delayedDateCount: 0, employeeCount: 0 });
    const read = (key: string) =>
      customerLeadColumns("Delayed ARR").find((c) => c.key === key)!.value(zeroed);
    expect(read("delayed-days")).toBe("0");
    expect(read("employees")).toBe("0");
  });

  it("reads the account's own answer through customerIdentityText", () => {
    const owner = customerLeadColumns("Total ARR").find((c) => c.label === "Account Owner")!;
    const one = account("a1", "Northwind Bank", { accountOwnerName: "R. Perera" });
    expect(customerIdentityText("a1", one, owner)).toBe("R. Perera");
  });

  it("reads blank for a customer this column's book does not have", () => {
    const owner = customerLeadColumns("Total ARR").find((c) => c.label === "Account Owner")!;
    expect(customerIdentityText("a1", undefined, owner)).toBe("");
  });
});

describe("Delayed Day Count, which only a Delayed type has", () => {
  // `tableUtils.js:753` spreads that column in only when the type is Delayed
  // ARR/QRR/MRR. So the table is SEVENTEEN identity columns by default and
  // eighteen on a Delayed type — not a flat eighteen, which is what a first
  // read of the column list suggests and what this port shipped until the
  // review of ticket 10 caught it.
  const keys = (type: string) => customerLeadColumns(type).map((column) => column.key);

  it("is absent on every type that is not Delayed", () => {
    for (const type of ["Total ARR", "Closed Won ARR", "Forecasted ARR", "Renewal ARR"]) {
      expect(keys(type)).not.toContain("delayed-days");
      expect(keys(type)).toHaveLength(17);
    }
  });

  it("appears on a Delayed type, right after Partner Role", () => {
    const delayed = keys("Delayed ARR");
    expect(delayed).toHaveLength(18);
    expect(delayed.indexOf("delayed-days")).toBe(delayed.indexOf("partner-role") + 1);
  });

  it("appears for a Delayed QRR and a Delayed MRR too", () => {
    // The source tests all three Period keys independently, and the summary
    // tables mirror a Quarterly type into `arrType`, so asking only about ARR
    // would drop the column on a Quarterly Build.
    expect(keys("Delayed QRR")).toContain("delayed-days");
    expect(keys("Delayed MRR")).toContain("delayed-days");
  });
});

// ---- BU only ---------------------------------------------------------------
//
// The source's DEFAULT view of this table, and the port's second one.
// `DataGrid.js:365` is `useState(true)`, so the live app opens the Software/
// Cloud Customers table on seven business-unit columns and the twelve-column
// Software/Cloud breakdown above is what unticking "BU only" gets you.
//
// Both views read the SAME `POST /accounts` response — there is no second
// request and no second hook. What differs is which six fields each figure is
// read from: `apimBuTotal` rather than `apimSoftwareTotal` plus `apimCloudTotal`.

describe("the BU-only columns", () => {
  it("reads the six business units, then the total", () => {
    expect(CUSTOMER_BU_SUB_COLUMNS.map((column) => column.key)).toEqual([
      "bu-apim",
      "bu-iam",
      "bu-integration",
      "bu-choreo",
      "bu-agent-platform",
      "bu-moesif",
      "bu-total",
    ]);
  });

  it("reads each unit off the field the backend sends it under", () => {
    const fieldByKey = Object.fromEntries(
      CUSTOMER_BU_SUB_COLUMNS.map((column) => [column.key, column.field]),
    );
    expect(fieldByKey).toEqual({
      "bu-apim": "apimBuTotal",
      "bu-iam": "iamBuTotal",
      "bu-integration": "integrationBuTotal",
      "bu-choreo": "choreoBuTotal",
      "bu-agent-platform": "agentPlatformBuTotal",
      "bu-moesif": "moesifBuTotal",
      "bu-total": "arrGrandTotal",
    });
  });

  it("carries Moesif's caveat in its own header, because the figure is inside API Platform BU beside it", () => {
    const moesif = CUSTOMER_BU_SUB_COLUMNS.find((column) => column.key === "bu-moesif");
    expect(moesif?.label).toBe("Moesif (Already included in API Platform BU)");
  });

  it("names the units the way the source's headers do", () => {
    expect(CUSTOMER_BU_SUB_COLUMNS.map((column) => column.label)).toEqual([
      "API Platform BU",
      "IAM BU",
      "Integration BU",
      "Choreo BU",
      "Agent Platform BU",
      "Moesif (Already included in API Platform BU)",
      "Total",
    ]);
  });

  it("reads a unit's figure off the account, like every other column", () => {
    const only = account("a1", "Northwind Bank", { apimBuTotal: 4_200, iamBuTotal: 900 });
    const figureFor = (key: string) =>
      customerFigure(only, CUSTOMER_BU_SUB_COLUMN_BY_KEY.get(key)!);
    expect(figureFor("bu-apim")).toBe(4_200);
    expect(figureFor("bu-iam")).toBe(900);
  });

  it("is undefined for a customer absent from that column, as the Software/Cloud view is", () => {
    expect(customerFigure(undefined, CUSTOMER_BU_SUB_COLUMN_BY_KEY.get("bu-apim")!)).toBeUndefined();
  });
});

// ---- the Total row ---------------------------------------------------------
//
// `useCustomerAccounts.js:443-508` unshifts a `TOTAL_ROW` at the top of this
// table, in BOTH views, with every figure added down the accounts and a `-` in
// all seventeen identity columns. It is the only client-computed total in the
// ARR Build: the Subscription Build has none (its totals are the backend's
// named metric rows) and the two Exit ARR summaries compute theirs across
// REGIONS. This one runs down the customer book.

describe("the Total row", () => {
  const twoCustomers = [
    account("a1", "Northwind Bank", { apimSoftwareTotal: 100, arrGrandTotal: 400 }),
    account("a2", "Contoso", { apimSoftwareTotal: 25, arrGrandTotal: 75 }),
  ];

  it("sits at the top, above the customers it counts", () => {
    const { rows } = customerAccountRows([twoCustomers]);
    expect(rows.map((row) => row.label)).toEqual(["Total", "Northwind Bank", "Contoso"]);
    expect(rows[0].id).toBe(CUSTOMER_TOTAL_ROW_ID);
  });

  it("is emphasised, because it is a balance and not a customer", () => {
    const { rows } = customerAccountRows([twoCustomers]);
    expect(rows[0].emphasis).toBe(true);
    // No rule above it: a stroke is what an accountant draws UNDER the figures
    // being added, and this total is above them.
    expect(rows[0].ruleAbove).toBeFalsy();
  });

  it("adds a column's figures down the customer book", () => {
    const apim = CUSTOMER_SUB_COLUMN_BY_KEY.get("software-apim")!;
    expect(customerTotal(twoCustomers, apim)).toBe(125);
  });

  it("counts a customer's figure as the table shows it, fallback and all", () => {
    // `customerFigure`'s grand-total rule: a zero total falls through to the two
    // halves. The source's total row sums the field it has ALREADY applied that
    // rule to (`${periodKey}_total`), so the column foots against what is on
    // screen rather than against the raw wire.
    const book = [
      account("a1", "Northwind Bank", { arrGrandTotal: 0, arrSoftwareTotal: 60, arrCloudTotal: 40 }),
      account("a2", "Contoso", { arrGrandTotal: 10 }),
    ];
    expect(customerTotal(book, CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!)).toBe(110);
  });

  it("counts nothing for a customer absent from that column", () => {
    const grandTotal = CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!;
    expect(customerTotal([twoCustomers[1]], grandTotal)).toBe(75);
  });

  it("is blank, not zero, for a column that never answered", () => {
    expect(customerTotal(undefined, CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!)).toBeUndefined();
  });

  it("is zero for a column that answered with an empty book", () => {
    expect(customerTotal([], CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!)).toBe(0);
  });

  it("reads a dash in every identity column, because it is not an account", () => {
    const columns = customerLeadColumns("Total ARR");
    const identityTexts = columns
      .slice(1)
      .map((column) => customerIdentityText(CUSTOMER_TOTAL_ROW_ID, undefined, column));
    expect(new Set(identityTexts)).toEqual(new Set(["-"]));
  });

  it("does not appear over an empty book, where the source shows a row of zeroes", () => {
    expect(customerAccountRows([]).rows).toEqual([]);
    expect(customerAccountRows([[], []]).rows).toEqual([]);
  });
});

// The two views disagree about the Total column, and the source is where the
// disagreement comes from. BOTH fall back when the backend sends no grand total,
// and they fall back to DIFFERENT SUMS under DIFFERENT conditions:
//
//   Software/Cloud  `${periodKey}_total` = `arrGrandTotal || soft + cloud || 0`
//                   — a data field, JS-falsy, so 0/undefined/NaN fall through.
//   BU only         the column's own `valueGetter` (`tableConstants.js:474-489`)
//                   — `_bu_total > 0 ? _bu_total : the six BU fields summed`,
//                   where `_bu_total` is itself `arrGrandTotal || 0`. Strictly
//                   POSITIVE, so a negative grand total falls through too.
//
// Same field on the same customer, two rules and two answers — which is why the
// rule belongs to the COLUMN and not to the field it reads.
describe("the grand-total fallback, which both views have and neither shares", () => {
  const noTotalSent = account("a1", "Northwind Bank", {
    arrGrandTotal: 0,
    arrSoftwareTotal: 60,
    arrCloudTotal: 40,
    apimBuTotal: 30,
    iamBuTotal: 20,
  });

  it("falls back to Software plus Cloud in the Software/Cloud view", () => {
    expect(customerFigure(noTotalSent, CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!)).toBe(100);
  });

  it("falls back to the six business units in the BU-only view", () => {
    // Not 100: the BU view adds the units it shows, not the two books.
    expect(customerFigure(noTotalSent, CUSTOMER_BU_SUB_COLUMN_BY_KEY.get("bu-total")!)).toBe(50);
  });

  it("uses the backend's grand total when it sent a positive one", () => {
    const sent = account("a1", "Northwind Bank", { arrGrandTotal: 75, apimBuTotal: 30 });
    expect(customerFigure(sent, CUSTOMER_BU_SUB_COLUMN_BY_KEY.get("bu-total")!)).toBe(75);
  });

  it("falls back on a NEGATIVE grand total too, where the other view would not", () => {
    // `directTotal > 0`, not a truthiness check. A negative total is a real
    // figure the source declines to show here and shows in the other view.
    const negative = account("a1", "Northwind Bank", {
      arrGrandTotal: -10,
      arrSoftwareTotal: -10,
      arrCloudTotal: 0,
      apimBuTotal: 30,
    });
    expect(customerFigure(negative, CUSTOMER_BU_SUB_COLUMN_BY_KEY.get("bu-total")!)).toBe(30);
    expect(customerFigure(negative, CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!)).toBe(-10);
  });
});

// The Total ROW asks the same question of the whole book rather than of each
// customer, and for the BU-only Total those are different numbers. The source
// sums the raw `_bu_total` down the book FIRST and applies the column's rule to
// the sum — so one customer whose grand total is missing does not drag the
// whole column onto the fallback.
describe("the Total row's own reading of the BU-only Total", () => {
  const buTotal = CUSTOMER_BU_SUB_COLUMN_BY_KEY.get("bu-total")!;

  it("adds the grand totals when the book has any", () => {
    const book = [
      account("a1", "Northwind Bank", { arrGrandTotal: 0, apimBuTotal: 100 }),
      account("a2", "Contoso", { arrGrandTotal: 50, apimBuTotal: 50 }),
    ];
    // 50, not 150: the rule is applied to the SUM of the raw totals, which is
    // positive, so the fallback is never reached. Summing each customer's own
    // answer would have counted a1's units and a2's total together.
    expect(customerTotal(book, buTotal)).toBe(50);
  });

  it("falls back to the six units only when the whole book sent no total", () => {
    const book = [
      account("a1", "Northwind Bank", { arrGrandTotal: 0, apimBuTotal: 100, iamBuTotal: 5 }),
      account("a2", "Contoso", { arrGrandTotal: 0, apimBuTotal: 20 }),
    ];
    expect(customerTotal(book, buTotal)).toBe(125);
  });

  it("still totals the other columns by adding what each customer shows", () => {
    const book = [
      account("a1", "Northwind Bank", { arrGrandTotal: 0, arrSoftwareTotal: 60, arrCloudTotal: 40 }),
      account("a2", "Contoso", { arrGrandTotal: 10 }),
    ];
    expect(customerTotal(book, CUSTOMER_SUB_COLUMN_BY_KEY.get("grand-total")!)).toBe(110);
  });
});

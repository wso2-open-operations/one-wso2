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
  CUSTOMER_SUB_COLUMNS,
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

describe("which customers the table has rows for", () => {
  it("gives one row per account, labelled with the account name", () => {
    const rows = customerAccountRows([[account("a1", "Northwind Bank"), account("a2", "Contoso")]]);
    expect(rows.map((row) => row.label)).toEqual(["Northwind Bank", "Contoso"]);
  });

  it("carries the account id, which is what a drill-down will be opened by", () => {
    const [row] = customerAccountRows([[account("a1", "Northwind Bank")]]);
    expect(row.id).toBe("a1");
  });

  it("has no tree — a customer has nothing under it", () => {
    // Worth pinning because the Build beside it is all tree. A customer row
    // with children would be a section header, and windowing releases a closed
    // section's rows: a customer that could be collapsed would be a customer
    // whose figures could go missing.
    const rows = customerAccountRows([[account("a1", "Northwind Bank")]]);
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
    const rows = customerAccountRows([
      [account("a1", "Northwind Bank")],
      [account("a2", "Contoso")],
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("keeps one row for a customer present in several columns", () => {
    const rows = customerAccountRows([
      [account("a1", "Northwind Bank"), account("a2", "Contoso")],
      [account("a1", "Northwind Bank")],
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("orders by first appearance, oldest column first", () => {
    // The source builds its union with a Map keyed by id, which is
    // insertion-ordered, and iterates the periods oldest first. Pinned because
    // an unstable order makes the table reshuffle whenever a filter changes.
    const rows = customerAccountRows([
      [account("a2", "Contoso")],
      [account("a1", "Northwind Bank"), account("a3", "Fabrikam")],
    ]);
    expect(rows.map((row) => row.id)).toEqual(["a2", "a1", "a3"]);
  });

  it("takes the name from the first column that names them", () => {
    const rows = customerAccountRows([
      [account("a1", "Northwind Bank")],
      [account("a1", "Northwind Bank PLC")],
    ]);
    expect(rows.map((row) => row.label)).toEqual(["Northwind Bank"]);
  });

  it("has no rows at all when no column answered", () => {
    expect(customerAccountRows([])).toEqual([]);
    expect(customerAccountRows([[], []])).toEqual([]);
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

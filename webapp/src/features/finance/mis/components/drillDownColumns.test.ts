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
  DRILL_DOWN_NOT_AVAILABLE,
  drillDownColumns,
  drillDownRows,
  type DrillDownCustomer,
} from "./drillDownColumns";

// The columns of the customer drill-down dialog. Ported from digiops-finance
// `arrDashboard/components/ArrSummaryCustomersDialog.js`:41-152.
//
// Eleven columns normally and THIRTEEN on a Lost row, with the two extra ones
// inserted after Amount rather than appended — so the reason a customer left
// sits beside how much left with them.

const customer = (over: Partial<DrillDownCustomer> = {}): DrillDownCustomer => ({
  accountId: "0018000001abcXYZ",
  name: "Northwind Bank",
  salesRegion: "EMEA",
  subRegion: "Northern Europe",
  amount: 750000,
  ...over,
});

const keysFor = (rowId: string) => drillDownColumns(rowId).map((column) => column.key);
const read = (rowId: string, key: string, from: DrillDownCustomer) =>
  drillDownColumns(rowId)
    .find((column) => column.key === key)!
    .value(from);

describe("which columns a drill-down shows", () => {
  it("shows eleven on an ordinary movement, in the source's order", () => {
    expect(keysFor("new-arr")).toEqual([
      "accountId",
      "name",
      "amount",
      "churnDate",
      "salesRegion",
      "subRegion",
      "accountRating",
      "activationDate",
      "customerLifetime",
      "technicalOwner",
      "accountOwner",
    ]);
  });

  it("inserts the two Lost columns after the Amount, not at the end", () => {
    // The source builds `[...BASE, ...LOST, ...INTERMEDIATE]`, so Lost Reason
    // Category and Lost Reason land at positions 4 and 5 — immediately right of
    // the amount that left and immediately left of the churn date. Appending
    // them instead would put the reason a customer churned eight columns away
    // from the fact that they did.
    expect(keysFor("lost")).toEqual([
      "accountId",
      "name",
      "amount",
      "lostReasonCategory",
      "lostReason",
      "churnDate",
      "salesRegion",
      "subRegion",
      "accountRating",
      "activationDate",
      "customerLifetime",
      "technicalOwner",
      "accountOwner",
    ]);
  });

  it("shows them for the logo row as well as the money row", () => {
    expect(keysFor("lost-customers")).toEqual(keysFor("lost"));
  });

  it("shows them for Lost and for nothing else", () => {
    // Keyed on the row ID, not on the label. The source compares the label text
    // against 'Lost'/'Lost Customers'; the port has stable ids, and a Build
    // with four rows labelled "y/y growth" is why a label is not an identity.
    for (const rowId of ["new-arr", "expansions", "reductions", "ending-arr", "opening-arr"]) {
      expect(keysFor(rowId)).not.toContain("lostReason");
      expect(keysFor(rowId)).toHaveLength(11);
    }
  });

  it("names every column the way the source's header does", () => {
    expect(drillDownColumns("lost").map((column) => column.label)).toEqual([
      "Account ID",
      "Account Name",
      "Amount (USD)",
      "Lost Reason Category",
      "Lost Reason",
      "ARR Churn Date",
      "Sales Region",
      "Sub Region",
      "Account Rating",
      "Activation Date",
      "Customer Lifetime (Years)",
      "Technical Owner",
      "Account Owner",
    ]);
  });

  it("freezes the Account ID and nothing else", () => {
    expect(drillDownColumns("lost").filter((c) => c.pinned).map((c) => c.key)).toEqual([
      "accountId",
    ]);
  });
});

describe("what a cell says when the backend said nothing", () => {
  // The source is NOT uniform here and the port reproduces it rather than
  // tidying it, under ADR 0003. Seven columns fall back to the literal "N/A";
  // four render an empty cell. The four are exactly the fields the backend
  // declares non-nullable — except Amount, which is also non-nullable and DOES
  // get the placeholder. Recorded in mis.md §8.

  it("writes N/A in the columns the source writes it in", () => {
    const bare = customer({ amount: undefined as unknown as number });
    for (const key of [
      "amount",
      "churnDate",
      "accountRating",
      "activationDate",
      "customerLifetime",
      "technicalOwner",
      "accountOwner",
    ]) {
      expect(read("new-arr", key, bare)).toBe(DRILL_DOWN_NOT_AVAILABLE);
    }
  });

  it("writes N/A in both Lost columns", () => {
    for (const key of ["lostReasonCategory", "lostReason"]) {
      expect(read("lost", key, customer())).toBe(DRILL_DOWN_NOT_AVAILABLE);
    }
  });

  it("leaves the other four blank, which is what the source does", () => {
    const blank = customer({ accountId: "", name: "", salesRegion: "", subRegion: "" });
    for (const key of ["accountId", "name", "salesRegion", "subRegion"]) {
      expect(read("new-arr", key, blank)).toBe("");
    }
  });

  it("never writes the word undefined into a cell", () => {
    const bare = { accountId: "a1" } as DrillDownCustomer;
    for (const column of drillDownColumns("lost")) {
      expect(column.value(bare)).not.toMatch(/undefined|null|NaN/);
    }
  });
});

describe("the amount, which is the figure the reader clicked broken down", () => {
  it("groups thousands and keeps exactly two decimals", () => {
    expect(read("new-arr", "amount", customer({ amount: 1234567.5 }))).toBe("1,234,567.50");
  });

  it("shows no currency symbol — the header carries the unit", () => {
    expect(read("new-arr", "amount", customer({ amount: 1000 }))).not.toContain("$");
  });

  it("ignores the Scale preference, exactly as the source does", () => {
    // The source hard-codes units for this dialog (`scale: SCALES.UNITS`) and
    // its own test asserts the thousands rendering must NOT appear. The column
    // header says "(USD)", so a figure silently divided by a thousand here
    // would be wrong rather than merely scaled — and the dialog is opened from
    // a Build that may well be showing thousands.
    expect(read("new-arr", "amount", customer({ amount: 1234567.5 }))).toBe("1,234,567.50");
  });

  it("shows a genuine zero rather than N/A", () => {
    expect(read("new-arr", "amount", customer({ amount: 0 }))).toBe("0.00");
  });

  it("keeps a negative amount negative", () => {
    // A Reductions drill-down may legitimately carry negative figures; the
    // source applies no sign handling, so neither does this.
    expect(read("reductions", "amount", customer({ amount: -5000 }))).toBe("-5,000.00");
  });
});

describe("the rows the dialog renders", () => {
  it("gives one row per customer, identified by the account id", () => {
    const rows = drillDownRows([customer(), customer({ accountId: "b2", name: "Contoso" })]);
    expect(rows.map((row) => row.id)).toEqual(["0018000001abcXYZ", "b2"]);
  });

  it("labels the row with the account id, which is the first column", () => {
    expect(drillDownRows([customer()])[0].label).toBe("0018000001abcXYZ");
  });

  it("has no tree — a customer in a drill-down has nothing under it", () => {
    expect(drillDownRows([customer()])[0].children).toBeUndefined();
  });

  it("keeps the backend's order, which is the order the figure was summed in", () => {
    const rows = drillDownRows([
      customer({ accountId: "c" }),
      customer({ accountId: "a" }),
      customer({ accountId: "b" }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("has nothing to show for an empty book", () => {
    expect(drillDownRows([])).toEqual([]);
  });
});

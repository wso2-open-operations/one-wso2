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
import type { MisChannelDirect } from "../util/misViewVocabulary";
import { MIS_VALUE_TYPES, misValueTypeForRow } from "../util/misMoney";
import {
  ARR_BUILD_SECTION_IDS,
  arrBuildFieldFor,
  arrBuildRows,
} from "./arrBuildRows";

// The shape of a Subscription Build: five sections of metric rows, and which
// field of a `/arr-summary` response each row reads.
//
// Ported from COMMON_ROW_HEADERS / TRANSFERRED_IN_TRANSFERRED_OUT_ROW_HEADERS
// and the mapper in `useArrTableSummary.js`. Every label is verbatim — they are
// wire values, and ticket 05's formatter decides what kind of number a row
// holds by reading them.

const labelsIn = (sectionId: string, channelDirect: MisChannelDirect = "All") =>
  arrBuildRows(channelDirect)
    .find((section) => section.id === sectionId)
    ?.children?.map((row) => row.label);

describe("the sections a Build is read in", () => {
  it("runs from the movement down to the logo percentages", () => {
    expect(arrBuildRows("All").map((section) => section.label)).toEqual([
      "ARR movement",
      "Dollar retention",
      "Movement percentages",
      "Customers",
      "Logo percentages",
    ]);
  });

  it("names every section so a screen can open them all", () => {
    expect(arrBuildRows("All").map((section) => section.id)).toEqual([...ARR_BUILD_SECTION_IDS]);
  });

  it("puts every metric row inside a section, never loose at the top", () => {
    for (const section of arrBuildRows("All")) {
      expect(section.children?.length).toBeGreaterThan(0);
    }
  });
});

describe("the ARR movement", () => {
  it("rolls an Opening balance through the movements to a Closing one", () => {
    expect(labelsIn("arr-movement")).toEqual([
      "Opening ARR",
      "New",
      "Expansions",
      "Reductions",
      "Lost",
      "Ending ARR",
      "y/y growth",
      "Net New",
      "y/y growth",
      "Total New ARR",
      "y/y growth",
      "Total Churn ARR",
      "y/y growth",
    ]);
  });

  it("emphasises the two balances, and rules off above the closing one", () => {
    const rows = arrBuildRows("All")[0].children ?? [];
    const opening = rows.find((row) => row.label === "Opening ARR");
    const ending = rows.find((row) => row.label === "Ending ARR");
    expect(opening?.emphasis).toBe(true);
    expect(ending?.emphasis).toBe(true);
    expect(ending?.ruleAbove).toBe(true);
  });

  it("gives each y/y growth row its own field, though all four read alike", () => {
    // The source tells them apart by looking at the row ABOVE — four rows share
    // one label, and the mapper switches on `prevHeader`. Here each is its own
    // row with its own id, so a re-order cannot silently swap two figures.
    const growth = (arrBuildRows("All")[0].children ?? []).filter(
      (row) => row.label === "y/y growth",
    );
    expect(growth.map((row) => arrBuildFieldFor(row.id))).toEqual([
      "endingArrYoyGrowth",
      "netNewYoyGrowth",
      "totalNewArrYoyGrowth",
      "totalChurnArrYoyGrowth",
    ]);
  });
});

describe("transfers between the channel and direct books", () => {
  it("are hidden while both books are on screen together", () => {
    // With Channel/Direct at All a transfer is internal: it leaves one book and
    // arrives in the other, so showing it would double-count a movement that
    // never happened.
    expect(labelsIn("arr-movement", "All")).not.toContain("Transferred In (included in new)");
    expect(labelsIn("customers", "All")).not.toContain(
      "Transferred In Customers (included in new)",
    );
  });

  it("appear beside the movement they are included in, once one book is chosen", () => {
    expect(labelsIn("arr-movement", "Channel")).toEqual([
      "Opening ARR",
      "New",
      "Transferred In (included in new)",
      "Expansions",
      "Reductions",
      "Transferred Out (included in lost)",
      "Lost",
      "Ending ARR",
      "y/y growth",
      "Net New",
      "y/y growth",
      "Total New ARR",
      "y/y growth",
      "Total Churn ARR",
      "y/y growth",
    ]);
  });

  it("appear in the customer counts too", () => {
    expect(labelsIn("customers", "Direct")).toEqual([
      "Opening Customers",
      "New Customers",
      "Transferred In Customers (included in new)",
      "Lost Customers",
      "Transferred Out Customers (included in lost)",
      "Closing Customers",
    ]);
  });
});

describe("what kind of number each row holds", () => {
  it("is decided by the row's own label, through ticket 05's formatter", () => {
    // The labels are wire values, which is what lets `misValueTypeForRow`
    // answer for them without a second table to keep in step.
    const kindOf = (sectionId: string, label: string) =>
      misValueTypeForRow(
        labelsIn(sectionId)?.find((rowLabel) => rowLabel === label) ?? "",
      );
    expect(kindOf("arr-movement", "Opening ARR")).toBe(MIS_VALUE_TYPES.CURRENCY);
    expect(kindOf("arr-movement", "y/y growth")).toBe(MIS_VALUE_TYPES.PERCENTAGE);
    expect(kindOf("customers", "Opening Customers")).toBe(MIS_VALUE_TYPES.COUNT);
    expect(kindOf("logo-percentages", "% New Logos")).toBe(MIS_VALUE_TYPES.PERCENTAGE);
  });
});

describe("every row on screen", () => {
  it("knows which field of a response it reads", () => {
    // A row with no field would render permanently blank, and blank is also
    // what a legitimately absent figure looks like — so the gap would never
    // announce itself.
    for (const channelDirect of ["All", "Channel"] as const) {
      for (const section of arrBuildRows(channelDirect)) {
        for (const row of section.children ?? []) {
          expect(arrBuildFieldFor(row.id), `${section.label} / ${row.label}`).toBeDefined();
        }
      }
    }
  });

  it("has an id of its own, so no two rows collide", () => {
    const ids = arrBuildRows("Channel").flatMap((section) => [
      section.id,
      ...(section.children ?? []).map((row) => row.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Ticket 06 owes ticket 07 a row count, and for THIS table the count is a
// property of the code rather than a measurement of the data.
describe("how big a Subscription Build can get", () => {
  const visibleRowCount = (channelDirect: MisChannelDirect) =>
    arrBuildRows(channelDirect).reduce(
      (total, section) => total + 1 + (section.children?.length ?? 0),
      0,
    );

  it("is the same whatever the backend returns", () => {
    // Every row is a metric — a named line of the roll-forward — so the table
    // is as tall with one customer's revenue in it as with fifty thousand. The
    // figures arrive as columns, never as rows. That is what makes windowing
    // (ticket 07) a question about the CUSTOMER tables (ticket 10), not this one.
    expect(visibleRowCount("All")).toBe(34);
    expect(visibleRowCount("Channel")).toBe(38);
  });

  it("stays well inside what an unwindowed table can render", () => {
    // The assertion that matters is the bound, not the exact number: adding a
    // metric row is ordinary, and going from tens of rows to hundreds would not
    // be. ADR 0004 accepted hand-rolling on the understanding that windowing
    // lands before the tables that need it.
    for (const channelDirect of ["All", "Channel", "Direct"] as const) {
      expect(visibleRowCount(channelDirect)).toBeLessThan(100);
    }
  });
});

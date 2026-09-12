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
  buildTableIds,
  tableMinWidth,
  visibleRows,
  type BuildRow,
  type BuildSubColumn,
} from "./buildTableModel";

// The arithmetic and the vocabulary behind the Build table, with no DOM in it.
//
// It lives apart from the component for two reasons. Collapsing a section and
// working out which rows are on screen is logic, and logic that renders is
// logic that can only be tested by rendering. And the `id`/`headers` wiring
// that lets a screen reader say WHICH Period a figure belongs to is a set of
// strings that have to agree across three places in the markup — a header cell,
// a sub-header cell, and every data cell under them. Agreement between strings
// is exactly what a test can hold still.

/** Opening, one movement with two business units under it, Closing. */
const ROWS: BuildRow[] = [
  { id: "opening", label: "Opening ARR", emphasis: true },
  {
    id: "new",
    label: "New",
    children: [
      {
        id: "new-apim",
        label: "APIM",
        children: [
          { id: "new-apim-northwind", label: "Northwind Bank" },
          { id: "new-apim-meridian", label: "Meridian Health" },
        ],
      },
      { id: "new-iam", label: "IAM" },
    ],
  },
  { id: "closing", label: "Ending ARR", emphasis: true, ruleAbove: true },
];

const ids = (rows: ReturnType<typeof visibleRows>) => rows.map((r) => r.row.id);

/** Every row that owns children, so a case can open the whole tree. */
const ALL_OPEN = new Set(["new", "new-apim"]);

describe("which rows are on screen", () => {
  it("walks the tree in reading order when everything is open", () => {
    expect(ids(visibleRows(ROWS, ALL_OPEN))).toEqual([
      "opening",
      "new",
      "new-apim",
      "new-apim-northwind",
      "new-apim-meridian",
      "new-iam",
      "closing",
    ]);
  });

  // The set names what is OPEN, so a Build with nothing opened shows the
  // summary it is meant to be: the balances, and the movements between them.
  it("shows only the outermost rows when nothing has been opened", () => {
    expect(ids(visibleRows(ROWS, new Set()))).toEqual(["opening", "new", "closing"]);
  });

  it("hides what a closed row holds, and everything below that", () => {
    expect(ids(visibleRows(ROWS, new Set(["new"])))).toEqual([
      "opening", "new", "new-apim", "new-iam", "closing",
    ]);
    // Opening a grandchild without its parent shows neither: the parent is
    // still closed, so nothing under it is on screen to open.
    expect(ids(visibleRows(ROWS, new Set(["new-apim"])))).toEqual(["opening", "new", "closing"]);
  });

  // A link or a saved view can name a row that a filter change has since taken
  // away. Ignoring it beats rendering nothing.
  it("ignores an id that is not in the tree", () => {
    expect(ids(visibleRows(ROWS, new Set([...ALL_OPEN, "gone"])))).toHaveLength(7);
  });

  // Depth comes from the tree rather than from a field on the row, so a row
  // cannot claim an indent its position contradicts.
  it("reports how deep each row sits", () => {
    expect(visibleRows(ROWS, ALL_OPEN).map((r) => r.depth)).toEqual([0, 0, 1, 2, 2, 1, 0]);
  });

  it("says which rows can be opened, and which are open", () => {
    const rows = visibleRows(ROWS, new Set(["new"]));
    expect(rows.map((r) => [r.row.id, r.expandable, r.expanded])).toEqual([
      ["opening", false, false],
      ["new", true, true],
      ["new-apim", true, false],
      ["new-iam", false, false],
      ["closing", false, false],
    ]);
  });

  // A parent that arrives with an empty list is a leaf. Offering a control that
  // opens onto nothing is worse than offering none.
  it("does not offer to open a row whose children are an empty list", () => {
    const rows = visibleRows([{ id: "empty", label: "Nothing here", children: [] }], new Set(["empty"]));
    expect(rows[0].expandable).toBe(false);
    expect(rows[0].expanded).toBe(false);
  });
});

describe("how wide the table has to be", () => {
  const SUBS: BuildSubColumn[] = [
    { key: "amount", label: "Amount", width: 104 },
    { key: "pct", label: "% Open", width: 68 },
  ];

  // The explicit minWidth is what makes the columns keep their size and the
  // container scroll, instead of two dozen columns squeezing to illegible.
  it("is the pinned label column plus every sub-column of every Period", () => {
    expect(tableMinWidth(5, SUBS, 288)).toBe(288 + 5 * (104 + 68));
    expect(tableMinWidth(12, SUBS, 288)).toBe(288 + 12 * (104 + 68));
  });

  it("grows with the Periods on screen", () => {
    expect(tableMinWidth(12, SUBS, 288)).toBeGreaterThan(tableMinWidth(5, SUBS, 288));
  });

  it("is the label column alone when there are no Periods to show", () => {
    expect(tableMinWidth(0, SUBS, 288)).toBe(288);
  });
});

describe("the header wiring a screen reader follows", () => {
  const id = buildTableIds("t1");

  it("names each header cell once", () => {
    const all = [
      id.rowLabelHeader,
      id.groupHeader("fy2025"),
      id.groupHeader("fy2026"),
      id.subHeader("fy2025", "amount"),
      id.subHeader("fy2025", "pct"),
      id.rowHeader("opening"),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  // Two Build tables on one page — the Subscription grid and a drill-down —
  // would otherwise both claim the same ids, and `headers` would resolve to
  // whichever the browser saw first.
  it("keeps two tables on one page apart", () => {
    expect(buildTableIds("t2").groupHeader("fy2025")).not.toBe(id.groupHeader("fy2025"));
  });

  // The whole point. Without this a screen reader reads "1,240,000" with no way
  // to say which of 24 numeric columns it came from.
  it("points a figure at its row, its Period, and its sub-column", () => {
    expect(id.cellHeaders("opening", "fy2025", "amount")).toBe(
      `${id.rowHeader("opening")} ${id.groupHeader("fy2025")} ${id.subHeader("fy2025", "amount")}`,
    );
  });

  // A Period label and the Amount under it are different cells and must not
  // collide, or the reader hears the Period twice and the sub-column never.
  it("does not let a Period's own id collide with its sub-columns'", () => {
    expect(id.subHeader("fy2025", "amount")).not.toBe(id.groupHeader("fy2025"));
  });

  // `headers` is a SPACE-SEPARATED list of ids, so a space inside one silently
  // splits it into references that point at nothing. This is not hypothetical:
  // a TTM Period's own header is "2025/12/31 - 2026/12/31", so a caller keying
  // its column groups by the label it already has would break the wiring with
  // nothing on screen to show for it.
  it("keeps whitespace out of an id, whatever the caller's keys look like", () => {
    const odd = buildTableIds("t1");
    const headers = odd.cellHeaders("Northwind Bank", "2025/12/31 - 2026/12/31", "% Open");
    expect(headers.split(" ")).toHaveLength(3);
    expect(headers.split(" ").every((one) => one.length > 0)).toBe(true);
    expect(odd.rowHeader("Northwind Bank")).not.toMatch(/\s/);
  });

  // The parts are joined, so a separator appearing inside a key would let two
  // different pairs land on the same id and a figure point at the wrong Period.
  it("does not let a key containing the separator collide with the next part", () => {
    const odd = buildTableIds("t1");
    expect(odd.subHeader("a", "b:c")).not.toBe(odd.subHeader("a:b", "c"));
  });
});

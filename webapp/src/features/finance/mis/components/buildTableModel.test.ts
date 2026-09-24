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
  ROW_WINDOW_OVERSCAN,
  buildTableIds,
  leadColumnOffsets,
  rowWindow,
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

describe("which rows are worth rendering", () => {
  // The arithmetic behind windowing, with no DOM in it. A Build of several
  // thousand customer lines cannot put every row in the document — ADR 0004
  // named this as required scope the moment it chose a hand-rolled table over a
  // grid — so the table renders a slice and pads the space the rest would have
  // taken. Getting the padding wrong is the failure that matters: the rows look
  // right and the scrollbar lies about how much table there is.

  const win = (over = {}) =>
    rowWindow({ total: 1000, scrollTop: 0, viewportHeight: 500, rowHeight: 25, ...over });

  it("renders the rows on screen, plus a margin either side to scroll into", () => {
    const { first, last } = win();
    expect(first).toBe(0);
    // 500px of viewport at 25px a row is 20 rows, and the overscan is rendered
    // above and below so a scroll of a few rows has something to show.
    expect(last).toBe(20 + ROW_WINDOW_OVERSCAN * 2);
  });

  it("moves the window down as the reader scrolls", () => {
    const { first, last } = win({ scrollTop: 25 * 100 });
    expect(first).toBe(100 - ROW_WINDOW_OVERSCAN);
    expect(last).toBe(first + 20 + ROW_WINDOW_OVERSCAN * 2);
  });

  it("pads exactly the height of the rows it did not render", () => {
    const { first, last, topPad, bottomPad } = win({ scrollTop: 25 * 100 });
    expect(topPad).toBe(first * 25);
    expect(bottomPad).toBe((1000 - last) * 25);
    // The whole table still occupies the height it would have, so the scrollbar
    // describes the real thing rather than the window.
    expect(topPad + (last - first) * 25 + bottomPad).toBe(1000 * 25);
  });

  it("runs out at the ends rather than off them", () => {
    expect(win({ scrollTop: 0 }).topPad).toBe(0);
    const atBottom = win({ scrollTop: 25 * 1000 });
    expect(atBottom.last).toBe(1000);
    expect(atBottom.bottomPad).toBe(0);
    // The window is still FULL at the bottom, rather than trailing off into the
    // last few rows: a viewport's worth is what the reader can see.
    expect(atBottom.first).toBeLessThan(atBottom.last);
    expect(atBottom.last - atBottom.first).toBeGreaterThanOrEqual(20);
  });

  // The failure this is written against: a reader scrolled deep into a Build
  // collapses a section, the row count drops under them, and the scroll offset
  // still describes where they were. Without a clamp the window starts past the
  // end of the table — an EMPTY body under a spacer the height of where the
  // rows used to be, which reads as a Build that has lost its figures.
  it("comes back to the rows when the table shrinks under the reader", () => {
    const shrunk = win({ total: 2, scrollTop: 25 * 2000 });
    expect(shrunk).toEqual({ first: 0, last: 2, topPad: 0, bottomPad: 0 });
  });

  it("never opens a window that starts after it ends, wherever it is asked", () => {
    // Swept rather than spot-checked: the bug above sat in one corner of this
    // space and every assertion in this file walked past it.
    for (const total of [0, 1, 2, 30, 999, 1000]) {
      for (const scrollTop of [0, 250, 25 * 40, 25 * 999, 25 * 5000]) {
        const { first, last, topPad, bottomPad } = win({ total, scrollTop });
        expect(first).toBeLessThanOrEqual(last);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(last).toBeLessThanOrEqual(total);
        // And the table always occupies exactly the height it should.
        expect(topPad + (last - first) * 25 + bottomPad).toBe(total * 25);
      }
    }
  });

  it("renders everything when there is less table than viewport", () => {
    const { first, last, topPad, bottomPad } = win({ total: 10 });
    expect([first, last]).toEqual([0, 10]);
    expect([topPad, bottomPad]).toEqual([0, 0]);
  });

  // jsdom reports every height as zero, and so does a container that has not
  // been laid out yet. Dividing by it would put NaN in a style attribute; the
  // honest answer is that nothing can be excluded, so nothing is.
  it("renders everything rather than nothing when it cannot measure a row", () => {
    const { first, last, topPad, bottomPad } = win({ rowHeight: 0 });
    expect([first, last]).toEqual([0, 1000]);
    expect([topPad, bottomPad]).toEqual([0, 0]);
  });
});

describe("the columns of row identity, left of the figures", () => {
  // Ticket 10. The Subscription Build needs ONE column on the left — the
  // movement's name — and the Software/Cloud Customers table needs eighteen:
  // Account Name, Account ID, Owner, Source, both countries, Industry, Region,
  // Activation and Churn dates, and the rest. They are the same mechanism at
  // two sizes, so the table takes a list and the one-column case is a list of
  // one.
  //
  // What has to be arithmetic rather than CSS: `position: sticky` needs each
  // frozen column's own `left`, and that is the sum of the widths frozen before
  // it. Get it wrong and the columns overlap — which looks like missing data
  // rather than like a layout bug, because the column underneath is still
  // there, just covered.

  const lead = (key: string, width: number, pinned?: boolean) => ({
    key,
    label: key,
    width,
    pinned,
  });

  it("puts the first frozen column at the left edge", () => {
    expect(leadColumnOffsets([lead("name", 280, true)])).toEqual([0]);
  });

  it("offsets each frozen column by the ones frozen before it", () => {
    expect(
      leadColumnOffsets([lead("name", 280, true), lead("id", 180, true), lead("owner", 120, true)]),
    ).toEqual([0, 280, 460]);
  });

  it("leaves an unfrozen column to scroll, with no offset at all", () => {
    // `undefined` rather than 0: a 0 would freeze it at the left edge, on top
    // of the column that belongs there.
    expect(leadColumnOffsets([lead("name", 280, true), lead("id", 180)])).toEqual([0, undefined]);
  });

  it("stops freezing after the first column that is not frozen", () => {
    // Pinning is only meaningful as a contiguous run from the left. A frozen
    // column with a scrolling one to its LEFT has nowhere honest to sit: its
    // offset would be a gap that the scrolling column slides underneath, so it
    // would sit on top of whatever happened to be passing. The source pins
    // Account Name alone and nothing else, so this rule costs nothing there and
    // stops the eighteen-column table inventing an unrenderable layout.
    expect(
      leadColumnOffsets([lead("name", 280, true), lead("id", 180), lead("owner", 120, true)]),
    ).toEqual([0, undefined, undefined]);
  });

  it("freezes nothing when nothing asked to be frozen", () => {
    expect(leadColumnOffsets([lead("name", 280), lead("id", 180)])).toEqual([undefined, undefined]);
  });

  it("has nothing to say about no columns", () => {
    expect(leadColumnOffsets([])).toEqual([]);
  });

  it("widens the table by every lead column, not just the frozen ones", () => {
    // The unfrozen ones still occupy width, and a minWidth that forgot them
    // would let the figure columns squeeze rather than the container scroll.
    const subColumns = [{ key: "amount", label: "Amount", width: 100 }];
    expect(tableMinWidth(2, subColumns, 280 + 180)).toBe(280 + 180 + 200);
  });
});

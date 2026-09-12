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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BuildTable, { type BuildCellFor } from "./BuildTable";
import type { BuildColumnGroup, BuildRow, BuildSubColumn } from "./buildTableModel";

// ADR 0004 committed this port to a hand-rolled table, and listed what that
// obliges: four mechanisms MUI declines to provide, which this repo now owns
// forever. Each one is invisible when it works and each one breaks silently —
// a header row that covers the labels it belongs to, a highlight that stops at
// the frozen column, a figure a screen reader cannot place. So each is tested
// as the mechanism it is, not as a screenshot.
//
// What jsdom will and will not answer, established rather than assumed:
// `getComputedStyle` DOES resolve emotion's plain declarations here, so sticky,
// offsets and colours are assertable against the real render. It does NOT match
// `:hover`, so that one rule is read out of the generated stylesheet instead —
// which is still the rendered artefact, not a constant standing in for it.
// (`financeGridSx.test.ts` records the same jsdom limit for `:focus`.)

const SUB_COLUMNS: BuildSubColumn[] = [
  { key: "amount", label: "Amount", width: 104 },
  { key: "pct", label: "% Open", width: 68 },
];
const ROW_LABEL_WIDTH = 288;

const periodsOf = (count: number): BuildColumnGroup[] =>
  Array.from({ length: count }, (_, i) => ({ key: `fy${2020 + i}`, label: `FY${2020 + i}` }));

/** Opening, one movement three levels deep, Closing — a Build in miniature. */
const ROWS: BuildRow[] = [
  { id: "opening", label: "Opening ARR", emphasis: true },
  {
    id: "new",
    label: "New",
    children: [
      {
        id: "new-apim",
        label: "APIM",
        children: [{ id: "new-apim-northwind", label: "Northwind Bank" }],
      },
    ],
  },
  { id: "lost", label: "Lost", children: [{ id: "lost-iam", label: "IAM" }] },
  { id: "closing", label: "Ending ARR", emphasis: true, ruleAbove: true },
];

/** Every figure says where it came from, so a misplaced cell is visible. */
const cell: BuildCellFor = (row, group, subColumn) => ({
  text: `${row.id}/${group.key}/${subColumn.key}`,
  negative: row.id === "lost",
  muted: subColumn.key === "pct",
});

function renderTable(periodCount = 5, rows: BuildRow[] = ROWS) {
  return render(
    <BuildTable
      label="ARR Build"
      rowLabelHeader="Movement"
      columnGroups={periodsOf(periodCount)}
      subColumns={SUB_COLUMNS}
      rows={rows}
      cell={cell}
    />,
  );
}

const headerRows = () => Array.from(document.querySelectorAll("thead tr"));
const bodyRows = () => Array.from(document.querySelectorAll("tbody tr"));
const cellsOf = (row: Element) => Array.from(row.querySelectorAll("th, td"));

/** The CSS emotion actually generated for an element's classes. */
function cssRulesFor(element: Element): string[] {
  const classes = Array.from(element.classList).filter(Boolean);
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const text = rule.cssText ?? "";
      if (classes.some((one) => text.includes(`.${one}`))) out.push(text);
    }
  }
  return out;
}

// The two header rows have no height under jsdom, which is the one thing the
// offset mechanism cannot be tested without. Heights are supplied here and
// changed mid-test, which is what a resize or a zoom does to it.
let measuredHeaderHeight = 30;
const realGetBoundingClientRect = HTMLTableRowElement.prototype.getBoundingClientRect;

beforeEach(() => {
  measuredHeaderHeight = 30;
  HTMLTableRowElement.prototype.getBoundingClientRect = function measured() {
    return { ...new DOMRect(0, 0, 800, measuredHeaderHeight), height: measuredHeaderHeight } as DOMRect;
  };
});

afterEach(() => {
  HTMLTableRowElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
});

describe("the shape of the table", () => {
  // Spec §10.19. Five Annual Periods is the default view, twelve is the Monthly
  // Build — 24 numeric columns, which is where a layout that merely looks fine
  // at five stops being fine.
  it.each([5, 8, 12])("renders %i Periods without the layout collapsing", (periodCount) => {
    renderTable(periodCount);
    const [periodRow, subRow] = headerRows();

    // One row-label cell spanning both header rows, then one cell per Period.
    expect(cellsOf(periodRow)).toHaveLength(1 + periodCount);
    expect(cellsOf(periodRow)[0]).toHaveAttribute("rowspan", "2");
    expect(cellsOf(periodRow)[1]).toHaveAttribute("colspan", String(SUB_COLUMNS.length));
    // The sub-header repeats under every Period and has no label column of its own.
    expect(cellsOf(subRow)).toHaveLength(periodCount * SUB_COLUMNS.length);
    for (const row of bodyRows()) {
      expect(cellsOf(row)).toHaveLength(1 + periodCount * SUB_COLUMNS.length);
    }
  });

  // The explicit minimum is what makes two dozen columns keep their width and
  // the container scroll, rather than every column squeezing to illegible.
  it.each([5, 8, 12])("asks for the width %i Periods actually need", (periodCount) => {
    renderTable(periodCount);
    const table = screen.getByRole("table", { name: "ARR Build" });
    const groupWidth = SUB_COLUMNS.reduce((total, column) => total + column.width, 0);
    expect(table.style.minWidth).toBe(`${ROW_LABEL_WIDTH + periodCount * groupWidth}px`);
  });

  it("scrolls the table rather than the page", () => {
    renderTable(12);
    const scroller = screen.getByRole("table").parentElement!;
    expect(getComputedStyle(scroller).overflow).toBe("auto");
  });
});

describe("the row-label column, while the Periods scroll past it", () => {
  // Spec §10.19, second half. "Readable when scrolled fully right" is two
  // things: the column is pinned, and it is OPAQUE. A translucent pinned cell
  // lets the columns moving behind it show through, and the frozen pane reads
  // as a smear across the figures rather than as a pane.
  it("is pinned to the left edge", () => {
    renderTable(12);
    const label = cellsOf(bodyRows()[0])[0];
    const style = getComputedStyle(label);
    expect(style.position).toBe("sticky");
    expect(style.left).toBe("0px");
  });

  it("is opaque, so the columns moving behind it do not show through", () => {
    renderTable(12);
    for (const row of bodyRows()) {
      // rgb(), never rgba() with an alpha below 1.
      expect(getComputedStyle(cellsOf(row)[0]).backgroundColor).toMatch(/^rgb\(/);
    }
  });

  it("outranks the figures it scrolls over, and yields to the header it scrolls under", () => {
    renderTable(5);
    const labelZ = Number(getComputedStyle(cellsOf(bodyRows()[0])[0]).zIndex);
    const periodHeaderZ = Number(getComputedStyle(cellsOf(headerRows()[0])[1]).zIndex);
    const cornerZ = Number(getComputedStyle(cellsOf(headerRows()[0])[0]).zIndex);
    expect(labelZ).toBeGreaterThan(0);
    expect(periodHeaderZ).toBeGreaterThan(labelZ);
    // Sticky on both axes, so it has to beat both.
    expect(cornerZ).toBeGreaterThan(periodHeaderZ);
  });

  it("holds its width so a long customer name ellipsises instead of widening the column", () => {
    renderTable(5);
    const label = cellsOf(bodyRows()[0])[0] as HTMLElement;
    expect(label.style.width).toBe(`${ROW_LABEL_WIDTH}px`);
    expect(label.style.maxWidth).toBe(`${ROW_LABEL_WIDTH}px`);
  });
});

describe("the second header row's offset", () => {
  // Spec §10.20. MUI's stickyHeader pins EVERY header cell to top: 0 — verified
  // in @mui/material 7.3.4, TableCell.js:145-151 — so without a measured offset
  // the sub-header lands on top of the Period labels and covers the very thing
  // that says which Period a column belongs to.
  it("holds the sub-header below the Period row rather than on top of it", () => {
    renderTable(5);
    for (const headerCell of cellsOf(headerRows()[0])) {
      expect((headerCell as HTMLElement).style.top).toBe("");
    }
    for (const headerCell of cellsOf(headerRows()[1])) {
      expect((headerCell as HTMLElement).style.top).toBe("30px");
    }
  });

  it("follows the Period row changing height, which is what a resize does to it", () => {
    renderTable(5);
    measuredHeaderHeight = 52;
    act(() => window.dispatchEvent(new Event("resize")));
    for (const headerCell of cellsOf(headerRows()[1])) {
      expect((headerCell as HTMLElement).style.top).toBe("52px");
    }
  });

  // At any zoom other than 100% the true height is fractional. Rounding it
  // leaves either a hairline of the row above showing through, or an overlap
  // that eats the descenders — so the measurement is used as measured.
  it("keeps the fraction a zoomed browser reports", () => {
    renderTable(5);
    measuredHeaderHeight = 41.6;
    act(() => window.dispatchEvent(new Event("resize")));
    expect((cellsOf(headerRows()[1])[0] as HTMLElement).style.top).toBe("41.6px");
  });

  it("stops measuring once the table is gone", () => {
    const { unmount } = renderTable(5);
    const removeListener = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    removeListener.mockRestore();
  });
});

describe("the row under the pointer", () => {
  // Spec §10.21. `<TableRow hover>` cannot do this: it tints the <tr>, which
  // sits BEHIND the pinned cell's own opaque background, so the highlight runs
  // across the scrolling figures and stops dead at the row label — the one cell
  // saying which row is highlighted. jsdom cannot match :hover, so the rule
  // emotion generated is read instead.
  /** The rules that highlight a row's CELLS, as emotion generated them. */
  const cellHoverRules = (row: Element) =>
    cssRulesFor(row)
      .map((rule) => rule.replace(/\s*>\s*/g, ">"))
      .filter((rule) => /:hover>(th|td)/.test(rule));

  it("is highlighted per cell, reaching the pinned label as well as the figures", () => {
    renderTable(5);
    const selectors = cellHoverRules(bodyRows()[0]).join(" ");
    // The row label is a <th scope="row">, so a rule reaching only <td> would
    // leave out exactly the cell this exists for.
    expect(selectors).toContain(":hover>th");
    expect(selectors).toContain(":hover>td");
  });

  it("paints the highlight opaquely, so it survives on the pinned cell", () => {
    renderTable(5);
    const rule = cellHoverRules(bodyRows()[0]).join(" ");
    // A translucent background-color alone would let the scrolling columns show
    // through the pinned cell. The tint is composited inside the cell instead.
    expect(rule).toContain("background-image");
    expect(rule).toContain("linear-gradient");
  });

  // MUI's own row highlight is `.MuiTableRow-hover:hover { background-color:
  // rgba(0,0,0,0.04) }` — a translucent fill on the <tr>, which is exactly the
  // mechanism ADR 0004 records as unusable here. It ships in the same generated
  // sheet; what matters is that no row ever wears the class that turns it on.
  it("does not use MUI's own row hover, which is the mechanism that fails here", () => {
    renderTable(5);
    for (const row of bodyRows()) {
      expect(row.className).not.toContain("MuiTableRow-hover");
    }
  });
});

describe("borders", () => {
  // stickyHeader forces border-collapse: separate, under which the collapsed
  // shorthand does nothing at all. Every border here is placed on a cell.
  it("are placed per cell, because the table cannot place them", () => {
    renderTable(5);
    const table = screen.getByRole("table");
    expect(getComputedStyle(table).borderCollapse).toBe("separate");
    expect(getComputedStyle(cellsOf(bodyRows()[0])[1]).borderBottomWidth).not.toBe("");
  });

  it("separates one Period from the next, but not the first from the pinned column", () => {
    renderTable(5);
    const figures = cellsOf(bodyRows()[0]).slice(1);
    // The first Period's Amount sits against the pinned column's own right
    // edge; a second border there would be drawn twice, not merged.
    expect(getComputedStyle(figures[0]).borderLeftWidth).toBe("");
    expect(getComputedStyle(figures[2]).borderLeftWidth).not.toBe("");
    // Only on the first sub-column of a Period — not between Amount and % Open.
    expect(getComputedStyle(figures[3]).borderLeftWidth).toBe("");
  });
});

describe("what a screen reader can say about a figure", () => {
  // With 24 numeric columns, `scope` and `colSpan` are not enough: they let a
  // reader announce "1,240,000" with no way to say which Period it came from.
  // Every data cell names its row, its Period and its sub-column explicitly.
  it("points every figure at its row, its Period and its sub-column", () => {
    renderTable(5);
    const figure = cellsOf(bodyRows()[0])[1];
    const named = figure.getAttribute("headers")!.split(" ");
    expect(named).toHaveLength(3);

    const [rowHeader, periodHeader, subHeader] = named.map((id) => document.getElementById(id));
    expect(rowHeader).not.toBeNull();
    // Resolved, not merely present: an id that points at the wrong cell reads
    // exactly like one that points at the right one.
    expect(rowHeader).toHaveTextContent("Opening ARR");
    expect(periodHeader).toHaveTextContent("FY2020");
    expect(subHeader).toHaveTextContent("Amount");
  });

  it("resolves every reference in the whole table, not just the first", () => {
    renderTable(8);
    const dangling: string[] = [];
    for (const row of bodyRows()) {
      for (const figure of cellsOf(row).slice(1)) {
        for (const id of figure.getAttribute("headers")!.split(" ")) {
          if (!document.getElementById(id)) dangling.push(id);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("gives the table and its row labels their proper roles", () => {
    renderTable(5);
    expect(screen.getByRole("table", { name: "ARR Build" })).toBeInTheDocument();
    expect(cellsOf(bodyRows()[0])[0].tagName).toBe("TH");
    expect(cellsOf(bodyRows()[0])[0]).toHaveAttribute("scope", "row");
  });
});

describe("opening and closing a section", () => {
  it("opens as the summary a Build is meant to be", () => {
    renderTable(5);
    expect(bodyRows()).toHaveLength(4);
    expect(screen.queryByText("APIM")).not.toBeInTheDocument();
  });

  it("shows what a section holds, one level at a time", async () => {
    const user = userEvent.setup();
    renderTable(5);

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText("APIM")).toBeInTheDocument();
    // One level at a time: opening the movement does not open the unit under it.
    expect(screen.queryByText("Northwind Bank")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "APIM" }));
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
  });

  it("takes the whole subtree away again, not just the level below", async () => {
    const user = userEvent.setup();
    renderTable(5);
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("button", { name: "APIM" }));
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.queryByText("APIM")).not.toBeInTheDocument();
    expect(screen.queryByText("Northwind Bank")).not.toBeInTheDocument();
  });

  it("says whether a section is open", async () => {
    const user = userEvent.setup();
    renderTable(5);
    const toggle = screen.getByRole("button", { name: "New" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "New" })).toHaveAttribute("aria-expanded", "true");
  });

  it("offers no control on a row that holds nothing", () => {
    renderTable(5);
    expect(screen.queryByRole("button", { name: "Opening ARR" })).not.toBeInTheDocument();
  });

  it("opens the sections the caller asks for", () => {
    render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        rows={ROWS}
        cell={cell}
        defaultExpandedIds={["new", "new-apim"]}
      />,
    );
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
  });

  // A refetch, or a change of Period, must not blow open a tree the reader had
  // closed — or reading a Build becomes a fight with the screen.
  it("keeps what the reader opened when the rows are replaced", async () => {
    const user = userEvent.setup();
    const { rerender } = renderTable(5);
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText("APIM")).toBeInTheDocument();

    rerender(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        // Same ids, new objects — what a refetch produces.
        rows={structuredClone(ROWS)}
        cell={cell}
      />,
    );
    expect(screen.getByText("APIM")).toBeInTheDocument();
  });
});

describe("the figures themselves", () => {
  // Formatting is injected. The Build shows currency, counts and percentages in
  // the same column and only currency is scaled (spec §3), so the row's own
  // formatter decides — this table must not second-guess it.
  it("shows exactly what the caller formatted, in the right cell", () => {
    renderTable(5);
    const figures = cellsOf(bodyRows()[0]).slice(1);
    expect(figures[0]).toHaveTextContent("opening/fy2020/amount");
    expect(figures[1]).toHaveTextContent("opening/fy2020/pct");
    expect(figures[2]).toHaveTextContent("opening/fy2021/amount");
  });

  it("asks the caller for every figure on screen, and for no others", () => {
    const spy = vi.fn(cell);
    render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        rows={[{ id: "opening", label: "Opening ARR" }]}
        cell={spy}
      />,
    );
    // The SET of figures, not the number of calls: measuring the header row
    // settles a height and re-renders once, so a call count would be counting
    // renders rather than figures.
    const asked = new Set(
      spy.mock.calls.map(([row, group, subColumn]) => `${row.id}/${group.key}/${subColumn.key}`),
    );
    expect(asked.size).toBe(5 * SUB_COLUMNS.length);
    expect(asked.has("opening/fy2024/pct")).toBe(true);
  });

  // Not asked for rows nobody can see: with no windowing yet (ticket 07), a
  // closed section must cost nothing rather than merely look as though it does.
  it("asks for nothing on a row a closed section is hiding", () => {
    const spy = vi.fn(cell);
    render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        rows={ROWS}
        cell={spy}
      />,
    );
    expect(spy.mock.calls.some(([row]) => row.id === "new-apim")).toBe(false);
  });

  it("marks a figure that subtracts, and mutes one that is subordinate", () => {
    renderTable(5);
    const lostRow = bodyRows().find((row) => row.textContent?.includes("Lost"))!;
    const amount = cellsOf(lostRow)[1];
    const openingPct = cellsOf(bodyRows()[0])[2];
    expect(getComputedStyle(amount).color).not.toBe(getComputedStyle(cellsOf(bodyRows()[0])[1]).color);
    expect(getComputedStyle(openingPct).color).not.toBe(getComputedStyle(cellsOf(bodyRows()[0])[1]).color);
  });

  it("draws the rule an accountant draws above a total", () => {
    renderTable(5);
    const closing = bodyRows().find((row) => row.textContent?.includes("Ending ARR"))!;
    expect(cssRulesFor(closing).join(" ")).toContain("border-top");
  });
});

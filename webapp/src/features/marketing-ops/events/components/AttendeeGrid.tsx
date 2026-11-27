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

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  Autocomplete,
  Box,
  Checkbox,
  MenuItem,
  Select as MuiSelect,
  TextField,
  Tooltip,
} from "@wso2/oxygen-ui";
import { Check, ChevronDown, X } from "@wso2/oxygen-ui-icons-react";
import { COMPUTED_FIELDS, defOf, labelOf, type EventsConfig, type Tab } from "../rules/schema";
import { columnsFor } from "../rules/columns";
import type { GridRow } from "../rules/model";
import type { Issue } from "../rules/validate";
import { NOT_ENGLISH } from "../rules/titles";
import { LEAVE_MS, tint, useToneColors, type ToneColors } from "./eventsStyles";

// The attendee grid — a plain table, deliberately.
//
// This replaced react-datasheet-grid, which was the wrong tool. That library owns the
// cell: its own focus model, virtualized rows, columns as memoized descriptors. Everything
// custom fought it — the accept button died between mousedown and mouseup because a fresh
// component identity remounted the cell; header counts froze because React skips
// re-rendering a memoized element, and the frozen one held a stale handler that reverted
// other edits; dropdowns had to be un-portalled to survive the focus model, which trapped
// them in the grid's scroll context; and its viewport maths put the last row under the
// horizontal scrollbar.
//
// It was chosen when RMMs were going to TYPE their lists in, so Excel paste and drag-fill
// were headline requirements. Drafting now happens in Google Sheets and this screen
// corrects a handful of flagged cells across a few hundred rows. A spreadsheet engine buys
// nothing here and costs a great deal.
//
// So: ordinary DOM, ordinary React, ordinary MUI. Dropdowns portal normally and take the
// app's theme. One cell edits at a time. Keyboard movement is a few lines, not a subsystem.
//
// Rows are WINDOWED: only the rows in view (plus a margin) are in the DOM, with a spacer
// row above and below standing in for the rest. Every cell carries its own styles, so
// building all of them for a list of several hundred rows stalls a tab switch or a
// dismissed banner. Rows are a fixed height, so the visible range is a multiplication
// and needs no library.
//
// Each row is also memoised (GridRowView), so a change elsewhere on the page — a banner
// dismissed, the save indicator ticking — re-renders none of them.

export interface CellRef {
  row_id: string;
  field: string;
}

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 32;
const CELL_FONT = 12;
const GUTTER_WIDTH = 46;
/** Above this many options a menu is worse than typing, so switch to type-ahead.
 *  Comfortably fits the 63 US states; nowhere near the 241 countries. */
const LIST_AS_SELECT = 80;

const CELL_PADDING = 18;
/** Reserved for the accept/reject pair so it never eats the values. */
const ACTIONS_WIDTH = 46;
/** The arrow between an old value and its replacement. */
const ARROW_WIDTH = 18;
const MIN_WIDTH = 90;

/** Room kept below the grid for the hint line and the page's own padding, so growing the
 *  grid never pushes the window into scrolling. */
const BELOW_GRID = 96;
/** Never squeeze the grid smaller than this, however short the window. */
const MIN_GRID_HEIGHT = 220;
/** Rows kept in the DOM beyond each edge of the viewport, so a fast scroll never shows
 *  blank rows before React catches up. */
const OVERSCAN = 15;

/** Past this a column stops being readable and starts being a wall. Notes and address are
 *  prose and get a longer leash; everything else is a field value. */
const maxWidth = (field: string) =>
  field === "lead_notes" || field === "address" ? 380 : 300;

// The cell being edited, held by ROW ID rather than position.
//
// Position was fine while the grid always showed every row. It stops being fine the moment
// rows can leave the view: fix the last name on row 17, the filter drops it, and index 17
// now addresses a different person — so arrow-down would land on the wrong row and, worse,
// commit into it. An id survives filtering, sorting and deletion.
interface Editing {
  rowId: string;
  field: string;
}

/** Fields we own. Editing one was always futile — the next derive overwrote it — so the
 *  cell REFUSES the edit rather than accepting it and quietly discarding it. */
const isComputed = (field: string) => COMPUTED_FIELDS.includes(field);

// May this cell legitimately be left empty?
//
// A menu used to offer "—" on every field, including required ones, so you could pick a
// value whose only possible outcome was the cell turning red and telling you it was
// required. A choice that can only produce a complaint is not a choice.
//
// State isn't marked mandatory — whether it's required depends on the row's country — but
// the grid only ever offers a state list for countries that require one, so wherever this
// is asked about state the answer is no.
function isClearable(field: string, tab: Tab, config: EventsConfig): boolean {
  if (defOf(config, tab, field)?.mandatory) return false;
  if (field === "state") return false;
  return true;
}

// Measure text in the grid's own font.
//
// Column widths used to be three hardcoded guesses made without knowing what was in the
// column — which is how a 130px Country cell ended up trying to show "United States", an
// arrow, "Netherlands" and two buttons, and truncated all of it. Nobody should be asked to
// accept a change they cannot read.
//
// A canvas measures exactly what the browser will paint, and results are cached by string
// so re-measuring a column of repeated countries costs nothing.
function makeMeasurer(): (s: string) => number {
  const cache = new Map<string, number>();
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = "12px 'Inter', system-ui, -apple-system, sans-serif";
  } catch {
    // No canvas (jsdom, older engines) — fall through to the estimate below.
  }
  return (s: string) => {
    if (!s) return 0;
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    // 6.4px per character is a decent mean for Inter at 12px; only ever a fallback.
    const w = ctx ? ctx.measureText(s).width : s.length * 6.4;
    cache.set(s, w);
    return w;
  };
}

export default function AttendeeGrid({
  rows,
  tab,
  editable,
  busy,
  onEdit,
  onAccept,
  onReject,
  onDeleteRow,
  jumpTo,
  jumpToRow,
  focusField,
  optionsFor,
  height,
  fill,
  toolbar,
  attached,
  selected,
  onToggleRow,
  onToggleAll,
  measureRows,
  rowNumber,
  leavingRows,
  config,
}: {
  rows: GridRow[];
  tab: Tab;
  editable: boolean;
  busy: boolean;
  onEdit: (edits: { row_id: string; field: string; value: string }[]) => void;
  onAccept: (cells: CellRef[]) => void;
  onReject: (cells: CellRef[]) => void;
  onDeleteRow?: (rowId: string) => void;
  /** Scroll this column into view. Bump `nonce` to re-trigger for the same field. */
  jumpTo?: { field: string; nonce: number };
  /** Scroll this row into view and mark it briefly. Used by the change list, where "show
   *  me that one" means a row on a tab of several hundred — a highlighted column alone
   *  still leaves you scanning for it. */
  jumpToRow?: { rowId: string; nonce: number };
  /** Column to highlight — the one picked in the issue bar. */
  focusField?: string;
  /** Allowed values for a cell when the field is a picklist. Takes the ROW because
   *  state's options follow that row's country. */
  optionsFor?: (field: string, row: GridRow) => string[] | undefined;
  height?: number;
  /** Take all the height the parent gives it (a flex column) instead of measuring the
   *  window. Used by the expanded view, where the parent IS the window. */
  fill?: boolean;
  /** Chrome rendered inside the frame, above the scroll area. */
  toolbar?: ReactNode;
  /** Square off the top so the frame reads as the body of the tab rail above it. */
  attached?: boolean;
  /** Rows on their way out of a filtered view: flashed, then faded. */
  leavingRows?: Set<string>;
  /** Where column headings and mandatory-ness come from. */
  config: EventsConfig;
  /** Row ids ticked for a bulk edit. Selection lives in the GUTTER and nowhere near the
   *  cell renderer — the one part of this grid that must stay boring. */
  selected?: Set<string>;
  onToggleRow?: (rowId: string) => void;
  onToggleAll?: () => void;
  /** Every row on the tab, filtered or not. Column widths are measured against this so
   *  hiding rows doesn't reflow the table under the user. */
  measureRows?: GridRow[];
  /** A row's 1-based position in the FULL tab. Without this a filtered view renumbers from
   *  1, and the submit report — which cites absolute positions — would name rows the grid
   *  disagrees with. */
  rowNumber?: (row: GridRow, indexInView: number) => number;
}) {
  const tones = useToneColors();
  const columns = useMemo(() => columnsFor(rows, tab, config), [rows, tab, config]);
  const selectable = Boolean(selected && onToggleRow);
  const gutter = selectable ? GUTTER_WIDTH + 26 : GUTTER_WIDTH;
  const allOn = selectable && rows.length > 0 && rows.every((r) => selected!.has(r.id));
  const someOn = selectable && !allOn && rows.some((r) => selected!.has(r.id));
  const [widths, setWidths] = useState<Record<string, number>>({});
  // Tab-scoped: switching tab must drop the open editor, because the cell it referred to
  // isn't on screen any more. Carrying the tab ON the state and derivING `editing` from it
  // does that during render — resetting it in an effect meant one render where the editor
  // was open on a cell that no longer existed.
  const [held, setHeld] = useState<(Editing & { tab: Tab }) | null>(null);
  const editing = held && held.tab === tab ? held : null;
  const setEditing = useCallback(
    (next: Editing | null) => setHeld(next ? { ...next, tab } : null),
    [tab],
  );

  const headRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const drag = useRef<{ field: string; startX: number; startW: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // How tall the grid is ALLOWED to get: everything between its top edge and the bottom of
  // the window, less the hint below it.
  //
  // A cap, not a height — the frame is still only as tall as its rows, so eight rows don't
  // become a tall empty box. It replaces a flat 520px that ignored the screen entirely and
  // put a scrollbar on a list of fifteen with half the window unused.
  //
  // Measured rather than a `calc(100vh - …)` because what sits above the grid MOVES: a
  // sent-back banner, the upload summary, the issue bar growing to two lines.
  const [available, setAvailable] = useState<number | null>(null);
  useEffect(() => {
    if (height || fill) return; // an explicit height, or the parent's, wins
    const measure = () => {
      const el = scrollRef.current;
      if (!el) return;
      // Offset within the DOCUMENT, not the viewport. A viewport-relative top shrinks as
      // you scroll down, which would make the cap grow the further you scrolled — the grid
      // quietly gaining height while you read it.
      const top = el.getBoundingClientRect().top + window.scrollY;
      setAvailable(Math.max(MIN_GRID_HEIGHT, window.innerHeight - top - BELOW_GRID));
    };
    measure();
    window.addEventListener("resize", measure);
    // Anything above the grid changing height moves its top edge.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [height, fill]);

  /** What each column needs to show its widest cell in full — including, for a cell with a
   *  suggestion, BOTH values, the arrow and the two buttons. Recomputed when the data
   *  changes so accepting a fix can let a column relax again. */
  const fitted = useMemo(() => {
    const measure = makeMeasurer();
    const out: Record<string, number> = {};
    const measured = measureRows ?? rows;
    for (const field of columns) {
      let widest = measure(labelOf(config, tab, field));
      for (const row of measured) {
        const value = row.data[field] ?? "";
        const issue = row.issues.find((i) => i.field === field);
        const needed = issue?.suggestion
          ? measure(value) + ARROW_WIDTH + measure(issue.suggestion) + ACTIONS_WIDTH
          : issue
            ? measure(value || issue.message)
            : measure(value);
        if (needed > widest) widest = needed;
      }
      out[field] = Math.min(maxWidth(field), Math.max(MIN_WIDTH, Math.ceil(widest) + CELL_PADDING));
    }
    return out;
  }, [rows, measureRows, columns, config, tab]);

  // A width the user DRAGGED always wins: measuring is a better starting guess, not a
  // policy about how wide their screen should be.
  const widthFor = useCallback(
    (field: string) => widths[field] ?? fitted[field] ?? MIN_WIDTH,
    [widths, fitted],
  );

  // Scroll a column into view when the issue bar asks. A tab is twenty columns wide, so
  // "there is a problem in Content offer" has to come with a way to reach it.
  useEffect(() => {
    if (!jumpTo) return;
    headRefs.current[jumpTo.field]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [jumpTo]);

  // Bring one row into view and mark it for a moment. The mark matters as much as the
  // scroll: landing mid-grid with nothing indicated leaves you guessing which of the twenty
  // visible rows was meant.
  //
  // The mark itself is DERIVED from the request rather than set alongside the scroll: a request
  // is marked until its own timer says it is spent. Each ask carries a nonce, so asking
  // twice for the same row flashes it twice.
  const [spent, setSpent] = useState<number | null>(null);
  // The rendered row height, measured below (windowing). Declared here because the jump
  // reads it too.
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT);
  const flashed = jumpToRow && jumpToRow.nonce !== spent ? jumpToRow.rowId : null;
  useEffect(() => {
    if (!jumpToRow) return;
    // By index, not by element: with windowing a far-away row isn't in the DOM to scroll to.
    const at = rows.findIndex((r) => r.id === jumpToRow.rowId);
    const el = scrollRef.current;
    if (at >= 0 && el) {
      el.scrollTo({
        top: Math.max(0, HEADER_HEIGHT + at * rowHeight - el.clientHeight / 2 + rowHeight / 2),
        behavior: "smooth",
      });
    }
    const t = setTimeout(() => setSpent(jumpToRow.nonce), 1600);
    return () => clearTimeout(t);
    // Deliberately only on a new request: re-running when `rows` changes would yank the
    // view back to the row after every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToRow]);

  // ---- windowing --------------------------------------------------------------------------
  //
  // Which rows are in the DOM: those inside the scroll viewport, plus OVERSCAN either side
  // so a quick scroll doesn't show blank rows before React catches up.
  const [view, setView] = useState({ top: 0, height: 0 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setView((v) =>
        v.top === el.scrollTop && v.height === el.clientHeight
          ? v
          : { top: el.scrollTop, height: el.clientHeight },
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  // A different tab is a different list: start it at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  // The real row height, read from the DOM once a row exists. ROW_HEIGHT is the cell's
  // height; the bottom border adds to it, and guessing wrong drifts the spacers by a pixel
  // a row — 800 pixels by the end of a long list.
  const tbodyRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const first = tbodyRef.current?.querySelector<HTMLElement>("tr[data-row]");
    const h = first?.getBoundingClientRect().height;
    if (h && Math.abs(h - rowHeight) > 0.5) setRowHeight(h);
  }, [rowHeight, rows.length, tab]);

  const editingIndex = editing ? rows.findIndex((r) => r.id === editing.rowId) : -1;
  const bodyTop = Math.max(0, view.top - HEADER_HEIGHT);
  let first = Math.max(0, Math.floor(bodyTop / rowHeight) - OVERSCAN);
  let last = Math.min(
    rows.length,
    Math.ceil((bodyTop + (view.height || 600)) / rowHeight) + OVERSCAN,
  );
  // The row being edited always stays in the DOM. Scrolled out of the window it would
  // unmount, and an input removed from the page fires no blur — whatever was typed would
  // be lost without a word.
  if (editingIndex >= 0) {
    first = Math.min(first, editingIndex);
    last = Math.max(last, editingIndex + 1);
  }

  // Keyboard movement can step onto a row outside the viewport; bring it in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || editingIndex < 0) return;
    const top = HEADER_HEIGHT + editingIndex * rowHeight;
    if (top < el.scrollTop + HEADER_HEIGHT) el.scrollTop = top - HEADER_HEIGHT;
    else if (top + rowHeight > el.scrollTop + el.clientHeight)
      el.scrollTop = top + rowHeight - el.clientHeight;
    // Only when the edited cell moves, not on every scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.rowId, editing?.field]);

  // Handlers the rows call, made STABLE so memoised rows don't re-render because a parent
  // passed a fresh arrow function. Each reads the latest prop through a ref.
  const latest = useRef({ onEdit, onAccept, onReject, onDeleteRow, onToggleRow, optionsFor, setEditing });
  useLayoutEffect(() => {
    latest.current = { onEdit, onAccept, onReject, onDeleteRow, onToggleRow, optionsFor, setEditing };
  });
  const rowApi = useMemo<RowApi>(
    () => ({
      edit: (edits) => latest.current.onEdit(edits),
      accept: (cells) => latest.current.onAccept(cells),
      reject: (cells) => latest.current.onReject(cells),
      deleteRow: (id) => latest.current.onDeleteRow?.(id),
      toggleRow: (id) => latest.current.onToggleRow?.(id),
      options: (field, row) => latest.current.optionsFor?.(field, row),
      setEditing: (next) => latest.current.setEditing(next),
    }),
    [],
  );

  const startResize = useCallback(
    (field: string, e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      drag.current = { field, startX: e.clientX, startW: widthFor(field) };
      const move = (ev: MouseEvent) => {
        const d = drag.current;
        if (d) setWidths((w) => ({ ...w, [d.field]: Math.max(70, d.startW + ev.clientX - d.startX) }));
      };
      const up = () => {
        drag.current = null;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [widthFor],
  );

  // Keyboard movement between cells.
  //
  // Up and down move rows: vertical caret motion means nothing in a one-line input, so
  // there's nothing to compete with. Tab moves sideways.
  //
  // Left and right are deliberately NOT bound, and this has been tried. They belong to the
  // caret — take them and you can never step back a character to fix a typo. An edge-aware
  // version (move only from position zero or the end, as Excel does) was built and
  // rejected: the mode switch under your fingers isn't worth it when Tab already goes
  // sideways.
  function onKeyDown(e: ReactKeyboardEvent) {
    if (!editing) return;
    const col = columns.indexOf(editing.field);
    const at = rows.findIndex((r) => r.id === editing.rowId);
    if (at < 0) return;

    // Save what's in the box before leaving it.
    //
    // A text cell commits on BLUR, and moving with the keyboard never blurs it: we swap
    // `editing` to another cell, React unmounts the input, and the DOM fires no blur for a
    // node that was simply removed. Every keystroke typed was discarded the moment you
    // pressed the down arrow. Clicking away always worked, which is why this survived —
    // focus genuinely moves there.
    //
    // Only inputs the cell editor MARKS are read. A menu-backed cell has already committed
    // through onChange, and MUI's hidden select input would hand us the wrong string.
    const commitInFlight = () => {
      const el = document.activeElement as HTMLInputElement | null;
      if (!el || el.dataset?.cellInput !== "text") return;
      const row = rows[at];
      if (row && (row.data[editing.field] ?? "") !== el.value) {
        onEdit([{ row_id: row.id, field: editing.field, value: el.value }]);
      }
    };

    const go = (rowIndex: number, colIndex: number) => {
      e.preventDefault();
      // Resolve the destination against the CURRENT rows, before committing: the commit may
      // remove the row we're leaving, and every index after it would shift.
      const target = rows[Math.max(0, Math.min(rows.length - 1, rowIndex))];
      commitInFlight();
      if (!target) {
        setEditing(null);
        return;
      }
      setEditing({
        rowId: target.id,
        field: columns[Math.max(0, Math.min(columns.length - 1, colIndex))],
      });
    };

    // Escape deliberately does NOT commit — that's what makes it a cancel.
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    } else if (e.key === "Enter" || e.key === "ArrowDown") go(at + 1, col);
    else if (e.key === "ArrowUp") go(at - 1, col);
    else if (e.key === "Tab") go(at, e.shiftKey ? col - 1 : col + 1);
  }

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.25,
        overflow: "hidden",
        // Fused to the tab rail above: its bottom border IS this frame's top edge, so the
        // grid reads as the contents of the selected tab rather than a separate object.
        ...(attached ? { borderTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}),
        // minHeight 0 is what lets a flex child shrink below its content and scroll.
        ...(fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}),
      }}
    >
      {/* Chrome for the surface — undo/redo, what needs attention. Inside the frame so it
          belongs to the grid, above the scroll area so it never scrolls away. */}
      {toolbar && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.4,
            minHeight: 34,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          {toolbar}
        </Box>
      )}
      <Box
        ref={scrollRef}
        sx={{
          // The scrollbar lives below the last row instead of on top of it, which is what
          // made the final row impossible to click before.
          overflow: "auto",
          ...(fill ? { flex: 1, minHeight: 0 } : { maxHeight: height ?? available ?? 520 }),
          position: "relative",
        }}
      >
        <Box
          component="table"
          sx={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%" }}
        >
          <Box component="thead">
            <Box component="tr">
              <Box
                component="th"
                sx={{
                  ...headCell,
                  width: gutter,
                  minWidth: gutter,
                  left: 0,
                  zIndex: 3,
                  textAlign: "center",
                  ...gutterEdge,
                }}
              >
                {selectable && (
                  <Tooltip
                    title={allOn ? "Clear the selection" : "Select every row on this tab"}
                    arrow
                  >
                    <Checkbox
                      size="small"
                      checked={allOn}
                      indeterminate={someOn}
                      onChange={onToggleAll}
                      inputProps={{ "aria-label": "Select every row on this tab" }}
                      sx={checkboxSx}
                    />
                  </Tooltip>
                )}
              </Box>
              {columns.map((field) => (
                <Box
                  component="th"
                  key={field}
                  ref={(el: HTMLTableCellElement | null) => {
                    headRefs.current[field] = el;
                  }}
                  sx={{
                    ...headCell,
                    position: "sticky",
                    width: widthFor(field),
                    minWidth: widthFor(field),
                    ...(focusField === field ? focusColumn(tones.accent) : {}),
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", px: 1, height: "100%" }}>
                    <Box
                      component="span"
                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {labelOf(config, tab, field)}
                    </Box>
                  </Box>
                  <Box
                    onMouseDown={(e) => startResize(field, e)}
                    sx={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 7,
                      cursor: "col-resize",
                      "&:hover": { bgcolor: tint(tones.accent, 0.25) },
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>

          <Box component="tbody" onKeyDown={onKeyDown} ref={tbodyRef}>
            {first > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length + 1} style={{ height: first * rowHeight, padding: 0, border: 0 }} />
              </tr>
            )}
            {rows.slice(first, last).map((row, i) => {
              const rowIndex = first + i;
              return (
                <GridRowView
                  key={row.id}
                  row={row}
                  number={rowNumber ? rowNumber(row, rowIndex) : rowIndex + 1}
                  columns={columns}
                  widthFor={widthFor}
                  gutter={gutter}
                  editable={editable}
                  busy={busy}
                  selectable={selectable}
                  isSelected={Boolean(selected?.has(row.id))}
                  canDelete={Boolean(editable && onDeleteRow)}
                  flashed={flashed === row.id}
                  leaving={Boolean(leavingRows?.has(row.id))}
                  focusField={focusField}
                  editingField={editing?.rowId === row.id ? editing.field : null}
                  tab={tab}
                  config={config}
                  tones={tones}
                  api={rowApi}
                />
              );
            })}
            {last < rows.length && (
              <tr aria-hidden>
                <td
                  colSpan={columns.length + 1}
                  style={{ height: (rows.length - last) * rowHeight, padding: 0, border: 0 }}
                />
              </tr>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** What a row may do, as stable functions — see `rowApi` in AttendeeGrid. */
interface RowApi {
  edit: (edits: { row_id: string; field: string; value: string }[]) => void;
  accept: (cells: CellRef[]) => void;
  reject: (cells: CellRef[]) => void;
  deleteRow: (rowId: string) => void;
  toggleRow: (rowId: string) => void;
  options: (field: string, row: GridRow) => string[] | undefined;
  setEditing: (next: Editing | null) => void;
}

// One row, memoised. Every prop is either data that changes only when THIS row's display
// does, or stable — so editing one cell re-renders one row, and anything outside the grid
// re-renders none. Keep it that way: an inline object or arrow passed here quietly turns
// the memo off for every row.
const GridRowView = memo(function GridRowView({
  row,
  number,
  columns,
  widthFor,
  gutter,
  editable,
  busy,
  selectable,
  isSelected,
  canDelete,
  flashed,
  leaving,
  focusField,
  editingField,
  tab,
  config,
  tones,
  api,
}: {
  row: GridRow;
  number: number;
  columns: string[];
  widthFor: (field: string) => number;
  gutter: number;
  editable: boolean;
  busy: boolean;
  selectable: boolean;
  isSelected: boolean;
  canDelete: boolean;
  flashed: boolean;
  leaving: boolean;
  focusField?: string;
  editingField: string | null;
  tab: Tab;
  config: EventsConfig;
  tones: ToneColors;
  api: RowApi;
}) {
  return (
    <Box
      component="tr"
      data-row=""
      sx={{
        "&:hover .evt-del": { opacity: 1 },
        ...(flashed ? { "& > td": { bgcolor: tint(tones.accent, 0.11) } } : {}),
        // Seen LEAVING, not teleported away: a beat of green to say "that one is
        // done", then out. Applied per cell because a <tr> background sits behind
        // the <td> backgrounds the grid already sets.
        ...(leaving
          ? {
              pointerEvents: "none",
              "& > td": { animation: `evtLeave ${LEAVE_MS}ms ease-out forwards` },
              "@keyframes evtLeave": {
                "0%": { opacity: 1, backgroundColor: tint(tones.accepted, 0) },
                "12%": { opacity: 1, backgroundColor: tint(tones.accepted, 0.22) },
                "60%": { opacity: 1, backgroundColor: tint(tones.accepted, 0.22) },
                "100%": { opacity: 0, backgroundColor: tint(tones.accepted, 0) },
              },
              "@media (prefers-reduced-motion: reduce)": {
                "& > td": {
                  animation: "none",
                  backgroundColor: tint(tones.accepted, 0.19),
                },
              },
            }
          : {}),
      }}
    >
      <Box
        component="td"
        sx={{
          ...bodyCell,
          width: gutter,
          position: "sticky",
          left: 0,
          zIndex: 1,
          textAlign: "center",
          fontSize: 10,
          color: "text.disabled",
          ...gutterEdge,
          ...(isSelected ? tinted(tint(tones.accent, 0.07)) : { bgcolor: "background.paper" }),
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25 }}>
          {selectable && (
            <Checkbox
              size="small"
              checked={isSelected}
              onChange={() => api.toggleRow(row.id)}
              inputProps={{ "aria-label": `Select row ${number}` }}
              sx={checkboxSx}
            />
          )}
          {number}
          {canDelete && (
            <Tooltip title="Remove this row">
              <Box
                component="span"
                className="evt-del"
                onMouseDown={fire(() => api.deleteRow(row.id), busy)}
                sx={{
                  display: "inline-flex",
                  opacity: 0,
                  cursor: "pointer",
                  color: "error.main",
                  transition: "opacity .12s",
                }}
              >
                <X size={11} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>

      {columns.map((field) => (
        <Cell
          key={field}
          row={row}
          field={field}
          width={widthFor(field)}
          editable={editable}
          busy={busy}
          focused={focusField === field}
          isEditing={editingField === field}
          options={api.options(field, row)}
          clearable={isClearable(field, tab, config)}
          tones={tones}
          onStartEdit={() => editable && !isComputed(field) && api.setEditing({ rowId: row.id, field })}
          onStopEdit={() => api.setEditing(null)}
          onCommit={(value) => {
            if ((row.data[field] ?? "") !== value) {
              api.edit([{ row_id: row.id, field, value }]);
            }
          }}
          onAccept={api.accept}
          onReject={api.reject}
        />
      ))}
    </Box>
  );
});

function Cell({
  row,
  field,
  width,
  editable,
  busy,
  focused,
  isEditing,
  options,
  clearable,
  tones,
  onStartEdit,
  onStopEdit,
  onCommit,
  onAccept,
  onReject,
}: {
  row: GridRow;
  field: string;
  width: number;
  editable: boolean;
  busy: boolean;
  focused: boolean;
  isEditing: boolean;
  options?: string[];
  /** Whether the menu offers an empty choice — false on fields that must have a value. */
  clearable: boolean;
  tones: ToneColors;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onCommit: (value: string) => void;
  onAccept: (cells: CellRef[]) => void;
  onReject: (cells: CellRef[]) => void;
}) {
  const value = row.data[field] ?? "";
  const issue: Issue | undefined = row.issues.find((i) => i.field === field);
  const shade = issue ? (issue.suggestion ? tones.suggested : tones.blocking) : undefined;

  // Changed since import.
  //
  // Marked on the VALUE, not on the cell. A corner triangle was tried and was wrong twice
  // over: sitting on the boundary it read as belonging to either neighbour, and at the
  // top-right it landed directly against the next cell's issue bar — two unrelated marks
  // touching, which looked like one broken thing. An underline is unambiguous about what it
  // refers to and never approaches an edge.
  const changed = !issue && (row.original?.[field] ?? "") !== value;
  const was = row.original?.[field] ?? "";

  // Compose the two highlights rather than letting one win. Focusing a column used to
  // overwrite the per-cell tint, so the column you were sent to look at was the one place
  // you could no longer see which rows were wrong.
  //
  // Inside a focused column the problem cells get a STRONGER fill and the clean ones a
  // fainter wash, so the rows needing attention are what stands out.
  const shadow = [
    shade ? `inset 3px 0 0 ${shade}` : "",
    focused
      ? `inset 0 1px 0 ${tint(tones.accent, 0.19)}, inset 0 -1px 0 ${tint(tones.accent, 0.19)}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  const background = shade
    ? tint(shade, focused ? 0.13 : 0.055)
    : focused
      ? tint(tones.accent, 0.027)
      : undefined;

  return (
    <Box
      component="td"
      onClick={() => !isEditing && onStartEdit()}
      sx={{
        ...bodyCell,
        width,
        minWidth: width,
        maxWidth: width,
        cursor: editable ? "text" : "default",
        ...(background ? { bgcolor: background } : {}),
        ...(shadow ? { boxShadow: shadow } : {}),
      }}
    >
      {isEditing ? (
        <Editor
          value={value}
          options={options}
          clearable={clearable}
          onCommit={onCommit}
          onDone={onStopEdit}
        />
      ) : issue ? (
        <Diff
          issue={issue}
          value={value}
          editable={editable}
          busy={busy}
          tones={tones}
          cell={[{ row_id: row.id, field }]}
          onAccept={onAccept}
          onReject={onReject}
        />
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", px: 1, height: "100%", gap: 0.25 }}>
          <Box
            component="span"
            sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {changed ? (
              <Tooltip arrow placement="top" title={was ? `Was "${was}"` : "Was empty"}>
                {/* The underline hugs the TEXT rather than the cell, so it can't be read as
                    belonging to the column next door. A cleared cell keeps a short stub of
                    it — otherwise the one change with nothing left to underline would be
                    the only invisible one. */}
                <Box
                  component="span"
                  sx={{
                    // Dashed, not solid: a solid rule under text reads as emphasis, a
                    // dashed one reads as an annotation about it.
                    borderBottom: `1.5px dashed ${tones.changed}`,
                    pb: "1px",
                    ...(value ? {} : { display: "inline-block", width: 16 }),
                  }}
                >
                  {value}
                </Box>
              </Tooltip>
            ) : (
              value
            )}
          </Box>
          {editable && options && options.length >= 1 && (
            <Box sx={{ color: "text.disabled", opacity: 0.45, display: "inline-flex" }}>
              <ChevronDown size={13} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// The editor for one cell. A closed list gets a menu, a long list gets type-ahead, and
// everything else a text box. All three are MUI, so they portal normally and take the app's
// theme — the native `<select>` used before was rendered by the operating system, which is
// why it came out white-on-black.
//
// A list of ONE still gets the menu. Opt-in status is the only such field: "Confirmed" is
// the single value a lead can lawfully carry, so a menu is both the shortest path to the
// right answer and a statement that there is only one. Typing it by hand invites
// "confirmed", "Yes" and "TRUE" — all of which the rules then reject.
function Editor({
  value,
  options,
  clearable,
  onCommit,
  onDone,
}: {
  value: string;
  options?: string[];
  clearable: boolean;
  onCommit: (value: string) => void;
  onDone: () => void;
}) {
  if (options && options.length >= 1 && options.length <= LIST_AS_SELECT) {
    // Keep an off-list value selectable so the cell isn't blank while deciding.
    const items = options.includes(value) || !value ? options : [value, ...options];
    return (
      <MuiSelect
        autoFocus
        defaultOpen
        value={value}
        variant="standard"
        disableUnderline
        // Commit ONLY. Closing the editor here would pre-empt the change and the cell would
        // snap back to its old value — that bug cost an afternoon.
        onChange={(e) => onCommit(String(e.target.value))}
        onClose={() => setTimeout(onDone, 0)}
        MenuProps={{ slotProps: { paper: { sx: menuPaper } } }}
        sx={{
          width: "100%",
          height: "100%",
          fontSize: CELL_FONT,
          "& .MuiSelect-select": {
            py: 0,
            px: 1,
            height: "100%",
            minHeight: "unset",
            display: "flex",
            alignItems: "center",
            fontSize: CELL_FONT,
          },
        }}
      >
        {clearable && (
          <MenuItem value="" sx={{ fontSize: CELL_FONT, color: "text.disabled" }}>
            —
          </MenuItem>
        )}
        {items.map((o) => (
          <MenuItem key={o} value={o} sx={{ fontSize: CELL_FONT }}>
            {o}
          </MenuItem>
        ))}
      </MuiSelect>
    );
  }

  if (options && options.length > LIST_AS_SELECT) {
    return (
      <Autocomplete
        freeSolo
        openOnFocus
        autoHighlight
        options={options}
        defaultValue={value}
        onChange={(_, v) => {
          onCommit(v ?? "");
          onDone();
        }}
        slotProps={{ paper: { sx: menuPaper } }}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            variant="standard"
            InputProps={{ ...params.InputProps, disableUnderline: true }}
            inputProps={{ ...params.inputProps, "data-cell-input": "text" }}
            onBlur={(e) => {
              onCommit(e.target.value);
              onDone();
            }}
            sx={{
              "& .MuiInputBase-root": { height: "100%", fontSize: CELL_FONT, px: 1 },
              "& input": { fontSize: CELL_FONT, py: 0 },
            }}
          />
        )}
        sx={{
          width: "100%",
          height: "100%",
          "& .MuiAutocomplete-endAdornment": { right: 2 },
          "& .MuiAutocomplete-option": { minHeight: 30, fontSize: CELL_FONT },
        }}
      />
    );
  }

  return (
    <Box
      component="input"
      autoFocus
      defaultValue={value}
      data-cell-input="text"
      onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.select()}
      onBlur={(e: FocusEvent<HTMLInputElement>) => {
        onCommit(e.target.value);
        onDone();
      }}
      sx={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        px: 1,
        bgcolor: "transparent",
        font: "inherit",
        fontSize: CELL_FONT,
        color: "text.primary",
      }}
    />
  );
}

/** A cell with a finding. With a suggestion it reads as a DIFF — old value struck through,
 *  proposal beside it — with accept and reject to hand. Without one it shows what's wrong,
 *  because "required" alone doesn't say which rule. */
function Diff({
  issue,
  value,
  editable,
  busy,
  tones,
  cell,
  onAccept,
  onReject,
}: {
  issue: Issue;
  value: string;
  editable: boolean;
  busy: boolean;
  tones: ToneColors;
  cell: CellRef[];
  onAccept: (c: CellRef[]) => void;
  onReject: (c: CellRef[]) => void;
}) {
  // Columns are measured to fit, so this normally shows both values whole. The hover card
  // is the guarantee for the cases measurement caps — a 200-character note, or a column the
  // user has dragged narrow.
  const title = issue.suggestion ? (
    <Box sx={{ py: 0.25 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
        <Box component="span" sx={{ textDecoration: "line-through", opacity: 0.75 }}>
          {value || "(empty)"}
        </Box>
        <Box component="span" sx={{ opacity: 0.6 }}>
          →
        </Box>
        <Box component="span" sx={{ fontWeight: 700 }}>
          {issue.suggestion}
        </Box>
      </Box>
      <Box sx={{ mt: 0.5, opacity: 0.75 }}>{issue.message}</Box>
    </Box>
  ) : (
    issue.message
  );

  return (
    <Tooltip title={title} placement="top" arrow enterDelay={250}>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.4, px: 1, height: "100%", minWidth: 0 }}
      >
        {issue.suggestion ? (
          <>
            {/* Both values shrink TOGETHER rather than the old one being capped at 45% of
                the cell — that cap is what guaranteed "United States" was cut off even when
                there was room for it. */}
            {value && (
              <>
                <Box
                  component="span"
                  sx={{
                    color: "text.disabled",
                    textDecoration: "line-through",
                    minWidth: 0,
                    flexShrink: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value}
                </Box>
                <Box
                  component="span"
                  sx={{ color: "text.disabled", flexShrink: 0, fontSize: 11, opacity: 0.8 }}
                >
                  →
                </Box>
              </>
            )}
            <Box
              component="span"
              sx={{
                color: tones.accepted,
                fontWeight: 600,
                minWidth: 0,
                flexShrink: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {issue.suggestion}
            </Box>
          </>
        ) : (
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: value ? "text.primary" : "error.main",
            }}
          >
            {value || issue.message}
          </Box>
        )}

        {/* Always visible, never faded in on hover: the buttons are part of what the column
            was measured to fit, so reserving the space costs nothing, and a control you
            must hover to discover is one you may not know you have. */}
        {editable && issue.suggestion && (
          <Box sx={{ display: "flex", gap: 0.25, ml: "auto", pl: 0.5, flexShrink: 0 }}>
            <Box
              component="span"
              title={issue.code === NOT_ENGLISH ? "Use the English title" : "Accept"}
              onMouseDown={fire(() => onAccept(cell), busy)}
              sx={{
                ...pill,
                color: tones.accepted,
                borderColor: tint(tones.accepted, 0.27),
                bgcolor: tint(tones.accepted, 0.08),
              }}
            >
              <Check size={10} />
            </Box>
            {/* A job title not in English can't be turned down — it has to become English,
                the suggestion or one typed into the cell (rules/titles.ts). */}
            {issue.code !== NOT_ENGLISH && (
              <Box
                component="span"
                title="Reject"
                onMouseDown={fire(() => onReject(cell), busy)}
                sx={{ ...pill, color: "text.secondary", borderColor: "divider" }}
              >
                <X size={10} />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

/** Act on MOUSEDOWN so the action lands before focus moves and re-renders the element out
 *  from under the pointer. */
function fire(action: () => void, busy: boolean) {
  return (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) action();
  };
}

const headCell = {
  position: "sticky" as const,
  top: 0,
  zIndex: 2,
  height: HEADER_HEIGHT,
  padding: 0,
  bgcolor: "background.paper",
  borderBottom: 1,
  borderColor: "divider",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "text.disabled",
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

/** The pinned gutter is a PANE, not a floating strip: rows passing behind it need a line to
 *  pass behind. Hairline rather than a shadow. */
const gutterEdge = { borderRight: 1, borderRightColor: "divider" };

const bodyCell = {
  height: ROW_HEIGHT,
  padding: 0,
  borderBottom: 1,
  borderColor: "divider",
  fontSize: CELL_FONT,
  verticalAlign: "middle" as const,
  overflow: "hidden",
};

// A tint that stays OPAQUE.
//
// For the pinned header and gutter, where other rows scroll underneath. A plain
// translucent bgcolor lets the moving content show straight through, so a pinned column
// reads as an overlay smeared across the data rather than as a fixed pane. Painting the
// tint as a one-colour gradient over an opaque base composites it in the element instead.
const tinted = (tintColor: string) => ({
  bgcolor: "background.paper",
  backgroundImage: `linear-gradient(${tintColor}, ${tintColor})`,
});

/** The header of the column the issue bar sent you to. Body cells compose their own
 *  treatment (see Cell) so a problem cell stays visible inside it. */
const focusColumn = (accent: string) => ({
  ...tinted(tint(accent, 0.08)),
  color: accent,
});

const menuPaper = {
  maxHeight: 280,
  borderRadius: 1,
  border: 1,
  borderColor: "divider",
  "& .MuiMenuItem-root": { fontSize: CELL_FONT, minHeight: 30 },
};

const pill = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 17,
  height: 17,
  borderRadius: 0.5,
  cursor: "pointer",
  border: 1,
  userSelect: "none" as const,
  "&:hover": { filter: "brightness(0.94)" },
};

/** Small enough to sit beside a row number without widening the gutter twice over. */
const checkboxSx = {
  p: 0.25,
  "& .MuiSvgIcon-root": { fontSize: 15 },
  color: "text.disabled",
};

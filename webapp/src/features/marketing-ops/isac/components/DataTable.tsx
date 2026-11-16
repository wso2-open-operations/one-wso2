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

import { ArrowDownward as ArrowDownwardIcon } from "../icons";
import { ArrowUpward as ArrowUpwardIcon } from "../icons";
import { UnfoldMore as UnfoldMoreIcon } from "../icons";
import {
  Box,
  CircularProgress,
  InputBase,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@wso2/oxygen-ui";
import React from "react";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

/** Column definition for DataTable — describes header text, accessor key, and optional renderer. */
export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string | number;
  sortable?: boolean;   // default true in spreadsheet mode
  filterable?: boolean; // default true in spreadsheet mode
  /** Source field the column's data is pulled from (e.g. the exact Salesforce
   * API name, or a derivation note) — shown as a tooltip on the header. */
  sfField?: string;
}

interface Props<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  getRowKey: (row: T) => string | number;
  /** Render as a dense spreadsheet-style grid with zebra rows, borders, and row numbers. */
  spreadsheet?: boolean;
  /** Currently sorted column key */
  sortBy?: string;
  /** Current sort direction */
  sortDir?: "asc" | "desc";
  /** Called when user clicks a column header to sort */
  onSort?: (field: string, dir: "asc" | "desc") => void;
  /** Per-column filter values { fieldKey: filterString } */
  columnFilters?: Record<string, string>;
  /** Called when user types in a column filter input */
  onColumnFilter?: (field: string, value: string) => void;
  /** Called when user clicks a data row */
  onRowClick?: (row: T) => void;
  /** Optional single-level row expansion (spreadsheet mode): when provided, each
   * row gets a chevron and expands in place to render this content full-width. */
  renderExpanded?: (row: T) => React.ReactNode;
}

/** Generic paginated data table with sorting, per-column filtering, and optional spreadsheet mode. */
export default function DataTable<T>({
  columns,
  rows,
  total,
  page,
  pageSize,
  pages,
  loading,
  onPageChange,
  getRowKey,
  spreadsheet = false,
  sortBy,
  sortDir = "asc",
  onSort,
  columnFilters = {},
  onColumnFilter,
  onRowClick,
  renderExpanded,
}: Props<T>) {
  const theme = useTheme();

  // Size the scroll container to end at the viewport bottom regardless of how
  // much page chrome sits above the table (tabs, search bars, upload cards) —
  // a fixed calc() fits exactly one page and overflows the rest. 64px reserves
  // the pagination row below.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [maxH, setMaxH] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setMaxH(Math.max(240, window.innerHeight - el.getBoundingClientRect().top - 64));
    measure();
    // Coalesce bursts of resize notifications into one measurement per frame —
    // the body observer fires frequently while content above the table loads.
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // Content above the table often loads/resizes after mount (stat cards,
    // filters) — a mount-only measurement leaves the table cut short/overflowing.
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  // Row-expansion state (used only when renderExpanded is provided)
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string | number>>(new Set());
  const toggleExpanded = (key: string | number) => setExpandedKeys((cur) => {
    const next = new Set(cur);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // ── Oxygen ListingTable look: clean rows, subtle dividers, soft header ──
  const headerBg    = C.card;
  const filterBg    = C.bg;
  const rowEvenBg   = C.panel;
  const rowOddBg    = C.panel;
  const borderCol   = theme.palette.divider;
  const rowNumCol   = theme.palette.text.disabled;
  const activeSort  = C.orange;

  function handleHeaderClick(col: ColumnDef<T>) {
    if (!onSort || col.sortable === false) return;
    const field = String(col.key);
    if (sortBy === field) {
      onSort(field, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSort(field, "asc");
    }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortBy !== field) return <UnfoldMoreIcon sx={{ fontSize: 14, opacity: 0.4 }} />;
    return sortDir === "asc"
      ? <ArrowUpwardIcon sx={{ fontSize: 14, color: activeSort }} />
      : <ArrowDownwardIcon sx={{ fontSize: 14, color: activeSort }} />;
  }

  if (spreadsheet) {
    const cellSx = {
      fontSize: FS.body,
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      py: 0.9,
      px: 1.5,
      border: 0,
      borderBottom: `1px solid ${borderCol}`,
      whiteSpace: "nowrap" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 240,
    };

    const rowOffset = (page - 1) * pageSize;

    return (
      <Box sx={{ width: "100%", minWidth: 0 }}>
        <TableContainer
          component={Paper}
          elevation={0}
          ref={containerRef}
          sx={{
            border: `1px solid ${borderCol}`,
            borderRadius: "12px",
            // Bound to the available width so a wide table scrolls INSIDE the
            // container instead of overflowing the page and getting clipped
            // (previously the right-hand columns were cut off on wide tables).
            width: "100%",
            maxWidth: "100%",
            maxHeight: maxH ? `${maxH}px` : "calc(100vh - 240px)",
            overflow: "auto",
            // Keep the horizontal scrollbar visible so it's clear the table
            // scrolls — otherwise overlay scrollbars hide it and it reads as cut off.
            "&::-webkit-scrollbar": { height: 10, width: 10 },
            "&::-webkit-scrollbar-thumb": { backgroundColor: C.dim, borderRadius: 8 },
            "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
            scrollbarWidth: "thin",
            scrollbarColor: `${C.dim} transparent`,
          }}
        >
          <Table size="small" stickyHeader sx={{ borderCollapse: "collapse" }}>
            <TableHead>
              {/* ── Column header row ───────────────────────────────────── */}
              <TableRow>
                <TableCell
                  sx={{
                    ...cellSx,
                    bgcolor: headerBg,
                    color: rowNumCol,
                    fontWeight: FW.semibold,
                    minWidth: 48,
                    width: 48,
                    textAlign: "right",
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    borderBottom: `2px solid ${borderCol}`,
                  }}
                >
                  #
                </TableCell>
                {columns.map((col) => {
                  const isActive = sortBy === String(col.key);
                  return (
                    <TableCell
                      key={String(col.key)}
                      onClick={() => handleHeaderClick(col)}
                      sx={{
                        ...cellSx,
                        bgcolor: headerBg,
                        fontWeight: FW.semibold,
                        fontSize: FS.small,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: isActive ? activeSort : "text.secondary",
                        width: col.width,
                        borderBottom: `1px solid ${borderCol}`,
                        cursor: col.sortable !== false && onSort ? "pointer" : "default",
                        userSelect: "none",
                        "&:hover": col.sortable !== false && onSort
                          ? { color: "text.primary" }
                          : {},
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                        {col.sfField ? (
                          <Tooltip title={col.sfField} arrow placement="top">
                            <Box
                              component="span"
                              tabIndex={0}
                              sx={{
                                cursor: "help",
                                borderBottom: "1px dotted",
                                borderColor: "divider",
                                "&:hover, &:focus-visible": { borderColor: "text.secondary" },
                                "&:focus-visible": { outline: "none" },
                              }}
                            >
                              {col.header}
                            </Box>
                          </Tooltip>
                        ) : col.header}
                        {col.sortable !== false && onSort && <SortIcon field={String(col.key)} />}
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* ── Per-column filter row ────────────────────────────────── */}
              {onColumnFilter && (
                <TableRow>
                  <TableCell
                    sx={{
                      ...cellSx,
                      bgcolor: filterBg,
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      borderBottom: `1px solid ${borderCol}`,
                      py: 0.25,
                    }}
                  />
                  {columns.map((col) => {
                    const field = String(col.key);
                    const isFilterable = col.filterable !== false;
                    return (
                      <TableCell
                        key={field}
                        sx={{
                          ...cellSx,
                          bgcolor: filterBg,
                          py: 0.25,
                          borderBottom: `1px solid ${borderCol}`,
                        }}
                      >
                        {isFilterable ? (
                          <InputBase
                            value={columnFilters[field] ?? ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              onColumnFilter(field, e.target.value)
                            }
                            placeholder="filter…"
                            inputProps={{
                              name: `filter-${field}`,
                              id: `filter-${field}`,
                              "aria-label": `Filter ${col.header}`,
                              autoComplete: "off",
                            }}
                            sx={{
                              fontSize: FS.small,
                              fontFamily: "inherit",
                              width: "100%",
                              "& input": {
                                py: 0,
                                px: 0.25,
                                color: "text.primary",
                                "&::placeholder": { opacity: 0.4, fontSize: FS.small },
                              },
                            }}
                          />
                        ) : null}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 6, border: 0 }}>
                    <CircularProgress size={28} sx={{ color: "primary.main" }} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 6, border: 0 }}>
                    <Typography color="text.secondary" fontSize={FS.reading}>No records found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? rowEvenBg : rowOddBg;
                  const rowKey = getRowKey(row);
                  const isExpanded = renderExpanded ? expandedKeys.has(rowKey) : false;
                  return (
                    <React.Fragment key={rowKey}>
                    <TableRow
                      onClick={() => { if (renderExpanded) toggleExpanded(rowKey); onRowClick?.(row); }}
                      sx={{
                        cursor: onRowClick || renderExpanded ? "pointer" : "default",
                        "&:hover td": { bgcolor: `${C.orange}0a` },
                      }}
                    >
                      <TableCell
                        sx={{
                          ...cellSx,
                          bgcolor: rowBg,
                          color: rowNumCol,
                          textAlign: "right",
                          fontSize: FS.small,
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          userSelect: "none",
                        }}
                      >
                        {renderExpanded && (
                          <UnfoldMoreIcon
                            aria-label={isExpanded ? "Collapse row" : "Expand row"}
                            sx={{
                              fontSize: 13, mr: 0.4, verticalAlign: "middle",
                              color: isExpanded ? activeSort : rowNumCol,
                              transform: isExpanded ? "none" : "rotate(-90deg)",
                              transition: "transform .15s",
                            }}
                          />
                        )}
                        {rowOffset + idx + 1}
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell
                          key={String(col.key)}
                          sx={{ ...cellSx, bgcolor: rowBg }}
                          title={
                            !col.render
                              ? String((row as Record<string, unknown>)[String(col.key)] ?? "")
                              : undefined
                          }
                        >
                          {col.render
                            ? col.render(row)
                            : String((row as Record<string, unknown>)[String(col.key)] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && renderExpanded && (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1}
                          sx={{ ...cellSx, whiteSpace: "normal", maxWidth: "none", p: 1.25, bgcolor: C.bg }}>
                          {renderExpanded(row)}
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5, px: 0.5 }}>
          <Typography variant="body2" color="text.secondary" fontSize={FS.body}>
            {total.toLocaleString()} record{total !== 1 ? "s" : ""}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </Typography>
          <Pagination
            count={pages}
            page={page}
            onChange={(_: React.ChangeEvent<unknown>, p: number) => onPageChange(p)}
            shape="rounded"
            size="small"
            color="primary"
          />
        </Box>
      </Box>
    );
  }

  // ── Standard (non-spreadsheet) mode ─────────────────────────────────────────
  return (
    <Box>
      <TableContainer component={Paper} sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider" }} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={String(col.key)}
                  sx={{ width: col.width, cursor: onSort ? "pointer" : "default", userSelect: "none" }}
                  onClick={() => handleHeaderClick(col)}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                    {col.header}
                    {onSort && col.sortable !== false && <SortIcon field={String(col.key)} />}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} sx={{ color: "primary.main" }} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No records found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={getRowKey(row)} hover onClick={() => onRowClick?.(row)} sx={{ cursor: onRowClick ? "pointer" : "default" }}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[String(col.key)] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2, px: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {total.toLocaleString()} record{total !== 1 ? "s" : ""}
        </Typography>
        <Pagination
          count={pages}
          page={page}
          onChange={(_: React.ChangeEvent<unknown>, p: number) => onPageChange(p)}
          shape="rounded"
          size="small"
          color="primary"
        />
      </Box>
    </Box>
  );
}

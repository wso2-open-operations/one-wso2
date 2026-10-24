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

import { Fragment, type JSX, type ReactNode } from "react";
import { alpha, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { CircleAlertIcon, PencilIcon } from "@wso2/oxygen-ui-icons-react";
import { orderForm, type SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { durationShort, formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { visuallyHidden } from "@features/sales/cado2/utils/visuallyHidden";

const num = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

interface OrderFormTableProps {
  readonly lines: readonly SheetLine[];
  readonly currency: string;
  /** Buttons for a line (the wizard's edit / remove), by its position in `lines`. */
  readonly actions?: (index: number) => ReactNode;
  /** A row under a line, e.g. its problems, by its position in `lines`. */
  readonly below?: (index: number) => ReactNode;
  /** A partner-led quote's commission %, e.g. "15": adds the commission and net rows. */
  readonly commissionPercent?: string | null;
  /** The totals box's label. */
  readonly totalLabel?: string;
  /** False inside a year: the Products card closes with the totals over every year. */
  readonly showTotals?: boolean;
  /** A last row inside the table with the lines' total, e.g. "Year 1 total": quieter than the order totals. */
  readonly closingTotalLabel?: string;
  /**
   * The wizard: frame the "Uncategorised" group in red and say how to fix it
   * (D93, D95). Elsewhere (Review, the quote page) the group still shows,
   * with a plain heading.
   */
  readonly flagUncategorised?: boolean;
}

/**
 * The products as an order form (misc/WSO2_Order_Form_Sample.docx): grouped
 * into Subscription, Support and Professional Services, each with its own
 * subtotal, then the total order value. Each amount is the line's cost over
 * the whole term, which the Duration column shows (D85, back since D94). On a partner-led
 * quote, the partner's commission and the
 * net order value follow:
 *
 *   Total order value              88,700.00
 *   Partner commission (15%)     − 13,305.00
 *   Net order value                75,395.00
 */
export default function OrderFormTable({
  lines,
  currency,
  actions,
  below,
  commissionPercent = null,
  flagUncategorised = false,
  totalLabel = "Total order value",
  showTotals = true,
  closingTotalLabel,
}: OrderFormTableProps): JSX.Element {
  const form = orderForm(lines, commissionPercent);
  // Product, unit of measure, unit list, qty, discount, duration, amount (+ actions).
  const dataCols = 7;
  const cols = actions ? dataCols + 1 : dataCols;
  // Lines whose category isn't chosen yet (D72): listed first, under their own
  // heading, on every view, so no line is ever left out of the table.
  const pending = lines.filter((l) => !l.category);
  const cur = currency ? ` (${currency})` : "";
  const money = (v: string | null) => (v ? formatMoney(v) : "—");

  // The table's hierarchy (D97): column headers, then section headers, then
  // lines; each section closes with its subtotal. The order totals are in a
  // box under the table (see summaryRow).
  const subtotalRow = (label: string, value: string | null) => (
    <TableRow>
      <TableCell colSpan={dataCols - 1} align="right" sx={{ fontWeight: 500, borderTop: 1, borderTopColor: "divider" }}>
        {label}
        {cur}
      </TableCell>
      <TableCell align="right" sx={{ ...num, fontWeight: 600, borderTop: 1, borderTopColor: "divider" }}>
        {money(value)}
      </TableCell>
      {actions ? <TableCell sx={{ borderTop: 1, borderTopColor: "divider" }} /> : null}
    </TableRow>
  );

  const groupHeader = (title: string) => (
    <TableRow>
      <TableCell colSpan={cols} sx={{ pt: 2, pb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
          {title}
        </Typography>
      </TableCell>
    </TableRow>
  );


  // The uncategorised group's heading (D93, D95): in the error colour, saying
  // what to do, so it reads as something to fix, not just another section.
  const uncategorisedHeader = (
    <TableRow>
      <TableCell colSpan={cols} sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.06), py: 0.75 }}>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1, color: "error.main" }}>
          <CircleAlertIcon size={16} aria-hidden />
          <Typography variant="overline" sx={{ fontWeight: 700, lineHeight: 1.6 }}>
            Uncategorised
          </Typography>
          <Typography variant="body2" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            · Click <PencilIcon size={14} aria-label="Edit" /> to choose a category
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );

  const lineRow = (l: SheetLine) => {
    const index = lines.indexOf(l);
    return (
      <Fragment key={l.number}>
        <TableRow>
          <TableCell sx={{ minWidth: 200 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
              {l.productName}
            </Typography>
            {/* The name and the SKU only (2026-10-12, amends D53): the description is shown when choosing the product. */}
            {l.productCode ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {l.productCode}
              </Typography>
            ) : null}
            {/* A bundle child: it comes with, and leaves with, its parent. */}
            {l.parentName ? (
              <Typography variant="caption" color="text.secondary" display="block" aria-label="Bundled">
                Comes with {l.parentName}
              </Typography>
            ) : null}
            {/* How a formula line's unit price was worked out (D81); it has no discount. */}
            {l.formula ? (
              <Typography variant="caption" color="text.secondary" display="block" aria-label="Priced by formula">
                Formula {l.formula.version}:{" "}
                <Box component="span" sx={{ fontFamily: "monospace" }}>
                  {l.formula.explanation}
                </Box>
              </Typography>
            ) : null}
          </TableCell>
          <TableCell>{l.unitOfMeasure ?? "–"}</TableCell>
          <TableCell align="right" sx={num}>
            {formatMoney(l.unitPrice)}
          </TableCell>
          <TableCell align="right" sx={num}>
            {l.quantity}
          </TableCell>
          <TableCell align="right" sx={num}>
            {Number(l.discountPercent) ? `${l.discountPercent}%` : "–"}
          </TableCell>
          {/* Each line's own term within its year, e.g. "1Y" or "6M";
              its dates when the AM narrowed them. */}
          <TableCell sx={{ whiteSpace: "nowrap" }}>
            {l.recurring ? (l.startDate && l.endDate ? durationShort(l.startDate, l.endDate) : "–") : "One-time"}
            {l.ownDates && l.startDate ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {l.recurring && l.endDate ? `${formatDate(l.startDate)} – ${formatDate(l.endDate)}` : formatDate(l.startDate)}
              </Typography>
            ) : null}
          </TableCell>
          <TableCell align="right" sx={num}>
            {money(l.tcv)}
          </TableCell>
          {actions ? (
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              {actions(index)}
            </TableCell>
          ) : null}
        </TableRow>
        {below?.(index)}
      </Fragment>
    );
  };

  // The order totals, below the table and right-aligned like an invoice's,
  // so they don't read as one more subtotal (D97).
  const summaryRow = (label: string, value: string | null, grand = false, prefix = "") => (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 3,
        px: 2,
        py: grand ? 1.25 : 0.75,
        ...(grand ? { borderTop: 1, borderColor: "divider", bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } : {}),
      }}
    >
      <Typography variant={grand ? "subtitle1" : "body2"} sx={{ fontWeight: grand ? 700 : 500 }}>
        {label}
        {cur}
      </Typography>
      <Typography variant={grand ? "subtitle1" : "body2"} sx={{ ...num, fontWeight: grand ? 700 : 600 }}>
        {value ? `${prefix}${money(value)}` : money(value)}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
        <Table
          size="small"
          aria-label="Products"
          // Light lines between columns (D97); not after the last cell, so the
          // Uncategorised group's red frame keeps its right edge.
          sx={{ "& th:not(:last-child), & td:not(:last-child)": { borderRight: 1, borderRightColor: "divider" } }}
        >
          <TableHead
            sx={{
              "& th": {
                bgcolor: "action.hover",
                fontWeight: 700,
                fontSize: (t) => t.typography.body2.fontSize,
                color: "text.primary",
                borderBottom: (t) => `2px solid ${t.palette.divider}`,
              },
            }}
          >
            <TableRow>
              <TableCell>Product or service</TableCell>
              <TableCell>Unit of measure</TableCell>
              <TableCell align="right">Unit price</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell>Term</TableCell>
              <TableCell align="right">Amount{cur}</TableCell>
              {actions ? (
                <TableCell align="right">
                  <Box component="span" sx={visuallyHidden}>
                    Actions
                  </Box>
                </TableCell>
              ) : null}
            </TableRow>
          </TableHead>
          {/* Lines waiting for a category come first, under a plain heading, with no
              subtotal, framed by a thin red line until each has one (D72, D93). */}
          {pending.length > 0 && flagUncategorised ? (
            <TableBody
              aria-label="Uncategorised"
              sx={(t) => {
                const line = `1px solid ${t.palette.error.main}`;
                return {
                  "& td:first-of-type": { borderLeft: line },
                  "& td:last-of-type": { borderRight: line },
                  // An inset shadow, not a border: the header row's bottom border
                  // sits on the same line and would win the collapsed-border tie.
                  "& tr:first-of-type td": { boxShadow: `inset 0 1px 0 ${t.palette.error.main}` },
                  "& tr:last-of-type td": { borderBottom: line },
                };
              }}
            >
              {uncategorisedHeader}
              {pending.map(lineRow)}
            </TableBody>
          ) : null}
          {/* Read-only views: the same lines under a plain heading. */}
          {pending.length > 0 && !flagUncategorised ? (
            <TableBody aria-label="Uncategorised">
              {groupHeader("Uncategorised")}
              {pending.map(lineRow)}
            </TableBody>
          ) : null}
          <TableBody>
            {form.groups.map((g) => (
              <Fragment key={g.category}>
                {groupHeader(g.title)}
                {g.lines.map(lineRow)}
                {subtotalRow(`${g.title} subtotal`, g.subtotal)}
              </Fragment>
            ))}
            {closingTotalLabel ? (
              <TableRow sx={{ bgcolor: "action.hover", "& td": { borderTop: 2, borderTopColor: "divider", borderBottom: 0, fontWeight: 700 } }}>
                <TableCell colSpan={dataCols - 1} align="right">
                  {closingTotalLabel}
                  {cur}
                </TableCell>
                <TableCell align="right" sx={num}>
                  {money(form.total)}
                </TableCell>
                {actions ? <TableCell /> : null}
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      {showTotals ? (
        <Paper
          variant="outlined"
          aria-label="Order totals"
          role="region"
          sx={{ mt: 1.5, ml: "auto", width: { xs: "100%", sm: 380 }, borderRadius: 1.5, overflow: "hidden" }}
        >
          {form.commission !== null ? (
            <>
              <Box sx={{ pt: 0.75 }}>
                {summaryRow(totalLabel, form.total)}
                {summaryRow(`Partner commission (${commissionPercent}%)`, form.commission, false, "− ")}
              </Box>
              {summaryRow("Net order value", form.netOrderValue, true)}
            </>
          ) : (
            summaryRow(totalLabel, form.total, true)
          )}
        </Paper>
      ) : null}
    </Box>
  );
}

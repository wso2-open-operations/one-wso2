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

import type { JSX, ReactNode } from "react";
import { Box, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import { durationShort, durationText, formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { orderForm, type SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { formatMoney } from "@features/sales/cado2/utils/money";
import OrderFormTable from "./OrderFormTable";

/** A year as the sections show it; start and end are "" before the term's start is known. */
export interface SectionYear {
  readonly number: number;
  readonly start: string;
  readonly end: string;
}

interface YearSectionsProps {
  readonly years: readonly SectionYear[];
  /** Every line of the quote, in order; each section shows its year's. */
  readonly lines: readonly SheetLine[];
  readonly currency: string;
  readonly commissionPercent: string | null;
  readonly collapsed: ReadonlySet<number>;
  readonly onToggle: (yearNumber: number) => void;
  /** Buttons on a year's header row (the wizard's add, clone and delete). */
  readonly yearActions?: (yearNumber: number) => ReactNode;
  /** Shown above a year's products, e.g. the last year's end date. */
  readonly yearTop?: (yearNumber: number) => ReactNode;
  /** What an empty year says. */
  readonly empty?: (yearNumber: number) => ReactNode;
  /** A line's buttons and problems, by its position in `lines`. */
  readonly lineActions?: (index: number) => ReactNode;
  readonly below?: (index: number) => ReactNode;
  readonly flagUncategorised?: boolean;
}

/**
 * The products year by year inside one card: each year
 * a foldable section whose header row says its dates, how many products it
 * has and its value, quietly; its products grouped as on the order form.
 *
 *   ▸ Year 1   1 Jan 2027 – 31 Dec 2027        3 products · USD 46,980.00   [actions]
 *   ▾ Year 2   1 Jan 2028 – 30 Jun 2028 (6M)   2 products · USD 18,140.00   [actions]
 *        Subscription / Support / Professional Services …
 */
export default function YearSections({
  years,
  lines,
  currency,
  commissionPercent,
  collapsed,
  onToggle,
  yearActions,
  yearTop,
  empty,
  lineActions,
  below,
  flagUncategorised = false,
}: YearSectionsProps): JSX.Element {
  return (
    <Box sx={{ borderTop: 1, borderColor: "divider" }}>
      {years.map((y) => {
        const indexes = lines.flatMap((l, i) => (l.yearNumber === y.number ? [i] : []));
        const ofYear = indexes.map((i) => lines[i]);
        const open = !collapsed.has(y.number);
        const total = orderForm(ofYear).total;
        // Only the last year can be shorter than 12 months; say so beside its dates.
        const short = y.start && y.end && durationShort(y.start, y.end) !== "1Y" ? durationText(y.start, y.end) : "";
        return (
          <Box key={y.number} component="section" aria-label={`Year ${y.number}`} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.25}
              role="button"
              tabIndex={0}
              aria-expanded={open}
              aria-label={`Year ${y.number}, ${open ? "fold" : "unfold"}`}
              onClick={() => onToggle(y.number)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(y.number);
                }
              }}
              sx={{ py: 1.25, cursor: "pointer", flexWrap: "wrap", rowGap: 0.5, "&:hover": { bgcolor: "action.hover" } }}
            >
              <Box
                aria-hidden
                sx={{ display: "grid", color: "text.secondary", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}
              >
                <ChevronRightIcon size={16} />
              </Box>
              <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 700 }}>
                {y.number ? `Year ${y.number}` : "Without a year"}
              </Typography>
              {y.start ? (
                <Typography variant="body2" color="text.secondary">
                  {formatDate(y.start)} – {formatDate(y.end)}
                </Typography>
              ) : null}
              {short ? <Chip size="small" color="warning" variant="outlined" label={short} /> : null}
              <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {ofYear.length} product{ofYear.length === 1 ? "" : "s"}
                {/* Folded, the header carries the year's total; open, the table's last row does. */}
                {!open && total ? ` · ${currency} ${formatMoney(total)}` : ""}
              </Typography>
              {yearActions ? (
                // Its buttons don't fold the year.
                <Box onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} sx={{ display: "flex", gap: 0.5 }}>
                  {yearActions(y.number)}
                </Box>
              ) : null}
            </Stack>
            {open ? (
              <Stack spacing={1.5} sx={{ pb: 2, pl: { sm: 3.5 } }}>
                {yearTop?.(y.number)}
                {ofYear.length === 0 ? (
                  (empty?.(y.number) ?? (
                    <Typography variant="body2" color="text.secondary">
                      No products in this year.
                    </Typography>
                  ))
                ) : (
                  <OrderFormTable
                    lines={ofYear}
                    currency={currency}
                    commissionPercent={commissionPercent}
                    showTotals={false}
                    closingTotalLabel={y.number ? `Year ${y.number} total` : "Total"}
                    flagUncategorised={flagUncategorised}
                    actions={lineActions ? (k) => lineActions(indexes[k]) : undefined}
                    below={below ? (k) => below(indexes[k]) : undefined}
                  />
                )}
              </Stack>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * The card's footer: the order total over every year (the TCV) and, on a
 * partner-led quote, the commission and the net order value. It closes the
 * Products card, edge to edge.
 */
export function OrderTotalsFooter({
  lines,
  currency,
  commissionPercent,
  yearCount,
}: {
  lines: readonly SheetLine[];
  currency: string;
  commissionPercent: string | null;
  yearCount: number;
}): JSX.Element {
  const form = orderForm(lines, commissionPercent);
  const cur = currency ? ` (${currency})` : "";
  // Each label beside its value, on the right, like an invoice's totals.
  const row = (label: string, value: string | null, strong = false, prefix = "") => (
    <Stack direction="row" justifyContent="flex-end" alignItems="baseline" spacing={3}>
      <Typography variant={strong ? "subtitle1" : "body2"} sx={{ fontWeight: strong ? 700 : 500 }}>
        {label}
        {cur}
      </Typography>
      <Typography
        variant={strong ? "subtitle1" : "body2"}
        sx={{ fontWeight: strong ? 700 : 600, fontVariantNumeric: "tabular-nums", minWidth: 140, textAlign: "right" }}
      >
        {value ? `${prefix}${formatMoney(value)}` : "—"}
      </Typography>
    </Stack>
  );
  const total = yearCount > 1 ? `Total order value · all ${yearCount} years` : "Total order value";
  return (
    <Box
      role="region"
      aria-label="Order totals"
      sx={{ mx: { xs: -2, sm: -2.5 }, mb: { xs: -2, sm: -2.5 }, px: { xs: 2, sm: 2.5 }, py: 1.5, bgcolor: "action.hover", borderRadius: "0 0 8px 8px" }}
    >
      {form.commission !== null ? (
        <Stack spacing={0.5}>
          {row(total, form.total)}
          {row(`Partner commission (${commissionPercent}%)`, form.commission, false, "− ")}
          {row("Net order value", form.netOrderValue, true)}
        </Stack>
      ) : (
        row(total, form.total, true)
      )}
    </Box>
  );
}

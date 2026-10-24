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

import type { JSX } from "react";
import { Button, Typography } from "@wso2/oxygen-ui";
import { ChevronsDownUpIcon, ChevronsUpDownIcon, PackageIcon } from "@wso2/oxygen-ui-icons-react";
import type { QuoteSheet } from "@features/sales/cado2/quotes/sheet/sheetModel";
import SheetCard from "@features/sales/cado2/components/section-card/SectionCard";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import YearSections, { OrderTotalsFooter } from "./YearSections";
import { useCollapsedYears } from "./useCollapsedYears";

/**
 * Every line, as on the order form, year by year in one card,
 * closed by the order total over every year.
 */
export default function ProductsSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  const fold = useCollapsedYears();
  const years = sheet.contractYears;
  const anyFolded = fold.collapsed.size > 0;
  // Lines saved before the years model have no year: shown in one plain group.
  const yearless = sheet.lines.some((l) => !years.some((y) => y.number === l.yearNumber));
  const sections = yearless ? [{ number: 0, start: "", end: "" }, ...years] : years;
  return (
    <SheetCard
      title="Products"
      icon={<PackageIcon size={18} />}
      aside={
        years.length > 1 ? (
          <Button
            size="small"
            startIcon={anyFolded ? <ChevronsUpDownIcon size={14} /> : <ChevronsDownUpIcon size={14} />}
            onClick={() => fold.toggleAll(years.map((y) => y.number))}
          >
            {anyFolded ? "Expand all" : "Collapse all"}
          </Button>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {sheet.lines.length} line{sheet.lines.length === 1 ? "" : "s"}
          </Typography>
        )
      }
    >
      {sheet.lines.length === 0 ? (
        <EmptyState compact icon={<PackageIcon size={20} />} title="No products yet" />
      ) : (
        <>
          <YearSections
            years={sections}
            lines={yearless ? sheet.lines.map((l) => (years.some((y) => y.number === l.yearNumber) ? l : { ...l, yearNumber: 0 })) : sheet.lines}
            currency={sheet.currency}
            commissionPercent={sheet.partnerCommissionPercent}
            collapsed={fold.collapsed}
            onToggle={fold.toggle}
          />
          <OrderTotalsFooter
            lines={sheet.lines}
            currency={sheet.currency}
            commissionPercent={sheet.partnerCommissionPercent}
            yearCount={years.length}
          />
        </>
      )}
    </SheetCard>
  );
}

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

import type { ExpenseClaimsReport, ExpenseDashboardPeriod } from "../expenseTypes";

// A leading =, +, - or @ makes spreadsheet software treat the cell as a
// formula, so those values are prefixed with a quote before they reach the
// file.
function escapeCell(value: string | number): string {
  const text = String(value ?? "");
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const toRow = (cells: (string | number)[]): string => cells.map(escapeCell).join(",");

function section(title: string, header: string[], rows: (string | number)[][]): string[] {
  return [title, toRow(header), ...rows.map(toRow), ""];
}

/**
 * The dashboard's four tables, stacked into one file under their own
 * headings — `exportReportCsv.ts` in the source. One file rather than one
 * per table, because finance reviews them together and four separate
 * downloads for one Export click is not what the button promises.
 */
export function buildExpenseReportCsv(report: ExpenseClaimsReport, period: ExpenseDashboardPeriod): string {
  const currency = report.reportingCurrency;
  const change = (value?: number): string => (value === undefined ? "n/a" : `${value}%`);

  const lines: string[] = [
    "Expense Claims Dashboard",
    toRow(["Period", period]),
    toRow(["Reporting currency", currency]),
    "",
    ...section(
      "SUMMARY",
      ["Metric", "Value", "vs Prior Period"],
      [
        ["Claim Count", report.current.claimCount, change(report.claimCountChangePercentage)],
        ["Total Value", report.current.totalValue, change(report.totalValueChangePercentage)],
        [
          "Average Claim Value",
          report.current.averageClaimValue,
          change(report.averageClaimValueChangePercentage),
        ],
      ],
    ),
    ...section(
      "CLAIMS BY STATUS",
      ["Status", "Count", "Avg Days Pending"],
      report.statusBreakdown.map((item) => [item.status, item.count, item.averageDaysPending]),
    ),
    ...section(
      "CLAIMS BY BUSINESS ENTITY",
      ["Business Entity", "Count", `Total Value (${currency})`, `Avg Value (${currency})`, "vs Prior Period"],
      report.entityBreakdown.map((item) => [
        item.legalName,
        item.claimCount,
        item.totalValue,
        item.averageClaimValue,
        `${item.totalValueChangePercentage}%`,
      ]),
    ),
    ...section(
      "MONTHLY BREAKDOWN BY EXPENSE TYPE",
      ["Month", ...report.expenseTypeColumns, `Total (${currency})`, "% of Total"],
      report.monthlyBreakdown.map((item) => [
        item.label,
        // Realigned against expenseTypeColumns rather than trusting array
        // order, so a month missing an expense type cannot shift every
        // later column.
        ...report.expenseTypeColumns.map(
          (column) => item.amounts.find((amount) => amount.expenseType === column)?.amount ?? 0,
        ),
        item.total,
        `${item.percentageOfTotal}%`,
      ]),
    ),
    ...section(
      "CLAIMS BY EMPLOYEE",
      ["Employee", "Email", "Claims", "Pending", "Claims / Month", `Total Value (${currency})`],
      report.employeeBreakdown.map((item) => [
        item.employeeName,
        item.employeeEmail,
        item.claimCount,
        item.pendingCount,
        item.claimsPerMonth,
        item.totalValue,
      ]),
    ),
  ];

  return lines.join("\n");
}

export function downloadExpenseReportCsv(report: ExpenseClaimsReport, period: ExpenseDashboardPeriod): void {
  // A leading BOM so Excel reads the file as UTF-8 rather than the local
  // codepage.
  const blob = new Blob(["﻿", buildExpenseReportCsv(report, period)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expense-claims-dashboard-${period.toLowerCase().replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

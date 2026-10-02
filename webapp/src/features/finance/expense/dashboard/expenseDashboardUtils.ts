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

// Ported from `dashboardUtils.ts` in the source app — the period-range math
// and the entity-label disambiguation are both behaviour, not presentation,
// so they moved unchanged. Currency formatting did not: the source used its
// own `NumericFormat` + `CURRENCY_FORMAT_PROPS`, dropped here in favour of
// this feature's own `money()` (financeFormat.ts), which every other finance
// screen already formats amounts with — two currency formatters for one
// portal is exactly the "disparity" this migration was asked to avoid.

import { toIso } from "../../util/financeFormat";
import type { ExpenseDashboardPeriod, ExpenseSubsidiarySummary } from "../expenseTypes";

export const ALL_ENTITIES = "All entities";
export const ALL_CATEGORIES = "All categories";
export const ALL_STATUSES = "All statuses";
export const ALL_REGIONS = "All regions";

/** `startDate` is omitted for an open-ended period ("All Time"), which the
 *  backend treats as unbounded and skips the prior-period comparison for. */
export interface PeriodRange {
  startDate?: string;
  endDate: string;
}

/**
 * Each preset covers the current period to date. `new Date(y, m + 1, 0)` is
 * the last day of month `m`, which keeps month lengths and leap years
 * correct without a date library.
 */
export function getPeriodRange(
  preset: ExpenseDashboardPeriod,
  customRange?: { startDate: string; endDate: string },
): PeriodRange {
  const now = new Date();

  if (preset === "Custom" && customRange) return customRange;

  switch (preset) {
    case "Monthly":
      return {
        startDate: toIso(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case "Annually":
      return {
        startDate: toIso(new Date(now.getFullYear(), 0, 1)),
        endDate: toIso(new Date(now.getFullYear(), 11, 31)),
      };
    case "All Time":
      return { endDate: toIso(now) };
    // A custom period with no range yet behaves as the current quarter, which
    // is also what seeds the date fields when someone first switches to it.
    case "Custom":
    case "Quarterly":
    default: {
      const startMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        startDate: toIso(new Date(now.getFullYear(), startMonth, 1)),
        endDate: toIso(new Date(now.getFullYear(), startMonth + 3, 0)),
      };
    }
  }
}

export function formatPercentage(value: number): string {
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "";
  return `${arrow} ${Math.abs(value)}%`;
}

export function percentageColor(value: number): "success.main" | "error.main" {
  return value >= 0 ? "success.main" : "error.main";
}

/**
 * Several subsidiaries share a legal name — "WSO2 (UK) LIMITED" covers both
 * the UK and Spain entities — so the legal name alone cannot identify a
 * selection. The entity code is appended whenever a name is ambiguous.
 */
export function getEntityLabel(
  subsidiary: ExpenseSubsidiarySummary,
  subsidiaries: readonly ExpenseSubsidiarySummary[],
): string {
  const sharesName = subsidiaries.filter((other) => other.legalName === subsidiary.legalName).length > 1;
  return sharesName ? `${subsidiary.legalName} (${subsidiary.code})` : subsidiary.legalName;
}

export function getEntityCodeForLabel(
  label: string,
  subsidiaries: readonly ExpenseSubsidiarySummary[],
): string | undefined {
  return subsidiaries.find((subsidiary) => getEntityLabel(subsidiary, subsidiaries) === label)?.code;
}

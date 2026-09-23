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

// The two reads behind a business unit's monthly view, as React Query options —
// shared by the dialog that reads one unit (`useFlashDetail`) and the Full
// Report that reads all six (`useFlashDetailReader`).
//
// Shared so that the two ask under ONE key. A Full Report taken after opening
// a dialog then reuses what the dialog read, and a dialog opened after a Full
// Report opens without a round trip — neither of which holds if each built its
// own key and the two drifted.
//
// In a module of its own because both hooks' suites, and the page's, replace
// the hook modules wholesale with `vi.mock` factories, which would drop
// anything else exported beside them (the reason `misFlashQueryKeys` is apart
// too).

import { authedPost } from "@api/http";
import { httpRetry } from "@api/errors";
import { misFlashServiceUrls } from "@config/apiConfig";
import type { MisFlashRange } from "../util/misFlashPeriods";
import { recordIn } from "./misResponseArray";
import { FLASH_ACCOUNT_SUMMARY_KEY } from "./misFlashQueryKeys";
import type {
  FlashFinancialAccountStatistics,
  FlashSalesStatistics,
  FlashSummaryRequest,
} from "./misFlashTypes";

/** What one detail view is for. */
export interface FlashDetailRequest {
  /** `BU_LIST`'s name for the unit, NOT the column header — see `FLASH_UNIT_COLUMNS`. */
  businessUnit: string;
  /** Every month asked for, oldest first. The view draws all but the first. */
  ranges: readonly MisFlashRange[];
  subRegions: readonly string[];
}

/** One unit's two answers. A read that has not answered is `{}`. */
export interface FlashDetailAnswer {
  sales: FlashSalesStatistics;
  accounts: FlashFinancialAccountStatistics;
}

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * The body both calls take.
 *
 * `isSubLevel: true` — **a deviation, and the one place this dialog differs
 * from the source's.** The source's monthly view is reached from the P&L with
 * `isSubLevel: false` (a flat Cost of Sales and Expense) and from its SEPARATE
 * sub-level dialog with `true`. Ticket 15 folds that second dialog into the
 * P&L's own collapsible rows, so there is one monthly view rather than two, and
 * it asks the richer question. The flag is purely additive at the backend: it
 * attaches `subLevel` to the Cost of Sales and Expense lines and changes
 * nothing else (`balance_statement.bal:312-325`). Spec §7.
 *
 * The source's Full Report sends `true` as well (`fetchMonthlySummary`).
 */
export function flashDetailBody(request: FlashDetailRequest): FlashSummaryRequest {
  return {
    businessUnit: request.businessUnit,
    isSubLevel: true,
    dateRange: request.ranges.map((range) => ({
      startDate: range.startDate,
      endDate: range.endDate,
    })),
    subRegions: [...request.subRegions],
  };
}

type TokenSource = () => Promise<string>;

/**
 * `POST /customer-summary` — ARR and Booking.
 *
 * Keyed by the BODY, not the URL: the URL is the same for every business unit,
 * so keying on it would serve Integration's figures under Choreo's heading.
 * Spec §6.
 */
export const flashSalesQuery = (
  userSub: string | undefined,
  body: FlashSummaryRequest | null,
  getAccessToken: TokenSource,
) => ({
  queryKey: ["mis", "customer-summary", userSub, body] as const,
  queryFn: async (): Promise<FlashSalesStatistics> =>
    recordIn<FlashSalesStatistics>(
      await authedPost<unknown>(misFlashServiceUrls.customerSummary, await getAccessToken(), body),
    ),
  staleTime: FIVE_MINUTES,
  retry: httpRetry,
});

/**
 * `POST /account-summary` — the twelve financial-account sections. Under
 * `FLASH_ACCOUNT_SUMMARY_KEY`, which a Forecast write marks stale by prefix.
 */
export const flashAccountSummaryQuery = (
  userSub: string | undefined,
  body: FlashSummaryRequest | null,
  getAccessToken: TokenSource,
) => ({
  queryKey: [...FLASH_ACCOUNT_SUMMARY_KEY, userSub, body] as const,
  queryFn: async (): Promise<FlashFinancialAccountStatistics> =>
    recordIn<FlashFinancialAccountStatistics>(
      await authedPost<unknown>(misFlashServiceUrls.accountSummary, await getAccessToken(), body),
    ),
  staleTime: FIVE_MINUTES,
  retry: httpRetry,
});

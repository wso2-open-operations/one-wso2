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

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPatch, humanizeHttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisFlashConfigured, misFlashServiceUrls } from "@config/apiConfig";
import { arrayIn } from "./misResponseArray";
import {
  FLASH_ACCOUNTS_KEY,
  FLASH_ACCOUNT_SUMMARY_KEY,
  FLASH_BALANCE_STATEMENT_KEY,
} from "./misFlashQueryKeys";
import type {
  FlashAccountBook,
  FlashAccountsQuery,
  FlashFinancialAccount,
  FlashForecastInput,
} from "./misFlashTypes";

// `GET` and `PATCH /income-accounts` and `/cost-of-sales-accounts` — the GL
// accounts behind one Flash figure, and the Forecast written against one of
// them. Ticket 16.
//
// ---- nothing here is optimistic, and that is the whole design -------------
//
// Spec §10.16: a failed PATCH must not leave an optimistic value on screen —
// wrong money that looks saved is the worst outcome available here. So no
// value is ever written into the cache by hand. A save sends the PATCH and, only
// once the server has taken it, marks the reads it moved stale; every figure a
// screen can show is therefore the server's answer to a read, and a refusal has
// nothing to roll back. The flash backend answers a PATCH with an empty 200
// (`service.bal:144,159`), so there is nothing in the response to show either.
//
// ---- the cutoff is not checked here -----------------------------------------
//
// Spec §8.1. The server refuses every edit after the 15th, and this file makes
// the attempt and hands any refusal to its caller rather than guessing at the
// date. What a refusal SAYS is the Account View's (`refusalOf`).

/** `/income-accounts` or `/cost-of-sales-accounts` — one path per book, both verbs. */
function bookUrl(book: FlashAccountBook): string {
  return book === "income" ? misFlashServiceUrls.incomeAccounts : misFlashServiceUrls.costOfSalesAccounts;
}

/**
 * The address of one account list.
 *
 * The source's parameters in the source's order (`MonthlyViewTable.js:383-387`,
 * `:440-445`), with one exception: the cost-of-sales sub-category goes as
 * **`accountSubCategory`**, the name the backend declares and requires
 * (`service.bal:95-96`). The source still sends `expenseType`, the name from
 * before the backend's 2023-11-20 rename (`ec5cfa857`), so its cost-of-sales
 * account view is refused with a 400. Spec §7, and §11.18 for the live check.
 *
 * Spaces go as `+`, which is what the source's `URLSearchParams` puts on the
 * wire here — its `encodeURI` leaves `+` alone. `balanceStatementUrl` sends
 * `%20` for the matching reason: there the source built the query by hand. Both
 * follow the source, so neither is the port's guess at what the gateway reads.
 */
export function flashAccountsUrl(query: FlashAccountsQuery): string {
  const parameters = new URLSearchParams({ accountCategory: query.accountCategory });
  if (query.book === "cost-of-sales") {
    parameters.set("accountSubCategory", query.accountSubCategory ?? "");
  }
  parameters.set("month", query.month);
  parameters.set("businessUnit", query.businessUnit);
  return `${bookUrl(query.book)}?${parameters.toString()}`;
}

export interface FlashAccountsState {
  /** Empty until the read has answered. */
  accounts: FlashFinancialAccount[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export function useFlashAccounts(query: FlashAccountsQuery | null): FlashAccountsState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const url = useMemo(() => (query ? flashAccountsUrl(query) : null), [query]);

  const read = useQuery<FlashFinancialAccount[], Error>({
    // A GET, so the URL is the whole question — the same as the P&L's.
    queryKey: [...FLASH_ACCOUNTS_KEY, userSub, url],
    enabled: Boolean(url) && isSignedIn && isMisFlashConfigured() && Boolean(userSub),
    queryFn: async () =>
      arrayIn<FlashFinancialAccount>(await authedGet<unknown>(url!, await getAccessToken())),
    // Not kept once the view is shut. This is the one list a reader edits from,
    // and the other app writes these same rows during the parallel period; a
    // cached copy served on the next open — this app does not refetch on mount
    // — would pre-fill a form with a forecast that has since changed.
    gcTime: 0,
    retry: httpRetry,
  });

  const folded = foldIdentityError(read, subState, retryIdentity);

  return {
    accounts: folded.data ?? [],
    isLoading: Boolean(url) && folded.isPending && folded.fetchStatus !== "idle",
    isError: folded.isError,
    errorMessage: folded.error ? humanizeHttpError(folded.error) : "",
    retry: () => void folded.refetch(),
  };
}

/** One forecast write: which book, and what `ForecastValueInput` carries. */
export interface FlashForecastEdit {
  book: FlashAccountBook;
  input: FlashForecastInput;
}

/**
 * The reads a forecast can move, besides the account list itself: the P&L and
 * every monthly detail. The detail's ARR and Booking half (`customer-summary`)
 * is sales data and is not among them.
 */
const FIGURES_A_FORECAST_MOVES = [FLASH_BALANCE_STATEMENT_KEY, FLASH_ACCOUNT_SUMMARY_KEY];

/**
 * Writes one account's forecast, and on success only, marks stale what it moved.
 *
 * The source re-reads the account list after a save and the monthly view once
 * the account view is closed, and leaves the P&L as it was until the next
 * Search. Here all three are refreshed at once — a deviation (spec §7), and the
 * only one available that keeps every figure on screen the server's current
 * answer.
 *
 * The figures not on screen are DROPPED rather than marked stale: this app does
 * not refetch on mount (`AppWithConfig.tsx`), so a stale P&L for another range
 * would be served as it was the next time it opened. The account list is
 * awaited and the rest are not, so the form closes on the new list without
 * waiting on a fourteen-section P&L.
 */
export function useWriteFlashForecast() {
  const getAccessToken = useAccessToken();
  const client = useQueryClient();
  return useMutation<void, Error, FlashForecastEdit>({
    mutationFn: async ({ book, input }) => {
      await authedPatch<unknown>(bookUrl(book), await getAccessToken(), input);
    },
    onSuccess: async () => {
      for (const queryKey of FIGURES_A_FORECAST_MOVES) {
        client.removeQueries({ queryKey, type: "inactive" });
        void client.invalidateQueries({ queryKey });
      }
      await client.invalidateQueries({ queryKey: FLASH_ACCOUNTS_KEY });
    },
  });
}

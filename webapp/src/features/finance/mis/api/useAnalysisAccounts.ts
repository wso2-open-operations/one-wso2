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
import { misArrServiceUrls } from "@config/apiConfig";
import type { MisCivilDate } from "../util/misPacificTime";
import type { MisAnalysisFilters } from "../util/misAnalysisFilters";
import {
  analysisAccountRows,
  type AnalysisAccountRow,
  type AnalysisAccountsResponse,
} from "../components/analysisAccountRows";
import { analysisAccountsRequest, analysisExitArrRequest } from "./misAnalysisRequest";
import { arrayIn } from "./misResponseArray";
import { useColumnQueries } from "./useColumnQueries";

// ARR Analysis's two reads: `POST /accounts` for the table, and
// `POST /exit-arr/search` for the figure above it.
//
// Both go through `useColumnQueries` with a list of ONE body, which is the same
// trade `useDrillDownCustomers` makes and for the same reason: this screen has
// no columns, but everything else that engine does is exactly what a POST-that-
// is-a-read needs. The body as the cache key (there is no URL to key on — spec
// §6), sub-scoping so switching accounts in one tab cannot paint the previous
// reader's revenue, `httpRetry`, `humanizeHttpError`, the identity-error fold,
// and a clean idle state while disabled.
//
// ---- what the source does instead, and what is not ported ------------------
//
// `ArrAnalysisDashboard.js:736-805` runs all four of its reads inside one
// 250ms-debounced `useEffect`, guarded by a request-id ref, a JSON-stringified
// "have the filters actually changed" key, and a retry nonce — then
// `Promise.allSettled`s them and copies each result into its own `useState`.
//
// None of that is ported, because React Query already owns every problem it
// solves: the request key IS the body, so an unchanged filter set re-reads
// nothing and the stringified guard has nothing to guard; results arriving out
// of order are the cache's problem rather than a ref's; and a failure is a
// state to read rather than one to copy into another. `allSettled` survives
// here in spirit — the two reads are independent queries, so the figure failing
// leaves the table standing and the other way round.
//
// The debounce IS ported, one level up — see `useDebouncedValue`, which the
// page applies to the filter state feeding all four reads. Ticket 13 dropped it
// on the reasoning that two reads did not justify delaying every deliberate
// click; ticket 14's charts took that to ten and earned it back. It lives over
// the filters rather than in any hook so that all four reads move together.

export interface AnalysisAccountsState {
  rows: AnalysisAccountRow[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

/** The account table's rows, for one narrowing, as at one day. */
export function useAnalysisAccounts(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
  enabled = true,
): AnalysisAccountsState {
  const bodies = useMemo(
    () => [analysisAccountsRequest(filters, today)],
    [filters, today],
  );

  const state = useColumnQueries({
    name: "analysis-accounts",
    url: misArrServiceUrls.accounts,
    bodies,
    parse: arrayIn<AnalysisAccountsResponse>,
    enabled,
  });

  const rows = useMemo(() => analysisAccountRows(state.columns[0]?.data), [state.columns]);

  return {
    rows,
    isLoading: state.isLoading,
    isError: state.isError,
    errorMessage: state.errorMessage,
    retry: state.retry,
  };
}

export interface AnalysisSummaryArrState {
  /**
   * Absent rather than zero when there is no answer yet or the read failed.
   *
   * The distinction is the whole reason this is `number | undefined`: a card
   * reading `$0` because a gateway timed out says the company earns nothing,
   * which is both false and unfalsifiable from the screen.
   */
  arr?: number;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

/**
 * The ARR figure above the table — `POST /exit-arr/search`.
 *
 * The endpoint answers with a bare `decimal` (`arr-backend/service.bal:266`),
 * not a record, which is why this cannot be another `arrayIn` caller: a list
 * coercion over a number yields `[]`, and the figure would silently be nothing.
 *
 * The source asks for three figures from this endpoint and throws two away:
 * `fetchSummaryMetrics` returns `{ arrAsOfToday, yoyGrowth: 0, logoCount: 0 }`,
 * with both zeros hard-coded (`arrAnalysisApi.js:197-210`). So only the first is
 * read here. The logo count is not lost — the screen counts the rows it has,
 * which is what the source's own card does too (`derivedSummary.logoCount` is
 * `accountsRows.length`, not the backend's zero).
 */
export function useAnalysisSummaryArr(
  filters: MisAnalysisFilters,
  today: MisCivilDate,
  enabled = true,
): AnalysisSummaryArrState {
  const bodies = useMemo(
    () => [analysisExitArrRequest(filters, today)],
    [filters, today],
  );

  const state = useColumnQueries({
    name: "analysis-exit-arr",
    url: misArrServiceUrls.exitArrSearch,
    bodies,
    parse: figureIn,
    enabled,
  });

  return {
    arr: state.columns[0]?.data,
    isLoading: state.isLoading,
    isError: state.isError,
    errorMessage: state.errorMessage,
    retry: state.retry,
  };
}

/**
 * The figure in a response, whatever shape it arrived in.
 *
 * Exported because ticket 14's breakdowns read the SAME endpoint, several times
 * over, and a second coercion for the same wire type is a second place for
 * "what counts as no figure" to be decided.
 *
 * A string is the ordinary case rather than the odd one: a Ballerina `decimal`
 * serialises as a string wherever precision matters. Anything that is not a
 * finite number after coercion is `undefined` — an absent figure, which the
 * card can say nothing about, rather than a zero it would state as fact.
 */
export const figureIn = (payload: unknown): number | undefined => {
  if (payload == null || payload === "") return undefined;
  const parsed = Number(payload);
  return Number.isFinite(parsed) ? parsed : undefined;
};

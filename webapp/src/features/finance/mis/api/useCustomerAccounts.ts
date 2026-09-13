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
import { useQueries } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedPost, humanizeHttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisArrConfigured, misArrServiceUrls } from "@config/apiConfig";
import { annualColumnLabel } from "../util/misPeriods";
import type { MisAppliedFilters, MisDateRange } from "../util/misViewVocabulary";
import type { AccountsResponse } from "../components/customerAccountRows";
import { accountsRequests } from "./misAccountsRequest";

// `POST /accounts` — the customer book behind the Software/Cloud Customers
// table, one call per column.
//
// Ported from digiops-finance `arrDashboard/hooks/useCustomerAccounts.js`,
// which is 584 lines. Most of what is missing here is date arithmetic: that
// hook carries its own Pacific-time period generator for this one table, and
// the port already cuts these ranges once in `misPeriods` for every table. Two
// generators are two places for the customers table and the Build beside it to
// disagree about when a year ended.
//
// Deliberately the same shape as `useArrSummary`, because it is the same
// problem: one read per column, keyed by its body, each column able to fail on
// its own. See that hook for why the columns are split rather than looped.
//
// ---- one source behaviour is NOT ported ------------------------------------
//
// `useCustomerAccounts.js` calls `setData([])` at the top of every run, with
// the comment "Clear previous data immediately to show loading state". On this
// table that means every filter change empties hundreds of customer rows and
// then re-paints them. React Query holds the previous answer until the next one
// lands, so the figures go stale for a moment instead of going away — which is
// the better failure on a table this tall, and is what the rest of this app
// already does.

/** One column of the customers table, and whatever is known about it so far. */
export interface CustomerAccountsColumn {
  /** The column header, `{opening} - {end}` — and its identity. */
  label: string;
  /** Absent while loading, and absent for good if this column failed. */
  accounts?: AccountsResponse[];
  isError: boolean;
}

export interface CustomerAccountsState {
  columns: CustomerAccountsColumn[];
  /** No column has answered yet, one way or the other. */
  isLoading: boolean;
  /** EVERY column failed. One failure among several is the column's problem. */
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

const EMPTY: CustomerAccountsState = {
  columns: [],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
};

/**
 * The accounts in one response, whatever shape it arrived in.
 *
 * The source coerces the same way — `Array.isArray(resp) ? resp : (resp?.data || [])`
 * — which is a note that this backend has answered both. A bare object would
 * otherwise reach the row builder and be spread into nothing, so the table
 * would show no customers and no error.
 */
function accountsIn(payload: unknown): AccountsResponse[] {
  if (Array.isArray(payload)) return payload as AccountsResponse[];
  const wrapped = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(wrapped) ? (wrapped as AccountsResponse[]) : [];
}

export function useCustomerAccounts(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  enabled = true,
): CustomerAccountsState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = enabled && isSignedIn && isMisArrConfigured() && Boolean(userSub);

  // Requests and columns are built together and stay index-aligned: a request
  // is what a column is fetched with, and pairing them anywhere else would be
  // two lists that could fall out of step.
  const requests = useMemo(() => accountsRequests(ranges, filters), [ranges, filters]);
  const labels = useMemo(() => ranges.map(annualColumnLabel), [ranges]);

  const results = useQueries({
    queries: requests.map((body) => ({
      // The body IS the key. A POST that is a read has no URL to key on, and
      // the URL is the same for every column — see spec §6.
      queryKey: ["mis", "accounts", userSub, body] as const,
      enabled: ready,
      queryFn: async () =>
        accountsIn(await authedPost<unknown>(misArrServiceUrls.accounts, await getAccessToken(), body)),
      staleTime: 5 * 60 * 1000,
      retry: httpRetry,
    })),
  });

  // The same fold every sub-keyed query in this app performs — see
  // `useArrSummary` for why it is by hand here rather than `foldIdentityError`.
  // Without it an identity error leaves every query disabled and quietly
  // reports a customer book with nobody in it.
  if (subState.status === "error") {
    return { ...EMPTY, isError: true, errorMessage: subState.message, retry: retryIdentity };
  }

  if (!requests.length) return EMPTY;

  const columns = requests.map((_body, index) => ({
    label: labels[index],
    accounts: results[index]?.data,
    isError: Boolean(results[index]?.isError),
  }));

  const firstError = results.find((result) => result.isError)?.error;
  return {
    columns,
    // `!ready` counts as loading. Until the subject resolves every query is
    // disabled, which React Query reports as pending-but-idle, so a "something
    // is fetching" test is false while `columns` is already built — and the
    // table would paint with no customers in it.
    isLoading:
      !ready || results.some((result) => result.isPending && result.fetchStatus !== "idle"),
    // Only when nothing at all came back. A table missing one year is still
    // worth reading.
    isError: results.length > 0 && results.every((result) => result.isError),
    errorMessage: firstError ? humanizeHttpError(firstError) : "",
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}

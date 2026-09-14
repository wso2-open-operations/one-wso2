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
import { annualColumnLabel } from "../util/misPeriods";
import type { MisAppliedFilters, MisDateRange } from "../util/misViewVocabulary";
import type { AccountsResponse } from "../components/customerAccountRows";
import { accountsRequests } from "./misAccountsRequest";
import { useColumnQueries } from "./useColumnQueries";
import { arrayIn } from "./misResponseArray";

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
// The one-request-per-column machinery is `useColumnQueries`, shared with
// `useArrSummary`: same problem, same shape, and a review of this ticket found
// the two hooks were 55 identical lines apart. What is left here is what is
// actually this endpoint's — its bodies, its coercion, and the word `accounts`
// for what a column holds.
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
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export function useCustomerAccounts(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  enabled = true,
): CustomerAccountsState {
  // Bodies and labels are built together and stay index-aligned: a body is what
  // a column is fetched with, and pairing them anywhere else would be two lists
  // that could fall out of step.
  const bodies = useMemo(() => accountsRequests(ranges, filters), [ranges, filters]);
  const labels = useMemo(() => ranges.map(annualColumnLabel), [ranges]);

  const state = useColumnQueries({
    name: "accounts",
    url: misArrServiceUrls.accounts,
    bodies,
    labels,
    parse: arrayIn<AccountsResponse>,
    enabled,
  });

  return {
    ...state,
    columns: state.columns.map(({ label, data, isError }) => ({ label, accounts: data, isError })),
  };
}

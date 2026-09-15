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
import { buildColumnLabel } from "../util/misPeriods";
import type { MisAppliedFilters, MisDateRange } from "../util/misViewVocabulary";
import type { ArrSummaryResponse } from "../components/arrBuildRows";
import { arrSummaryRequests } from "./misArrSummaryRequest";
import { useColumnQueries } from "./useColumnQueries";

// `POST /arr-summary` — the figures behind a Build, one call per column.
//
// The one-request-per-column machinery lives in `useColumnQueries`, shared with
// `useCustomerAccounts`: why the columns are split rather than looped, why the
// body is the cache key, why a failed column blanks only itself, and why the
// queries are sub-scoped are all written there. What stays here is what is
// actually this endpoint's — its bodies, and the word `response` for what a
// column holds.

/** One Build column, and whatever is known about it so far. */
export interface ArrSummaryColumn {
  /**
   * The column header, `{opening} - {end}` — and its identity. Unique per
   * column because no two columns close on the same date, so it doubles as the
   * key a table groups by.
   */
  label: string;
  /** Absent while loading, and absent for good if this column failed. */
  response?: ArrSummaryResponse;
  isError: boolean;
}

export interface ArrSummaryState {
  columns: ArrSummaryColumn[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export function useArrSummary(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  enabled = true,
): ArrSummaryState {
  // Bodies and labels are built together and stay index-aligned: a body is what
  // a column is fetched with, and pairing them anywhere else would be two lists
  // that could fall out of step.
  const bodies = useMemo(() => arrSummaryRequests(ranges, filters), [ranges, filters]);
  const labels = useMemo(() => ranges.map(buildColumnLabel), [ranges]);

  const state = useColumnQueries({
    name: "arr-summary",
    url: misArrServiceUrls.arrSummary,
    bodies,
    labels,
    // An empty object rather than undefined: a column that answered with
    // nothing is a column that answered, and every field lookup on it should
    // read as absent rather than as a column still loading.
    parse: (payload) => (payload as ArrSummaryResponse | null) ?? {},
    enabled,
  });

  return {
    ...state,
    columns: state.columns.map(({ label, data, isError }) => ({ label, response: data, isError })),
  };
}

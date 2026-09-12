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
import type { ArrSummaryResponse } from "../components/arrBuildRows";
import { arrSummaryRequests } from "./misArrSummaryRequest";

// `POST /arr-summary` — the figures behind a Build.
//
// ONE QUERY PER COLUMN, not one per table. The source runs a single hand-rolled
// loop over the columns, guarded by a request-id ref so a stale run cannot
// finish after a fresh one. Splitting it buys three things and costs one:
//
//   + Each column caches under its own body, so widening Years Back re-asks
//     only for the columns whose body actually changed — the new one, and the
//     one that stopped being leftmost, because `isFirstColumn` is positional.
//     Every filter change would otherwise cost the whole table.
//   + A column that fails blanks only itself. That is the source's own error
//     behaviour, but here it falls out of the shape rather than needing a
//     per-column catch inside the loop.
//   + React Query owns the races, so the request-id ref is not ported.
//   − Columns are now fetched in parallel rather than in sequence. Recorded as
//     a deviation in spec §7: ticket 06 is the ticket that measures real
//     volume, and if the gateway objects to six concurrent reads this is the
//     decision to revisit.
//
// Sub-scoped like every other identity-sensitive query in this app. The figures
// themselves are the same for anyone allowed to see them, but *being allowed*
// is not: switching accounts in one tab must not paint the previous user's
// revenue report.

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
  /** No column has answered yet, one way or the other. */
  isLoading: boolean;
  /** EVERY column failed. One failure among several is the column's problem. */
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

const EMPTY: ArrSummaryState = {
  columns: [],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
};

export function useArrSummary(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  enabled = true,
): ArrSummaryState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = enabled && isSignedIn && isMisArrConfigured() && Boolean(userSub);

  // Requests and columns are built together and stay index-aligned: a request
  // is what a column is fetched with, and pairing them anywhere else would be
  // two lists that could fall out of step.
  const requests = useMemo(() => arrSummaryRequests(ranges, filters), [ranges, filters]);
  const labels = useMemo(() => ranges.map(annualColumnLabel), [ranges]);

  const results = useQueries({
    queries: requests.map((body) => ({
      // The body IS the key. A POST that is a read has no URL to key on, and
      // the URL is the same for all six columns — see spec §6.
      queryKey: ["mis", "arr-summary", userSub, body] as const,
      enabled: ready,
      queryFn: async () =>
        (await authedPost<ArrSummaryResponse>(
          misArrServiceUrls.arrSummary,
          await getAccessToken(),
          body,
        )) ?? {},
      staleTime: 5 * 60 * 1000,
      retry: httpRetry,
    })),
  });

  // The same fold every sub-keyed query in this app performs — `useAsgardeoSub`
  // states the rule, and `foldIdentityError` implements it for a single
  // UseQueryResult. This hook returns a shape that helper cannot take (many
  // queries, one Build), so the fold is applied by hand.
  //
  // Without it the failure is silent and severe: identity error leaves
  // `userSub` undefined, so every query stays disabled, reports neither error
  // nor fetch, and the page paints a full Build with every cell blank — which
  // reads as "the company earned nothing" rather than "we could not ask".
  if (subState.status === "error") {
    return { ...EMPTY, isError: true, errorMessage: subState.message, retry: retryIdentity };
  }

  if (!requests.length) return EMPTY;

  const columns = requests.map((_body, index) => ({
    label: labels[index],
    response: results[index]?.data,
    isError: Boolean(results[index]?.isError),
  }));

  const firstError = results.find((result) => result.isError)?.error;
  return {
    columns,
    // `!ready` counts as loading, and has to. Until the subject resolves every
    // query is `enabled: false`, which React Query reports as pending-but-idle
    // — so a "some query is actually fetching" test is false, while `columns`
    // is already populated from the requests. The Build would paint in full
    // with every cell blank, which reads as "the company earned nothing"
    // rather than as "not yet".
    isLoading:
      !ready || results.some((result) => result.isPending && result.fetchStatus !== "idle"),
    // Only when nothing at all came back. A Build missing one year is still
    // worth reading, and replacing it with an error page would throw away five
    // columns that arrived perfectly well.
    isError: results.length > 0 && results.every((result) => result.isError),
    errorMessage: firstError ? humanizeHttpError(firstError) : "",
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}

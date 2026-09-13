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

import { useQueries } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedPost, humanizeHttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisArrConfigured } from "@config/apiConfig";

// One POST per Build column — the engine under `useArrSummary` and
// `useCustomerAccounts`.
//
// Both tables are read the same way and it is not a coincidence: a Build column
// is one request, so N columns are N requests. The source runs a hand-rolled
// loop over them guarded by a request-id ref, and both hooks here split them
// instead, which buys three things and costs one:
//
//   + Each column caches under its own body, so widening Years Back re-asks
//     only for the columns whose body actually changed.
//   + A column that fails blanks only itself. That is the source's own error
//     behaviour, but here it falls out of the shape rather than needing a
//     per-column catch inside the loop.
//   + React Query owns the races, so the request-id ref is not ported.
//   − Columns are fetched in parallel rather than in sequence. Recorded as a
//     deviation in spec §7; if the gateway objects to six concurrent reads,
//     this is the one place to change it for every table at once.
//
// Sub-scoped like every other identity-sensitive query in this app. The figures
// are the same for anyone allowed to see them, but *being allowed* is not:
// switching accounts in one tab must not paint the previous user's revenue.
//
// The callers stay thin and keep their own vocabulary — `response` for a Build
// column, `accounts` for a customer book — because a screen reads better saying
// what it got than saying `data`.

/** One column, and whatever is known about it so far. */
export interface ColumnQuery<T> {
  /**
   * The column header, `{opening} - {end}` — and its identity. Unique per
   * column because no two columns close on the same date, so it doubles as the
   * key a table groups by.
   */
  label: string;
  /** Absent while loading, and absent for good if this column failed. */
  data?: T;
  isError: boolean;
}

export interface ColumnQueriesState<T> {
  columns: ColumnQuery<T>[];
  /** No column has answered yet, one way or the other. */
  isLoading: boolean;
  /** EVERY column failed. One failure among several is the column's problem. */
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export interface ColumnQueriesInput<TBody, TData> {
  /** The query-key segment naming the endpoint — `arr-summary`, `accounts`. */
  name: string;
  url: string;
  /** One body per column, oldest first. The body IS the cache key. */
  bodies: readonly TBody[];
  /** One header per column, index-aligned with `bodies`. */
  labels: readonly string[];
  /** What the endpoint's payload means to the caller. */
  parse: (payload: unknown) => TData;
  enabled?: boolean;
}

export function useColumnQueries<TBody, TData>({
  name,
  url,
  bodies,
  labels,
  parse,
  enabled = true,
}: ColumnQueriesInput<TBody, TData>): ColumnQueriesState<TData> {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = enabled && isSignedIn && isMisArrConfigured() && Boolean(userSub);

  const results = useQueries({
    queries: bodies.map((body) => ({
      // The body IS the key. A POST that is a read has no URL to key on, and
      // the URL is the same for all of a table's columns — see spec §6.
      queryKey: ["mis", name, userSub, body] as const,
      enabled: ready,
      queryFn: async () => parse(await authedPost<unknown>(url, await getAccessToken(), body)),
      staleTime: 5 * 60 * 1000,
      retry: httpRetry,
    })),
  });

  // The same fold every sub-keyed query in this app performs — `useAsgardeoSub`
  // states the rule, and `foldIdentityError` implements it for a single
  // UseQueryResult. This shape is many queries and one table, so the fold is
  // applied by hand.
  //
  // Without it the failure is silent and severe: an identity error leaves
  // `userSub` undefined, so every query stays disabled, reports neither error
  // nor fetch, and the table paints in full with every cell blank — which reads
  // as "the company earned nothing" rather than "we could not ask".
  if (subState.status === "error") {
    return {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: subState.message,
      retry: retryIdentity,
    };
  }

  if (!bodies.length) {
    return { columns: [], isLoading: false, isError: false, errorMessage: "", retry: () => {} };
  }

  const columns = bodies.map((_body, index) => ({
    label: labels[index],
    data: results[index]?.data,
    isError: Boolean(results[index]?.isError),
  }));

  const firstError = results.find((result) => result.isError)?.error;
  return {
    columns,
    // `!ready` counts as loading, and has to. Until the subject resolves every
    // query is `enabled: false`, which React Query reports as pending-but-idle
    // — so a "some query is actually fetching" test is false, while `columns`
    // is already populated from the bodies. The table would paint in full with
    // every cell blank, which reads as "nothing" rather than as "not yet".
    isLoading: !ready || results.some((r) => r.isPending && r.fetchStatus !== "idle"),
    // Only when nothing at all came back. A table missing one year is still
    // worth reading, and replacing it with an error page would throw away the
    // columns that arrived perfectly well.
    isError: results.length > 0 && results.every((result) => result.isError),
    errorMessage: firstError ? humanizeHttpError(firstError) : "",
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}

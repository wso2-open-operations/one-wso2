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
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, humanizeHttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisArrConfigured, misArrServiceUrls } from "@config/apiConfig";
import type { MisDateRange } from "../util/misViewVocabulary";
import { arrayIn } from "./misResponseArray";
import type { OpportunityResponse } from "../components/opportunityRows";

// `GET /opportunities` — the opportunities behind one account, as at one date.
//
// A GET with query parameters, which makes this the ONE MIS read whose URL is
// its own cache key. Every other read on these screens is a POST carrying a
// filter body, so `useColumnQueries` keys on the body; here there is no body
// and the two parameters are in the address.
//
// ---- what the source does to work out that date, and why none of it is here -
//
// `accountId` and `endDate` are the whole request
// (`arr-backend/service.bal:129`). The source arrives at `endDate` through two
// layers of scraping:
//
//   1. `extractDateRangeFromColumn(params.column)` pulls dates off the clicked
//      ag-Grid column (`DataGrid.js:611`), then
//   2. `OpportunitiesDialog` RE-derives it from the column's rendered HEADER
//      TEXT with two regexes when that came back empty — matching `as of
//      2025-06-30` and then `as of Jun 30, 2025` (`:130-163`).
//
// Reading a date back out of a string a component just printed is a round trip
// through the presentation layer, and it fails silently: no match means `null`,
// which means no `endDate`, which means a 400 the dialog shows as its generic
// error. None of it is ported. `BuildTable` hands the cell's own `MisDateRange`
// to `onActivate`, so the port has the date structurally — the thing the source
// is trying to recover.
//
// `startDate` is not sent. `useOpportunities.js:21` takes it, documents it as
// "(Deprecated/ignored)", and never puts it on the URL; the backend resource
// declares `accountId` and `endDate` only.

/** What one opportunities read is for. `null` means the dialog is shut. */
export interface OpportunitiesRequest {
  accountId: string;
  /** `yyyy-MM-dd`. The closing date of the column the reader clicked. */
  endDate: string;
}

/**
 * The request for a cell, or `null` when there is nothing to ask.
 *
 * Pure, and exported for its own test: this is where the port's decision about
 * what the backend is told lives, and the date it sends is the whole of what
 * the source works so hard to recover.
 */
export function opportunitiesRequest(
  accountId: string | undefined,
  range: MisDateRange | undefined,
): OpportunitiesRequest | null {
  if (!accountId || !range?.end) return null;
  // `2026/09/21` → `2026-09-21`, the shape this endpoint wants.
  return { accountId, endDate: range.end.replace(/\//g, "-") };
}

export interface OpportunitiesState {
  opportunities: OpportunityResponse[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * The opportunities for one account.
 *
 * Sub-scoped like every other identity-sensitive query in this app: these are
 * named customers and their contract values, and switching accounts in one tab
 * must not serve the previous reader's answer out of cache.
 *
 * ---- the source's error handling is broken, and this does not copy it ------
 *
 * `http.js:65` hands the failure callback a STRING, so `useOpportunities.js`
 * reading `error?.message` off it is always `undefined` and always falls
 * through to its literal `'Failed to fetch data. Select an account under a date
 * range to view opportunities.'` — a sentence that blames the reader for a
 * gateway timeout. It does at least HAVE an error state, which is more than
 * `useArrSummaryCustomers.js` manages; the message is the part that is wrong.
 * This surfaces the backend's own, the same as the drill-down beside it.
 */
export function useOpportunities(request: OpportunitiesRequest | null): OpportunitiesState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const url = useMemo(() => {
    if (!request) return "";
    const parameters = new URLSearchParams({
      accountId: request.accountId,
      endDate: request.endDate,
    });
    return `${misArrServiceUrls.opportunities}?${parameters.toString()}`;
  }, [request]);

  const query = useQuery<OpportunityResponse[], Error>({
    // The URL, because this one HAS a distinguishing URL — see the note above.
    queryKey: ["mis", "opportunities", userSub, url],
    enabled: Boolean(request) && isSignedIn && isMisArrConfigured() && Boolean(userSub),
    queryFn: async () =>
      arrayIn<OpportunityResponse>(await authedGet<unknown>(url, await getAccessToken())),
    staleTime: FIVE_MINUTES,
    retry: httpRetry,
  });

  const folded = foldIdentityError(query, subState, retryIdentity);

  return {
    opportunities: folded.data ?? [],
    // `fetchStatus` guards the disabled case: with the dialog shut the query is
    // pending and idle, which is not loading.
    isLoading: folded.isPending && folded.fetchStatus !== "idle",
    isError: folded.isError,
    errorMessage: folded.error ? humanizeHttpError(folded.error) : "",
    retry: () => void folded.refetch(),
  };
}

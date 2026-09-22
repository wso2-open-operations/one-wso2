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
import { isMisFlashConfigured, misFlashServiceUrls } from "@config/apiConfig";
import type { MisFlashRange } from "../util/misFlashPeriods";
import { recordIn } from "./misResponseArray";
import type { FlashBalanceStatement } from "./misFlashTypes";

// `GET /balance-statement` — the whole monthly P&L in one read.
//
// Unlike every Build table, this is ONE call rather than one per column: the
// columns here are business units and they all arrive in the same body. So
// there is no `useColumnQueries` underneath it, and no partial answer to
// reason about — the statement either came back or it did not.
//
// ---- the shape of the request, and the one thing easy to get wrong ---------
//
// `subRegions` REPEATS. The Ballerina resource declares `string[]?`
// (`flash-backend/service.bal:32`), which is read from repeated query
// parameters, and the source builds exactly that by pushing one
// `subRegions=<name>` per selection (`FlashConsole.js`'s `fetchData`). Joining
// them with commas would send one sub-region whose name contains a comma, and
// the backend would answer with an empty P&L rather than an error.
//
// A GET, so the URL is its own cache key — the same as `/opportunities` and
// unlike every POST-that-is-a-read on these screens (spec §6).
//
// Sub-scoped like every identity-sensitive query in this app. This is the
// company's P&L; switching accounts in one tab must not paint the previous
// reader's.

/**
 * The address of one P&L.
 *
 * Exported for its own test: the repeated parameter is the request's one
 * subtlety, and a test that went through the hook to reach it would be testing
 * React Query.
 */
export function balanceStatementUrl(
  range: MisFlashRange,
  subRegions: readonly string[],
): string {
  const parameters = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  for (const subRegion of subRegions) parameters.append("subRegions", subRegion);
  // `%20`, not `+`. `URLSearchParams.toString()` uses form encoding, where a
  // space is `+`; the source sends its query through `encodeURI`
  // (`utils/http.js`), so the wire form is `%20`. EVERY sub-region name has a
  // space in it — `"EU : EU 1"`, `"NA - CENTRAL"`, `"NO POD"`, `"- None -"` —
  // and whether a gateway and Ballerina's query binding read `+` back as a
  // space is not something this port has ever exercised. If they do not, the
  // filter silently matches nothing and the P&L comes back empty rather than
  // erroring, which is the same failure this function's own note rejects
  // comma-joining to avoid.
  return `${misFlashServiceUrls.balanceStatement}?${parameters.toString().replace(/\+/g, "%20")}`;
}

export interface FlashBalanceStatementState {
  /** Empty until the call has answered, so the table draws its sections either way. */
  statement: FlashBalanceStatement;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

const FIVE_MINUTES = 5 * 60 * 1000;

export function useFlashBalanceStatement(
  range: MisFlashRange,
  subRegions: readonly string[],
): FlashBalanceStatementState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const url = useMemo(() => balanceStatementUrl(range, subRegions), [range, subRegions]);

  const query = useQuery<FlashBalanceStatement, Error>({
    queryKey: ["mis", "balance-statement", userSub, url],
    enabled: isSignedIn && isMisFlashConfigured() && Boolean(userSub),
    // A body that is not a record draws fourteen empty sections if it reaches
    // `flashPnlRows` — see `recordIn`.
    queryFn: async () =>
      recordIn<FlashBalanceStatement>(await authedGet<unknown>(url, await getAccessToken())),
    staleTime: FIVE_MINUTES,
    retry: httpRetry,
  });

  // Without this an identity failure leaves the query disabled — neither
  // erroring nor fetching — and the P&L paints its fourteen headings with every
  // line missing, which reads as a company that traded nothing.
  const folded = foldIdentityError(query, subState, retryIdentity);

  return {
    statement: folded.data ?? {},
    isLoading: folded.isPending && folded.fetchStatus !== "idle",
    isError: folded.isError,
    errorMessage: folded.error ? humanizeHttpError(folded.error) : "",
    retry: () => void folded.refetch(),
  };
}

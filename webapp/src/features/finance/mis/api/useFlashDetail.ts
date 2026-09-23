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
import { humanizeHttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisFlashConfigured } from "@config/apiConfig";
import {
  flashAccountSummaryQuery,
  flashDetailBody,
  flashSalesQuery,
  type FlashDetailRequest,
} from "./flashDetailQueries";
import type { FlashFinancialAccountStatistics, FlashSalesStatistics } from "./misFlashTypes";

// `POST /customer-summary` and `POST /account-summary` — one business unit's
// P&L, month by month.
//
// **Both are READS that take a body**, which is the whole reason they are POSTs
// and the whole reason the body is in the React Query key rather than the URL:
// the URL is the same for every business unit, so keying on it would serve
// Integration's figures under Choreo's heading. Spec §6 states the rule; this
// is one of the three places in the port that has to obey it. The keys, the
// body and the calls live in `flashDetailQueries`, shared with the Full
// Report's reader so that the two cache under one key.
//
// ---- two calls and one table -----------------------------------------------
//
// The backend splits sales statistics from financial-account statistics
// (`StatisticType` in its own types), so ARR and Booking come from one endpoint
// and the other twelve sections from the other. The SAME body goes to both. The
// source makes the pair as two hand-rolled promises inside one `useCallback`
// and stitches the answers with `Promise.all`; here they are two queries, which
// buys the thing that matters on a dialog someone opens and closes repeatedly —
// each is cached under its own body, so reopening a unit already read shows it
// without a round trip.
//
// A failure in one does not blank the other. That is the source's behaviour
// too, by accident of its `.catch`; here it falls out of the shape, and
// `flashDetailRows` draws every heading with the answered sections filled.

export interface FlashDetailState {
  sales: FlashSalesStatistics;
  accounts: FlashFinancialAccountStatistics;
  /** Neither call has answered yet. */
  isLoading: boolean;
  /** BOTH failed. One failure alone leaves a table still worth reading. */
  isError: boolean;
  /**
   * ONE failed and the other answered: the table draws the answered sections
   * and leaves the rest blank. Worth reading on screen, but not worth writing
   * to a file, where blank sections would read as a unit with nothing to say —
   * so the monthly view's Export is withheld (ticket 18).
   */
  isPartial: boolean;
  errorMessage: string;
  retry: () => void;
}

/** `request` is what the open dialog is for; `null` means it is shut, and nothing is asked. */
export function useFlashDetail(request: FlashDetailRequest | null): FlashDetailState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = Boolean(request) && isSignedIn && isMisFlashConfigured() && Boolean(userSub);

  const body = useMemo(() => (request ? flashDetailBody(request) : null), [request]);

  // The BODY, not the URL, is the key. See the note above.
  const sales = useQuery<FlashSalesStatistics, Error>({
    ...flashSalesQuery(userSub, body, getAccessToken),
    enabled: ready,
  });
  const accounts = useQuery<FlashFinancialAccountStatistics, Error>({
    ...flashAccountSummaryQuery(userSub, body, getAccessToken),
    enabled: ready,
  });

  // The same fold every sub-keyed query here performs, applied by hand because
  // this shape is two queries and one table. Without it an identity failure
  // leaves both disabled — neither erroring nor fetching — and the dialog opens
  // on fourteen headings and no figures, which reads as a business unit that
  // earned nothing.
  if (subState.status === "error") {
    return {
      sales: {},
      accounts: {},
      isLoading: false,
      isError: true,
      isPartial: false,
      errorMessage: subState.message,
      retry: retryIdentity,
    };
  }

  const pending = (query: { isPending: boolean; fetchStatus: string }) =>
    query.isPending && query.fetchStatus !== "idle";

  return {
    sales: sales.data ?? {},
    accounts: accounts.data ?? {},
    // `!ready` counts as loading while the dialog is open and the subject is
    // still resolving: both queries are disabled then, which React Query reports
    // as pending-but-idle.
    isLoading: Boolean(request) && (!ready || pending(sales) || pending(accounts)),
    isError: sales.isError && accounts.isError,
    isPartial: sales.isError !== accounts.isError,
    errorMessage: humanizeFirst(sales.error, accounts.error),
    retry: () => {
      if (sales.isError) void sales.refetch();
      if (accounts.isError) void accounts.refetch();
    },
  };
}

const humanizeFirst = (...errors: (Error | null)[]): string => {
  const first = errors.find(Boolean);
  return first ? humanizeHttpError(first) : "";
};

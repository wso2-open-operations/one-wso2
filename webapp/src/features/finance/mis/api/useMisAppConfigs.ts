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
import {
  EMPTY_MIS_FILTER_OPTIONS,
  misFilterOptions,
  type MisAppConfigs,
  type MisFilterOptions,
} from "./misAppConfigs";

// `GET /app-configs` — the one call behind every menu on the filter bar.
//
// Nine list filters and two custom unit lists, all from one response, fetched
// once and shared: React Query dedupes on the key below, so each control asking
// independently still makes one request. The source achieves the same with a
// Redux slice and a `if (!appConfigs) dispatch(fetch…)` guard on a render
// (`ArrDashboard.js:44-48`) — which is the part of its shell this port deletes.
//
// The lists themselves are not secret in any interesting way, but WHO may ask
// is: this is the same ARR backend that answers /user-info, behind the same
// gateway. So the query is sub-scoped like every other identity-sensitive query
// in this app — switching accounts in one tab must not serve the previous
// user's answer out of cache.
//
// An hour of staleTime rather than the five minutes the figures get. These are
// reference lists — a sales region is not added during a reading session — and
// re-fetching them on every remount of a screen costs a round trip to show a
// menu that has not changed.
const ONE_HOUR = 60 * 60 * 1000;

export interface MisAppConfigsState {
  /** Always a complete set of menus; empty ones before the call has answered. */
  options: MisFilterOptions;
  /** True until the call has resolved one way or the other. */
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
}

export function useMisAppConfigs(): MisAppConfigsState {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<MisAppConfigs>({
    queryKey: ["mis", "app-configs", userSub],
    enabled: isSignedIn && isMisArrConfigured() && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return (await authedGet<MisAppConfigs>(misArrServiceUrls.appConfigs, accessToken)) ?? {};
    },
    staleTime: ONE_HOUR,
    retry: httpRetry,
  });

  // The same fold the other MIS queries perform, for the same reason: an
  // identity failure leaves the query disabled, which reports neither error nor
  // fetch — so without this the bar would sit with empty menus and no
  // explanation for why nothing can be filtered by.
  const folded = foldIdentityError(query, subState, retryIdentity);

  // Narrow rather than trust. A 200 carrying a gateway error page resolves to a
  // string, and `misFilterOptions` would then read `.salesRegions` off it and
  // hand every control `[]` — which is the right answer, but arrived at by
  // accident. Deciding it here makes it the intent.
  const options = useMemo(
    () => (isConfigsBody(folded.data) ? misFilterOptions(folded.data) : EMPTY_MIS_FILTER_OPTIONS),
    [folded.data],
  );

  return {
    options,
    isLoading: folded.isPending && folded.fetchStatus !== "idle",
    isError: folded.isError,
    errorMessage: folded.error ? humanizeHttpError(folded.error) : "",
    retry: () => void folded.refetch(),
  };
}

const isConfigsBody = (body: unknown): body is MisAppConfigs =>
  typeof body === "object" && body !== null && !Array.isArray(body);

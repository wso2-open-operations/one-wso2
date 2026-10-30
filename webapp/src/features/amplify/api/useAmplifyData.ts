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

// Reads from amplify-api, through its API proxy.
//
// Every key is scoped to the signed-in subject, same as TIL: a tab switching
// accounts must not serve the previous user's grants or LinkedIn status from cache.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { amplifyServiceUrls, isAmplifyBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { amplifyRetry } from "../util/amplifyError";
import type { AmplifyMe, CampaignPage, Category, Leaderboard, Share, TopBoard } from "./amplifyTypes";

export { isAmplifyBackendConfigured };

// The most a page asks for at once (amplify-api caps `size` at 50).
export const AMPLIFY_PAGE_SIZE = 50;

export function amplifyKey(name: string, sub: string | undefined, ...rest: unknown[]): unknown[] {
  return ["amplify", name, sub, ...rest];
}

export function useAmplifyQueryBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isAmplifyBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/**
 * The caller, their grants and their LinkedIn connection status (GET /me).
 * `enabled` keeps it quiet off the Amplify perspective (the rail asks for the
 * Amplify gate on every perspective it renders).
 */
export function useAmplifyMe(enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<AmplifyMe>({
    queryKey: amplifyKey("me", userSub),
    enabled: ready && enabled,
    queryFn: async () => authedGet<AmplifyMe>(amplifyServiceUrls.me, await getAccessToken()),
    staleTime: 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Campaigns, priority first then newest (the API's order).
 *
 * `open` is what every employee sees. `all` is any status and only answers for
 * `CAN_CAMPAIGN`; anyone else is limited to open posts server-side.
 */
export function useAmplifyCampaigns(status: "open" | "all") {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<CampaignPage>({
    queryKey: amplifyKey("campaigns", userSub, status),
    enabled: ready,
    queryFn: async () => {
      const params = new URLSearchParams({ status, size: String(AMPLIFY_PAGE_SIZE) });
      // Current Posts looks past the two-week employee window.
      if (status === "all") params.set("window", "365d");
      return authedGet<CampaignPage>(`${amplifyServiceUrls.campaigns}?${params}`, await getAccessToken());
    },
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The caller's own shares, so Celebrate can drop posts they've already amplified. */
export function useMyShares() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<{ items: Share[] }>({
    queryKey: amplifyKey("my-shares", userSub),
    enabled: ready,
    queryFn: async () => authedGet<{ items: Share[] }>(amplifyServiceUrls.myShares, await getAccessToken()),
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Company top N, the caller's standing and My Team. */
export function useAmplifyLeaderboard() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<Leaderboard>({
    queryKey: amplifyKey("leaderboard", userSub),
    enabled: ready,
    queryFn: async () => authedGet<Leaderboard>(amplifyServiceUrls.leaderboard, await getAccessToken()),
    // The API caches for 30 s itself (Cache-Control: private, max-age=30).
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The company top three and the caller's own position (Celebrate), for the scope the server is set to,
 * this month by default. The server sums the month once and every caller reuses it for 2 hours, so a short
 * client stale time only costs a cheap cache hit.
 */
export function useAmplifyTopBoard() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<TopBoard>({
    queryKey: amplifyKey("leaderboard-top", userSub),
    enabled: ready,
    queryFn: async () => authedGet<TopBoard>(amplifyServiceUrls.leaderboardTop, await getAccessToken()),
    // The API sends Cache-Control: private, max-age=60.
    staleTime: 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The post categories New Post offers, in the API's order. */
export function useAmplifyCategories() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<Category[]>({
    queryKey: amplifyKey("categories", userSub),
    enabled: ready,
    queryFn: async () => {
      const body = await authedGet<{ categories: Category[] }>(amplifyServiceUrls.categories, await getAccessToken());
      return [...body.categories].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    staleTime: 10 * 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

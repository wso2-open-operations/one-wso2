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

import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { amplifyServiceUrls, isAmplifyBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { amplifyRetry } from "../util/amplifyError";
import { DEFAULT_POST_LINK_ORIGINS } from "../util/linkedinPost";
import type {
  AmplifyAppConfig,
  AmplifyMe,
  CampaignPage,
  Category,
  Leaderboard,
  Share,
  TeamPage,
  TopBoard,
} from "./amplifyTypes";

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
 * Deployment settings amplify-api sends in `GET /me` (LinkedIn company page, privacy notice, allowed post-link
 * origins). Until /me loads, or if it fails, the org and privacy values are empty and links are limited to
 * LinkedIn, so nothing is sent or followed on a guess.
 *
 * `campaignLinkOrigins` is the wire name (openapi.yaml); it also decides which LinkedIn sign-in page the consent
 * popup may follow, which is how the local mock's `http://localhost:19091` gets through.
 */
export function amplifyConfigFrom(me: AmplifyMe | undefined): AmplifyAppConfig {
  return {
    linkedinOrgUrn: me?.config?.linkedinOrgUrn ?? "",
    privacyNoticeUrl: me?.config?.privacyNoticeUrl ?? "",
    campaignLinkOrigins: me?.config?.campaignLinkOrigins?.length
      ? me.config.campaignLinkOrigins
      : [...DEFAULT_POST_LINK_ORIGINS],
  };
}

export function useAmplifyConfig(): AmplifyAppConfig {
  const { data } = useAmplifyMe();
  return amplifyConfigFrom(data);
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

/** How often the caller's shares are checked while one of them is still queued. */
export const QUEUED_SHARE_POLL_MS = 30 * 1000;

/** The shares query's refetch interval: every 30 s while a share is queued, otherwise none. */
export function pollWhileQueued(shares: Share[] | undefined): number | false {
  return shares?.some((s) => s.status === "QUEUED") ? QUEUED_SHARE_POLL_MS : false;
}

/** True when a share that was QUEUED in `before` is PUBLISHED in `after`: its points have just been awarded. */
export function sharePublishedSince(before: Share[] | undefined, after: Share[]): boolean {
  const queued = new Set((before ?? []).filter((s) => s.status === "QUEUED").map((s) => s.id));
  return after.some((s) => s.status === "PUBLISHED" && queued.has(s.id));
}

/** Refetches the leaderboard and the Celebrate top board now, including copies no page is showing. */
function refreshBoards(qc: QueryClient, sub: string | undefined): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: amplifyKey("leaderboard", sub), refetchType: "all" }),
    qc.invalidateQueries({ queryKey: amplifyKey("leaderboard-top", sub), refetchType: "all" }),
  ]);
}

/**
 * The caller's own shares, so Celebrate can drop posts they've already amplified.
 *
 * A share is queued (202) and published by the next Amplify Jobs run, which is when its points are awarded. While
 * one is queued, the list is checked every 30 s (only while the tab is visible), and when a queued share comes back
 * PUBLISHED the boards are refetched, so the new points show without a page reload.
 */
export function useMyShares() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const qc = useQueryClient();
  const queryKey = amplifyKey("my-shares", userSub);
  const query = useQuery<{ items: Share[] }>({
    queryKey,
    enabled: ready,
    queryFn: async () => {
      const before = qc.getQueryData<{ items: Share[] }>(queryKey)?.items;
      const shares = await authedGet<{ items: Share[] }>(amplifyServiceUrls.myShares, await getAccessToken());
      if (sharePublishedSince(before, shares.items)) void refreshBoards(qc, userSub);
      return shares;
    },
    staleTime: 30 * 1000,
    refetchInterval: (q) => pollWhileQueued(q.state.data?.items),
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Search, sort and paging for the team page. */
export interface TeamPageParams {
  q: string;
  sort: "rank" | "points" | "name";
  page: number;
  size: number;
}

/**
 * The full team page (GET /team). `keepPreviousData` keeps the last page on screen while the next one loads, so
 * paging and sorting don't flash an empty table.
 */
export function useAmplifyTeamPage(params: TeamPageParams) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<TeamPage>({
    queryKey: amplifyKey("team", userSub, params.q, params.sort, params.page, params.size),
    enabled: ready,
    queryFn: async () => {
      const search = new URLSearchParams({
        sort: params.sort,
        page: String(params.page),
        size: String(params.size),
      });
      if (params.q) search.set("q", params.q);
      return authedGet<TeamPage>(`${amplifyServiceUrls.team}?${search}`, await getAccessToken());
    },
    placeholderData: keepPreviousData,
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
    // The API sends Cache-Control: private, no-cache with an ETag, so a refetch of an unchanged board is a 304.
    staleTime: 30 * 1000,
    // The app turns both off; points change while Celebrate is open in another tab or the page is left and opened
    // again, so this board reloads (when stale) on either.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The company top three and the caller's own position (Celebrate), for the scope the server is set to,
 * this month by default. The server sums the month once, shares it with every caller and sums it again when points
 * change, so a refetch is answered from its memory.
 */
export function useAmplifyTopBoard() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<TopBoard>({
    queryKey: amplifyKey("leaderboard-top", userSub),
    enabled: ready,
    queryFn: async () => authedGet<TopBoard>(amplifyServiceUrls.leaderboardTop, await getAccessToken()),
    // The API sends Cache-Control: private, no-cache.
    staleTime: 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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

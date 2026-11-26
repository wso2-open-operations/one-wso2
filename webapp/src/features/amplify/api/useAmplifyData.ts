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

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { amplifyServiceUrls, isAmplifyBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { amplifyRetry } from "../util/amplifyError";
import { DEFAULT_POST_LINK_ORIGINS } from "../util/linkedinPost";
import type {
  ActionRequiredPage,
  AmplifyAppConfig,
  AmplifyMe,
  AmplifyPersonMatch,
  AmplifySetting,
  CampaignPage,
  Category,
  ExternalShare,
  ExternalSharePage,
  ExternalShareStatus,
  Leaderboard,
  LinkedInPage,
  MyPoints,
  NativeIntent,
  PointRule,
  PointValues,
  PointsHistory,
  SettingList,
  Share,
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

/**
 * Refetches the leaderboard, the Celebrate top board, the caller's points and their history now, including copies no
 * page is showing.
 */
function refreshBoards(qc: QueryClient, sub: string | undefined): Promise<unknown> {
  return Promise.all(
    ["leaderboard", "leaderboard-top", "my-points", "points-history"].map((name) =>
      qc.invalidateQueries({ queryKey: amplifyKey(name, sub), refetchType: "all" }),
    ),
  );
}

/**
 * The caller's own shares, so Celebrate can drop posts they've already amplified.
 *
 * A share is queued (202) and published by the next Amplify Jobs run, which is when its points are awarded. While
 * one is queued, the list is checked every 30 s (only while the tab is visible), and when a queued share comes back
 * PUBLISHED the boards and the caller's points are refetched, so the new points show without a page reload.
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

/** The caller's own posts sent for review, newest first (GET /me/external-shares). */
export function useMyExternalShares() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<ExternalShare[]>({
    queryKey: amplifyKey("my-external-shares", userSub),
    enabled: ready,
    queryFn: async () =>
      (await authedGet<{ items: ExternalShare[] }>(amplifyServiceUrls.myExternalShares, await getAccessToken())).items,
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Claims per page on Review own posts. */
export const REVIEW_PAGE_SIZE = 10;

/**
 * One page (0-based) of claims in `status`, oldest first (GET /po/external-shares, CAN_REVIEW_SHARES). The page
 * on screen stays while the next one loads.
 */
export function useExternalSharesForReview(status: ExternalShareStatus, page: number) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<ExternalSharePage>({
    queryKey: amplifyKey("external-shares-review", userSub, status, page),
    enabled: ready,
    queryFn: async () => {
      const params = new URLSearchParams({ status, page: String(page), size: String(REVIEW_PAGE_SIZE) });
      return authedGet<ExternalSharePage>(`${amplifyServiceUrls.poExternalShares}?${params}`, await getAccessToken());
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * How many claims are waiting for review: the `total` of a one-row PENDING page. Shares its key prefix with the
 * review lists, so a decision refreshes it too.
 *
 * @param enabled - false asks nothing (a caller without `CAN_REVIEW_SHARES`, or off the Amplify perspective)
 */
export function useWaitingReviewCount(enabled: boolean) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<number>({
    queryKey: amplifyKey("external-shares-review", userSub, "PENDING", "count"),
    enabled: ready && enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ status: "PENDING", page: "0", size: "1" });
      const url = `${amplifyServiceUrls.poExternalShares}?${params}`;
      return (await authedGet<ExternalSharePage>(url, await getAccessToken())).total;
    },
    staleTime: 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The fewest characters GET /po/people searches on. */
export const PEOPLE_SEARCH_MIN_LENGTH = 2;

/** How many matches the person search asks for. */
export const PEOPLE_SEARCH_LIMIT = 10;

/**
 * People who have used Amplify whose name or email matches `q` (GET /po/people, CAN_ADJUST_POINTS). Asks nothing
 * until the trimmed text has two characters; the caller debounces it.
 */
export function usePoPeopleSearch(q: string) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const term = q.trim();
  const query = useQuery<AmplifyPersonMatch[]>({
    queryKey: amplifyKey("po-people", userSub, term),
    enabled: ready && term.length >= PEOPLE_SEARCH_MIN_LENGTH,
    queryFn: async () => {
      const params = new URLSearchParams({ q: term, limit: String(PEOPLE_SEARCH_LIMIT) });
      const url = `${amplifyServiceUrls.poPeople}?${params}`;
      return (await authedGet<{ items: AmplifyPersonMatch[] }>(url, await getAccessToken())).items;
    },
    staleTime: 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * One page (0-based) of a person's points history, newest first (GET /team/{employeeId}/history), with their
 * all-time points in `totalPoints`. The page on screen stays while the next one loads. Asks nothing without an id.
 */
export function usePointsHistoryPage(employeeId: string | null, page: number, size: number) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const id = employeeId?.trim() || null;
  const query = useQuery<PointsHistory>({
    queryKey: amplifyKey("points-history", userSub, id ?? "", page, size),
    enabled: ready && id !== null,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const url = `${amplifyServiceUrls.pointsHistory(id ?? "")}?${params}`;
      return authedGet<PointsHistory>(url, await getAccessToken());
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Rows per request in the caller's own activity list. */
export const ACTIVITY_PAGE_SIZE = 25;

/** The page number after `pages`, or undefined when the last one was the end of the history. */
export function nextHistoryPage(last: PointsHistory, pages: readonly PointsHistory[]): number | undefined {
  return last.items.length < ACTIVITY_PAGE_SIZE || pages.length * ACTIVITY_PAGE_SIZE >= last.total
    ? undefined
    : pages.length;
}

/**
 * The caller's own points history, newest first, `ACTIVITY_PAGE_SIZE` rows at a time (GET
 * /team/{employeeId}/history); `fetchNextPage` adds the next page. Asks nothing until `employeeId` (GET /me
 * `employee.employeeId`) is known, so an identity failure surfaces on /me rather than here.
 */
export function useMyActivity(employeeId: string | undefined) {
  const { getAccessToken, userSub, ready } = useAmplifyQueryBasis();
  const id = employeeId?.trim() || null;
  return useInfiniteQuery<PointsHistory, Error, InfiniteData<PointsHistory>, unknown[], number>({
    queryKey: amplifyKey("points-history", userSub, id ?? "", "feed"),
    enabled: ready && id !== null,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), size: String(ACTIVITY_PAGE_SIZE) });
      const url = `${amplifyServiceUrls.pointsHistory(id ?? "")}?${params}`;
      return authedGet<PointsHistory>(url, await getAccessToken());
    },
    getNextPageParam: nextHistoryPage,
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
}

/** Which standing GET /me/points answers for: all time, or this calendar month (UTC). */
export type MyPointsScope = "ALL" | "MONTH";

/** The `period` GET /me/points takes for `scope`: `ALL`, or the month `now` falls in as `YYYY-MM` (UTC). */
export function myPointsPeriod(scope: MyPointsScope, now: Date = new Date()): string {
  if (scope === "ALL") return "ALL";
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The caller's points and rank for `scope`, and their Coins (GET /me/points). Reloads when the page is opened again
 * or the tab regains focus, like the leaderboards, since points change while it is open.
 */
export function useMyPoints(scope: MyPointsScope) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const period = myPointsPeriod(scope);
  const query = useQuery<MyPoints>({
    queryKey: amplifyKey("my-points", userSub, period),
    enabled: ready,
    queryFn: async () =>
      authedGet<MyPoints>(`${amplifyServiceUrls.myPoints}?period=${encodeURIComponent(period)}`, await getAccessToken()),
    staleTime: 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The points each action earns today (GET /point-values, every employee). */
export function usePointValues() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<PointValues>({
    queryKey: amplifyKey("point-values", userSub),
    enabled: ready,
    queryFn: async () =>
      (await authedGet<{ values: PointValues }>(amplifyServiceUrls.pointValues, await getAccessToken())).values,
    staleTime: 5 * 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Which settings endpoint a screen uses: the PO team's (`/po/settings`, CAN_POINT_RULES: the Coins rate and schedule
 * and the own-post daily limit) or the admins' (`/admin/settings`, CAN_ADMIN: every editable key).
 */
export type SettingsScope = "po" | "admin";

/** The URL of `scope`'s settings, for GET and PUT. */
export function settingsUrl(scope: SettingsScope): string {
  return scope === "admin" ? amplifyServiceUrls.adminSettings : amplifyServiceUrls.poSettings;
}

/**
 * The settings `scope` lists (GET /po/settings or /admin/settings), each with the version a change sends back.
 *
 * @param enabled - false asks nothing (a caller without the scope's grant)
 */
export function useAmplifySettings(scope: SettingsScope, enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<AmplifySetting[]>({
    queryKey: amplifyKey("settings", userSub, scope),
    enabled: ready && enabled,
    queryFn: async () => (await authedGet<SettingList>(settingsUrl(scope), await getAccessToken())).settings,
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Every points rule version (GET /po/point-rules, CAN_POINT_RULES).
 *
 * @param enabled - false asks nothing (a caller without the grant)
 */
export function usePointRules(enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<PointRule[]>({
    queryKey: amplifyKey("point-rules", userSub),
    enabled: ready && enabled,
    queryFn: async () =>
      (await authedGet<{ rules: PointRule[] }>(amplifyServiceUrls.poPointRules, await getAccessToken())).rules,
    staleTime: 60 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Whether post cards offer "Repost on LinkedIn" (`sharing.native_repost_default`, sent in GET /me `config`). False
 * until /me answers.
 */
export function useNativeRepostEnabled(): boolean {
  const { data } = useAmplifyMe();
  return data?.config?.nativeRepostDefault === true;
}

/** How often the caller's reposts are checked while Amplify is still looking for one. */
export const NATIVE_LOOKING_POLL_MS = 2 * 60 * 1000;

/** The native intents query's refetch interval: every two minutes while one is LOOKING, otherwise none. */
export function pollWhileLooking(intents: readonly NativeIntent[] | undefined): number | false {
  return intents?.some((i) => i.nativeStatus === "LOOKING") ? NATIVE_LOOKING_POLL_MS : false;
}

/**
 * The posts the caller opened to repost on LinkedIn themselves, newest first (GET /me/native-intents), each LOOKING,
 * DETECTED or NOT_FOUND. Checked again every two minutes while one is LOOKING, so the card turns to "Found your
 * repost" once the engagement sync has seen it.
 *
 * @param enabled - false asks nothing (the Repost on LinkedIn button is off)
 */
export function useMyNativeIntents(enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<NativeIntent[]>({
    queryKey: amplifyKey("native-intents", userSub),
    enabled: ready && enabled,
    queryFn: async () =>
      (await authedGet<{ items: NativeIntent[] }>(amplifyServiceUrls.myNativeIntents, await getAccessToken())).items,
    staleTime: 30 * 1000,
    refetchInterval: (q) => pollWhileLooking(q.state.data),
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The company page connection and today's LinkedIn calls against the daily budget (GET /admin/linkedin-page,
 * CAN_ADMIN).
 *
 * @param enabled - false asks nothing (a caller without CAN_ADMIN)
 */
export function useLinkedInPage(enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<LinkedInPage>({
    queryKey: amplifyKey("linkedin-page", userSub),
    enabled: ready && enabled,
    queryFn: async () => authedGet<LinkedInPage>(amplifyServiceUrls.linkedinPage, await getAccessToken()),
    staleTime: 30 * 1000,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Rows per page in Points & corrections' Action required list. */
export const ACTION_REQUIRED_PAGE_SIZE = 10;

/**
 * One page (0-based) of the ledger rows waiting for the PO team, oldest first (GET /po/points/action-required,
 * CAN_ADJUST_POINTS): rows the pre-coin check couldn't verify on LinkedIn, or that a PO held back. The page on screen
 * stays while the next one loads.
 */
export function useActionRequired(page: number) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<ActionRequiredPage>({
    queryKey: amplifyKey("action-required", userSub, page),
    enabled: ready,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: String(ACTION_REQUIRED_PAGE_SIZE) });
      return authedGet<ActionRequiredPage>(`${amplifyServiceUrls.poPointsActionRequired}?${params}`, await getAccessToken());
    },
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    retry: amplifyRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

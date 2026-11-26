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

// Reads for the Dashboarding boards. Same scoping as useAmplifyData: every key carries the signed-in
// subject. The API caches each board for 60 s, so the UI holds it for the same time.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { authedGet, fetchWithReauth, HttpError } from "@api/http";
import { amplifyServiceUrls } from "@config/apiConfig";
import { foldIdentityError } from "@hooks/useAsgardeoSub";
import { amplifyRetry } from "../util/amplifyError";
import { amplifyKey, useAmplifyQueryBasis } from "./useAmplifyData";
import type {
  GroupSort,
  SortDir,
  DashboardGlance,
  DashboardOperations,
  DashboardParticipation,
  DashboardCampaigns,
  DashboardPersonBoard,
  DashboardScorecard,
  GroupBoard,
} from "./amplifyTypes";

const BOARD_STALE_MS = 60 * 1000;

/** `keepPrevious` holds the last answer on screen while the next key loads (a popup that pages through posts). */
function useBoardQuery<T>(name: string, url: string, enabled: boolean, keyRest: unknown[], keepPrevious: boolean) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useAmplifyQueryBasis();
  const query = useQuery<T>({
    queryKey: amplifyKey(name, userSub, ...keyRest),
    enabled: ready && enabled,
    queryFn: async () => authedGet<T>(url, await getAccessToken()),
    staleTime: BOARD_STALE_MS,
    retry: amplifyRetry,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

function useBoard<T>(name: string, url: string, enabled: boolean, ...keyRest: unknown[]) {
  return useBoardQuery<T>(name, url, enabled, keyRest, false);
}

/** `url` with `includeArchived=true` when archived posts should count; the API defaults to leaving them out. */
export function withIncludeArchived(url: string, includeArchived: boolean): string {
  if (!includeArchived) return url;
  return `${url}${url.includes("?") ? "&" : "?"}includeArchived=true`;
}

/** Operations. `includeArchived` counts archived posts in the summary cards; the post list always shows them. */
export function useDashboardOperations(includeArchived = false) {
  return useBoard<DashboardOperations>(
    "dashboard-operations",
    withIncludeArchived(amplifyServiceUrls.dashboardOperations, includeArchived),
    true,
    includeArchived,
  );
}

/**
 * Post performance. `campaignId` picks the selected post; the API defaults to the one with the most reposts.
 * `includeArchived` counts archived posts in reposts by category; the post list always shows them.
 */
export function useDashboardCampaigns(campaignId?: string, includeArchived = false) {
  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  if (includeArchived) params.set("includeArchived", "true");
  const qs = params.toString();
  return useBoardQuery<DashboardCampaigns>(
    "dashboard-campaigns",
    qs ? `${amplifyServiceUrls.dashboardCampaigns}?${qs}` : amplifyServiceUrls.dashboardCampaigns,
    true,
    [campaignId ?? "", includeArchived],
    true,
  );
}

/**
 * One person's Post Performance (the person popup). Waits for an id, and never asks without one. The team list
 * sends no id for a person with no points in the period yet (or who never signed in); asking for them would call
 * `/dashboards/people/`, which no gateway route matches (a 404 on the preflight, reported as a CORS error).
 */
export function useDashboardPerson(employeeId: string | null | undefined) {
  const id = employeeId?.trim() || undefined;
  return useBoard<DashboardPersonBoard>(
    "dashboard-person",
    id === undefined ? "" : `${amplifyServiceUrls.dashboardPeople}/${encodeURIComponent(id)}`,
    id !== undefined,
    id ?? "",
  );
}

export function useDashboardParticipation() {
  return useBoard<DashboardParticipation>("dashboard-participation", amplifyServiceUrls.dashboardParticipation, true);
}

export function useDashboardGlance(includeArchived = false) {
  return useBoard<DashboardGlance>(
    "dashboard-glance",
    withIncludeArchived(amplifyServiceUrls.dashboardGlance, includeArchived),
    true,
    includeArchived,
  );
}

export function useDashboardScorecard(includeArchived = false) {
  return useBoard<DashboardScorecard>(
    "dashboard-scorecard",
    withIncludeArchived(amplifyServiceUrls.dashboardScorecard, includeArchived),
    true,
    includeArchived,
  );
}

/**
 * Teams, BUs or houses ranked against each other. `bu` narrows `TEAM` to one business unit; `sort` and `dir`
 * reorder the rows on the server (the rank stays the points-based dense rank). `enabled` holds the
 * call back until the BU is known.
 */
export function useGroupBoard(
  by: "TEAM" | "BU" | "HOUSE",
  bu?: string,
  sort: GroupSort = "rank",
  dir: SortDir = "asc",
  enabled = true,
) {
  const params = new URLSearchParams({ by });
  if (by !== "BU") {
    if (by === "TEAM" && bu) params.set("bu", bu);
    params.set("sort", sort);
    params.set("dir", dir);
  }
  return useBoard<GroupBoard>(
    "leaderboard-groups",
    `${amplifyServiceUrls.leaderboardGroups}?${params}`,
    enabled,
    by,
    bu ?? "",
    by !== "BU" ? sort : "",
    by !== "BU" ? dir : "",
  );
}

/** The raw rows behind the boards for a UTC date range (`YYYY-MM-DD`, both ends included), as CSV text. */
export function useDashboardExport() {
  const { getAccessToken } = useAmplifyQueryBasis();
  return async (from: string, to: string): Promise<Blob> => {
    const url = `${amplifyServiceUrls.dashboardExport}?${new URLSearchParams({ from, to })}`;
    const res = await fetchWithReauth(url, { headers: { Accept: "text/csv" } }, await getAccessToken());
    if (!res.ok) throw new HttpError(url, res.status, await res.text().catch(() => ""));
    return new Blob([await res.text()], { type: "text/csv;charset=utf-8" });
  };
}

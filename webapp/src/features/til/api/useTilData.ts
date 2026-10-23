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

// Reads from til-backend.
//
// Every key is scoped to the signed-in subject, same as menu/leave — a tab
// switching accounts must not serve the previous user's canModerate answer
// from cache.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { isTilBackendConfigured, tilServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { tilRetry } from "../util/tilError";
import { TIL_WHAT_DEFAULT_MAX_LENGTH, normalizeSubmission } from "./tilTypes";
import type {
  TilSettingsWire,
  TilSubmission,
  TilSubmissionsPage,
  TilSubmissionsPageWire,
  TilSubmissionsQuery,
  TilSubmissionWire,
  TilUserInfoWire,
} from "./tilTypes";

export { isTilBackendConfigured };

function useTilQueryBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isTilBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/** The caller's identity + whether they may delete other people's entries. */
export function useTilUserInfo() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useQuery<TilUserInfoWire>({
    queryKey: ["til-user-info", userSub],
    enabled: ready,
    queryFn: async () => authedGet<TilUserInfoWire>(tilServiceUrls.userInfo, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: tilRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// GET /settings, shared by every hook that reads one of its rules.
function useTilSettings() {
  const { getAccessToken, userSub, ready } = useTilQueryBasis();
  return useQuery<TilSettingsWire>({
    queryKey: ["til-settings", userSub],
    enabled: ready,
    queryFn: async () => authedGet<TilSettingsWire>(tilServiceUrls.settings, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: tilRetry,
  });
}

/** Whether entries are sent to Google Chat (GET /settings). False until the
 * answer arrives, and from a backend that predates it, so an entry is only
 * flagged as unsent when there's somewhere to send it. */
export function useTilNotificationsEnabled(): boolean {
  return useTilSettings().data?.notificationsEnabled ?? false;
}

/** The learning's length limit the backend enforces (GET /settings). `max`
 * is the backend's default until the answer arrives; `known` says whether it
 * has. The form holds Submit until then, and if the request fails it stays
 * held with a retry: guessing could let the form accept text the backend
 * rejects. */
export function useTilWhatMaxLength(): { max: number; known: boolean; failed: boolean; retry: () => void } {
  const query = useTilSettings();
  return {
    max: query.data?.whatMaxLength ?? TIL_WHAT_DEFAULT_MAX_LENGTH,
    known: query.data !== undefined,
    failed: query.isError,
    retry: () => void query.refetch(),
  };
}

function submissionsUrl(q: TilSubmissionsQuery): string {
  const params = new URLSearchParams({ limit: String(q.limit), offset: String(q.offset) });
  if (q.search) params.set("q", q.search);
  if (q.createdFrom) params.set("createdFrom", q.createdFrom);
  if (q.createdBefore) params.set("createdBefore", q.createdBefore);
  if (q.author) params.set("author", q.author);
  if (q.source) params.set("source", q.source);
  if (q.mine) params.set("mine", "true");
  return `${tilServiceUrls.submissions}?${params}`;
}

// The backend's largest page, so an export takes as few requests as it can.
export const TIL_EXPORT_PAGE_SIZE = 100;

/** Every entry, page by page from `fetchPage` (given an offset), until a page
 * comes back short or the total is reached. An entry shared mid-export can
 * shift the pages, so each entry is kept once. */
export async function collectTilPages(
  fetchPage: (offset: number) => Promise<TilSubmissionsPageWire>,
): Promise<TilSubmission[]> {
  const entries: TilSubmission[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += TIL_EXPORT_PAGE_SIZE) {
    const page = await fetchPage(offset);
    for (const wire of page.items) {
      if (seen.has(wire.id)) continue;
      seen.add(wire.id);
      entries.push(normalizeSubmission(wire));
    }
    if (page.items.length < TIL_EXPORT_PAGE_SIZE || offset + TIL_EXPORT_PAGE_SIZE >= page.total) return entries;
  }
}

/** Every entry a feed query selects, newest first, for the CSV export: the
 * query's search, dates and "mine" apply, its paging doesn't. */
export function useTilExportEntries(): (q: TilSubmissionsQuery) => Promise<TilSubmission[]> {
  const getAccessToken = useAccessToken();
  return useCallback(
    (q) =>
      collectTilPages(async (offset) =>
        authedGet<TilSubmissionsPageWire>(
          submissionsUrl({ ...q, limit: TIL_EXPORT_PAGE_SIZE, offset }),
          await getAccessToken(),
        ),
      ),
    [getAccessToken],
  );
}

/** One page of submissions, newest first, with how many match in total. The
 * backend searches, filters and pages, so a search covers every entry, not
 * just the ones loaded. The previous page stays on screen while the next one
 * loads (isPlaceholderData), instead of the feed blanking on every page turn. */
export function useTilSubmissions(q: TilSubmissionsQuery) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useQuery<TilSubmissionsPage>({
    queryKey: ["til-submissions", userSub, q],
    enabled: ready,
    queryFn: async () => {
      const page = await authedGet<TilSubmissionsPageWire>(submissionsUrl(q), await getAccessToken());
      return { items: page.items.map(normalizeSubmission), total: page.total };
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnMount: true,
    retry: tilRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** One entry by id — the detail page a Chat "View entry" link or a feed
 * card's own link lands on. 404 surfaces as a plain query error; the page
 * reads `error.status` (see HttpError) to tell "not found" apart from any
 * other failure. */
export function useTilSubmission(id: string | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useQuery<TilSubmission>({
    queryKey: ["til-submission", userSub, id],
    enabled: ready && Boolean(id),
    queryFn: async () =>
      normalizeSubmission(
        await authedGet<TilSubmissionWire>(tilServiceUrls.submission(id as string), await getAccessToken()),
      ),
    retry: tilRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

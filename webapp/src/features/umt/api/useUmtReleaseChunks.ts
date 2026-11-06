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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { umtReleaseChunkInProgress } from "../lib/umtReleaseChunks";
import {
  mapUmtReleaseChunk,
  mapUmtReleaseChunkBuildStatus,
  mapUmtReleasedChunk,
  mapUmtReleaseChunksPage,
  type RawUmtReleaseChunk,
  type RawUmtReleaseChunkBuildStatus,
  type RawUmtReleaseChunksPage,
  type RawUmtReleasedChunk,
  type UmtDockerBuildStatus,
  type UmtPageRequest,
  type UmtReleaseChunk,
  type UmtReleaseChunkBuildStatus,
  type UmtReleaseChunksPage,
  type UmtReleaseChunkStatus,
  type UmtReleasedChunk,
} from "./umtReleaseChunks";

// Both lists load one page at a time, and keep the previous page on screen
// while the next one loads, so paging doesn't blank the grid between requests.
export function useUmtReleaseChunks({ page, pageSize }: UmtPageRequest) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtReleaseChunksPage<UmtReleaseChunk>>({
    queryKey: ["umt-release-chunks", userSub, page, pageSize],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const raw = await authedGet<RawUmtReleaseChunksPage<RawUmtReleaseChunk>>(
        umtServiceUrls.releaseChunksPage({ page, pageSize }),
        await getAccessToken(),
      );
      return mapUmtReleaseChunksPage(raw, mapUmtReleaseChunk);
    },
    placeholderData: keepPreviousData,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export function useUmtReleasedChunks({ page, pageSize }: UmtPageRequest) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtReleaseChunksPage<UmtReleasedChunk>>({
    queryKey: ["umt-released-chunks", userSub, page, pageSize],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const raw = await authedGet<RawUmtReleaseChunksPage<RawUmtReleasedChunk>>(
        umtServiceUrls.releaseChunksPage({ states: "released", page, pageSize }),
        await getAccessToken(),
      );
      return mapUmtReleaseChunksPage(raw, mapUmtReleasedChunk);
    },
    placeholderData: keepPreviousData,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export interface UmtReleaseChunkRowStatus {
  buildStatus?: UmtReleaseChunkBuildStatus;
  buildStatusLoading: boolean;
  chunkStatus?: UmtReleaseChunkStatus;
}

async function fetchUmtReleaseChunkBuildStatus(
  id: number,
  accessToken: string,
): Promise<UmtReleaseChunkBuildStatus> {
  const raw = await authedGet<RawUmtReleaseChunkBuildStatus>(
    umtServiceUrls.releaseChunkBuildStatus(id),
    accessToken,
  );
  return mapUmtReleaseChunkBuildStatus(raw);
}

// Fetches a chunk's build status from the backend, bypassing the cache, and
// writes the result back into the row's query so the grid shows it too. For
// decisions that must not rest on what the row loaded earlier: a level can be
// rebuilt and fail, or finish building, at any time after the page loads.
// Resolves to undefined when the status cannot be fetched.
export function useFetchFreshUmtReleaseChunkBuildStatus() {
  const queryClient = useQueryClient();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  return useCallback(
    async (id: number): Promise<UmtReleaseChunkBuildStatus | undefined> => {
      if (!userSub) return undefined;
      const queryKey = ["umt-release-chunk-build-status", userSub, id];
      await queryClient.cancelQueries({ queryKey, exact: true });
      try {
        const status = await fetchUmtReleaseChunkBuildStatus(id, await getAccessToken());
        queryClient.setQueryData(queryKey, status);
        return status;
      } catch {
        return undefined;
      }
    },
    [getAccessToken, queryClient, userSub],
  );
}

// A chunk's build statuses and its own lifecycle status live behind two
// further endpoints, one request each per row, so the pending list needs both
// for every chunk it shows. They are issued as two parallel query sets keyed
// by chunk id, which keeps them cached and deduplicated per row rather than
// refetching the lot whenever the list re-renders.
//
// A row whose requests fail is left to render its fallback chip rather than
// reporting the failure itself: a grid of per-row error banners would drown
// out the list, and every action that depends on a status checks for one
// before it runs.
//
// The build statuses of the chunks on screen are read again every few seconds,
// so a level that starts, finishes or fails a build shows it without a reload.
//
// A chunk being created, released or retriggered also has its status read
// again every few seconds until it settles, and when it does the lists and its
// build statuses are refreshed, so a released chunk leaves the pending list
// and a created one shows its builds.
const CHUNK_STATUS_POLL_MS = 5000;

// A number for each data object a query has produced. A refetch that returns
// the same values hands back the same object, so the number stays the same;
// one that returns new values hands back a new object, which gets a new number.
const dataIds = new WeakMap<object, number>();
let nextDataId = 0;

function dataId(data: unknown): string {
  if (typeof data !== "object" || data === null) return String(data);
  let id = dataIds.get(data);
  if (id === undefined) {
    id = ++nextDataId;
    dataIds.set(data, id);
  }
  return `#${id}`;
}

// Whether a row's status is still on its first load. A query with no data goes
// back to pending at the start of every fetch, so a status whose request
// failed would count as loading again on every poll. Only a query that has
// never finished a fetch counts as loading; after that the row keeps what it
// last showed until the next answer arrives.
function firstLoad(result: { isPending: boolean; isFetched: boolean } | undefined): boolean {
  return result ? result.isPending && !result.isFetched : false;
}

export function useUmtReleaseChunkRowStatuses(ids: number[]): Record<number, UmtReleaseChunkRowStatus> {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isUmtBackendConfigured() && Boolean(userSub);

  const buildStatusResults = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["umt-release-chunk-build-status", userSub, id],
      enabled: ready,
      queryFn: async () => fetchUmtReleaseChunkBuildStatus(id, await getAccessToken()),
      refetchInterval: CHUNK_STATUS_POLL_MS,
      retry: httpRetry,
    })),
  });

  const chunkStatusResults = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["umt-release-chunk-status", userSub, id],
      enabled: ready,
      queryFn: async () =>
        authedGet<UmtReleaseChunkStatus>(umtServiceUrls.releaseChunk(id), await getAccessToken()),
      refetchInterval: (query: { state: { data?: UmtReleaseChunkStatus } }) =>
        umtReleaseChunkInProgress(query.state.data?.status) ? CHUNK_STATUS_POLL_MS : false,
      retry: httpRetry,
    })),
  });

  // A signature of what the queries have produced. It changes only when a
  // query's data changes, not each time a poll fetches the same values again,
  // so this string stays equal across renders that changed nothing, and the
  // object below keeps its identity with it. That matters because the grid
  // rebuilds its entire column state, and re-measures every row, whenever the
  // columns built from this are a new reference.
  const signature = [
    ids.join(","),
    buildStatusResults.map((result) => `${dataId(result.data)}:${firstLoad(result)}`).join(","),
    chunkStatusResults.map((result) => dataId(result.data)).join(","),
  ].join("|");

  // The chunks last seen in progress, so a status that moves on from it can be
  // told from one that was never in progress.
  const inProgressIds = useRef(new Set<number>());
  useEffect(() => {
    const settledIds = new Set<number>();
    ids.forEach((id, index) => {
      const status = chunkStatusResults[index]?.data?.status;
      if (typeof status !== "string") return;
      if (umtReleaseChunkInProgress(status)) inProgressIds.current.add(id);
      else if (inProgressIds.current.delete(id)) settledIds.add(id);
    });
    if (settledIds.size === 0) return;
    void queryClient.invalidateQueries({ queryKey: ["umt-release-chunks"] });
    void queryClient.invalidateQueries({ queryKey: ["umt-released-chunks"] });
    void queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "umt-release-chunk-build-status" && settledIds.has(query.queryKey[2] as number),
    });
    // The signature stands for the results read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return useMemo(() => {
    const statuses: Record<number, UmtReleaseChunkRowStatus> = {};
    ids.forEach((id, index) => {
      statuses[id] = {
        buildStatus: buildStatusResults[index]?.data,
        buildStatusLoading: firstLoad(buildStatusResults[index]),
        chunkStatus: chunkStatusResults[index]?.data,
      };
    });
    return statuses;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

// Docker build statuses are only ever read inside the Build Information
// dialog, so this stays disabled until that dialog opens for a given chunk
// rather than fetching for every row on mount.

export function useUmtReleaseChunkDockerBuildStatus(id: number | null, enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtDockerBuildStatus[]>({
    queryKey: ["umt-release-chunk-docker-build-status", userSub, id],
    enabled: enabled && id !== null && isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () =>
      authedGet<UmtDockerBuildStatus[]>(
        umtServiceUrls.releaseChunkDockerBuildStatus(id as number),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

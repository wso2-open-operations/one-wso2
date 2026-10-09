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

import { useCallback, useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  mapUmtReleaseChunk,
  mapUmtReleaseChunkBuildStatus,
  mapUmtReleasedChunk,
  type RawUmtReleaseChunk,
  type RawUmtReleaseChunkBuildStatus,
  type RawUmtReleasedChunk,
  type UmtDockerBuildStatus,
  type UmtReleaseChunk,
  type UmtReleaseChunkBuildStatus,
  type UmtReleaseChunkStatus,
  type UmtReleasedChunk,
} from "./umtReleaseChunks";

export function useUmtReleaseChunks() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtReleaseChunk[]>({
    queryKey: ["umt-release-chunks", userSub],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const raw = await authedGet<RawUmtReleaseChunk[]>(
        umtServiceUrls.releaseChunks,
        await getAccessToken(),
      );
      return raw.map(mapUmtReleaseChunk);
    },
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export function useUmtReleasedChunks() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtReleasedChunk[]>({
    queryKey: ["umt-released-chunks", userSub],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const raw = await authedGet<RawUmtReleasedChunk[]>(
        umtServiceUrls.releasedChunks,
        await getAccessToken(),
      );
      return raw.map(mapUmtReleasedChunk);
    },
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export interface UmtReleaseChunkRowStatus {
  buildStatus?: UmtReleaseChunkBuildStatus;
  buildStatusLoading: boolean;
  chunkStatus?: UmtReleaseChunkStatus;
  chunkStatusLoading: boolean;
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

export function useUmtReleaseChunkRowStatuses(ids: number[]): Record<number, UmtReleaseChunkRowStatus> {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isUmtBackendConfigured() && Boolean(userSub);

  const buildStatusResults = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["umt-release-chunk-build-status", userSub, id],
      enabled: ready,
      queryFn: async () => fetchUmtReleaseChunkBuildStatus(id, await getAccessToken()),
      retry: httpRetry,
    })),
  });

  const chunkStatusResults = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["umt-release-chunk-status", userSub, id],
      enabled: ready,
      queryFn: async () =>
        authedGet<UmtReleaseChunkStatus>(umtServiceUrls.releaseChunk(id), await getAccessToken()),
      retry: httpRetry,
    })),
  });

  // A signature of what the queries have produced. `dataUpdatedAt` changes
  // exactly when a query's data changes, so this string stays equal across
  // renders that changed nothing, and the object below keeps its identity with
  // it. That matters because the grid rebuilds its entire column state, and
  // re-measures every row, whenever the columns built from this are a new
  // reference — which a freshly built object made them on every render.
  const signature = [
    ids.join(","),
    buildStatusResults.map((result) => `${result.dataUpdatedAt}:${result.isPending}`).join(","),
    chunkStatusResults.map((result) => `${result.dataUpdatedAt}:${result.isPending}`).join(","),
  ].join("|");

  return useMemo(() => {
    const statuses: Record<number, UmtReleaseChunkRowStatus> = {};
    ids.forEach((id, index) => {
      statuses[id] = {
        buildStatus: buildStatusResults[index]?.data,
        buildStatusLoading: buildStatusResults[index]?.isPending ?? false,
        chunkStatus: chunkStatusResults[index]?.data,
        chunkStatusLoading: chunkStatusResults[index]?.isPending ?? false,
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

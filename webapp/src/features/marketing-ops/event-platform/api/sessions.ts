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

// Sessions: what sits on the agenda grid, or waits unscheduled in the palette.
//
// Every session list is cached per filter set, under one `sessionsRoot` prefix,
// so a write patches every cached list at once — but only the lists the
// session belongs in (sessionMatchesFilters), since the lists are now scoped to
// one event.

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authedDelete, authedGet, authedPatch, authedPost, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { eventPlatformServiceUrls as urls } from "@config/apiConfig";
import {
  eventPlatformKeys as keys,
  sessionFiltersOf,
} from "@features/marketing-ops/event-platform/api/queryKeys";
import {
  useEventPlatformBase,
  useNotifyFailure,
} from "@features/marketing-ops/event-platform/api/base";
import { expectBody } from "@features/marketing-ops/event-platform/api/responses";
import {
  applyPlacement,
  collectSessions,
  refileSessions,
  removeById,
  replaceById,
  type Placement,
} from "@features/marketing-ops/event-platform/api/cacheUpdates";
import type {
  Session,
  SessionArtifact,
  SessionFilters,
  SessionKind,
  SessionSpeakerRole,
} from "@features/marketing-ops/event-platform/types/eventPlatformTypes";

export interface SpeakerAssignment {
  speakerId: string;
  role: SessionSpeakerRole;
}

// The fields create and update share. There is no `roomIsManual`: the server
// derives it from whether `roomId` was supplied, and its strict binding would
// reject the key — the source typed it but no caller ever sent it.
export interface SessionFields {
  kind: SessionKind;
  title: string;
  description: string;
  durationSlots: number;
  speakerAssignments: SpeakerAssignment[];
  roomId?: string | null;
  articleUrl?: string | null;
  articleLabel?: string | null;
  videoUrl?: string | null;
  videoLabel?: string | null;
  topicId?: string | null;
  topicIsManual?: boolean;
}

export interface CreateSessionInput extends SessionFields {
  configId: string;
  // Created straight onto the grid when set; otherwise unscheduled.
  dayId?: string | null;
  trackId?: string | null;
  slotIndex?: number | null;
}

// Files changed sessions into every cached session list at once: moved into
// the lists they now belong in and out of the ones they left. What placement,
// create and the track and section deletes all need.
export function refileEverywhere(qc: QueryClient, changed: readonly Session[]) {
  if (!changed.length) return;
  for (const [key, data] of qc.getQueriesData<Session[]>({ queryKey: keys.sessionsRoot })) {
    if (data) qc.setQueryData<Session[]>(key, refileSessions(data, sessionFiltersOf(key), changed));
  }
}

// `configId` is required (see SessionFilters): the source called this unscoped,
// so the agenda palette and the Event speakers page saw every event's sessions.
export function useListSessions(filters: SessionFilters) {
  const { getAccessToken, ready } = useEventPlatformBase();
  return useQuery<Session[]>({
    queryKey: keys.sessions(filters),
    enabled: ready && Boolean(filters.configId),
    queryFn: async () => authedGet<Session[]>(urls.sessions(filters), await getAccessToken()),
    // The agenda editor is the only writer and patches these lists itself; a
    // background refetch mid-drag would snap cards back.
    staleTime: Infinity,
    retry: httpRetry,
  });
}

export function useCreateSession() {
  const { getAccessToken } = useEventPlatformBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSessionInput) =>
      expectBody(await authedPost<Session>(urls.sessions(), await getAccessToken(), input)),
    // Appended only to lists it belongs in. The source appended to every
    // cached list, which with scoped lists would drop a new session into
    // another event's palette.
    onSuccess: (created) => refileEverywhere(qc, [created]),
  });
}

export function useUpdateSession() {
  const { getAccessToken } = useEventPlatformBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: SessionFields & { id: string }) =>
      expectBody(await authedPatch<Session>(urls.session(id), await getAccessToken(), fields)),
    onSuccess: (updated) => {
      qc.setQueriesData<Session[]>({ queryKey: keys.sessionsRoot }, (old) =>
        old ? replaceById(old, updated) : old,
      );
    },
  });
}

// Moves a session on the grid, or off it (UNPLACED). Optimistic, because it
// follows a drop: the card must land where it was dropped, not a round trip
// later. A move changes which lists the session is in, so it is re-filed, not
// patched in place.
//
// A failure puts back only THIS session, not a snapshot of every list: drops
// overlap, and a snapshot taken before this one would also undo any drop that
// succeeded after it started. The lists are then refetched, so the cache ends
// on what the server holds.
export function useUpdatePlacement() {
  const { getAccessToken } = useEventPlatformBase();
  const notifyFailure = useNotifyFailure();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dayId, trackId, slotIndex, sectionId }: Placement & { id: string }) =>
      expectBody(
        await authedPut<Session>(urls.sessionPlacement(id), await getAccessToken(), {
          dayId,
          trackId,
          slotIndex,
          sectionId,
        }),
      ),
    onMutate: async ({ id, ...placement }) => {
      await qc.cancelQueries({ queryKey: keys.sessionsRoot });
      const [previous] = collectSessions(
        qc.getQueriesData<Session[]>({ queryKey: keys.sessionsRoot }),
        (s) => s.id === id,
      );
      if (previous) refileEverywhere(qc, [applyPlacement(previous, placement)]);
      return { previous };
    },
    // The server's answer also carries the room the mappings resolved to.
    onSuccess: (updated) => refileEverywhere(qc, [updated]),
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) refileEverywhere(qc, [ctx.previous]);
      qc.invalidateQueries({ queryKey: keys.sessionsRoot });
      notifyFailure("Couldn't move the session — placement reverted.", err);
    },
  });
}

export function useUpdateArtifacts() {
  const { getAccessToken } = useEventPlatformBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, artifacts }: { id: string; artifacts: SessionArtifact[] }) =>
      expectBody(
        await authedPatch<Session>(urls.sessionArtifacts(id), await getAccessToken(), { artifacts }),
      ),
    onSuccess: (updated) => {
      qc.setQueriesData<Session[]>({ queryKey: keys.sessionsRoot }, (old) =>
        old ? replaceById(old, updated) : old,
      );
    },
  });
}

export function useDeleteSession() {
  const { getAccessToken } = useEventPlatformBase();
  const notifyFailure = useNotifyFailure();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => authedDelete(urls.session(id), await getAccessToken()),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.sessionsRoot });
      const snapshots = qc.getQueriesData<Session[]>({ queryKey: keys.sessionsRoot });
      qc.setQueriesData<Session[]>({ queryKey: keys.sessionsRoot }, (old) =>
        old ? removeById(old, id) : old,
      );
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      notifyFailure("Couldn't delete the session — changes reverted.", err);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.sessionsRoot }),
  });
}

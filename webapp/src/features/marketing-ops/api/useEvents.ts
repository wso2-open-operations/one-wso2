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

// Events data layer — 29 endpoints as TanStack Query hooks.
//
// Two independent authorization layers, and they are SIBLINGS not parent/child:
//   `events`         every route — the capability RMMs hold
//   `events-review`  the review routes, on top of that
// A reviewer therefore holds both groups. Admin passes both as master key. The hooks
// below don't enforce that (the backend does) — but the review hooks take an `enabled`
// flag so a non-reviewer never fires a request that would 403.
//
// Group membership only decides what a user may DO. Which submissions an RMM can SEE is
// enforced server-side by owner-scoped queries, because every RMM is in the same group
// and RBAC can't make that distinction.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPatch, authedPost, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls as urls,
} from "@config/apiConfig";
import { downloadAuthed } from "../events/lib/download";
import type {
  CampaignCheck,
  Comment,
  FieldDef,
  FieldDefs,
  FlaggedTitle,
  GeographyStatus,
  MemberStatus,
  MemberStatusInput,
  NotificationSettings,
  NotificationSettingsOut,
  Payload,
  PicklistSyncStatus,
  ReferenceResponse,
  ReviewResult,
  SubmissionFull,
  SubmissionSummary,
  SubmitResult,
  SuggestItem,
  SuggestResult,
  TitleResult,
} from "../events/eventsTypes";

// Submissions are PER-USER (owner-scoped server-side), so those keys carry the sub.
// Statuses, fields and reference are ORG-WIDE configuration and don't.
const KEY = {
  submissions: (sub?: string) => ["marketing-ops", "events", "submissions", sub] as const,
  submission: (id: string, sub?: string) =>
    ["marketing-ops", "events", "submission", id, sub] as const,
  comments: (id: string) => ["marketing-ops", "events", "comments", id] as const,
  statuses: (incl: boolean) => ["marketing-ops", "events", "statuses", incl] as const,
  fields: ["marketing-ops", "events", "fields"] as const,
  reference: ["marketing-ops", "events", "reference"] as const,
  geography: ["marketing-ops", "events", "geography"] as const,
  picklists: ["marketing-ops", "events", "picklists"] as const,
  flaggedTitles: (q: string) => ["marketing-ops", "events", "flagged-titles", q] as const,
  queue: ["marketing-ops", "events", "review", "queue"] as const,
  reviewSubmission: (id: string) => ["marketing-ops", "events", "review", id] as const,
  reviewComments: (id: string) => ["marketing-ops", "events", "review", "comments", id] as const,
  notifications: ["marketing-ops", "events", "notifications"] as const,
};

function useBase() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;
  const ready = isSignedIn && isMarketingOpsBackendConfigured();
  return { getAccessToken, sub, ready };
}

// ---- configuration reads (org-wide) ---------------------------------------
//
// A workbook cannot be read at all until statuses AND fields have loaded — nothing
// about a heading is guessed. So these are long-lived and fetched eagerly.

export function useMemberStatuses(includeDisabled = false) {
  const { getAccessToken, ready } = useBase();
  return useQuery<MemberStatus[]>({
    queryKey: KEY.statuses(includeDisabled),
    enabled: ready,
    queryFn: async () =>
      authedGet<MemberStatus[]>(urls.eventsStatuses(includeDisabled), await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useFieldDefs() {
  const { getAccessToken, ready } = useBase();
  return useQuery<FieldDefs>({
    queryKey: KEY.fields,
    enabled: ready,
    queryFn: async () => authedGet<FieldDefs>(urls.eventsFields, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useEventsReference() {
  const { getAccessToken, ready } = useBase();
  return useQuery<ReferenceResponse>({
    queryKey: KEY.reference,
    enabled: ready,
    queryFn: async () =>
      authedGet<ReferenceResponse>(urls.eventsReference, await getAccessToken()),
    // Countries and states essentially never change within a session.
    staleTime: 30 * 60 * 1000,
    retry: httpRetry,
  });
}

// How fresh the country and state lists are, for Settings → Events. Asked on every visit
// (the app default is not to refetch on mount): the answer changes on its own once a day.
export function useGeographyStatus() {
  const { getAccessToken, ready } = useBase();
  return useQuery<GeographyStatus>({
    queryKey: KEY.geography,
    enabled: ready,
    queryFn: async () => authedGet<GeographyStatus>(urls.eventsGeography, await getAccessToken()),
    refetchOnMount: true,
    retry: httpRetry,
  });
}

// Sync now: replace the lists with Salesforce's, whatever their age. On success the
// browser's own copy of the lists is dropped too, so this session validates against
// the new ones straight away.
export function useSyncGeography() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      authedPost<GeographyStatus>(urls.eventsGeographySync, await getAccessToken(), {}),
    onSuccess: (data) => {
      qc.setQueryData(KEY.geography, data);
      return qc.invalidateQueries({ queryKey: KEY.reference });
    },
    // A failure is recorded server-side; show it in the status too.
    onError: () => qc.invalidateQueries({ queryKey: KEY.geography }),
  });
}

// Pick list columns copied from Salesforce (Industry), for Settings → Events.
export function usePicklistStatus() {
  const { getAccessToken, ready } = useBase();
  return useQuery<PicklistSyncStatus[]>({
    queryKey: KEY.picklists,
    enabled: ready,
    queryFn: async () =>
      authedGet<PicklistSyncStatus[]>(urls.eventsPicklists, await getAccessToken()),
    refetchOnMount: true,
    retry: httpRetry,
  });
}

// Sync from Salesforce: copy Salesforce's values onto those columns on every status. On
// success the column definitions are reloaded, so the editor and this session's checks
// use the new values straight away.
export function useSyncPicklists() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      authedPost<PicklistSyncStatus[]>(urls.eventsPicklistsSync, await getAccessToken(), {}),
    onSuccess: (data) => {
      qc.setQueryData(KEY.picklists, data);
      return qc.invalidateQueries({ queryKey: KEY.fields });
    },
    // A failure is recorded server-side; show it in the status too.
    onError: () => qc.invalidateQueries({ queryKey: KEY.picklists }),
  });
}

// Job titles the check took as not English, newest first, for Settings → Events.
export function useFlaggedTitles(q: string) {
  const { getAccessToken, ready } = useBase();
  return useQuery<FlaggedTitle[]>({
    queryKey: KEY.flaggedTitles(q),
    enabled: ready,
    queryFn: async () =>
      authedGet<FlaggedTitle[]>(urls.eventsFlaggedTitles(q), await getAccessToken()),
    refetchOnMount: true,
    retry: httpRetry,
  });
}

// An admin says a flagged title is English: no list flags it again (a list already open
// in someone's browser does once it is reloaded).
export function useMarkTitleEnglish() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) =>
      authedPost<{ ok: boolean }>(urls.eventsMarkTitleEnglish, await getAccessToken(), { key }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "flagged-titles"] }),
  });
}

// Event-name autocomplete. Only fires once the user has typed enough to be worth a
// round trip — a one-character query would match almost everything.
export function useEventNames(q: string) {
  const { getAccessToken, ready } = useBase();
  return useQuery<string[]>({
    queryKey: ["marketing-ops", "events", "event-names", q],
    enabled: ready && q.trim().length >= 2,
    queryFn: async () => authedGet<string[]>(urls.eventsEventNames(q), await getAccessToken()),
    staleTime: 60 * 1000,
    retry: httpRetry,
  });
}

// Whether Salesforce has this campaign — feedback for the URL field as it is typed.
// Keyed by the campaign ID, so it asks once per distinct ID however many keystrokes it
// takes to get there. Automatic review asks again at submit; this is not the check.
export function useCampaignCheck(campaignId: string) {
  const { getAccessToken, ready } = useBase();
  return useQuery<CampaignCheck>({
    queryKey: ["marketing-ops", "events", "campaign", campaignId],
    enabled: ready && Boolean(campaignId),
    queryFn: async () => authedGet<CampaignCheck>(urls.eventsCampaign(campaignId), await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ---- submissions (submitter side) ----------------------------------------

export function useSubmissions() {
  const { getAccessToken, sub, ready } = useBase();
  return useQuery<SubmissionSummary[]>({
    queryKey: KEY.submissions(sub),
    enabled: ready && Boolean(sub),
    queryFn: async () =>
      authedGet<SubmissionSummary[]>(urls.eventsSubmissions, await getAccessToken()),
    staleTime: 30 * 1000,
    // The app default is refetchOnMount: false. Lead Import creates submissions on
    // another page and invalidates this list, but an unmounted query is only marked
    // stale — without this, My Submissions kept showing the list from its last visit.
    // Refetches only when stale (invalidated or older than staleTime).
    refetchOnMount: true,
    retry: httpRetry,
  });
}

export function useSubmission(id: string | null) {
  const { getAccessToken, sub, ready } = useBase();
  return useQuery<SubmissionFull>({
    queryKey: KEY.submission(id ?? "", sub),
    enabled: ready && Boolean(id && sub),
    queryFn: async () =>
      authedGet<SubmissionFull>(urls.eventsSubmission(id!), await getAccessToken()),
    // The working copy lives in browser state once opened; refetching under the user
    // would fight their edits.
    staleTime: Infinity,
    retry: httpRetry,
  });
}

export function useSubmissionComments(id: string | null) {
  const { getAccessToken, ready } = useBase();
  return useQuery<Comment[]>({
    queryKey: KEY.comments(id ?? ""),
    enabled: ready && Boolean(id),
    queryFn: async () =>
      authedGet<Comment[]>(urls.eventsSubmissionComments(id!), await getAccessToken()),
    staleTime: 30 * 1000,
    retry: httpRetry,
  });
}

export interface EventMeta {
  event_name: string;
  event_date: string | null;
  sf_campaign_url: string | null;
  /** Left out, the server keeps the one it has. */
  sdr_owner_email?: string | null;
}

export function useCreateSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: EventMeta) =>
      authedPost<{ id: string }>(urls.eventsSubmissions, await getAccessToken(), body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "submissions"] }),
  });
}

export function useUpdateSubmissionMeta() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: EventMeta }) =>
      authedPatch<SubmissionFull>(urls.eventsSubmission(id), await getAccessToken(), body),
    // Both the list AND the open submission. Unlike useSaveSubmission below — which
    // deliberately leaves the open payload alone so a refetch can't stomp in-flight
    // grid edits — this changes the submission's METADATA (event name, date, campaign
    // URL), none of which the grid is editing. Leaving it stale meant the workspace
    // header kept showing the old event name until a reload.
    onSuccess: (_res, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "submissions"] }),
        qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "submission", id] }),
      ]),
  });
}

// Store the working copy — ONE call, ONE blob, on a debounce. Never on the path of an
// individual edit: the grid can produce hundreds of edits a minute and each is applied
// locally by the rules engine.
//
// Deliberately does NOT invalidate the open submission's query. Doing so would refetch
// the payload the user is actively editing and stomp on their in-flight changes; the
// list is refreshed instead, since row_count and updated_at are what it shows.
export function useSaveSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
      rowCount,
      sourceFilename = "",
      templateVersion = "",
    }: {
      id: string;
      payload: Payload;
      rowCount: number;
      sourceFilename?: string;
      templateVersion?: string;
    }) =>
      authedPut<SubmissionSummary>(urls.eventsSubmissionPayload(id), await getAccessToken(), {
        payload,
        row_count: rowCount,
        source_filename: sourceFilename,
        template_version: templateVersion,
      }),
    // Written into the cache as the save starts, not only when it lands: a screen that
    // leaves with a save in flight and is opened again at once (Lead Import's step 3)
    // would otherwise rebuild its rows from the copy before that save, and its next save
    // would put the old rows back.
    onMutate: ({ id, payload }) => {
      qc.setQueriesData<SubmissionFull>(
        { queryKey: ["marketing-ops", "events", "submission", id] },
        (old) => (old ? { ...old, payload } : old),
      );
    },
    onSuccess: (saved, { id, payload }) => {
      // The open submission is cached with staleTime Infinity (see useSubmission), so
      // nothing refreshes it on its own. Before this, the cache kept the EMPTY payload it
      // was first loaded with: upload, go back, reopen — and the screen asked for the file
      // again, though the server had every row. Written in from what was just saved rather
      // than refetched, so a refetch can never land on top of edits made since.
      qc.setQueriesData<SubmissionFull>(
        { queryKey: ["marketing-ops", "events", "submission", id] },
        (old) => (old ? { ...old, ...saved, payload } : old),
      );
      return qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "submissions"] });
    },
  });
}

// Ask the model about values our own rules could not resolve. Only the AMBIGUOUS VALUES
// travel — never names, emails or phone numbers. A mutation because it costs a model
// call and must only fire when the user asks.
export function useSuggest() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async ({ id, items }: { id: string; items: SuggestItem[] }) =>
      authedPost<SuggestResult>(urls.eventsSubmissionSuggest(id), await getAccessToken(), {
        items,
      }),
  });
}

// Which job titles are not in English, with an English version for each. Only the
// TITLES travel. Answers are stored server-side, so a list seen before costs no model
// call. A mutation for the same reason as useSuggest: it fires after a load, not on render.
export function useCheckTitles() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async ({ id, titles }: { id: string; titles: string[] }) =>
      authedPost<TitleResult>(urls.eventsSubmissionTitles(id), await getAccessToken(), {
        titles,
      }),
  });
}

// Submit for review. Returns `problems` on a 200 when the SERVER's invariants disagree
// with the browser's rules — in practice a stale tab. `submitted: false` with problems
// is a normal outcome, not an error, so callers must check the flag rather than assume
// a 200 means success.
export function useSubmitSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedPost<SubmitResult>(urls.eventsSubmissionSubmit(id), await getAccessToken(), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

// Run automatic review without changing anything, check by check. Nothing to invalidate:
// the list is exactly as it was.
export function useRunAutomaticReview() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async (id: string) =>
      authedPost<ReviewResult>(urls.eventsSubmissionReview(id), await getAccessToken(), {}),
  });
}

// Send the list to an admin instead of automatic review, with a note saying why — for the
// cases the rules get wrong. Lands in the review queue as Submitted.
export function useEscalateSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) =>
      authedPost<SubmitResult>(urls.eventsSubmissionEscalate(id), await getAccessToken(), { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

// Take a list back out of the queue while it's still awaiting review — Submitted back to
// Draft. Nothing is destroyed; it just becomes editable again.
export function useWithdrawSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedPost<{ ok: boolean }>(urls.eventsSubmissionWithdraw(id), await getAccessToken(), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

export function useDeleteSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedDelete(urls.eventsSubmission(id), await getAccessToken()),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "submissions"] }),
  });
}

// ---- member statuses + field defs (admin writes) -------------------------

export function useCreateStatus() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MemberStatusInput) =>
      authedPost<MemberStatus>(urls.eventsStatuses(), await getAccessToken(), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "statuses"] }),
  });
}

export function useUpdateStatus() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    // A RENAME carries its columns server-side — which is why the URL keys on the old
    // name (`source`) while the body carries the new one.
    mutationFn: async ({ source, body }: { source: string; body: MemberStatusInput }) =>
      authedPatch<MemberStatus>(urls.eventsStatus(source), await getAccessToken(), body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "statuses"] }),
        qc.invalidateQueries({ queryKey: KEY.fields }),
      ]),
  });
}

export function useDeleteStatus() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      authedDelete(urls.eventsStatus(name), await getAccessToken()),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "statuses"] }),
        qc.invalidateQueries({ queryKey: KEY.fields }),
      ]),
  });
}

// Copy a status AND its whole column list under a new name — one call, one transaction.
// A status that arrived without its columns would look complete while importing every
// heading as free text, which is exactly the failure the column contract prevents.
export function useDuplicateStatus() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, name }: { source: string; name: string }) =>
      authedPost<MemberStatus>(urls.eventsStatusDuplicate(source), await getAccessToken(), {
        name,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["marketing-ops", "events", "statuses"] }),
        qc.invalidateQueries({ queryKey: KEY.fields }),
      ]),
  });
}

export function useSaveFields() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tab, fields }: { tab: string; fields: FieldDef[] }) =>
      authedPut<FieldDef[]>(urls.eventsFieldsForTab(tab), await getAccessToken(), { fields }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.fields }),
  });
}

// ---- submission emails (admin) ---------------------------------------------

export function useNotificationSettings() {
  const { getAccessToken, ready } = useBase();
  return useQuery<NotificationSettingsOut>({
    queryKey: KEY.notifications,
    enabled: ready,
    queryFn: async () =>
      authedGet<NotificationSettingsOut>(urls.eventsNotifications, await getAccessToken()),
    staleTime: 60 * 1000,
    retry: httpRetry,
  });
}

export function useSaveNotificationSettings() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: NotificationSettings) =>
      authedPut<NotificationSettingsOut>(urls.eventsNotifications, await getAccessToken(), body),
    onSuccess: (saved) => qc.setQueryData(KEY.notifications, saved),
  });
}

/** Send a sample of the real email to the SAVED recipients. */
export function useSendTestNotification() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async () =>
      authedPost<{ sent: boolean; recipients: number }>(
        urls.eventsNotificationsTest,
        await getAccessToken(),
        {},
      ),
  });
}

// ---- review side (needs the `events-review` capability) -------------------

export function useReviewQueue(enabled = true) {
  const { getAccessToken, ready } = useBase();
  return useQuery<SubmissionSummary[]>({
    queryKey: KEY.queue,
    enabled: ready && enabled,
    queryFn: async () =>
      authedGet<SubmissionSummary[]>(urls.eventsReviewQueue, await getAccessToken()),
    staleTime: 30 * 1000,
    retry: httpRetry,
  });
}

export function useReviewSubmission(id: string | null) {
  const { getAccessToken, ready } = useBase();
  return useQuery<SubmissionFull>({
    queryKey: KEY.reviewSubmission(id ?? ""),
    enabled: ready && Boolean(id),
    queryFn: async () =>
      authedGet<SubmissionFull>(urls.eventsReviewSubmission(id!), await getAccessToken()),
    staleTime: 60 * 1000,
    retry: httpRetry,
  });
}

export function useReviewComments(id: string | null) {
  const { getAccessToken, ready } = useBase();
  return useQuery<Comment[]>({
    queryKey: KEY.reviewComments(id ?? ""),
    enabled: ready && Boolean(id),
    queryFn: async () =>
      authedGet<Comment[]>(urls.eventsReviewComments(id!), await getAccessToken()),
    staleTime: 30 * 1000,
    retry: httpRetry,
  });
}

export function useApproveSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedPost<{ ok: boolean }>(urls.eventsReviewApprove(id), await getAccessToken(), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

// Send a submission back to its owner. Named for the ACTION rather than the route
// (`/reject`) so it can't be confused with rejecting a cell suggestion in the grid —
// two very different rejections live in this feature.
export function useSendBackSubmission() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) =>
      authedPost<{ ok: boolean }>(urls.eventsReviewReject(id), await getAccessToken(), {
        comment,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

export function useMarkImported() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedPost<{ ok: boolean }>(urls.eventsReviewImported(id), await getAccessToken(), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

// Clear a finished list out of the queue. The server refuses anything still with its
// submitter — only Approved and Imported can be removed this way.
export function useRemoveFromQueue() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedDelete(urls.eventsReviewSubmission(id), await getAccessToken()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-ops", "events"] }),
  });
}

// Exports return binary, so they bypass authedGet — see events/lib/download.
export function useExportTab() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async ({ id, tab, filename }: { id: string; tab: string; filename: string }) =>
      downloadAuthed(urls.eventsReviewExportTab(id, tab), await getAccessToken(), filename),
  });
}

// Every tab at once, zipped SERVER-side — one request rather than one download per tab,
// which browsers throttle and users experience as "only some of them downloaded".
export function useExportAll() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async ({ id, filename }: { id: string; filename: string }) =>
      downloadAuthed(urls.eventsReviewExportAll(id), await getAccessToken(), filename),
  });
}

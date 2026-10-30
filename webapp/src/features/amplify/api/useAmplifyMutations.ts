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

// Writes to amplify-api.
//
// Every POST carries an Idempotency-Key, a fresh one per HTTP call, so it
// de-duplicates a retry of that same call (a proxy or the network resending it),
// not a second click. A double click is stopped where the call is made: each
// submit control is disabled while its mutation is pending. A manual re-submit
// after a failure is a new action and gets a new key. No React Query `retry`:
// a 4xx here is a final answer.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authedDelete, authedPatch, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { amplifyServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { amplifyKey } from "./useAmplifyData";
import type {
  Campaign,
  CampaignDraft,
  CampaignPatch,
  CampaignRegistration,
  ConnectAuthorization,
  LinkedInConnection,
  Share,
  ShareKind,
} from "./amplifyTypes";

function idempotencyHeaders(): Record<string, string> {
  return { "Idempotency-Key": crypto.randomUUID() };
}

// Marks the key stale and refetches it now, including lists no page is showing. The app's QueryClient sets
// `refetchOnMount: false`, so a stale list that isn't on screen would otherwise never reload: save a post on
// New Post and Current Posts kept its old list until a full refresh. Awaited, so a caller that navigates
// afterwards lands on fresh data.
function refreshNow(qc: QueryClient, queryKey: unknown[]): Promise<void> {
  return qc.invalidateQueries({ queryKey, refetchType: "all" });
}

function useAmplifySub(): string | undefined {
  const { state } = useAsgardeoSub();
  return state.status === "ready" ? state.sub : undefined;
}

/** POST /campaigns (PO and Marketing; the backend 403s anyone else). */
export function useRegisterCampaign() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<CampaignRegistration | null, Error, { draft: CampaignDraft; shareNow: boolean }>({
    mutationFn: async ({ draft, shareNow }) =>
      authedPost<CampaignRegistration>(
        `${amplifyServiceUrls.campaigns}?shareNow=${shareNow}`,
        await getAccessToken(),
        draft,
        idempotencyHeaders(),
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("campaigns", sub));
    },
  });
}

/** PATCH /campaigns/{id} with the version that was read (PO and Marketing). */
export function useEditCampaign() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<Campaign | null, Error, { id: string; patch: CampaignPatch }>({
    mutationFn: async ({ id, patch }) =>
      authedPatch<Campaign>(amplifyServiceUrls.campaign(id), await getAccessToken(), patch),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("campaigns", sub));
    },
  });
}

/** POST /campaigns/{id}/shares: "Amplify, share this for me". Queued (202), published by the next Run. */
export function useRequestShare() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<Share | null, Error, { campaignId: string; kind: ShareKind; commentary?: string }>({
    mutationFn: async ({ campaignId, kind, commentary }) =>
      authedPost<Share>(
        amplifyServiceUrls.shares(campaignId),
        await getAccessToken(),
        commentary === undefined ? { kind } : { kind, commentary },
        idempotencyHeaders(),
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("my-shares", sub));
    },
  });
}

/** POST /connections/linkedin/start. The caller sends the browser to `authorizationUrl`. */
export function useStartLinkedInConnect() {
  const getAccessToken = useAccessToken();
  return useMutation<ConnectAuthorization | null, Error, { returnTo: string; pendingCampaignId?: string }>({
    mutationFn: async (body) =>
      authedPost<ConnectAuthorization>(
        amplifyServiceUrls.connectStart,
        await getAccessToken(),
        body,
        idempotencyHeaders(),
      ),
  });
}

/** POST /connections/linkedin/decline with the LinkedIn profile URL of an employee who doesn't consent to link. */
export function useDeclineLinkedInConsent() {
  const getAccessToken = useAccessToken();
  return useMutation<null, Error, { profileUrl?: string }>({
    mutationFn: async (body) => {
      await authedPost<unknown>(amplifyServiceUrls.connectDecline, await getAccessToken(), body, idempotencyHeaders());
      return null;
    },
  });
}

/** DELETE /connections/linkedin: Amplify revokes the caller's token at LinkedIn, then drops its saved link. */
export function useRemoveLinkedInConnection() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<null, Error, void>({
    mutationFn: async () => {
      await authedDelete(amplifyServiceUrls.connectRemove, await getAccessToken());
      return null;
    },
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("me", sub));
    },
  });
}

/** POST /connections/linkedin/complete with the code and state LinkedIn sent back. */
export function useCompleteLinkedInConnect() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<LinkedInConnection | null, Error, { code: string; state: string; redirectUri: string }>({
    mutationFn: async (body) =>
      authedPost<LinkedInConnection>(
        amplifyServiceUrls.connectComplete,
        await getAccessToken(),
        body,
        idempotencyHeaders(),
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("me", sub));
    },
  });
}

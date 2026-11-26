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
// No Idempotency-Key header: the Choreo API proxy's CORS allow-list doesn't
// include it, so a browser POST carrying it passes the preflight and is then
// blocked. amplify-api treats the header as optional. Controls are disabled
// while their mutation is pending, which stops most double clicks, and a share
// is one per campaign per employee on the server. No React Query `retry`: a 4xx
// here is a final answer.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authedDelete, authedPatch, authedPost, authedPut } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { amplifyServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { amplifyProblemCode } from "../util/amplifyError";
import { amplifyKey, settingsUrl, type SettingsScope } from "./useAmplifyData";
import type {
  Campaign,
  CampaignDraft,
  CampaignPatch,
  CampaignRegistration,
  CoinWallet,
  DashboardOperations,
  ConnectAuthorization,
  ExternalShare,
  ExternalShareClaim,
  LedgerEntry,
  LinkedInConnection,
  MyPoints,
  PointAction,
  PointRule,
  PointsAdjustment,
  SettingChange,
  SettingList,
  Share,
  ShareKind,
} from "./amplifyTypes";

// Marks the key stale and refetches it now, including lists no page is showing. The app's QueryClient sets
// `refetchOnMount: false`, so a stale list that isn't on screen would otherwise never reload: save a post on
// New Post and Current Posts kept its old list until a full refresh. Awaited, so a caller that navigates
// afterwards lands on fresh data.
function refreshNow(qc: QueryClient, queryKey: unknown[]): Promise<void> {
  return qc.invalidateQueries({ queryKey, refetchType: "all" });
}

// Shows the announcement as Queued before the server snapshot rebuilds; the prefix match covers every `sub`.
function markAnnouncementQueued(qc: QueryClient, campaignId: string): void {
  qc.setQueriesData<DashboardOperations>({ queryKey: ["amplify", "dashboard-operations"] }, (old) =>
    old
      ? {
          ...old,
          campaigns: old.campaigns.map((c) =>
            c.campaignId === campaignId ? { ...c, announcement: { status: "QUEUED", attempts: 0 } } : c,
          ),
        }
      : old,
  );
  void qc.invalidateQueries({ queryKey: ["amplify", "dashboard-operations"], refetchType: "all" });
}

// After a change to someone's points: their history, and the boards their total ranks on.
function refreshPointsOf(qc: QueryClient, sub: string | undefined, employeeId: string): Promise<unknown> {
  return Promise.all([
    refreshNow(qc, amplifyKey("points-history", sub, employeeId)),
    refreshNow(qc, amplifyKey("leaderboard", sub)),
    refreshNow(qc, amplifyKey("leaderboard-top", sub)),
  ]);
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
    mutationFn: async (vars) =>
      authedPost<CampaignRegistration>(
        `${amplifyServiceUrls.campaigns}?shareNow=${vars.shareNow}`,
        await getAccessToken(),
        vars.draft,
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
    mutationFn: async (vars) =>
      authedPost<Share>(
        amplifyServiceUrls.shares(vars.campaignId),
        await getAccessToken(),
        vars.commentary === undefined ? { kind: vars.kind } : { kind: vars.kind, commentary: vars.commentary },
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("my-shares", sub));
    },
  });
}

/**
 * POST /admin/announcements/{campaignId}/retry: puts a FAILED Novera announcement back in the queue (CAN_ADMIN).
 * The board's chip then reads Queued once the dashboards reload.
 */
export function useRetryAnnouncement() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<unknown, Error, { campaignId: string }>({
    mutationFn: async (vars) =>
      authedPost<unknown>(
        amplifyServiceUrls.adminAnnouncementRetry(vars.campaignId),
        await getAccessToken(),
        {},
      ),
    onSuccess: (_data, vars) => markAnnouncementQueued(qc, vars.campaignId),
  });
}

/**
 * POST /admin/announcements/{campaignId}/send: queues the Novera announcement for a post that was never announced
 * (CAN_ADMIN). The board's chip then reads Queued once the dashboards reload.
 */
export function useSendAnnouncement() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<unknown, Error, { campaignId: string }>({
    mutationFn: async (vars) =>
      authedPost<unknown>(amplifyServiceUrls.adminAnnouncementSend(vars.campaignId), await getAccessToken(), {}),
    onSuccess: (_data, vars) => markAnnouncementQueued(qc, vars.campaignId),
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
      ),
  });
}

/** POST /connections/linkedin/decline with the LinkedIn profile URL of an employee who doesn't consent to link. */
export function useDeclineLinkedInConsent() {
  const getAccessToken = useAccessToken();
  return useMutation<null, Error, { profileUrl?: string }>({
    mutationFn: async (body) => {
      await authedPost<unknown>(amplifyServiceUrls.connectDecline, await getAccessToken(), body);
      return null;
    },
  });
}

/** DELETE /campaigns/{id} (PO and Marketing): archives the post, then refetches the campaigns lists. */
export function useArchiveCampaign() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<null, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await authedDelete(amplifyServiceUrls.campaign(id), await getAccessToken());
      return null;
    },
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("campaigns", sub));
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
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("me", sub));
    },
  });
}

/** POST /external-shares: the caller's own post, sent for review. Then refetches the caller's own claims. */
export function useClaimOwnPost() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<ExternalShare | null, Error, ExternalShareClaim>({
    mutationFn: async (claim) =>
      authedPost<ExternalShare>(amplifyServiceUrls.externalShares, await getAccessToken(), claim),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("my-external-shares", sub));
    },
  });
}

/** What a review decision needs: the claim, and whose points it changes. */
interface ClaimRef {
  id: string;
  employeeId: string;
}

// After a review decision: every review list and the waiting count, then the person's points.
async function refreshAfterDecision(qc: QueryClient, sub: string | undefined, employeeId: string): Promise<void> {
  await refreshNow(qc, amplifyKey("external-shares-review", sub));
  await refreshPointsOf(qc, sub, employeeId);
}

/** POST /po/external-shares/{id}/approve (CAN_REVIEW_SHARES): approves a waiting claim and awards its points. */
export function useApproveExternalShare() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<ExternalShare | null, Error, ClaimRef>({
    mutationFn: async ({ id }) =>
      authedPost<ExternalShare>(amplifyServiceUrls.poExternalShareApprove(id), await getAccessToken(), {}),
    onSuccess: async (_data, vars) => refreshAfterDecision(qc, sub, vars.employeeId),
  });
}

/** POST /po/external-shares/{id}/amplified (CAN_REVIEW_SHARES): features an approved claim and adds the top-up. */
export function useFeatureExternalShare() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<ExternalShare | null, Error, ClaimRef>({
    mutationFn: async ({ id }) =>
      authedPost<ExternalShare>(amplifyServiceUrls.poExternalShareAmplified(id), await getAccessToken(), {}),
    onSuccess: async (_data, vars) => refreshAfterDecision(qc, sub, vars.employeeId),
  });
}

/** POST /po/external-shares/{id}/reject (CAN_REVIEW_SHARES): declines a waiting claim with a reason. */
export function useDeclineExternalShare() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<ExternalShare | null, Error, { id: string; reason: string }>({
    mutationFn: async ({ id, reason }) =>
      authedPost<ExternalShare>(amplifyServiceUrls.poExternalShareReject(id), await getAccessToken(), { reason }),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("external-shares-review", sub));
    },
  });
}

/** POST /po/points/{reference}/reverse (CAN_ADJUST_POINTS): cancels one ledger row with a reason. */
export function useReversePoints() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<LedgerEntry | null, Error, { reference: string; employeeId: string; reason: string }>({
    mutationFn: async ({ reference, reason }) =>
      authedPost<LedgerEntry>(amplifyServiceUrls.poPointsReverse(reference), await getAccessToken(), { reason }),
    onSuccess: async (_data, vars) => {
      await refreshPointsOf(qc, sub, vars.employeeId);
    },
  });
}

/** POST /po/points/adjustments (CAN_ADJUST_POINTS): adds or removes points with a reason. */
export function useAdjustPoints() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<LedgerEntry | null, Error, PointsAdjustment>({
    mutationFn: async (body) =>
      authedPost<LedgerEntry>(amplifyServiceUrls.poPointsAdjustments, await getAccessToken(), body),
    onSuccess: async (_data, vars) => {
      await refreshPointsOf(qc, sub, vars.employeeId);
    },
  });
}

/**
 * POST /po/point-rules (CAN_POINT_RULES): a new value for one action, from now on. Then refetches the rules and the
 * values every employee reads.
 */
export function useSetPointRule() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<PointRule | null, Error, { action: PointAction; points: number }>({
    mutationFn: async (body) => authedPost<PointRule>(amplifyServiceUrls.poPointRules, await getAccessToken(), body),
    onSuccess: async () => {
      await Promise.all([refreshNow(qc, amplifyKey("point-rules", sub)), refreshNow(qc, amplifyKey("point-values", sub))]);
    },
  });
}

/**
 * PUT /po/settings or /admin/settings: changes the given keys in one go, each with the version it was read at. Then
 * refetches both settings lists and the caller's Coins. A 409 VERSION_CONFLICT (someone else saved first) refetches
 * the settings before the error reaches the caller, so the screen shows the latest values.
 */
export function useSaveSettings() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<SettingList | null, Error, { scope: SettingsScope; changes: SettingChange[] }>({
    mutationFn: async ({ scope, changes }) =>
      authedPut<SettingList>(settingsUrl(scope), await getAccessToken(), { changes }),
    onSuccess: async () => {
      await Promise.all([refreshNow(qc, amplifyKey("settings", sub)), refreshNow(qc, amplifyKey("my-points", sub))]);
    },
    onError: async (err) => {
      if (amplifyProblemCode(err) === "VERSION_CONFLICT") await refreshNow(qc, amplifyKey("settings", sub));
    },
  });
}

/**
 * POST /me/coins/wallet (no body): amplify-api asks the WSO2 Coins service for the caller's default wallet with the
 * caller's own token and keeps it for the automatic conversion. On success the wallet goes straight into every cached
 * GET /me/points, so the band shows it without another read. 404 NO_WALLET (no wallet) and 503 COINS_UNAVAILABLE (the
 * Coins service isn't configured or didn't answer) reach the caller; read them with `amplifyProblemCode`.
 */
export function useCaptureCoinsWallet() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<CoinWallet | null, Error, void>({
    mutationFn: async () => authedPost<CoinWallet>(amplifyServiceUrls.myCoinsWallet, await getAccessToken(), {}),
    onSuccess: (wallet) => {
      if (!wallet) return;
      qc.setQueriesData<MyPoints>({ queryKey: amplifyKey("my-points", sub) }, (old) =>
        old ? { ...old, coins: { ...old.coins, wallet } } : old,
      );
    },
  });
}

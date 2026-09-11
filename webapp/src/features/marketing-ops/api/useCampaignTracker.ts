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

// Ad Campaigns → Campaign Tracker data layer, ported from Marketing Ops'
// CampaignTrackerContext.tsx + api.ts. That file hand-rolled Map caches keyed
// by selection, per-slice loading/error useState, and a sessionStorage mirror
// — the same things TanStack Query already does (see useAdAnalytics.ts's
// header comment for the same migration on this operation's sibling tab).
// This layer is read AND write, unlike Analytics, so it also uses
// useMutation with query invalidation for the persisted slices (Register's
// four override fields, manual Budget Pacing rows, Weekly Log).
//
// The sessionStorage mirror is dropped: React Query's cache already survives
// in-app navigation, which is the case that mattered ("leave the operation
// and come back"); a full page reload re-fetching is accepted.
//
// Register and Budget Pacing rows are only ever PARTIALLY persisted — most
// fields always reflect live vendor data on the next fetch regardless of what
// a local edit set. CampaignTrackerPage keeps its own optimistic row state on
// top of these queries (seeded from query data, merged with a mutation's
// confirmed result) so the tables' onChange-then-persist contract carries
// over unchanged from the source — see the page for that orchestration.

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import {
  authedDelete,
  authedGet,
  authedPatch,
  authedPost,
} from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls as urls,
} from "@config/apiConfig";
import type {
  AdPlatform,
  BudgetPacingRow,
  BusinessUnit,
  CampaignRegisterRow,
  WeeklyLogEntryRow,
  WeeklyLogRow,
} from "../ad-campaigns/campaign-tracker/campaignTrackerTypes";

const ROOT = ["marketing-ops", "campaign-tracker"] as const;
const OWNERSHIP_ROOT = ["marketing-ops", "ad-campaigns-ownership"] as const;

const KEY = {
  register: (platform: AdPlatform, includeInactive: boolean) =>
    [...ROOT, "register", platform, includeInactive] as const,
  registerPlatform: (platform: AdPlatform) => [...ROOT, "register", platform] as const,
  pacing: (platform: AdPlatform) => [...ROOT, "pacing", platform] as const,
  pacingAll: [...ROOT, "pacing"] as const,
  weeklyLog: (days: number, includeUnlogged: boolean) =>
    [...ROOT, "weekly-log", days, includeUnlogged] as const,
  weeklyLogAll: [...ROOT, "weekly-log"] as const,
  linkedinRefreshStatus: [...ROOT, "linkedin-refresh-status"] as const,
  owners: [...OWNERSHIP_ROOT, "owners"] as const,
  buCurrent: [...OWNERSHIP_ROOT, "bu-current"] as const,
  buHistory: (bu?: BusinessUnit) => [...OWNERSHIP_ROOT, "bu-history", bu ?? "all"] as const,
};

// Optimistic-edit writers for CampaignTrackerPage's table onChange handlers.
// A table's onChange is "apply this edit to the view right now, regardless
// of whether persistence resolves" — the React Query way to do that is to
// write straight into the query cache (setQueryData) rather than mirroring
// query data into a parallel piece of local state kept in sync via an
// effect, which the project's react-hooks/set-state-in-effect lint rule
// (rightly) flags as a render-cascade risk.
export function setCampaignRegisterCache(
  qc: QueryClient,
  platform: AdPlatform,
  includeInactive: boolean,
  rows: CampaignRegisterRow[],
) {
  qc.setQueryData(KEY.register(platform, includeInactive), rows);
}

export function setBudgetPacingCache(qc: QueryClient, platform: AdPlatform, rows: BudgetPacingRow[]) {
  qc.setQueryData(KEY.pacing(platform), rows);
}

export function setWeeklyLogCache(qc: QueryClient, days: number, includeUnlogged: boolean, rows: WeeklyLogRow[]) {
  qc.setQueryData(KEY.weeklyLog(days, includeUnlogged), rows);
}

// authedPost/authedPatch resolve to `T | null` because SOME endpoints reply
// 204 on success. The mutations below are documented to always answer with
// the created/updated resource, and CampaignTrackerPage relies on that to
// merge the result straight into its row state — a null here means the
// backend broke that contract, not a value the caller should silently wave
// through. Throwing surfaces it as a normal mutation failure instead of
// smuggling `null` into a row shape that expects real fields (e.g. `id`).
function requireResult<T>(value: T | null, action: string): T {
  if (value === null) throw new Error(`${action} succeeded but the server returned no data`);
  return value;
}

function useBase() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const ready = isSignedIn && isMarketingOpsBackendConfigured();
  return { getAccessToken, ready };
}

// AdPlatform ('Google Ads' | 'LinkedIn') -> the backend's query-param spelling.
const platformParam = (platform: AdPlatform): "google_ads" | "linkedin" =>
  platform === "Google Ads" ? "google_ads" : "linkedin";

// ---- register ---------------------------------------------------------------

// includeInactive=false (default) asks the backend to drop campaigns that
// were neither created nor active in roughly the last year. Both platforms
// are always fetched by the page (see CampaignTrackerPage) so the platform
// toggle switches instantly rather than firing a new request.
export function useCampaignRegister(platform: AdPlatform, includeInactive: boolean) {
  const { getAccessToken, ready } = useBase();
  return useQuery<CampaignRegisterRow[]>({
    queryKey: KEY.register(platform, includeInactive),
    enabled: ready,
    queryFn: async () =>
      authedGet<CampaignRegisterRow[]>(
        urls.campaignTrackerRegister(platformParam(platform), includeInactive),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });
}

// The four Register fields with no vendor source — human judgement calls that
// persist server-side once set (ad_campaigns_register_overrides), unlike
// campaignName/dates/budget/objective, which always stay live from the vendor
// on the next fetch regardless of what's saved here.
export type RegisterOverrideFields = Pick<
  CampaignRegisterRow,
  "bu" | "status" | "lastReviewed" | "actualCpl" | "targetCpl"
>;

function toRegisterOverrideBody(patch: Partial<RegisterOverrideFields>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ("bu" in patch) body.bu = patch.bu;
  if ("status" in patch) body.status = patch.status;
  if ("lastReviewed" in patch) body.last_reviewed = patch.lastReviewed;
  if ("actualCpl" in patch) body.actual_cpl = patch.actualCpl;
  if ("targetCpl" in patch) body.target_cpl = patch.targetCpl;
  return body;
}

// Persists bu/status/lastReviewed/actualCpl/targetCpl for one campaign.
// Returns just those overlay fields, not a full CampaignRegisterRow — the
// backend would need another live vendor fetch to answer with one, so the
// caller (CampaignTrackerPage) merges this onto the row it already has.
export function useUpdateRegisterOverride() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaignId,
      platform,
      patch,
    }: {
      campaignId: string;
      platform: AdPlatform;
      patch: Partial<RegisterOverrideFields>;
    }) =>
      requireResult(
        await authedPatch<RegisterOverrideFields>(
          urls.campaignTrackerRegisterOverride(campaignId, platformParam(platform)),
          await getAccessToken(),
          toRegisterOverrideBody(patch),
        ),
        "Update register override",
      ),
    onSuccess: (_data, { platform }) =>
      qc.invalidateQueries({ queryKey: KEY.registerPlatform(platform) }),
  });
}

// ---- budget pacing ------------------------------------------------------------

// Active campaigns only, with MTD spend summed from the 1st of the current
// month to today. Includes every persisted manual row for the platform
// alongside the live ones. Both platforms are always fetched (see
// useCampaignRegister's note above).
export function useBudgetPacing(platform: AdPlatform) {
  const { getAccessToken, ready } = useBase();
  return useQuery<BudgetPacingRow[]>({
    queryKey: KEY.pacing(platform),
    enabled: ready,
    queryFn: async () =>
      authedGet<BudgetPacingRow[]>(
        urls.campaignTrackerBudgetPacing(platformParam(platform)),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });
}

export type ManualPacingEditableFields = Pick<
  BudgetPacingRow,
  "month" | "bu" | "campaign" | "monthlyBudget" | "mtdSpend" | "asOfDate"
>;

function toManualPacingBody(patch: Partial<ManualPacingEditableFields>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ("month" in patch) body.month = patch.month;
  if ("bu" in patch) body.bu = patch.bu;
  if ("campaign" in patch) body.campaign = patch.campaign;
  if ("monthlyBudget" in patch) body.monthly_budget = patch.monthlyBudget;
  if ("mtdSpend" in patch) body.mtd_spend = patch.mtdSpend;
  if ("asOfDate" in patch) body.as_of_date = patch.asOfDate;
  return body;
}

// Add/edit/delete a manually-composed Budget Pacing row — for a campaign
// Budget Pacing's live read wouldn't otherwise surface (e.g. a completed
// campaign, or a past month's numbers).
export function useAddManualPacingRow() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      row: Omit<BudgetPacingRow, "id" | "isManual" | "monthlyBudgetIsDerived" | "dailyBudget" | "dailyBudgetIsDerived">,
    ) =>
      requireResult(
        await authedPost<BudgetPacingRow>(urls.campaignTrackerBudgetPacingManual, await getAccessToken(), {
          month: row.month,
          bu: row.bu,
          platform: row.platform,
          campaign: row.campaign,
          monthly_budget: row.monthlyBudget,
          mtd_spend: row.mtdSpend,
          as_of_date: row.asOfDate,
        }),
        "Add manual pacing row",
      ),
    onSuccess: (_data, row) => qc.invalidateQueries({ queryKey: KEY.pacing(row.platform) }),
  });
}

export function useUpdateManualPacingRow() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ManualPacingEditableFields> }) =>
      requireResult(
        await authedPatch<BudgetPacingRow>(
          urls.campaignTrackerBudgetPacingManualRow(id),
          await getAccessToken(),
          toManualPacingBody(patch),
        ),
        "Update manual pacing row",
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.pacingAll }),
  });
}

export function useDeleteManualPacingRow() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedDelete(urls.campaignTrackerBudgetPacingManualRow(id), await getAccessToken()),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.pacingAll }),
  });
}

// ---- weekly log ---------------------------------------------------------------

// includeUnlogged=false (default) matches the backend's default — entries an
// operator marked "unlog" are excluded, and a group left with no visible
// entries is omitted entirely. Both platforms' groups come back in one call
// (no platform param) — LinkedIn has no change-event log to fetch live, so
// its groups are reconciled into the same backend tables by a periodic
// snapshot-diff job instead.
export function useWeeklyLog(days: number, includeUnlogged: boolean) {
  const { getAccessToken, ready } = useBase();
  return useQuery<WeeklyLogRow[]>({
    queryKey: KEY.weeklyLog(days, includeUnlogged),
    enabled: ready,
    queryFn: async () =>
      authedGet<WeeklyLogRow[]>(
        urls.campaignTrackerWeeklyLog(days, includeUnlogged),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });
}

type WeeklyLogGroupEditableFields = Pick<
  WeeklyLogRow,
  "status" | "why" | "expectedImpact" | "followUpDate" | "outcome" | "completedDate" | "owner" | "bu" | "campaignName"
>;

function toGroupPatchBody(patch: Partial<WeeklyLogGroupEditableFields>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ("status" in patch) body.status = patch.status;
  if ("why" in patch) body.why = patch.why;
  if ("expectedImpact" in patch) body.expected_impact = patch.expectedImpact;
  if ("followUpDate" in patch) body.follow_up_date = patch.followUpDate;
  if ("outcome" in patch) body.outcome = patch.outcome;
  if ("completedDate" in patch) body.completed_date = patch.completedDate;
  if ("owner" in patch) body.owner = patch.owner;
  if ("bu" in patch) body.bu = patch.bu;
  if ("campaignName" in patch) body.campaign_name = patch.campaignName;
  return body;
}

type WeeklyLogEntryEditableFields = Pick<WeeklyLogEntryRow, "entryType" | "whatChanged">;

function toEntryPatchBody(patch: Partial<WeeklyLogEntryEditableFields>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ("entryType" in patch) body.entry_type = patch.entryType;
  if ("whatChanged" in patch) body.what_changed = patch.whatChanged;
  return body;
}

// A freshly-drafted row (from "Add log entry") always has exactly one entry —
// the whole point of a manual submission is one human composing one change in
// one sitting.
function toEntryCreateBody(row: Omit<WeeklyLogRow, "id">): Record<string, unknown> {
  const [entry] = row.entries;
  return {
    completed_date: row.completedDate,
    owner: row.owner,
    bu: row.bu,
    platform: row.platform,
    campaign_name: row.campaignName,
    entry_type: entry.entryType,
    what_changed: entry.whatChanged,
    why: row.why,
    expected_impact: row.expectedImpact,
    follow_up_date: row.followUpDate,
    outcome: row.outcome,
    status: row.status,
  };
}

function useInvalidateWeeklyLog() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY.weeklyLogAll });
}

// Add a manually-typed Weekly Log entry. Always becomes its own persisted
// group server-side (never merged into an existing one) — the caller should
// track the RETURNED row's id (not a locally-generated draft id) as
// persisted, so a later edit of this same row correctly PATCHes.
export function useAddWeeklyLogEntry() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateWeeklyLog();
  return useMutation({
    mutationFn: async (row: Omit<WeeklyLogRow, "id">) =>
      requireResult(
        await authedPost<WeeklyLogRow>(urls.campaignTrackerWeeklyLogCreate, await getAccessToken(), toEntryCreateBody(row)),
        "Add weekly log entry",
      ),
    onSuccess: invalidate,
  });
}

// Append a manually-typed entry (type + what-changed) to an EXISTING,
// already-persisted group — logging a second, distinct change made in the
// same sitting without composing a whole new why/expected-impact/follow-up
// session for it. Returns the whole parent group (nested entries included).
export function useAddWeeklyLogEntryToGroup() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateWeeklyLog();
  return useMutation({
    mutationFn: async ({
      groupId,
      entry,
    }: {
      groupId: string;
      entry: Pick<WeeklyLogEntryRow, "entryType" | "whatChanged">;
    }) =>
      requireResult(
        await authedPost<WeeklyLogRow>(urls.campaignTrackerWeeklyLogEntries(groupId), await getAccessToken(), {
          entry_type: entry.entryType,
          what_changed: entry.whatChanged,
        }),
        "Add weekly log entry to group",
      ),
    onSuccess: invalidate,
  });
}

// Edit an existing (backend-persisted) Weekly Log group. Only meaningful for
// rows that came from a fetch or a prior add call — never call this for a
// row that isn't backend-known (see persistedLogIds in CampaignTrackerPage).
export function useUpdateWeeklyLogGroup() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateWeeklyLog();
  return useMutation({
    mutationFn: async ({
      groupId,
      patch,
    }: {
      groupId: string;
      patch: Partial<WeeklyLogGroupEditableFields>;
    }) =>
      requireResult(
        await authedPatch<WeeklyLogRow>(
          urls.campaignTrackerWeeklyLogGroup(groupId),
          await getAccessToken(),
          toGroupPatchBody(patch),
        ),
        "Update weekly log group",
      ),
    onSuccess: invalidate,
  });
}

// Correct a single child entry's type and/or "what changed" text. Returns the
// whole parent group (nested entries included) so the caller can replace it
// wholesale.
export function useUpdateWeeklyLogEntry() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateWeeklyLog();
  return useMutation({
    mutationFn: async ({
      groupId,
      entryId,
      patch,
    }: {
      groupId: string;
      entryId: string;
      patch: Partial<WeeklyLogEntryEditableFields>;
    }) =>
      requireResult(
        await authedPatch<WeeklyLogRow>(
          urls.campaignTrackerWeeklyLogEntry(groupId, entryId),
          await getAccessToken(),
          toEntryPatchBody(patch),
        ),
        "Update weekly log entry",
      ),
    onSuccess: invalidate,
  });
}

// Mark (or restore) a single child entry as "unlog" — junk/not worth
// tracking, excluded from the default fetch. A dedicated mutation rather than
// routing through useUpdateWeeklyLogEntry since it's a one-click row action,
// not a form edit.
export function useSetEntryUnlogged() {
  const { getAccessToken } = useBase();
  const invalidate = useInvalidateWeeklyLog();
  return useMutation({
    mutationFn: async ({
      groupId,
      entryId,
      isUnlogged,
    }: {
      groupId: string;
      entryId: string;
      isUnlogged: boolean;
    }) =>
      requireResult(
        await authedPatch<WeeklyLogRow>(urls.campaignTrackerWeeklyLogEntry(groupId, entryId), await getAccessToken(), {
          is_unlogged: isUnlogged,
        }),
        "Set weekly log entry unlogged state",
      ),
    onSuccess: invalidate,
  });
}

// ---- LinkedIn snapshot refresh -------------------------------------------------

export interface LinkedInRefreshStatus {
  lastUpdated: string | null;
  inProgress: boolean;
}

export interface LinkedInRefreshResult {
  status: "ok" | "in_progress";
  lastUpdated: string | null;
}

// No-side-effect status read for the "Last updated" display.
export function useLinkedinRefreshStatus(enabled: boolean) {
  const { getAccessToken, ready } = useBase();
  return useQuery<LinkedInRefreshStatus>({
    queryKey: KEY.linkedinRefreshStatus,
    enabled: ready && enabled,
    queryFn: async () =>
      authedGet<LinkedInRefreshStatus>(urls.campaignTrackerLinkedinRefresh, await getAccessToken()),
    retry: httpRetry,
  });
}

// Triggers (or joins an already in-flight) LinkedIn snapshot capture — the
// manual "refresh" button. Concurrent clicks from any number of users are
// coalesced server-side into one underlying fetch. Resolves to
// {status:'ok', lastUpdated} once data is fresh, or {status:'in_progress',
// lastUpdated} if the 60s server-side wait elapsed first (the capture keeps
// running regardless — a later click/reload picks up its result).
export function useTriggerLinkedinRefresh() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      authedPost<LinkedInRefreshResult>(urls.campaignTrackerLinkedinRefresh, await getAccessToken(), {}),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: KEY.linkedinRefreshStatus });
      if (result?.status === "ok") qc.invalidateQueries({ queryKey: KEY.weeklyLogAll });
    },
  });
}

// ─── BU ownership registry (owner registry + BU assignment + history) ────────

export interface Owner {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface CurrentBuOwner {
  bu: BusinessUnit;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  effective_from: string;
}

export interface BuOwnershipEntry extends CurrentBuOwner {
  id: string;
  changed_by: string | null;
  created_at: string;
}

export function useOwners() {
  const { getAccessToken, ready } = useBase();
  return useQuery<Owner[]>({
    queryKey: KEY.owners,
    enabled: ready,
    queryFn: async () => authedGet<Owner[]>(urls.ownershipOwners, await getAccessToken()),
    retry: httpRetry,
  });
}

export function useCurrentBuOwners() {
  const { getAccessToken, ready } = useBase();
  return useQuery<CurrentBuOwner[]>({
    queryKey: KEY.buCurrent,
    enabled: ready,
    queryFn: async () => authedGet<CurrentBuOwner[]>(urls.ownershipBuCurrent, await getAccessToken()),
    retry: httpRetry,
  });
}

export function useBuOwnershipHistory(bu: BusinessUnit | null) {
  const { getAccessToken, ready } = useBase();
  return useQuery<BuOwnershipEntry[]>({
    queryKey: KEY.buHistory(bu ?? undefined),
    enabled: ready && bu !== null,
    queryFn: async () =>
      authedGet<BuOwnershipEntry[]>(urls.ownershipBuHistory(bu ?? undefined), await getAccessToken()),
    retry: httpRetry,
  });
}

export function useAddOwner() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, email }: { name: string; email: string }) =>
      authedPost<Owner>(urls.ownershipOwners, await getAccessToken(), { name, email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.owners }),
  });
}

export function useAssignBuOwner() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bu,
      owner_id,
      effective_from,
    }: {
      bu: BusinessUnit;
      owner_id: string;
      effective_from: string;
    }) =>
      authedPost<BuOwnershipEntry>(urls.ownershipBuAssign, await getAccessToken(), {
        bu,
        owner_id,
        effective_from,
      }),
    onSuccess: (_data, { bu }) => {
      qc.invalidateQueries({ queryKey: KEY.buCurrent });
      qc.invalidateQueries({ queryKey: KEY.buHistory(bu) });
      qc.invalidateQueries({ queryKey: KEY.buHistory(undefined) });
    },
  });
}

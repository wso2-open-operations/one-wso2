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

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { saveBlob } from "@utils/saveFile";
import { MIN_DIRECTORY_QUERY } from "../request-form/requestFormModel";
import type { ApprovalDecisionInput, Attachment, BudgetChange, OverrideInput, Person, Priority, PurchaseRequestInput, RequestStatus } from "../types";
import { createProcurementApi, isProcurementAvailable } from "./procurementApi";

const REFERENCE_STALE_TIME = 5 * 60 * 1000;

/** The signed-in user as a Person, once their id_token has been read. */
function useSignedInPerson(): Person | undefined {
  const { sub, email, displayName, ready } = useAsgardeoUser();
  return useMemo(
    () => (ready && sub && email ? { id: email, name: displayName ?? email, email } : undefined),
    [ready, sub, email, displayName],
  );
}

/**
 * Everything a Procurement query needs: the API, who is asking, and whether
 * asking is allowed yet. Keys carry the user's id so one account's cache is
 * never served to another.
 */
function useProcurementContext() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const person = useSignedInPerson();
  const api = useMemo(
    () => (person ? createProcurementApi(getAccessToken, person) : undefined),
    [getAccessToken, person],
  );
  return { api, userId: person?.id, enabled: isSignedIn && isProcurementAvailable() && Boolean(api) };
}

/** The cache is kept per user, so one account's answers are never served to another. `userId` is the signed-in email. */
const root = (userId: string | undefined) => ["procurement", userId] as const;

/** @param active - Whether to ask at all; the rail asks only while the Procurement perspective is open */
export function useProcurementMe(active = true) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "me"],
    enabled: enabled && active,
    staleTime: REFERENCE_STALE_TIME,
    retry: defaultQueryRetry,
    queryFn: () => api!.getMe(),
  });
}

export function useProcurementLookups() {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "lookups"],
    enabled,
    staleTime: REFERENCE_STALE_TIME,
    retry: defaultQueryRetry,
    queryFn: () => api!.getLookups(),
  });
}

/**
 * Budget approvers who cover a business unit or region (both by code). Asks
 * nothing until one is chosen, because the backend needs at least one.
 */
export function useBudgetApprovers(scope: { businessUnit: string; region: string }) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "budget-approvers", scope.businessUnit, scope.region],
    enabled: enabled && Boolean(scope.businessUnit || scope.region),
    staleTime: REFERENCE_STALE_TIME,
    retry: defaultQueryRetry,
    queryFn: () => api!.getBudgetApprovers(scope),
  });
}

/** Engagement codes funded by a business unit, asked for by the unit's name; nothing until one is chosen. */
export function useEngagementCodes(businessUnitName: string) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "engagement-codes", businessUnitName],
    enabled: enabled && Boolean(businessUnitName),
    staleTime: REFERENCE_STALE_TIME,
    retry: defaultQueryRetry,
    queryFn: () => api!.getEngagementCodes(businessUnitName),
  });
}

/**
 * Directory matches for the approver picker; asks nothing until the query is long enough.
 *
 * @param leadsOnly - Keep only leads, who are the people who can approve a request
 */
export function useDirectorySearch(query: string, leadsOnly: boolean) {
  const { api, userId, enabled } = useProcurementContext();
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...root(userId), "directory", trimmed.toLowerCase(), leadsOnly],
    enabled: enabled && trimmed.length >= MIN_DIRECTORY_QUERY,
    staleTime: REFERENCE_STALE_TIME,
    retry: defaultQueryRetry,
    queryFn: () => api!.searchDirectory(trimmed, leadsOnly),
  });
}

export function useMyRequests() {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "requests"],
    enabled,
    retry: defaultQueryRetry,
    queryFn: () => api!.listMyRequests(),
  });
}

export function useRequest(requestId: string | undefined) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "request", requestId],
    enabled: enabled && Boolean(requestId),
    retry: defaultQueryRetry,
    queryFn: () => api!.getRequest(requestId!),
  });
}

/** The files saved on a request. */
export function useAttachments(requestId: string | undefined) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "request", requestId, "attachments"],
    enabled: enabled && Boolean(requestId),
    retry: defaultQueryRetry,
    queryFn: () => api!.listAttachments(requestId!),
  });
}

/** Save one of a request's files to the person's computer. */
export function useDownloadAttachment(requestId: string) {
  const { api } = useProcurementContext();
  return useMutation({
    mutationFn: async (attachment: Attachment) => saveBlob(await api!.downloadAttachment(requestId, attachment.id), attachment.name),
  });
}

/** Raise a request. Refreshes the list, the one thing a new request changes. */
export function useSubmitRequest() {
  const { api, userId } = useProcurementContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseRequestInput) => api!.submitRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...root(userId), "requests"] }),
  });
}

/** Resubmit a rejected request. Refreshes that request and the list. */
export function useResubmitRequest(requestId: string) {
  const { api, userId } = useProcurementContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseRequestInput) => api!.resubmitRequest(requestId, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...root(userId), "request", requestId] }),
        queryClient.invalidateQueries({ queryKey: [...root(userId), "requests"] }),
      ]),
  });
}

/** Name another team lead for a request. Refreshes that request and the list. */
export function useChangeTeamLead(requestId: string) {
  const { api, userId } = useProcurementContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api!.changeTeamLead(requestId, email),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...root(userId), "request", requestId] }),
        queryClient.invalidateQueries({ queryKey: [...root(userId), "requests"] }),
      ]),
  });
}

/** Withdraw a request. Refreshes that request and the list. */
export function useCancelRequest(requestId: string) {
  const { api, userId } = useProcurementContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api!.cancelRequest(requestId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...root(userId), "request", requestId] }),
        queryClient.invalidateQueries({ queryKey: [...root(userId), "requests"] }),
      ]),
  });
}

export function useApprovals(status?: RequestStatus) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "approvals", status ?? "waiting"],
    enabled,
    retry: defaultQueryRetry,
    queryFn: () => api!.listApprovals(status),
  });
}

/** Approve or reject a request. Refreshes that request and the approvals. */
export function useDecideRequest(requestId: string) {
  const { api, userId } = useProcurementContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: ApprovalDecisionInput) => api!.decideRequest(requestId, decision),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...root(userId), "request", requestId] }),
        queryClient.invalidateQueries({ queryKey: [...root(userId), "approvals"] }),
      ]),
  });
}

/**
 * @param filter.assignee - Only the requests assigned to this email
 * @param active - Whether to ask yet; "Assigned to me" waits until the signed-in user's email is known
 */
export function useTeamQueue(filter: { status?: RequestStatus; priority?: Priority; assignee?: string }, active = true) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "team-queue", filter.status ?? "all", filter.priority ?? "all", filter.assignee?.toLowerCase() ?? "anyone"],
    enabled: enabled && active,
    retry: defaultQueryRetry,
    queryFn: () => api!.listTeamQueue(filter),
  });
}

/**
 * The people a request can be assigned to.
 *
 * @param active - Whether to ask at all; only the page that assigns needs the team
 */
export function useProcurementTeam(active = true) {
  const { api, userId, enabled } = useProcurementContext();
  return useQuery({
    queryKey: [...root(userId), "team-members"],
    enabled: enabled && active,
    staleTime: REFERENCE_STALE_TIME,
    retry: defaultQueryRetry,
    queryFn: () => api!.listTeamMembers(),
  });
}

/** Run a handling action on a request, then refresh that request and the queue. */
function useHandlingAction<V>(requestId: string, run: (api: NonNullable<ReturnType<typeof useProcurementContext>["api"]>, variables: V) => Promise<unknown>) {
  const { api, userId } = useProcurementContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: V) => run(api!, variables),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...root(userId), "request", requestId] }),
        queryClient.invalidateQueries({ queryKey: [...root(userId), "team-queue"] }),
      ]),
  });
}

/** Assign to the signed-in user, or to the given email. */
export const useAssignRequest = (requestId: string) =>
  useHandlingAction<string | undefined>(requestId, (api, email) => api.assignRequest(requestId, email));

/** As a Procurement admin, confirm the approval of a request or reject it. */
export const useOverrideRequest = (requestId: string) =>
  useHandlingAction<OverrideInput>(requestId, (api, input) => api.overrideRequest(requestId, input));

/** Replace the budget details of a request. */
export const useChangeBudget = (requestId: string) =>
  useHandlingAction<BudgetChange>(requestId, (api, change) => api.changeBudget(requestId, change));

/** Add a collaborator, by email. */
export const useAddCollaborator = (requestId: string) =>
  useHandlingAction<string>(requestId, (api, email) => api.addCollaborator(requestId, email));

/** Take a collaborator off, by email. */
export const useRemoveCollaborator = (requestId: string) =>
  useHandlingAction<string>(requestId, (api, email) => api.removeCollaborator(requestId, email));

export const useUnassignRequest = (requestId: string) => useHandlingAction<void>(requestId, (api) => api.unassignRequest(requestId));

export const useSetPriority = (requestId: string) =>
  useHandlingAction<Priority>(requestId, (api, priority) => api.setPriority(requestId, priority));

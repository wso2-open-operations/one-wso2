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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authedGet, HttpError } from "@api/http";
import { cado2Send } from "@features/sales/cado2/api/cado2Http";
import { httpRetry } from "@api/errors";
import { cado2ServiceUrls } from "@config/apiConfig";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import type {
  ApprovalInboxItem,
  ApprovalMatrix,
  ApprovalOutcome,
  ApprovalPreview,
  ApprovalPreviewInput,
  ApprovalWorkflow,
  CatalogProduct,
  MatrixChange,
  MatrixSaveResult,
} from "./approvalTypes";

// Approval data changes as soon as anyone decides: always re-fetched on open
// (the "live" freshness of useQuoteApi).
const live = { staleTime: 0, refetchOnMount: "always" as const };

/**
 * For the approval graphs: never draw one from an earlier visit while the
 * current one loads (2026-09-28), because an out-of-date graph flashing up is
 * confusing. Nothing is kept once no screen shows it, so a spinner shows instead.
 */
const noStaleGraph = { ...live, gcTime: 0 };

/**
 * The live approval preview for the wizard. `body` is null until there
 * is an opportunity to evaluate. While a new result loads, nothing is shown
 * but a spinner: showing the previous graph (e.g. on reopening "Preview
 * approvals" after an edit) was confusing (2026-09-28).
 */
export function useApprovalPreview(body: ApprovalPreviewInput | null) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<ApprovalPreview, Error>({
    queryKey: key("approval-preview", body),
    queryFn: async () => cado2Send<ApprovalPreview>("POST", cado2ServiceUrls.approvalPreview, await getToken(), body),
    enabled: ready && body !== null,
    retry: httpRetry,
  });
}

/** What a stored draft needs under the current matrix (quote page). */
export function useStoredApprovalPreview(quoteId: number | null, version: number | null, enabled: boolean) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<ApprovalPreview, Error>({
    queryKey: key("quotes", "approval-preview", quoteId, version),
    queryFn: async () =>
      authedGet<ApprovalPreview>(cado2ServiceUrls.storedApprovalPreview(quoteId as number, version as number), await getToken()),
    enabled: ready && enabled && quoteId !== null && version !== null,
    ...noStaleGraph,
    retry: httpRetry,
  });
}

/**
 * A submitted version's workflow, or null when the version has none (a draft,
 * or a version submitted before approvals existed).
 */
export function useApprovalWorkflow(quoteId: number | null, version: number | null, enabled: boolean) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<ApprovalWorkflow | null, Error>({
    queryKey: key("quotes", "approval", quoteId, version),
    queryFn: async () => {
      try {
        return await authedGet<ApprovalWorkflow>(cado2ServiceUrls.approval(quoteId as number, version as number), await getToken());
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: ready && enabled && quoteId !== null && version !== null,
    ...noStaleGraph,
    retry: httpRetry,
  });
}

/** Approve or return a step (Reject was merged into Return, 2026-10-12; "Request changes" until D80, 2026-10-14). */
export function useDecideStep() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<
    ApprovalWorkflow,
    Error,
    { quoteId: number; version: number; stepId: number; outcome: ApprovalOutcome; comment: string }
  >({
    mutationFn: async ({ quoteId, version, stepId, outcome, comment }) =>
      cado2Send<ApprovalWorkflow>("POST", cado2ServiceUrls.approvalDecision(quoteId, version, stepId, outcome), await getToken(), {
        comment: comment.trim() || null,
      }),
    onSuccess: (wf, { quoteId, version }) => {
      queryClient.setQueryData(key("quotes", "approval", quoteId, version), wf);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
      void queryClient.invalidateQueries({ queryKey: key("quote-version", quoteId) });
      void queryClient.invalidateQueries({ queryKey: key("approvals") });
    },
  });
}

/** Deal Desk approves a stuck step for its approver, with a reason (D120). */
export function useApproveOnBehalf() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<ApprovalWorkflow, Error, { quoteId: number; version: number; stepId: number; reason: string }>({
    mutationFn: async ({ quoteId, version, stepId, reason }) =>
      cado2Send<ApprovalWorkflow>("POST", cado2ServiceUrls.approvalOnBehalf(quoteId, version, stepId), await getToken(), {
        comment: reason.trim(),
      }),
    onSuccess: (wf, { quoteId, version }) => {
      queryClient.setQueryData(key("quotes", "approval", quoteId, version), wf);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
      void queryClient.invalidateQueries({ queryKey: key("quote-version", quoteId) });
      void queryClient.invalidateQueries({ queryKey: key("approvals") });
    },
  });
}

/** The steps waiting for the caller (My approvals). */
export function useApprovalInbox(enabled = true) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<ApprovalInboxItem[], Error>({
    queryKey: key("approvals", "inbox"),
    queryFn: async () => authedGet<ApprovalInboxItem[]>(cado2ServiceUrls.approvalInbox, await getToken()),
    enabled: ready && enabled,
    ...live,
    retry: httpRetry,
  });
}

export function useApprovalMatrix() {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<ApprovalMatrix, Error>({
    queryKey: key("approvals", "matrix"),
    queryFn: async () => authedGet<ApprovalMatrix>(cado2ServiceUrls.approvalMatrix, await getToken()),
    enabled: ready,
    ...live,
    retry: httpRetry,
  });
}

export function useMatrixChanges() {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<MatrixChange[], Error>({
    queryKey: key("approvals", "matrix-changes"),
    queryFn: async () => authedGet<MatrixChange[]>(cado2ServiceUrls.approvalMatrixChanges, await getToken()),
    enabled: ready,
    ...live,
    retry: httpRetry,
  });
}

/**
 * Salesforce's active products, for the product mapping (D117): picking
 * products for a list, and counting what a pattern or rule matches. The
 * backend reuses its copy for 5 minutes; so does this.
 */
export function useMatrixProducts(enabled: boolean) {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<CatalogProduct[], Error>({
    queryKey: key("approvals", "matrix-products"),
    queryFn: async () => authedGet<CatalogProduct[]>(cado2ServiceUrls.approvalMatrixProducts, await getToken()),
    enabled: ready && enabled,
    staleTime: 5 * 60_000,
    retry: httpRetry,
  });
}

/**
 * Checks (confirm = false) or saves (confirm = true) a matrix. A check only
 * reports the in-flight quotes the change would recall.
 */
export function useSaveApprovalMatrix() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<MatrixSaveResult, Error, { matrix: ApprovalMatrix; confirm: boolean }>({
    mutationFn: async (body) => cado2Send<MatrixSaveResult>("PUT", cado2ServiceUrls.approvalMatrix, await getToken(), body),
    onSuccess: (res) => {
      if (!res.saved) return;
      void queryClient.invalidateQueries({ queryKey: key("approvals") });
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
    },
  });
}

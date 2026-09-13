/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useExpenseClaims } from "../useExpense";
import { useExpenseClaimStatus } from "../useExpenseMutations";
import { nextStatus, type ApproverView, type ExpenseClaimSearchPayload } from "../expenseTypes";
import type { ApprovalClaim } from "./expenseApprovalTypes";

/**
 * The data this screen runs on. Everything here wraps a hook the expense app
 * already owns rather than restating it: the queue is the shared
 * `/search-claims` query, and the decision is the shared `/claims/{id}/status`
 * mutation, which already sends the `{ status, reason? }` body the source
 * sends (`claimDetailsSlice.ts:104-106`) and already invalidates the claim
 * queries on success.
 */

/**
 * The queue. Re-typed to `ApprovalClaim` for the `submittedBy` the on-behalf
 * chip needs — a local `extends`, not a widening of the shared DTO.
 */
export function useApprovalQueue(payload: ExpenseClaimSearchPayload, enabled: boolean) {
  const query = useExpenseClaims(payload, enabled);
  return { ...query, data: query.data as ApprovalClaim[] | undefined };
}

export type ApprovalDecision = "approve" | "reject";

/**
 * Approve or reject, at whichever stage the approver is acting.
 *
 * `nextStatus` is the source's `getMappedStatus` (`claimDetailsSlice.ts:36-50`):
 * a lead approving moves the claim on to finance rather than finishing it, and
 * each stage has its own rejection status.
 *
 * The reason rides along only when there is one. Only a lead is ever asked for
 * it — the backend records `leadRejectedReason` and has no finance equivalent,
 * so a reason collected at the finance stage could never be stored or shown.
 */
export function useApprovalDecision() {
  const mutation = useExpenseClaimStatus();
  const decide = (
    claimId: string,
    stage: ApproverView,
    decision: ApprovalDecision,
    reason: string | undefined,
    handlers: { onSuccess: () => void; onError: (err: Error) => void },
  ) =>
    mutation.mutate(
      {
        claimId,
        body: {
          status: nextStatus(stage, decision),
          reason: reason?.trim() ? reason.trim() : undefined,
        },
      },
      { onSuccess: handlers.onSuccess, onError: handlers.onError },
    );

  return { decide, isPending: mutation.isPending };
}

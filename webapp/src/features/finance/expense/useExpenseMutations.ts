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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedDelete, authedPost, authedPut } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls } from "@config/apiConfig";
import { uploadReceipt } from "../util/financeReceipts";
import type {
  ExpenseClaimPayload,
  ExpenseStatusPayload,
  ExpenseTransactionPayload,
} from "./expenseTypes";

// POST /claims/{email}/transactions/receipts/file (raw binary) → fileName.
export function useExpenseReceiptUpload() {
  const getAccessToken = useAccessToken();
  return useMutation<string, Error, { email: string; file: File }>({
    mutationFn: async ({ email, file }) => {
      const accessToken = await getAccessToken();
      return uploadReceipt(expenseServiceUrls.receiptUpload(email), accessToken, file);
    },
  });
}

// POST /claims — submit a new expense claim to the caller's lead.
export function useSubmitExpenseClaim() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, ExpenseClaimPayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(expenseServiceUrls.claims, accessToken, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-claims"] });
      await qc.invalidateQueries({ queryKey: ["expense-app-data"] });
    },
  });
}

// POST /claim-drafts — autosave the in-progress claim; DELETE clears it.
/**
 * PUT /claims/{id}/transactions — resubmit a rejected claim with corrected
 * lines (`claimDetailsSlice.ts:52-80`). The claim keeps its id and goes back
 * through review; it is not a new claim.
 */
export function useResubmitExpenseClaim() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; transactions: ExpenseTransactionPayload[] }>({
    mutationFn: async ({ id, transactions }) => {
      const accessToken = await getAccessToken();
      await authedPut<unknown>(expenseServiceUrls.claimTransactions(id), accessToken, transactions);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-claims"] });
    },
  });
}

export function useExpenseDraftSync() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const save = useMutation<void, Error, ExpenseTransactionPayload[]>({
    mutationFn: async (transactions) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(expenseServiceUrls.claimDrafts, accessToken, { transactions });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-app-data"] });
    },
  });
  const remove = useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedDelete(expenseServiceUrls.claimDrafts, accessToken);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-app-data"] });
    },
  });
  return { save, remove };
}

// POST /claims/{id}/status — lead or finance approve/reject. The backend
// authorizes on the caller being a lead of the claim or an admin.
export function useExpenseClaimStatus() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { claimId: string; body: ExpenseStatusPayload }>({
    mutationFn: async ({ claimId, body }) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(expenseServiceUrls.claimStatus(claimId), accessToken, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense-claims"] });
    },
  });
}

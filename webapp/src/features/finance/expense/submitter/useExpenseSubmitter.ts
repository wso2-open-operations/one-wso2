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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls, isExpenseBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { financeRetry } from "../../util/financeError";
import { useExpenseAppData } from "../useExpense";
import type { ExpenseTypeData } from "../expenseTypes";
import { expenseSubmitterUrls } from "./expenseSubmitterUrls";
import type { SubmitterAppData, SubmitterClaimPayload, SubmitterTravel } from "./expenseSubmitterTypes";

/**
 * The same `/app-data` query the rest of the expense app runs — same cache
 * entry, so this view costs no extra request — read back at the fuller shape
 * this screen needs (see `SubmitterAppData`).
 */
export function useSubmitterAppData() {
  const query = useExpenseAppData();
  return { ...query, data: query.data as SubmitterAppData | undefined };
}

/**
 * GET /employees/{email}/travels — the job numbers offered are the CLAIM
 * OWNER's, so filing for someone else swaps in theirs. Idle until an employee
 * is picked, so the ordinary "filing for myself" case never fires it.
 */
export function useOnBehalfOfTravels(email: string | null) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<SubmitterTravel[]>({
    queryKey: ["expense-submitter-travels", userSub, email],
    enabled: isSignedIn && configured && Boolean(userSub) && Boolean(email),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<SubmitterTravel[]>(expenseSubmitterUrls.employeeTravels(email!), accessToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * GET /user-configurations/expense-types, scoped to the job number AND to
 * whoever the claim is for. Keyed on both, so switching employee or job
 * number re-fetches rather than showing the previous person's types.
 */
export function useSubmitterExpenseTypes(
  travelJobNumber: string | undefined,
  onBehalfOfEmail: string | null,
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseTypeData[]>({
    queryKey: ["expense-submitter-types", userSub, travelJobNumber ?? null, onBehalfOfEmail],
    enabled: isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseTypeData[]>(
        expenseSubmitterUrls.expenseTypes(travelJobNumber, onBehalfOfEmail),
        accessToken,
      );
    },
    staleTime: 10 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * POST /claim-drafts — autosave the in-progress claim, remembering who it is
 * for; DELETE clears it. Invalidates the shared `/app-data` entry so the
 * restored draft the form reads back is the one just saved.
 */
export function useSubmitterDraftSync() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const save = useMutation<void, Error, SubmitterClaimPayload>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPost<unknown>(expenseServiceUrls.claimDrafts, accessToken, payload);
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

/**
 * POST /claims — submit the claim. With `onBehalfOfEmail` set the backend
 * files it for that employee and routes it to THEIR lead, not the caller's.
 */
export function useSubmitClaimForEmployee() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, SubmitterClaimPayload>({
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

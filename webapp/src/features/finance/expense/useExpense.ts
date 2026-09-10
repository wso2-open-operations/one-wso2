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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls, isExpenseBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { financeRetry } from "../util/financeError";
import type {
  ExchangeRate,
  ExpenseAppData,
  ExpenseClaim,
  ExpenseClaimSearchPayload,
  ExpenseEmployee,
  ExpenseTypeData,
} from "./expenseTypes";

export { isExpenseBackendConfigured };

// GET /app-data — the caller's employee record, lead/finance view flags,
// reimbursement currency, travels and any draft. Keyed per-user.
export function useExpenseAppData(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseAppData>({
    queryKey: ["expense-app-data", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseAppData>(expenseServiceUrls.appData, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// POST /search-claims — the list endpoint for History (own), Lead approvals
// (leadEmail) and Finance approvals (admin). `enabled` defers until ready.
export function useExpenseClaims(payload: ExpenseClaimSearchPayload, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseClaim[]>({
    // Scope per user — a claim search with no explicit email resolves the
    // caller from the token, so two users would share one cache entry.
    queryKey: ["expense-claims", userSub, payload],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      // The response IS the array. tableSlice.ts:57 assigns `resp.data` straight
      // to `Claim[]`, and axios's `data` is the response body — so there is no
      // `{ body: [...] }` wrapper to unwrap. Unwrapping one yielded undefined
      // every time, which is why every claim list rendered empty.
      const res = await authedPost<ExpenseClaim[]>(
        expenseServiceUrls.searchClaims,
        accessToken,
        payload,
      );
      return Array.isArray(res) ? res : [];
    },
    staleTime: 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// GET /user-configurations/expense-types — the expense-type dropdown,
// scoped to the caller's country and (optionally) a travel job number.
export function useExpenseTypes(travelJobNumber: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseTypeData[]>({
    // Country-scoped per caller — key per user like the sibling queries.
    queryKey: ["expense-types", userSub, travelJobNumber ?? null],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseTypeData[]>(expenseServiceUrls.expenseTypes(travelJobNumber), accessToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// GET /employees — to resolve the lead's name for the submit confirmation,
// the way AppHandler.tsx:28 does. The email is the fallback, as it is there.
export function useExpenseEmployees(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExpenseEmployee[]>({
    queryKey: ["expense-employees", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExpenseEmployee[]>(expenseServiceUrls.employees, accessToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// GET /currencies/{base}/rates/{date} — exchange rates into the
// reimbursement currency for the bill date. Only fires once base+date exist.
export function useExchangeRates(baseCode: string | undefined, date: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isExpenseBackendConfigured();
  const query = useQuery<ExchangeRate[]>({
    queryKey: ["expense-rates", userSub, baseCode ?? null, date ?? null],
    enabled: isSignedIn && configured && Boolean(userSub) && Boolean(baseCode) && Boolean(date),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ExchangeRate[]>(expenseServiceUrls.exchangeRates(baseCode!, date!), accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

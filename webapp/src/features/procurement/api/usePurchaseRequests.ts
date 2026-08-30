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

// Purchase-request reads for the Phase 1 screens.
//
// The standalone app polls these every 5s (hooks/usePurchaseRequests.ts) because
// approvals move while you watch. One WSO2's QueryClient disables
// refetchOnWindowFocus/Mount globally, so the interval is stated per query here
// rather than inherited.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isPurchasingBackendConfigured, purchasingServiceUrls } from "@config/apiConfig";
import type { HomeResponse, PRListScope, PurchaseRequest } from "./purchasingTypes";

const POLL_MS = 5000;

function usePurchasingQuery<T>(key: unknown[], url: string, enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<T>({
    queryKey: [...key, userSub],
    enabled: enabled && isSignedIn && isPurchasingBackendConfigured() && Boolean(userSub),
    queryFn: async () => authedGet<T>(url, await getAccessToken()),
    refetchInterval: POLL_MS,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

function listUrl(scope?: PRListScope): string {
  return scope
    ? `${purchasingServiceUrls.purchaseRequests}?scope=${encodeURIComponent(scope)}`
    : purchasingServiceUrls.purchaseRequests;
}

/** The caller's own submissions. Open to everyone. */
export function useMyRequests(enabled = true) {
  return usePurchasingQuery<PurchaseRequest[]>(
    ["purchasing", "purchase-requests", "mine"],
    listUrl("mine"),
    enabled,
  );
}

/** PRs awaiting the caller's decision, across both approval systems. */
export function useApprovalRequests(enabled = true) {
  return usePurchasingQuery<PurchaseRequest[]>(
    ["purchasing", "purchase-requests", "approvals"],
    listUrl("approvals"),
    enabled,
  );
}

/** The role-based home blocks. The backend decides which apply. */
export function useProcurementHome(enabled = true) {
  return usePurchasingQuery<HomeResponse>(["purchasing", "home"], purchasingServiceUrls.home, enabled);
}

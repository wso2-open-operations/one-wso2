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

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { authedDelete, authedGet, authedPost, HttpError } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type { SwagStoreAlertList } from "../../api/swagStoreTypes";
import { swagStoreRetry } from "../../util/swagStoreError";
import { PRODUCT_KEY } from "./useShopData";

export const ALERTS_KEY = "alerts";

/** The caller's "Notify me" alerts, newest first (GET /stock-alerts). */
export function useAlerts(): UseQueryResult<SwagStoreAlertList, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreAlertList, Error>({
    queryKey: key(ALERTS_KEY),
    queryFn: async () => authedGet<SwagStoreAlertList>(swagStoreServiceUrls.stockAlerts, await getToken()),
    enabled: ready,
    staleTime: 30 * 1000,
    retry: swagStoreRetry,
  });
}

/**
 * Ask to be emailed when an out-of-stock variant is back (POST /stock-alerts).
 * Asking twice is safe: the backend answers with the alert already waiting.
 */
export function useCreateAlert(productSlug?: string): UseMutationResult<string, Error, string> {
  const { getToken } = useSwagStoreBasis();
  const refreshAlerts = useRefreshAlerts(productSlug);
  return useMutation<string, Error, string>({
    mutationFn: async (variantId) => {
      const created = await authedPost<{ id: string }>(swagStoreServiceUrls.stockAlerts, await getToken(), { variantId });
      if (!created?.id) throw new HttpError(swagStoreServiceUrls.stockAlerts, 201, "");
      return created.id;
    },
    onSuccess: refreshAlerts,
  });
}

/** Stop a waiting alert (DELETE /stock-alerts/{id}). */
export function useCancelAlert(productSlug?: string): UseMutationResult<void, Error, string> {
  const { getToken } = useSwagStoreBasis();
  const refreshAlerts = useRefreshAlerts(productSlug);
  return useMutation<void, Error, string>({
    mutationFn: async (alertId) => authedDelete(swagStoreServiceUrls.stockAlert(alertId), await getToken()),
    onSettled: refreshAlerts,
  });
}

/** An alert change makes the alert list, and the product it is for, stale. */
function useRefreshAlerts(productSlug: string | undefined): () => Promise<void> {
  const { key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key(ALERTS_KEY) }),
      ...(productSlug ? [queryClient.invalidateQueries({ queryKey: key(PRODUCT_KEY, productSlug) })] : []),
    ]);
  };
}

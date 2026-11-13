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

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type { SwagStoreCart, SwagStoreCartSummary } from "../../api/swagStoreTypes";
import { swagStoreRetry } from "../../util/swagStoreError";

/** Cache-key parts of the cart and its summary, so a cart change can invalidate both. */
export const CART_KEY = "cart";
export const CART_SUMMARY_KEY = "cart-summary";

/**
 * The cart's item count for the top-bar badge (GET /cart/summary). It runs on
 * every page, so it is cached for a minute; cart changes invalidate it.
 */
export function useCartSummary(): UseQueryResult<SwagStoreCartSummary, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreCartSummary, Error>({
    queryKey: key(CART_SUMMARY_KEY),
    queryFn: async () => authedGet<SwagStoreCartSummary>(swagStoreServiceUrls.cartSummary, await getToken()),
    enabled: ready,
    staleTime: 60 * 1000,
    retry: swagStoreRetry,
  });
}

/** The cart with live prices and line states (GET /cart). Money and stock, so every mount asks again. */
export function useCart(): UseQueryResult<SwagStoreCart, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreCart, Error>({
    queryKey: key(CART_KEY),
    queryFn: async () => authedGet<SwagStoreCart>(swagStoreServiceUrls.cart, await getToken()),
    enabled: ready,
    staleTime: 0,
    refetchOnMount: "always",
    retry: swagStoreRetry,
  });
}

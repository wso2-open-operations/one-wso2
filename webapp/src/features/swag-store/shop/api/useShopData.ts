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

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type {
  SwagStoreCategory,
  SwagStoreOfficeList,
  SwagStoreProductDetail,
  SwagStoreProductList,
} from "../../api/swagStoreTypes";
import { swagStoreRetry } from "../../util/swagStoreError";
import { productListQuery, type ShopView } from "../../util/shopViewState";

/** Cache-key part of every product read, so placing an order can refresh stock everywhere. */
export const PRODUCTS_KEY = "products";
export const PRODUCT_KEY = "product";

/** Catalog reads match the backend's 60 s list cache. */
const CATALOG_STALE_MS = 60 * 1000;

/** The categories that have products, for the shop's chips (GET /categories). */
export function useCategories(): UseQueryResult<readonly SwagStoreCategory[], Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<readonly SwagStoreCategory[], Error>({
    queryKey: key("categories"),
    queryFn: async () => authedGet<SwagStoreCategory[]>(swagStoreServiceUrls.categories, await getToken()),
    enabled: ready,
    staleTime: CATALOG_STALE_MS,
    retry: swagStoreRetry,
  });
}

/**
 * One page of the shop's grid (GET /products). The previous page stays on
 * screen while a new filter loads, so the grid doesn't flash empty.
 */
export function useProducts(view: ShopView): UseQueryResult<SwagStoreProductList, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  const query = productListQuery(view);
  return useQuery<SwagStoreProductList, Error>({
    queryKey: key(PRODUCTS_KEY, query),
    queryFn: async () => authedGet<SwagStoreProductList>(`${swagStoreServiceUrls.products}?${query}`, await getToken()),
    enabled: ready,
    staleTime: CATALOG_STALE_MS,
    placeholderData: keepPreviousData,
    retry: swagStoreRetry,
  });
}

/** One product by slug (GET /products/{slug}). A removed product answers with its alternatives only. */
export function useProduct(slug: string): UseQueryResult<SwagStoreProductDetail, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreProductDetail, Error>({
    queryKey: key(PRODUCT_KEY, slug),
    queryFn: async () => authedGet<SwagStoreProductDetail>(swagStoreServiceUrls.product(slug), await getToken()),
    enabled: ready && Boolean(slug),
    staleTime: CATALOG_STALE_MS,
    retry: swagStoreRetry,
  });
}

/** The pickup offices and the caller's default (GET /pickup-offices). */
export function useOffices(): UseQueryResult<SwagStoreOfficeList, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreOfficeList, Error>({
    queryKey: key("offices"),
    queryFn: async () => authedGet<SwagStoreOfficeList>(swagStoreServiceUrls.pickupOffices, await getToken()),
    enabled: ready,
    staleTime: CATALOG_STALE_MS,
    retry: swagStoreRetry,
  });
}

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
import { authedGet, authedPost, HttpError } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type {
  SwagStoreAdminCategory,
  SwagStoreAdminProduct,
  SwagStoreAdminProductList,
  SwagStoreProductStatus,
  SwagStoreRemovalImpact,
  SwagStoreAdminOffice,
  SwagStoreAdminOrderDetail,
  SwagStoreAdminOrderList,
  SwagStoreDashboard,
  SwagStoreDemandRow,
} from "../../api/swagStoreTypes";
import { orderSearchBody, type AdminOrdersView } from "../../util/adminOrdersViewState";
import { swagStoreRetry } from "../../util/swagStoreError";

/** Cache-key prefix of every admin read, so an admin change can refresh them together. */
export const ADMIN_KEY = "admin";

/** Admin lists change as the team works, so they are kept for 30 s. */
const ADMIN_STALE_MS = 30 * 1000;

/** The counts for the caller's store roles (GET /admin/dashboard). */
export function useAdminDashboard(): UseQueryResult<SwagStoreDashboard, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreDashboard, Error>({
    queryKey: key(ADMIN_KEY, "dashboard"),
    queryFn: async () => authedGet<SwagStoreDashboard>(swagStoreServiceUrls.admin.dashboard, await getToken()),
    enabled: ready,
    staleTime: ADMIN_STALE_MS,
    retry: swagStoreRetry,
  });
}

/**
 * A short stand-in for search text in a cache key. The text can be an email
 * address, and nothing personal goes into a query key beyond the subject.
 */
function searchKey(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/** One page of the orders board (POST /admin/orders/search). The previous page stays while a filter loads. */
export function useAdminOrders(view: AdminOrdersView): UseQueryResult<SwagStoreAdminOrderList, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreAdminOrderList, Error>({
    queryKey: key(ADMIN_KEY, "orders", view.status, view.office, view.page, view.q ? searchKey(view.q) : ""),
    queryFn: async () => {
      const url = swagStoreServiceUrls.admin.ordersSearch;
      const list = await authedPost<SwagStoreAdminOrderList>(url, await getToken(), orderSearchBody(view));
      if (!list) throw new HttpError(url, 204, "");
      return list;
    },
    enabled: ready,
    staleTime: ADMIN_STALE_MS,
    placeholderData: keepPreviousData,
    retry: swagStoreRetry,
  });
}

/** One order with who placed it, the payment reference and notes (GET /admin/orders/{orderNo}). */
export function useAdminOrder(orderNo: string): UseQueryResult<SwagStoreAdminOrderDetail, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreAdminOrderDetail, Error>({
    queryKey: key(ADMIN_KEY, "order", orderNo),
    queryFn: async () => authedGet<SwagStoreAdminOrderDetail>(swagStoreServiceUrls.admin.order(orderNo), await getToken()),
    enabled: ready && Boolean(orderNo),
    staleTime: ADMIN_STALE_MS,
    retry: swagStoreRetry,
  });
}

/** Every pickup office, open or not (GET /admin/pickup-offices). */
export function useAdminOffices(): UseQueryResult<readonly SwagStoreAdminOffice[], Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<readonly SwagStoreAdminOffice[], Error>({
    queryKey: key(ADMIN_KEY, "offices"),
    queryFn: async () =>
      (await authedGet<{ items: SwagStoreAdminOffice[] }>(swagStoreServiceUrls.admin.pickupOffices, await getToken()))
        .items,
    enabled: ready,
    staleTime: ADMIN_STALE_MS,
    retry: swagStoreRetry,
  });
}

/** Products per page of the admin products list. */
export const ADMIN_PRODUCTS_PAGE_SIZE = 50;

/** One tab of the products list (GET /admin/products?status=). */
export function useAdminProducts(status: SwagStoreProductStatus, page = 1): UseQueryResult<SwagStoreAdminProductList, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  const query = `status=${status}&limit=${ADMIN_PRODUCTS_PAGE_SIZE}&offset=${(page - 1) * ADMIN_PRODUCTS_PAGE_SIZE}`;
  return useQuery<SwagStoreAdminProductList, Error>({
    queryKey: key(ADMIN_KEY, "products", status, page),
    queryFn: async () => authedGet<SwagStoreAdminProductList>(`${swagStoreServiceUrls.admin.products}?${query}`, await getToken()),
    enabled: ready,
    staleTime: ADMIN_STALE_MS,
    placeholderData: keepPreviousData,
    retry: swagStoreRetry,
  });
}

/** One product with its options, variants and stock (GET /admin/products/{id}). */
export function useAdminProduct(productId: string): UseQueryResult<SwagStoreAdminProduct, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreAdminProduct, Error>({
    queryKey: key(ADMIN_KEY, "product", productId),
    queryFn: async () => authedGet<SwagStoreAdminProduct>(swagStoreServiceUrls.admin.product(productId), await getToken()),
    enabled: ready && Boolean(productId),
    staleTime: ADMIN_STALE_MS,
    retry: swagStoreRetry,
  });
}

/** The catalog's categories (GET /admin/categories). */
export function useAdminCategories(): UseQueryResult<readonly SwagStoreAdminCategory[], Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<readonly SwagStoreAdminCategory[], Error>({
    queryKey: key(ADMIN_KEY, "categories"),
    queryFn: async () =>
      (await authedGet<{ items: SwagStoreAdminCategory[] }>(swagStoreServiceUrls.admin.categories, await getToken())).items,
    enabled: ready,
    staleTime: ADMIN_STALE_MS,
    retry: swagStoreRetry,
  });
}

/** The demand board: variants people are waiting for (GET /admin/demand). */
export function useAdminDemand(): UseQueryResult<readonly SwagStoreDemandRow[], Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<readonly SwagStoreDemandRow[], Error>({
    queryKey: key(ADMIN_KEY, "demand"),
    queryFn: async () => (await authedGet<{ items: SwagStoreDemandRow[] }>(swagStoreServiceUrls.admin.demand, await getToken())).items,
    enabled: ready,
    staleTime: ADMIN_STALE_MS,
    retry: swagStoreRetry,
  });
}

/** What removing a product would touch, read fresh each time the dialog opens. */
export function useRemovalImpact(productId: string, enabled: boolean): UseQueryResult<SwagStoreRemovalImpact, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreRemovalImpact, Error>({
    queryKey: key(ADMIN_KEY, "removal-impact", productId),
    queryFn: async () => authedGet<SwagStoreRemovalImpact>(swagStoreServiceUrls.admin.removalImpact(productId), await getToken()),
    enabled: ready && enabled,
    staleTime: 0,
    refetchOnMount: "always",
    retry: swagStoreRetry,
  });
}

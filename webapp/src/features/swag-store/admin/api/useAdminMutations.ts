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

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { authedDelete, authedPatch, authedPost, authedPostText, authedPut, HttpError } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type {
  SwagStoreAdminOffice,
  SwagStoreAdminProduct,
  SwagStoreOfficeInput,
  SwagStoreOptionsInput,
  SwagStoreOrderPatch,
  SwagStoreProductInput,
  SwagStoreStockMovement,
  SwagStoreStockResult,
  SwagStoreVariantPatch,
} from "../../api/swagStoreTypes";
import { orderSearchBody, type AdminOrdersView } from "../../util/adminOrdersViewState";
import { saveCsv } from "../../util/saveCsv";
import { ADMIN_KEY } from "./useAdminData";

/** An admin change can move any admin count or list, so all of them are read again. */
function useRefreshAdmin(): () => Promise<void> {
  const { key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: key(ADMIN_KEY) });
  };
}

/**
 * Move an order to its next step (PATCH /admin/orders/{orderNo}). Settled either
 * way, because a 409 means someone else moved it and the screen must catch up.
 */
export function useTransitionOrder(orderNo: string): UseMutationResult<void, Error, SwagStoreOrderPatch> {
  const { getToken } = useSwagStoreBasis();
  const refresh = useRefreshAdmin();
  return useMutation<void, Error, SwagStoreOrderPatch>({
    mutationFn: async (patch) => {
      await authedPatch(swagStoreServiceUrls.admin.order(orderNo), await getToken(), patch);
    },
    onSettled: refresh,
  });
}

/** Add a fulfilment note (POST /admin/orders/{orderNo}/notes). */
export function useAddOrderNote(orderNo: string): UseMutationResult<void, Error, string> {
  const { getToken, key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (note) => {
      await authedPost(swagStoreServiceUrls.admin.orderNotes(orderNo), await getToken(), { note });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key(ADMIN_KEY, "order", orderNo) });
    },
  });
}

/** Save the board's current search as a CSV file: the same POST, asked for as `text/csv`. */
export function useExportOrders(): UseMutationResult<void, Error, AdminOrdersView> {
  const { getToken } = useSwagStoreBasis();
  return useMutation<void, Error, AdminOrdersView>({
    mutationFn: async (view) => {
      const body = { ...orderSearchBody(view), pagination: { limit: 100, offset: 0 } };
      const csv = await authedPostText(swagStoreServiceUrls.admin.ordersSearch, await getToken(), body, {
        Accept: "text/csv",
      });
      saveCsv("swag-store-orders.csv", csv);
    },
  });
}

/** Add an office (POST) or replace one (PATCH with the whole office). */
export function useSaveOffice(): UseMutationResult<void, Error, { id?: string; office: SwagStoreOfficeInput }> {
  const { getToken, key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id?: string; office: SwagStoreOfficeInput }>({
    mutationFn: async ({ id, office }) => {
      const token = await getToken();
      if (id) await authedPatch<SwagStoreAdminOffice>(swagStoreServiceUrls.admin.pickupOffice(id), token, office);
      else await authedPost<SwagStoreAdminOffice>(swagStoreServiceUrls.admin.pickupOffices, token, office);
    },
    onSuccess: async () => {
      // Shoppers' office list reads the same rows.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key(ADMIN_KEY, "offices") }),
        queryClient.invalidateQueries({ queryKey: key("offices") }),
      ]);
    },
  });
}

/**
 * After a product change: the editor shows the saved product at once (every
 * product endpoint answers with it), and every admin and shop list is read
 * again, since stock, status and prices may have moved.
 */
function useProductSaved(): (product: SwagStoreAdminProduct | null) => Promise<void> {
  const { key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return async (product) => {
    if (product) queryClient.setQueryData(key(ADMIN_KEY, "product", product.id), product);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: key(ADMIN_KEY) }),
      queryClient.invalidateQueries({ queryKey: key("products") }),
      queryClient.invalidateQueries({ queryKey: key("product") }),
      queryClient.invalidateQueries({ queryKey: key("categories") }),
    ]);
  };
}

async function required<T>(url: string, pending: Promise<T | null>): Promise<T> {
  const value = await pending;
  if (!value) throw new HttpError(url, 204, "");
  return value;
}

/** Create a draft product (POST /admin/products). Answers with the new product, id included. */
export function useCreateProduct(): UseMutationResult<SwagStoreAdminProduct, Error, SwagStoreProductInput> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<SwagStoreAdminProduct, Error, SwagStoreProductInput>({
    mutationFn: async (input) => {
      const url = swagStoreServiceUrls.admin.products;
      return required(url, authedPost<SwagStoreAdminProduct>(url, await getToken(), input));
    },
    onSuccess: saved,
  });
}

/** Save a product's basics (PATCH with ProductInput). */
export function useUpdateProduct(productId: string): UseMutationResult<SwagStoreAdminProduct, Error, SwagStoreProductInput> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<SwagStoreAdminProduct, Error, SwagStoreProductInput>({
    mutationFn: async (input) => {
      const url = swagStoreServiceUrls.admin.product(productId);
      return required(url, authedPatch<SwagStoreAdminProduct>(url, await getToken(), input));
    },
    onSuccess: saved,
  });
}

/** Publish or restore (ACTIVE), or remove from the store (REMOVED, with a note). Orders already placed are still served. */
export function useSetProductStatus(
  productId: string,
): UseMutationResult<SwagStoreAdminProduct, Error, { status: "ACTIVE" | "REMOVED"; removalNote?: string }> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<SwagStoreAdminProduct, Error, { status: "ACTIVE" | "REMOVED"; removalNote?: string }>({
    mutationFn: async (change) => {
      const url = swagStoreServiceUrls.admin.product(productId);
      return required(url, authedPatch<SwagStoreAdminProduct>(url, await getToken(), change));
    },
    onSuccess: saved,
  });
}

/** Delete a product that was never published (DELETE /admin/products/{id}). */
export function useDeleteDraft(productId: string): UseMutationResult<void, Error, void> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<void, Error, void>({
    mutationFn: async () => authedDelete(swagStoreServiceUrls.admin.product(productId), await getToken()),
    onSuccess: () => saved(null),
  });
}

/** Replace a product's options (PUT). The backend rebuilds the variants from them. */
export function useSetOptions(productId: string): UseMutationResult<SwagStoreAdminProduct, Error, SwagStoreOptionsInput> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<SwagStoreAdminProduct, Error, SwagStoreOptionsInput>({
    mutationFn: async (input) => {
      const url = swagStoreServiceUrls.admin.productOptions(productId);
      return required(url, authedPut<SwagStoreAdminProduct>(url, await getToken(), input));
    },
    onSuccess: saved,
  });
}

/** Change one variant's SKU, price change, restock date or whether it is sold. */
export function usePatchVariant(
  productId: string,
): UseMutationResult<SwagStoreAdminProduct, Error, { variantId: string; patch: SwagStoreVariantPatch }> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<SwagStoreAdminProduct, Error, { variantId: string; patch: SwagStoreVariantPatch }>({
    mutationFn: async ({ variantId, patch }) => {
      const url = swagStoreServiceUrls.admin.productVariant(productId, variantId);
      return required(url, authedPatch<SwagStoreAdminProduct>(url, await getToken(), patch));
    },
    onSuccess: saved,
  });
}

/** Receive, adjust or write off one variant's stock. Receiving can set off "Notify me" emails. */
export function useStockMovement(): UseMutationResult<
  SwagStoreStockResult,
  Error,
  { variantId: string; movement: SwagStoreStockMovement }
> {
  const { getToken } = useSwagStoreBasis();
  const saved = useProductSaved();
  return useMutation<SwagStoreStockResult, Error, { variantId: string; movement: SwagStoreStockMovement }>({
    mutationFn: async ({ variantId, movement }) => {
      const url = swagStoreServiceUrls.admin.stockMovements(variantId);
      return required(url, authedPost<SwagStoreStockResult>(url, await getToken(), movement));
    },
    onSuccess: () => saved(null),
  });
}

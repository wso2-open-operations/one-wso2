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
import { authedPatch, authedPost, authedPostText } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type { SwagStoreAdminOffice, SwagStoreOfficeInput, SwagStoreOrderPatch } from "../../api/swagStoreTypes";
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

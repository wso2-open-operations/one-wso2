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

import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { authedGet, authedPost, HttpError } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type {
  SwagStoreCheckoutInput,
  SwagStoreOrderDetail,
  SwagStoreOrderList,
  SwagStorePlacedOrder,
  SwagStoreQuote,
} from "../../api/swagStoreTypes";
import { swagStoreRetry } from "../../util/swagStoreError";
import { CART_KEY, CART_SUMMARY_KEY } from "./useCartData";
import { PRODUCT_KEY, PRODUCTS_KEY } from "./useShopData";

export const ORDERS_KEY = "orders";
export const ORDER_KEY = "order";
const WALLETS_KEY = "wallets";

/** Orders per page of the Orders list. */
export const ORDERS_PAGE_SIZE = 20;

/** How often a payment that is still being confirmed is asked about, and for how long. */
export const PAYMENT_POLL_MS = 5 * 1000;
export const PAYMENT_POLL_WINDOW_MS = 2 * 60 * 1000;

interface QuoteRequest {
  readonly pickupOfficeId: string;
  readonly walletAddress: string;
  /**
   * The wallet's place in the shopper's list. The cache key uses it instead
   * of the address, so no wallet address sits in a query key.
   */
  readonly walletSlot: number;
}

/**
 * The cart priced for an office and wallet (POST /quotes). Money and stock, so
 * it is never served from cache. Disabled until both are chosen.
 */
export function useQuote(request: QuoteRequest | undefined): UseQueryResult<SwagStoreQuote, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreQuote, Error>({
    queryKey: key("quote", request?.pickupOfficeId, request?.walletSlot),
    queryFn: async () => {
      const body: SwagStoreCheckoutInput = {
        pickupOfficeId: request!.pickupOfficeId,
        walletAddress: request!.walletAddress,
      };
      const quote = await authedPost<SwagStoreQuote>(swagStoreServiceUrls.quotes, await getToken(), body);
      if (!quote) throw new HttpError(swagStoreServiceUrls.quotes, 204, "");
      return quote;
    },
    enabled: ready && Boolean(request),
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
    retry: swagStoreRetry,
  });
}

export interface PlaceOrderRequest {
  readonly input: SwagStoreCheckoutInput;
  /** One per attempt at this cart, office and wallet; a retry sends the same one, so the order is placed once. */
  readonly idempotencyKey: string;
}

/**
 * Place the order and pay (POST /orders). Never retried by itself: a retry
 * is the shopper pressing Try again, with the same idempotency key.
 */
export function usePlaceOrder(): UseMutationResult<SwagStorePlacedOrder, Error, PlaceOrderRequest> {
  const { getToken } = useSwagStoreBasis();
  const refreshAfterPayment = useRefreshAfterPayment();
  return useMutation<SwagStorePlacedOrder, Error, PlaceOrderRequest>({
    mutationFn: async ({ input, idempotencyKey }) => {
      const placed = await authedPost<SwagStorePlacedOrder>(swagStoreServiceUrls.orders, await getToken(), input, {
        "Idempotency-Key": idempotencyKey,
      });
      if (!placed) throw new HttpError(swagStoreServiceUrls.orders, 204, "");
      return placed;
    },
    onSuccess: refreshAfterPayment,
  });
}

/** Pay a PENDING_PAYMENT order again (POST /orders/{orderNo}/payments). The backend reuses the same payment reference. */
export function useRetryPayment(orderNo: string): UseMutationResult<SwagStorePlacedOrder | null, Error, void> {
  const { getToken, key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return useMutation<SwagStorePlacedOrder | null, Error, void>({
    mutationFn: async () => authedPost<SwagStorePlacedOrder>(swagStoreServiceUrls.orderPayments(orderNo), await getToken(), {}),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key(ORDER_KEY, orderNo) }),
        queryClient.invalidateQueries({ queryKey: key(ORDERS_KEY) }),
        queryClient.invalidateQueries({ queryKey: key(WALLETS_KEY) }),
      ]);
    },
  });
}

/** A placed order changes the cart, the wallet, stock and the order list. */
function useRefreshAfterPayment(): () => Promise<void> {
  const { key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all(
      [CART_KEY, CART_SUMMARY_KEY, ORDERS_KEY, WALLETS_KEY, PRODUCTS_KEY, PRODUCT_KEY].map((part) =>
        queryClient.invalidateQueries({ queryKey: key(part) }),
      ),
    );
  };
}

/** One page of the caller's orders, newest first (GET /orders). */
export function useOrders(page: number): UseQueryResult<SwagStoreOrderList, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  const query = `limit=${ORDERS_PAGE_SIZE}&offset=${(page - 1) * ORDERS_PAGE_SIZE}`;
  return useQuery<SwagStoreOrderList, Error>({
    queryKey: key(ORDERS_KEY, page),
    queryFn: async () => authedGet<SwagStoreOrderList>(`${swagStoreServiceUrls.orders}?${query}`, await getToken()),
    enabled: ready,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    retry: swagStoreRetry,
  });
}

/**
 * One order (GET /orders/{orderNo}). While its payment is being confirmed and
 * `poll` is on, it is asked again every 5 s: confirmation is asynchronous.
 */
export function useOrder(orderNo: string, poll: boolean): UseQueryResult<SwagStoreOrderDetail, Error> {
  const { getToken, ready, key } = useSwagStoreBasis();
  return useQuery<SwagStoreOrderDetail, Error>({
    queryKey: key(ORDER_KEY, orderNo),
    queryFn: async () => authedGet<SwagStoreOrderDetail>(swagStoreServiceUrls.order(orderNo), await getToken()),
    enabled: ready && Boolean(orderNo),
    staleTime: 30 * 1000,
    refetchInterval: (query) => (poll && query.state.data?.status === "PENDING_PAYMENT" ? PAYMENT_POLL_MS : false),
    retry: swagStoreRetry,
  });
}

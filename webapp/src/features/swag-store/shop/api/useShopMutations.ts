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
import { authedPost } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type { SwagStoreCartLineInput } from "../../api/swagStoreTypes";
import { CART_KEY, CART_SUMMARY_KEY } from "./useCartData";

/**
 * Put a variant in the cart (POST /cart/lines). A variant already there gets
 * the quantity added to its line. Never retried; the caller words any failure.
 */
export function useAddToCart(): UseMutationResult<void, Error, SwagStoreCartLineInput> {
  const { getToken, key } = useSwagStoreBasis();
  const queryClient = useQueryClient();
  return useMutation<void, Error, SwagStoreCartLineInput>({
    mutationFn: async (line) => {
      await authedPost(swagStoreServiceUrls.cartLines, await getToken(), line);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key(CART_KEY) }),
        queryClient.invalidateQueries({ queryKey: key(CART_SUMMARY_KEY) }),
      ]);
    },
  });
}

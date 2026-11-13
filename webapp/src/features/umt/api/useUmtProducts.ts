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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { UmtBaseProduct, UmtCreateProductRequest, UmtDeprecateProductRequest } from "./umtProducts";

const BASE_PRODUCTS_QUERY_KEY = "umt-base-products";

// GET /update/base-product — the admin-only Product Management catalog. The
// endpoint returns the whole list at once (no pagination). A product appears
// in it only when the scheduled onboarding job adds it, at a time this page
// cannot know, so the catalog is fetched again every time the page opens
// instead of being served from the cache.
export function useUmtBaseProducts() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtBaseProduct[]>({
    queryKey: [BASE_PRODUCTS_QUERY_KEY, userSub],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const response = await authedGet<UmtBaseProduct[]>(umtServiceUrls.baseProducts, await getAccessToken());
      return response ?? [];
    },
    retry: httpRetry,
    refetchOnMount: "always",
  });

  return foldIdentityError(query, subState, retryIdentity);
}

// Only queues the product for onboarding. The base product row is written
// later, when the scheduled onboarding job adds the product, so the catalog is
// not refetched here: it would come back unchanged.
export function useUmtCreateProduct() {
  const getAccessToken = useAccessToken();

  return useMutation<void, Error, UmtCreateProductRequest>({
    mutationFn: async (request) => {
      await authedPost<void>(umtServiceUrls.createBaseProduct, await getAccessToken(), request);
    },
  });
}

export function useUmtDeprecateProduct() {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtDeprecateProductRequest>({
    mutationFn: async (request) => {
      await authedPut<void>(umtServiceUrls.deprecateBaseProduct, await getAccessToken(), request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [BASE_PRODUCTS_QUERY_KEY] });
    },
  });
}

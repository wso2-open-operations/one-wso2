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

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { authedDelete, authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { cado2ServiceUrls } from "@config/apiConfig";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import { cado2Send } from "@features/sales/cado2/api/cado2Http";
import type { Bundle } from "./bundleTypes";

const DOMAIN = "bundles";

/** Every bundle (Admin). */
export function useBundles(): UseQueryResult<Bundle[], Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<Bundle[], Error>({
    queryKey: key(DOMAIN, "all"),
    queryFn: async () => authedGet<Bundle[]>(cado2ServiceUrls.adminBundles, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

/** Saves a parent's children, in order (replacing any it had), or removes its bundle with none. */
export function useSetBundle() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { parentProductId: string; childProductIds: readonly string[] | null }>({
    mutationFn: async ({ parentProductId, childProductIds }) => {
      const token = await getToken();
      if (childProductIds === null) await authedDelete(cado2ServiceUrls.adminBundle(parentProductId), token);
      else await cado2Send("PUT", cado2ServiceUrls.adminBundle(parentProductId), token, { childProductIds });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(DOMAIN) }),
  });
}

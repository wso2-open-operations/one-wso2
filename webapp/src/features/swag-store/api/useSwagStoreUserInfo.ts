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
import { foldIdentityError } from "@hooks/useAsgardeoSub";
import { swagStoreRetry } from "../util/swagStoreError";
import { useSwagStoreBasis } from "./swagStoreBasis";
import type { SwagStoreMe } from "./swagStoreTypes";

/**
 * The caller as the store's backend sees them (GET /users/me). Decides whether
 * the store opens at all; the backend re-checks every call on its own.
 *
 * @param enabled - Off where nothing needs the answer, such as the rail outside People Ops
 */
export function useSwagStoreUserInfo(enabled = true): UseQueryResult<SwagStoreMe, Error> {
  const { getToken, ready, key, subState, retryIdentity } = useSwagStoreBasis();
  const query = useQuery<SwagStoreMe, Error>({
    queryKey: key("me"),
    queryFn: async () => authedGet<SwagStoreMe>(swagStoreServiceUrls.me, await getToken()),
    enabled: ready && enabled,
    staleTime: 5 * 60 * 1000,
    retry: swagStoreRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

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
import type { SwagStoreDashboard } from "../../api/swagStoreTypes";
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

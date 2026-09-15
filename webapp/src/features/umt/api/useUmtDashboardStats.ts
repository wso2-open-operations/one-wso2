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

import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { umtServiceUrls, isUmtBackendConfigured } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { useQuery } from "@tanstack/react-query";
import type { UmtDashboardStats } from "./umtDashboardStats";

// GET /update/stats — the source dashboard's aggregate update and release-chunk
// counts. UmtShell mounts this hook only after the UMT role check succeeds.
//
// The key remains user-scoped because these are authenticated service results;
// an account switch must never display aggregates cached for the prior user.
// One minute keeps return visits quick without leaving operational counts stale.
export function useUmtDashboardStats(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isUmtBackendConfigured();

  const query = useQuery<UmtDashboardStats>({
    queryKey: ["umt-dashboard-stats", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => authedGet<UmtDashboardStats>(umtServiceUrls.updatesStats, await getAccessToken()),
    staleTime: 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

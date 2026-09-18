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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isOpdBackendConfigured, opdServiceUrls } from "@config/apiConfig";
import { authedGet } from "@api/http";
import { financeRetry } from "../../util/financeError";
import { normalizeDashboardSummary, type OpdDashboardSummary } from "./opdDashboardTypes";

/**
 * GET /dashboard-summary — the whole analytics screen in one request.
 *
 * Its own hook rather than another case in `useOpd.ts`: that module is shared
 * by every OPD screen, and this endpoint is finance-only. Same query idiom as
 * the hooks there, so it retries and folds an identity failure the same way.
 *
 * A longer `staleTime` than the claim queries: these are whole-year totals
 * across every employee, which do not move between two glances at the page.
 */
export function useOpdDashboardSummary(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isOpdBackendConfigured();
  const query = useQuery<OpdDashboardSummary>({
    queryKey: ["opd-dashboard-summary", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      // Coerced here rather than trusted: the type parameter on `authedGet` is
      // a claim about the body, not a check on it, and a missing `utilization`
      // would take the screen down rather than render empty.
      const body = await authedGet<unknown>(opdServiceUrls.dashboardSummary, accessToken);
      return normalizeDashboardSummary(body);
    },
    staleTime: 5 * 60 * 1000,
    retry: financeRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

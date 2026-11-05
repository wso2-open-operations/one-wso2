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
import { authedGet, HttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isDueDiligenceBackendConfigured, dueDiligenceServiceUrls } from "@config/apiConfig";
import type { UserInfoResponse } from "./dueDiligenceTypes";

export { isDueDiligenceBackendConfigured };

// GET /user-info — the single identity + role call for the whole Due
// Diligence app. Every gate in this feature derives from it, so it is
// fetched once and shared: React Query dedupes concurrent callers on the key
// below, which means the rail (under both Finance and Legal) and each page
// asking independently still produce one request.
//
// Keyed per-user (`userSub`) so switching accounts in the same tab can't
// serve the previous user's role decision from cache.
//
// `enabled` lets a caller avoid firing this while neither the Finance nor
// Legal perspective is active.
//
// staleTime of 5 minutes matches every other identity query in this app
// (marketing-ops /api/me, opd/cc/leave /user-info): group membership changes
// rarely, and a stale decision is corrected on the next mount rather than
// needing to be live.
//
// A 403 here is the empty role list UserInfoResponse already describes.
// That type says an authenticated caller with no Due Diligence groups gets
// 200 and `roles: []`. The deployed interceptor still answers 403 before
// that resource runs, when the caller is outside the employee group the
// interceptor requires. Folding the 403 into `{ roles: [] }` is that same
// answer, so the gate hides the rows and Finance shows the empty card
// instead of treating the read as failed. Only 403. Any other status is an
// outage and stays a failure with Retry.
export function useDueDiligenceMe(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isDueDiligenceBackendConfigured();

  const query = useQuery<UserInfoResponse>({
    queryKey: ["due-diligence-me", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      try {
        return await authedGet<UserInfoResponse>(dueDiligenceServiceUrls.userInfo, accessToken);
      } catch (error: unknown) {
        if (error instanceof HttpError && error.status === 403) return { roles: [] };
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

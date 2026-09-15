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
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  isUmtBackendConfigured,
  umtServiceUrls,
} from "@config/apiConfig";
import type { UmtUserInfo } from "./umtTypes";

// GET /update/user-info — the single identity and authorization source for UMT.
// Every UMT gate derives from this query, so callers share one cached request.
//
// The key includes the Asgardeo subject because switching accounts in the same
// tab must not reuse the previous person's authorization decision. `enabled`
// also lets callers avoid hitting UMT until its perspective is active.
//
// Five minutes matches the other service-owned identity queries: role changes
// are uncommon, while a remount still corrects a stale decision promptly.
export function useUmtUserInfo(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isUmtBackendConfigured();

  const query = useQuery<UmtUserInfo>({
    queryKey: ["umt-user-info", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<UmtUserInfo>(umtServiceUrls.userInfo, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

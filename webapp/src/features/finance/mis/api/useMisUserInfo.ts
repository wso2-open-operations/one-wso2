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
import { isMisArrConfigured, misArrServiceUrls } from "@config/apiConfig";
import type { MisUserInfo } from "./misTypes";

export { isMisArrConfigured };

// GET /user-info — the one identity + authorization call for the whole of
// Finance MIS. It lives on the ARR service and answers for BOTH dashboards:
// one array carries 987 and/or 789 (arr-backend service.bal:55-69), and the
// Flash service has no /user-info of its own. So the Flash screens gate on a
// response from the ARR backend, which looks wrong and is not.
//
// Fetched once and shared: React Query dedupes concurrent callers on the key
// below, so the rail and each MIS page asking independently still make one
// request. The source app achieved the same thing with a module-level mutable
// `var userPrivileges` and a hasBootstrappedRef guard (oauth.js), which is the
// part of its shell this port deletes.
//
// Keyed per-user for the reason every sibling identity query is: switching
// accounts in one tab must not serve the previous user's authorization
// decision from cache. The key prefix is unique per backend — the whole cache
// is one namespace across every ported app, and ["user-info", sub] already
// belongs to the shell's people-app hook.
//
// staleTime of 5 minutes matches the other identity queries. Group membership
// changes rarely, and a stale decision corrects itself on the next mount.
//
// `enabled` lets a caller avoid firing this while MIS isn't on screen — the
// rail asks for a gate on every perspective, and a People Ops page has no
// business calling a finance backend.
export function useMisUserInfo(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isMisArrConfigured();

  const query = useQuery<MisUserInfo>({
    queryKey: ["mis-user-info", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<MisUserInfo>(misArrServiceUrls.userInfo, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

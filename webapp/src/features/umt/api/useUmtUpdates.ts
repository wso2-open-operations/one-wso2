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

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { UmtLifecycleState } from "./umtTypes";
import type {
  UmtUpdateSearchRequest,
  UmtUpdatesByLifecycleStateResponse,
  UmtUpdatesResponse,
} from "./umtUpdates";

export function useUmtUpdates(request: UmtUpdateSearchRequest) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtUpdatesResponse>({
    queryKey: ["umt-updates", userSub, request],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () => {
      const response = await authedPost<UmtUpdatesResponse>(
        umtServiceUrls.updatesSearch,
        await getAccessToken(),
        request,
      );
      if (!response) throw new Error("The update search returned an empty response.");
      return response;
    },
    placeholderData: keepPreviousData,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

// Every update in one lifecycle state, in a single request. The Create
// Release Chunk screen needs whole states rather than pages of them: it lists
// everything in UATStaging to choose from, and checks the choice against
// everything in UAT, and a page of either would quietly make both incomplete.
export function useUmtUpdatesByLifecycleState(lifecycleState: UmtLifecycleState) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtUpdatesByLifecycleStateResponse>({
    // Keyed under "umt-updates" so that every mutation which already
    // invalidates that prefix — a lifecycle transition, an unlock that demotes
    // updates back out of a chunk, an edit, a completion — refreshes this list
    // too. A key of its own would look tidier and would quietly go stale after
    // all of them.
    queryKey: ["umt-updates", "by-lifecycle-state", userSub, lifecycleState],
    enabled: isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () =>
      authedGet<UmtUpdatesByLifecycleStateResponse>(
        umtServiceUrls.updatesByLifecycleState(lifecycleState),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

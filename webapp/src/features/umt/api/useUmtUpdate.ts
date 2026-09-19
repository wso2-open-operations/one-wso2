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

import { useAsgardeo } from "@asgardeo/react";
import { useQuery } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { UmtUpdateSummary } from "./umtUpdates";

export function useUmtUpdate(id: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const hasValidId = id !== undefined && /^\d+$/.test(id);

  const query = useQuery<UmtUpdateSummary>({
    queryKey: ["umt-update", userSub, id],
    enabled:
      hasValidId &&
      isSignedIn &&
      isUmtBackendConfigured() &&
      Boolean(userSub),
    queryFn: async () =>
      authedGet<UmtUpdateSummary>(
        umtServiceUrls.update(id as string),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

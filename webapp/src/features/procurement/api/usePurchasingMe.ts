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

// GET /api/v1/me — the identity and authorization source for this perspective.
//
// Same shape as useMarketingOpsMe: keyed on the Asgardeo `sub` so switching user
// cannot serve another person's cached roles, and folded through
// foldIdentityError so a failure to decode the id_token surfaces as a query
// error the UI can retry rather than a query that never fires.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isPurchasingBackendConfigured, purchasingServiceUrls } from "@config/apiConfig";
import type { PurchasingMe } from "./purchasingTypes";

export { isPurchasingBackendConfigured };

export function usePurchasingMe(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isPurchasingBackendConfigured();

  const query = useQuery<PurchasingMe>({
    queryKey: ["purchasing-me", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<PurchasingMe>(purchasingServiceUrls.me, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

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
import { umtServiceUrls, isUmtBackendConfigured } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { UmtMeta } from "./umtTypes";

// GET /meta — reference data shared by UMT workflows. UmtShell prefetches it
// and the Create dialog calls this hook again; React Query deduplicates both
// callers through the key below rather than maintaining two metadata copies.
//
// It is still scoped per user because the payload contains user emails and may
// be permission-filtered. Ten minutes is appropriate for product/version lists,
// which change far less often than dashboard statistics.
export function useUmtMeta(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isUmtBackendConfigured();

  const query = useQuery<UmtMeta>({
    queryKey: ["umt-meta", userSub],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<UmtMeta>(umtServiceUrls.meta, accessToken);
    },
    staleTime: 10 * 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

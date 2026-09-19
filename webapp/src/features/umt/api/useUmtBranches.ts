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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpRetry } from "@api/errors";
import { authedGet, authedPost } from "@api/http";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  UmtBranchCreationRequest,
  UmtComponentMaxVersionRequest,
  UmtComponentMaxVersionResponse,
  UmtUpdateBranch,
} from "./umtUpdates";

export function useUmtBranches(id: string) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UmtUpdateBranch[]>({
    queryKey: ["umt-update-branches", userSub, id],
    enabled: /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub),
    queryFn: async () =>
      authedGet<UmtUpdateBranch[]>(umtServiceUrls.updateBranches(id), await getAccessToken()),
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export function useUmtCreateBranch(id: string, hotfix: boolean) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtBranchCreationRequest>({
    mutationFn: async (request) => {
      const url = hotfix
        ? umtServiceUrls.createHotfixBranch(id)
        : umtServiceUrls.createUpdateBranch(id);
      await authedPost<void>(url, await getAccessToken(), request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-update-branches"] });
    },
  });
}

export function useUmtComponentMaxUpdateLevel(id: string) {
  const getAccessToken = useAccessToken();

  return useMutation<UmtComponentMaxVersionResponse | null, Error, UmtComponentMaxVersionRequest>({
    mutationFn: async (request) =>
      authedPost<UmtComponentMaxVersionResponse>(
        umtServiceUrls.componentMaxUpdateLevel(id),
        await getAccessToken(),
        request,
      ),
  });
}

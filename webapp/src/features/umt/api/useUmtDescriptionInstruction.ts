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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPut } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtBehaviorChangeRequest, UmtProductDetailsRequest } from "./umtUpdates";

// Saves the Description and Instruction step. `behaviorChange` is null for
// the hotfix branch (which never touches those fields); otherwise both
// PUTs are sequenced inside this one mutation so a failure in either
// surfaces to the caller. Invalidation runs in onSettled (not onSuccess) so
// a second-PUT failure still refreshes the cache to reflect the first PUT's
// persisted write instead of leaving stale data on screen.
export function useUmtSaveDescriptionInstruction(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { products: UmtProductDetailsRequest[]; behaviorChange: UmtBehaviorChangeRequest | null }
  >({
    mutationFn: async ({ products, behaviorChange }) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.updateProductsDetails(id), accessToken, products);
      if (behaviorChange) {
        await authedPut(umtServiceUrls.update(id), accessToken, behaviorChange);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-update"] });
    },
  });
}

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

// A dedicated mutation for the Edit tab's stepper, distinct from
// useUmtUpdateFieldMutation: it always sends a fixed enum value (never
// free text) to the same endpoint, and a successful transition can reveal
// new lifecycle history and PR-analysis rows, so it invalidates a broader
// set of queries than a plain field edit does.
export function useUmtLifecycleTransition(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (nextLifecycleState) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.update(id), accessToken, { lifecycleState: nextLifecycleState });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-updates"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-lifecycle-history"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-pull-request-analysis"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-product-analysis"] }),
      ]);
    },
  });
}

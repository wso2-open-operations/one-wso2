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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { BACKEND_BASE_URL } from "@features/security/grc/shim/apiConfig";
import { frameworkControlsQueryKey } from "@features/security/grc/modules/audit/api/useGetFrameworkControls";
import { extractErrorMessage } from "@features/security/grc/modules/audit/api/apiError";
import type { CreateFrameworkControlRequest } from "@features/security/grc/modules/audit/api/useCreateFrameworkControl";
import type { FrameworkControlListResponse } from "@features/security/grc/modules/audit/types/audit";

interface BulkAddPayload {
  frameworkId: number;
  controls: Omit<CreateFrameworkControlRequest, "frameworkId">[];
}

/**
 * Adds many controls to a framework in one request. The server validates every
 * row first and rejects the whole file (422, row-numbered message) if any row
 * is invalid or duplicates a control already in the framework.
 */
export function useBulkAddFrameworkControls() {
  const authFetch = useAuthApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ frameworkId, controls }: BulkAddPayload): Promise<FrameworkControlListResponse> => {
      const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/audits/frameworks/controls/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameworkId, controls }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, `Failed to add controls (${res.status})`));
      }
      return res.json() as Promise<FrameworkControlListResponse>;
    },

    // Also on error: a part-way failure (409) leaves some controls saved, so the list must refetch.
    onSettled: (_data, _error, { frameworkId }) => {
      void queryClient.invalidateQueries({ queryKey: frameworkControlsQueryKey(frameworkId) });
    },
  });
}

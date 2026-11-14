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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { BACKEND_BASE_URL } from "@features/security/grc/shim/apiConfig";
import { controlsQueryKey } from "@features/security/grc/modules/audit/api/useGetControls";
import { deadlineDaysQueryKey } from "@features/security/grc/modules/audit/api/useGetDeadlineDays";
import type {
  DeadlineDaysResponse,
  UpdateDeadlineDaysRequest,
} from "@features/security/grc/modules/audit/types/audit";
import { extractErrorMessage } from "@features/security/grc/modules/audit/api/apiError";

interface UpdateDeadlineDaysPayload {
  auditId: number;
  req: UpdateDeadlineDaysRequest;
}

/** Updates the audit's allowed days. Only hand-offs that happen afterwards use the new numbers. */
export function useUpdateDeadlineDays() {
  const authFetch = useAuthApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ auditId, req }: UpdateDeadlineDaysPayload): Promise<DeadlineDaysResponse> => {
      const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/audits/${auditId}/settings/deadline-days`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, `Failed to update deadline days (${res.status})`));
      }
      return res.json() as Promise<DeadlineDaysResponse>;
    },

    onSuccess: (_data, { auditId }) => {
      void queryClient.invalidateQueries({ queryKey: deadlineDaysQueryKey(auditId) });
      // Controls carry the planned and current dates the new numbers feed.
      void queryClient.invalidateQueries({ queryKey: controlsQueryKey(auditId) });
    },
  });
}

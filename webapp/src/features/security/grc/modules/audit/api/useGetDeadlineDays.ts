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

import { useQuery } from "@tanstack/react-query";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { BACKEND_BASE_URL } from "@features/security/grc/shim/apiConfig";
import type { DeadlineDaysResponse } from "@features/security/grc/modules/audit/types/audit";
import { extractErrorMessage } from "@features/security/grc/modules/audit/api/apiError";

export const deadlineDaysQueryKey = (auditId: number) =>
  ["audits", auditId, "deadline-days"] as const;

/** The audit's allowed days per group and cycle. `enabled` lets a closed dialog skip the request. */
export function useGetDeadlineDays(auditId: number, enabled = true) {
  const authFetch = useAuthApiClient();

  return useQuery({
    queryKey: deadlineDaysQueryKey(auditId),
    queryFn: async (): Promise<DeadlineDaysResponse> => {
      const res = await authFetch(`${BACKEND_BASE_URL}/api/v1/audits/${auditId}/settings/deadline-days`);
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, `Failed to load deadline days (${res.status})`));
      }
      return res.json() as Promise<DeadlineDaysResponse>;
    },
    enabled: enabled && auditId > 0,
  });
}

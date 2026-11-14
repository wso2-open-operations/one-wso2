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
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import type { AdminChange } from "@features/sales/cado2/admin/components/changeLog";

/**
 * An Admin change log (D172), cached under its page's domain, so the page's
 * saves refresh it: key(domain, "changes").
 */
export function useAdminChanges(url: string, domain: string): UseQueryResult<AdminChange[], Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<AdminChange[], Error>({
    queryKey: key(domain, "changes"),
    queryFn: async () => authedGet<AdminChange[]>(url, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

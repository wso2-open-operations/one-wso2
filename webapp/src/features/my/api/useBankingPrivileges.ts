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
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { bankingBackendUrl, bankingServiceUrls } from "@config/apiConfig";
import type { BankingPrivileges } from "./types";

// GET /employee-privileges on the banking backend — whether the caller is an
// employee, a People Ops admin, or a Finance admin, worked out by the backend
// from the very roles it enforces. Asking it, instead of comparing the
// browser's group list against a group name kept here, means the answer cannot
// drift from what the backend will actually allow: the browser and the backend
// see the same person under different group strings.
//
// `enabled` lets a caller that only needs this on some screens hold the
// request until then. Cached generously and shared: the rail, the route guard
// and the overview card all read the same answer.
export function useBankingPrivileges(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(bankingBackendUrl);
  return useQuery<BankingPrivileges>({
    queryKey: ["banking-privileges"],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<BankingPrivileges>(bankingServiceUrls.employeePrivileges, accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

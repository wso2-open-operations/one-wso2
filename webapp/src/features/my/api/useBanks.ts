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
import type { BanksResponse } from "./types";

// GET /banks — the full bank list, fetched once and searched client-side by
// the edit/add dialog's Autocomplete. Matches the source app's own approach
// (a single unfiltered fetch on dialog open, filtered locally), rather than
// a query-per-keystroke.
//
// `enabled` lets the caller hold this until the dialog actually opens —
// nothing on the Banking page itself needs the bank list.
export function useBanks(enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(bankingBackendUrl);
  return useQuery<BanksResponse>({
    queryKey: ["banks"],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<BanksResponse>(bankingServiceUrls.banks, accessToken);
    },
    staleTime: 30 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

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

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { bankingBackendUrl, bankingServiceUrls } from "@config/apiConfig";
import type { BankAccountsResponse } from "./types";

// Fetches the caller's bank accounts from the digiops-hr banking-app.
// Backend authorization allows self-lookup for non-admin callers, so no
// extra guard needed here. Unlike par/promotion apps, this backend does
// NOT require x-user-timezone-offset.
//
// The app-wide query client never refetches on mount, so a screen that must
// show current data whenever it is opened — the Banking tabs, as in the
// source app — asks for `refetchWhenOpened`. That is done here rather than
// with React Query's `refetchOnMount: "always"`, because that only looks at
// the moment of mounting, and a freshly opened tab has not yet read the
// caller's email out of the sign-in token: the query is still disabled then,
// and once it is enabled the cached list still counts as fresh. Left out, the
// caller keeps the global behaviour (the overview card reads the cached list).
export function useBankAccounts(
  workEmail: string | undefined,
  options?: { refetchWhenOpened?: boolean },
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(bankingBackendUrl);
  const enabled = isSignedIn && backendConfigured && Boolean(workEmail);
  const query = useQuery<BankAccountsResponse>({
    queryKey: ["bank-accounts", workEmail],
    enabled,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<BankAccountsResponse>(
        bankingServiceUrls.employeeAccounts(workEmail!),
        accessToken,
      );
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });

  // Once per opening, as soon as the query can run. Not cancelling an
  // in-flight fetch means a cold open — where enabling the query has just
  // started one — makes a single request, not two.
  const refetchWhenOpened = Boolean(options?.refetchWhenOpened);
  const refetch = query.refetch;
  const alreadyRefetched = useRef(false);
  useEffect(() => {
    if (!refetchWhenOpened || !enabled || alreadyRefetched.current) return;
    alreadyRefetched.current = true;
    void refetch({ cancelRefetch: false });
  }, [refetchWhenOpened, enabled, refetch]);

  return query;
}

export function isBankingBackendConfigured(): boolean {
  return Boolean(bankingBackendUrl);
}

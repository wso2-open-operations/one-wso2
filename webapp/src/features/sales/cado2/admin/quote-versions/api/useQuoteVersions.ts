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
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { cado2ServiceUrls } from "@config/apiConfig";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import { cado2Send } from "@features/sales/cado2/api/cado2Http";

/** How many versions a quote may have (D174), and who last changed it. */
export interface QuoteVersionsSetting {
  readonly maxVersions: number;
  readonly updatedByEmail: string | null;
  readonly updatedAt: string | null;
}

const DOMAIN = "admin-quote-versions";

export function useQuoteVersions(): UseQueryResult<QuoteVersionsSetting, Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<QuoteVersionsSetting, Error>({
    queryKey: key(DOMAIN),
    queryFn: async () => authedGet<QuoteVersionsSetting>(cado2ServiceUrls.adminQuoteVersions, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

/** Saves the limit; it applies at the next Revise. Quotes are reloaded to show it. */
export function useSaveQuoteVersions() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<QuoteVersionsSetting, Error, number>({
    mutationFn: async (maxVersions) =>
      cado2Send<QuoteVersionsSetting>("PUT", cado2ServiceUrls.adminQuoteVersions, await getToken(), { maxVersions }),
    onSuccess: (saved) => {
      queryClient.setQueryData(key(DOMAIN), saved);
      void queryClient.invalidateQueries({ queryKey: key("quotes") });
    },
  });
}

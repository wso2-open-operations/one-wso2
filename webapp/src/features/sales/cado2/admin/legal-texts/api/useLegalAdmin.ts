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
import type { LegalAdmin, LegalNoticeInput } from "./legalAdminTypes";

const DOMAIN = "legal-admin";

/** Admin › Legal Texts. */
export function useLegalAdmin(): UseQueryResult<LegalAdmin, Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<LegalAdmin, Error>({
    queryKey: key(DOMAIN),
    queryFn: async () => authedGet<LegalAdmin>(cado2ServiceUrls.adminLegal, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

/** One change on the page; every answer is the whole page again. */
type Change =
  | { kind: "text"; key: string; body: string }
  | { kind: "notice"; id: number | null; notice: LegalNoticeInput }
  | { kind: "deleteNotice"; id: number };

export function useLegalAdminChange() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<LegalAdmin, Error, Change>({
    mutationFn: async (c) => {
      const token = await getToken();
      const u = cado2ServiceUrls;
      switch (c.kind) {
        case "text":
          return cado2Send<LegalAdmin>("PUT", u.adminLegalText(c.key), token, { body: c.body });
        case "notice":
          return c.id === null
            ? cado2Send<LegalAdmin>("POST", u.adminLegalNotices, token, c.notice)
            : cado2Send<LegalAdmin>("PUT", u.adminLegalNotice(c.id), token, c.notice);
        case "deleteNotice":
          return cado2Send<LegalAdmin>("DELETE", u.adminLegalNotice(c.id), token, undefined);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key(DOMAIN), data);
      // The wizard reads the same texts.
      void queryClient.invalidateQueries({ queryKey: key("legal-config") });
    },
  });
}

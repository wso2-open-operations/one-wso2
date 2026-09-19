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
import { authedDelete, authedPost } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";

export type UmtSubscriptionAction = "subscribe" | "unsubscribe";

export function useUmtUpdateSubscription(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtSubscriptionAction>({
    mutationFn: async (action) => {
      const accessToken = await getAccessToken();
      const url = umtServiceUrls.updateSubscription(id);

      if (action === "unsubscribe") {
        await authedDelete(url, accessToken);
        return;
      }

      await authedPost<void>(url, accessToken, null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-update"] });
    },
  });
}

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
import { authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { bankingServiceUrls } from "@config/apiConfig";
import type { CreateBankAccountRequestPayload, CreateBankAccountRequestResponse } from "./types";

// POST /employee/accounts — submits a bank account Change Request.
//
// No automatic retry, deliberately: the two failures that actually happen
// here (past the Threshold cutoff, or a validation rejection) are final
// answers, not transient ones — retrying just repeats the same rejection.
// Same reasoning already used for the subscription service's mutations.
export function useCreateBankAccountRequest() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<
    CreateBankAccountRequestResponse,
    Error,
    CreateBankAccountRequestPayload
  >({
    mutationFn: async (payload) => {
      const result = await authedPost<CreateBankAccountRequestResponse>(
        bankingServiceUrls.createBankAccountRequest,
        await getAccessToken(),
        payload,
      );
      if (!result) throw new Error("The banking backend accepted the request but returned no body.");
      return result;
    },
    onSuccess: async (_data, payload) => {
      // The employee's accounts list may now include the new Requested
      // Change Request — refetch so the page reflects it.
      await qc.invalidateQueries({ queryKey: ["bank-accounts", payload.employeeEmail] });
    },
  });
}

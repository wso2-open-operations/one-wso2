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

import { useAsgardeo } from "@asgardeo/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authedGet, authedPut } from "@api/http";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtSecurityAdvisory, UmtSecurityAdvisoryValidationResult } from "./umtUpdates";

// One GET per settled, format-valid advisory id typed into the Add modal
// (the caller debounces the input and passes `enabled` as its own format
// check — umtSecurityAdvisoryFormatValid — so this never fires for a string
// that can't possibly be a real advisory). No retry: a not-found/invalid
// response is a normal, expected outcome here, not a transient failure.
export function useUmtValidateSecurityAdvisory(advisoryId: string, enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();

  return useQuery<UmtSecurityAdvisoryValidationResult>({
    queryKey: ["umt-validate-security-advisory", advisoryId],
    enabled: enabled && isSignedIn && isUmtBackendConfigured() && advisoryId.trim().length > 0,
    queryFn: async () =>
      authedGet<UmtSecurityAdvisoryValidationResult>(
        umtServiceUrls.validateSecurityAdvisory(advisoryId),
        await getAccessToken(),
      ),
    retry: false,
  });
}

// Saves the full current advisory list in one PUT — the backend has no
// dedicated add/delete endpoint, so every change re-sends the whole array via
// the same generic update endpoint useUmtSaveDescriptionInstruction already
// uses for its behaviorChange save.
export function useUmtSaveSecurityAdvisories(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtSecurityAdvisory[]>({
    mutationFn: async (securityAdvisories) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.update(id), accessToken, { securityAdvisories });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-update"] });
    },
  });
}

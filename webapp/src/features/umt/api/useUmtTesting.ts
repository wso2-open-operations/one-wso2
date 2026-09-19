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
import { httpRetry } from "@api/errors";
import { authedGet, authedPut } from "@api/http";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { UMT_TESTING_LIFECYCLE_STATES, umtShouldPollStagingTestResults } from "../lib/umtTesting";
import type { UmtStagingTestResultRecord, UmtStagingTestResultRequest } from "./umtUpdates";

// Shared by the shell (Proceed-gating) and UmtTestingStep (its own render) —
// same query key, so TanStack dedupes the fetch. Enabled only while
// lifecycleState is in the testing-state family; polls every 3s while
// umtShouldPollStagingTestResults is true (mirrors useUmtPrAnalysisStatus's
// existing polling precedent), stopping once Staging or Failed is reached.
export function useUmtStagingTestResults(id: string, lifecycleState: string | null | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const queryClient = useQueryClient();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const baseEnabled =
    /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub);
  const enabled =
    baseEnabled && (UMT_TESTING_LIFECYCLE_STATES as readonly (string | null | undefined)[]).includes(lifecycleState);

  return useQuery<UmtStagingTestResultRecord[]>({
    queryKey: ["umt-update-staging-test-results", userSub, id],
    enabled,
    queryFn: async () => {
      const result = await authedGet<UmtStagingTestResultRecord[]>(
        umtServiceUrls.updateIntegrationTestStaging(id),
        await getAccessToken(),
      );
      // While actively polling, also refresh the update resource itself —
      // otherwise a backend lifecycle transition (e.g. into Staging or
      // TestingEnvironmentFailed) goes unnoticed until something unrelated
      // happens to refetch it, leaving Next disabled/enabled on stale state.
      if (umtShouldPollStagingTestResults(lifecycleState)) {
        void queryClient.invalidateQueries({ queryKey: ["umt-update"] });
      }
      return result;
    },
    refetchInterval: () => (umtShouldPollStagingTestResults(lifecycleState) ? 3000 : false),
    retry: httpRetry,
  });
}

export class UmtPartialTestingSaveError extends Error {
  constructor(public readonly failedRows: UmtStagingTestResultRequest[], totalRows: number) {
    super(`Failed to save ${failedRows.length} of ${totalRows} row(s).`);
    this.name = "UmtPartialTestingSaveError";
  }
}

// Saves only the rows the user actually touched this session, one PUT per
// row, all inside this one mutationFn (not Promise.all'd from the caller) so
// isPending/error reflect the whole batch rather than only the last call —
// same reasoning as useUmtSaveDescriptionInstruction's two-sequenced PUTs.
// Rows are awaited with allSettled (not Promise.all) so one row's failure
// doesn't cut the others off mid-flight; any failures are reported back via
// UmtPartialTestingSaveError.failedRows so the caller can keep those rows'
// drafts for retry while clearing the ones that saved. Invalidation runs in
// onSettled so a partial failure still refreshes both queries to reflect
// whichever rows actually persisted.
export function useUmtSaveTestingResults(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtStagingTestResultRequest[]>({
    mutationFn: async (rows) => {
      const accessToken = await getAccessToken();
      const results = await Promise.allSettled(
        rows.map((row) => authedPut(umtServiceUrls.updateIntegrationTestStaging(id), accessToken, row)),
      );
      const failedRows = rows.filter((_, index) => results[index].status === "rejected");
      if (failedRows.length > 0) {
        throw new UmtPartialTestingSaveError(failedRows, rows.length);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update-staging-test-results"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
      ]);
    },
  });
}

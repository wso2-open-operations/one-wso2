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
import { authedGet, authedPost, authedPut } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtUpdateSummary } from "./umtUpdates";

// View-tab action row (Mark as Duplicate / On Hold / Reopen, shown for
// Development/PRAnalyzed/ProductAnalyzed — Reopen reuses the existing
// lifecycle-transition mutation instead of a dedicated one).

// Moves an update to OnHold with a reason. Submits only when the reason is
// non-blank; the caller is expected to enforce that before calling
// mutateAsync.
export function useUmtOnHoldUpdate(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (reason) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.updateOnHold(id), accessToken, { reason });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-updates"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-lifecycle-history"] }),
      ]);
    },
  });
}

// Records a Duplicate dependency from this update to another. Fetches the
// target update first (surfacing an error if it doesn't exist) before
// posting the dependency.
export function useUmtMarkAsDuplicate(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (duplicateOfId) => {
      const accessToken = await getAccessToken();
      await authedGet<UmtUpdateSummary>(umtServiceUrls.update(duplicateOfId), accessToken);
      await authedPost(umtServiceUrls.updateDependency, accessToken, {
        from: { id },
        to: { id: duplicateOfId },
        type: "Duplicate",
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-dependencies"] }),
      ]);
    },
  });
}

// The View tab's three editable link-list sections (Public GitHub Issues,
// Public Pull Requests, Integration Test Pull Requests) each replace their
// whole list in one POST.
function useUmtReplaceLinkList(url: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string[]>({
    mutationFn: async (values) => {
      const accessToken = await getAccessToken();
      await authedPost(url, accessToken, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-update"] });
    },
  });
}

export function useUmtSaveIssues(id: string) {
  return useUmtReplaceLinkList(umtServiceUrls.updateIssues(id));
}

export function useUmtSavePublicPullRequests(id: string) {
  return useUmtReplaceLinkList(umtServiceUrls.updatePublicPullRequests(id));
}

export function useUmtSaveTestPullRequests(id: string) {
  return useUmtReplaceLinkList(umtServiceUrls.updateTestPullRequests(id));
}

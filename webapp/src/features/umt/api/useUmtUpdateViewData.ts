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
import { useQuery } from "@tanstack/react-query";
import { httpRetry } from "@api/errors";
import { authedGet } from "@api/http";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  UmtHotfixInfo,
  UmtProductAnalysis,
  UmtPullRequestAnalysis,
  UmtUpdateDependency,
} from "./umtUpdates";

// Extracted so the Edit tab's stepper can depend on just this one query
// (needed to compute whether File Approval belongs in the step list) without
// also fetching dependencies/hotfix-info/product-analysis, which belong to
// sections it does not port. Query key is unchanged, so this is a pure
// refactor: TanStack dedupes the fetch if the View tab already cached it.
export function useUmtPullRequestAnalysis(
  id: string,
  lifecycleState: string | null | undefined,
  options?: { alwaysEnabled?: boolean },
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const enabled =
    /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub);
  // The View tab fetches this for every lifecycle state except Development.
  // A missing lifecycle state must not suppress the request: existing
  // analysis rows should still display in that case. The Edit tab's PR
  // Analysis step is the exception: it's only ever active during
  // Development, so it passes `alwaysEnabled` to fetch there too.
  const analysisEnabled = enabled && (options?.alwaysEnabled || lifecycleState !== "Development");

  return useQuery<UmtPullRequestAnalysis>({
    queryKey: ["umt-update-pull-request-analysis", userSub, id],
    enabled: analysisEnabled,
    queryFn: async () =>
      authedGet<UmtPullRequestAnalysis>(
        umtServiceUrls.updatePullRequestAnalysis(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });
}

// Extracted for the same reason as useUmtPullRequestAnalysis above: the Edit
// tab's Product Analysis step needs just this one query, with different
// enablement than the View tab (which gates it off during Development).
// Query key is unchanged, so this is a pure refactor.
export function useUmtProductAnalysis(
  id: string,
  lifecycleState: string | null | undefined,
  options?: { alwaysEnabled?: boolean },
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const enabled =
    /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub);
  // The View tab fetches product analysis for every lifecycle state except
  // Development, same as pull-request analysis above.
  const analysisEnabled = enabled && (options?.alwaysEnabled || lifecycleState !== "Development");

  return useQuery<UmtProductAnalysis>({
    queryKey: ["umt-update-product-analysis", userSub, id],
    enabled: analysisEnabled,
    queryFn: async () =>
      authedGet<UmtProductAnalysis>(
        umtServiceUrls.updateProductAnalysis(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });
}

export function useUmtUpdateViewData(
  id: string,
  lifecycleState: string | null | undefined,
  isHotfix: boolean,
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const enabled =
    /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub);

  const dependencies = useQuery<UmtUpdateDependency[]>({
    queryKey: ["umt-update-dependencies", userSub, id],
    enabled,
    queryFn: async () =>
      authedGet<UmtUpdateDependency[]>(
        umtServiceUrls.updateDependencies(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, lifecycleState);
  const productAnalysis = useUmtProductAnalysis(id, lifecycleState);

  const hotfixInfo = useQuery<UmtHotfixInfo>({
    queryKey: ["umt-update-hotfix-info", userSub, id],
    enabled: enabled && isHotfix,
    queryFn: async () =>
      authedGet<UmtHotfixInfo>(
        umtServiceUrls.updateHotfixInfo(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  return { dependencies, hotfixInfo, productAnalysis, pullRequestAnalysis };
}

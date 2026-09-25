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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  UmtPlatformStatsRequest,
  UmtPlatformStatsRow,
  UmtPlatformStatsWire,
} from "./umtStatisticsTypes";
import { normalizeUmtPlatformStats } from "./umtPlatformStats";

const ENDPOINT_BY_FILTER = {
  all: umtServiceUrls.platformStats,
  product: umtServiceUrls.platformStatsProductWise,
  version: umtServiceUrls.platformStatsVersionWise,
  update_origin: umtServiceUrls.platformStatsUpdateOrigin,
  update_lifecycle: umtServiceUrls.platformStatsUpdateLifecycle,
  extended_support: umtServiceUrls.platformStatsExtendedSupport,
} as const;

function platformStatsUrl(request: UmtPlatformStatsRequest): string {
  const params = new URLSearchParams({ platform: request.platform });
  if (request.product) params.set("product", request.product);
  if (request.from) params.set("from", request.from);
  if (request.to) params.set("to", request.to);
  return `${ENDPOINT_BY_FILTER[request.filter]}?${params.toString()}`;
}

// GET /update/platform-stats and its filter-specific siblings. The Statistics
// page mounts this after UmtShell has resolved access.
// The full request is in the key, so changing one filter cannot show a result
// for an earlier platform, date range, or breakdown.
export function useUmtPlatformStats(request: UmtPlatformStatsRequest, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const configured = isUmtBackendConfigured();
  const url = platformStatsUrl(request);

  const query = useQuery<UmtPlatformStatsRow[]>({
    queryKey: ["umt-platform-stats", userSub, request],
    enabled: enabled && isSignedIn && configured && Boolean(userSub),
    queryFn: async () =>
      normalizeUmtPlatformStats(
        await authedGet<UmtPlatformStatsWire>(url, await getAccessToken()),
      ),
    staleTime: 60 * 1000,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

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

import type { QueryClient } from "@tanstack/react-query";

/** Hierarchical query key factory for React Query -- ensures consistent cache key structure across all queries. */
export const queryKeys = {
  me: ["isac", "me"] as const,
  dashboard: {
    all: ["isac", "dashboard"] as const,
    data: () => [...queryKeys.dashboard.all, "data"] as const,
    trends: () => [...queryKeys.dashboard.all, "trends"] as const,
  },
  companies: {
    all: ["isac", "companies"] as const,
    counts: (params: Record<string, unknown>) => [...queryKeys.companies.all, "counts", params] as const,
    list: (params: Record<string, unknown>) =>
      [...queryKeys.companies.all, "list", params] as const,
    profile: (id: number) =>
      [...queryKeys.companies.all, "profile", id] as const,
  },
  follows: {
    all: ["isac", "follows"] as const,
    mine: () => [...queryKeys.follows.all, "mine"] as const,
  },
  geo: {
    all: ["isac", "geo"] as const,
    regionMap: () => [...queryKeys.geo.all, "regionMap"] as const,
    subdivisions: () => [...queryKeys.geo.all, "subdivisions"] as const,
  },
  competitiveIntel: {
    all: ["isac", "competitiveIntel"] as const,
    alerts: (params: Record<string, unknown>) =>
      [...queryKeys.competitiveIntel.all, "alerts", params] as const,
    trends: (params: Record<string, unknown>) =>
      [...queryKeys.competitiveIntel.all, "trends", params] as const,
  },
  g2Signals: {
    all: ["isac", "g2Signals"] as const,
    analytics: (params: Record<string, unknown>) =>
      [...queryKeys.g2Signals.all, "analytics", params] as const,
  },
};

/** Invalidates all dashboard and company queries after a data sync completes. */
export function invalidateSyncQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  qc.invalidateQueries({ queryKey: queryKeys.companies.all });
}

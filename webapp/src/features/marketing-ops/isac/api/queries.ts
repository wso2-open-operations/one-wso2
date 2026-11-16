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

import { useQuery } from "@tanstack/react-query";
import {
  useApiClient,
  type CMODashboardResponse,
  type TrendsOverviewResponse,
  type PaginatedResponse,
  type Company,
  type CompanyProfile,
  type CompetitiveAlertsResponse,
  type CompetitiveTrendsResponse,
  type G2SignalAnalytics,
  type FollowedCompany,
} from "./client";
import { queryKeys } from "./queryKeys";

/**
 * What every ISAC query starts from: one retry, and a refetch on mount once the
 * query's own `staleTime` has passed.
 */
const ISAC_QUERY_DEFAULTS = { retry: 1, refetchOnMount: true } as const;

/** The signed-in person as ISAC knows them. */
export interface IsacUser {
  sub: string;
  email?: string;
  name?: string;
  role: "admin" | "user";
}

/** The caller's ISAC identity and role. Enabled only when the ISAC API is configured. */
export function useIsacMe(enabled = true) {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.me,
    queryFn: () => get<IsacUser>("/users/me"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Account follows ────────────────────────────────────────────────────────

/** Accounts the current user follows, with stage, score and last stage move.
 * staleTime 0 so returning to the Dashboard after (un)following on a company
 * page shows the change straight away. */
export function useMyFollows() {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.follows.mine(),
    queryFn: () => get<FollowedCompany[]>("/users/me/follows"),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

/** Cached query for the CMO dashboard data -- staleTime 5 min. */
export function useDashboardQuery() {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.dashboard.data(),
    queryFn: () => get<CMODashboardResponse>("/dashboard"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Cached query for the trends overview (monthly time-series) -- staleTime 5 min, one retry.
 * The Dashboard renders an explicit error + retry state on failure, so a transient error
 * no longer silently zeroes the funnel. */
export function useTrendsQuery() {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.dashboard.trends(),
    queryFn: () => get<TrendsOverviewResponse>("/trends/overview"),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Companies ──────────────────────────────────────────────────────────────

/** Scopes for the company aggregate counts — the geo filters the list applies.
 * Text search is deliberately absent: a name lookup must not rescale the funnel. */
export interface CompanyCountScopes {
  region?: string;
  country?: string;
  state?: string;
}

/** Cached query for company aggregate counts (total, by tier, by source), scoped by
 * the same region/country/state filters as the list so the pipeline/heat
 * cards match the filtered rows. staleTime 5 min. */
export function useCompanyCounts(scopes: CompanyCountScopes = {}) {
  const { get } = useApiClient();
  const apiParams: Record<string, unknown> = {};
  if (scopes.region) apiParams.region = scopes.region;
  if (scopes.country) apiParams.country = scopes.country;
  if (scopes.state) apiParams.state = scopes.state;
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.companies.counts(apiParams),
    queryFn: () => get<Record<string, unknown>>("/companies/counts", apiParams),
    staleTime: 5 * 60 * 1000,
  });
}

/** Filter, sort, and pagination parameters for the company list query. */
export interface CompanyListParams {
  page: number;
  sort_by: string;
  sort_dir: string;
  search?: string;
  heat_filter?: string;
  funnel_filter?: string;
  region?: string;
  country?: string;
  state?: string;
  /** Only companies the current user follows. */
  following?: boolean;
}

/** Paginated company list query with filtering, sorting, and previous-data placeholder support. */
export function useCompanyList(params: CompanyListParams) {
  const { get } = useApiClient();

  const apiParams: Record<string, unknown> = {
    page: params.page,
    page_size: 60,
    sort_by: params.sort_by,
    sort_dir: params.sort_dir,
  };
  if (params.search) apiParams.search = params.search;
  if (params.heat_filter) apiParams.heat_filter = params.heat_filter;
  if (params.funnel_filter) apiParams.funnel_filter = params.funnel_filter;
  if (params.region) apiParams.region = params.region;
  if (params.country) apiParams.country = params.country;
  if (params.state) apiParams.state = params.state;
  if (params.following) apiParams.following = true;

  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.companies.list(apiParams),
    queryFn: () => get<PaginatedResponse<Company>>("/companies", apiParams),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev: PaginatedResponse<Company> | undefined) => prev,
  });
}

/** Fetches a full company profile by ID -- disabled when id is null. */
export function useCompanyProfile(id: number | null) {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.companies.profile(id ?? 0),
    queryFn: () => get<CompanyProfile>(`/companies/${id}/profile`),
    enabled: id !== null,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ── Geography ──────────────────────────────────────────────────────────────

/** Region → member countries, from the same map the API filters by.
 *
 * Powers the drill-down geo filters: with no region picked every country is
 * offered; once a region is picked the country list narrows to that region.
 * The map is static, so it is cached for the session.
 */
export function useRegionCountryMap() {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.geo.regionMap(),
    queryFn: () => get<Record<string, string[]>>("/countries/region-map"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Country → its states/provinces (US, Canada, Australia, India), for the State
 * filter drill-down. Static on the server, so cached for the session. */
export function useSubdivisionMap() {
  const { get } = useApiClient();
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.geo.subdivisions(),
    queryFn: () => get<Record<string, string[]>>("/countries/subdivisions"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ── Competitive Intelligence ──────────────────────────────────────────────

/** Cached query for competitive alerts with SF customer/prospect matching -- staleTime 5 min. */
export function useCompetitiveAlerts(days: number, product?: string) {
  const { get } = useApiClient();
  const params: Record<string, unknown> = { days, limit: 200 };
  if (product) params.product = product;
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.competitiveIntel.alerts(params),
    queryFn: () => get<CompetitiveAlertsResponse>("/g2/competitive-alerts", params),
    staleTime: 5 * 60 * 1000,
  });
}

/** Cached query for G2 signal analytics (all signal types aggregated) -- staleTime 5 min. */
export function useG2SignalAnalytics(product?: string, enabled = true) {
  const { get } = useApiClient();
  const params: Record<string, unknown> = {};
  if (product) params.product = product;
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.g2Signals.analytics(params),
    queryFn: () => get<G2SignalAnalytics>("/g2/signals-analytics", params),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/** Cached query for competitive trend analytics (by product, monthly, WSO2-vs-competitor split) -- staleTime 5 min. */
export function useCompetitiveTrends(days: number, product?: string) {
  const { get } = useApiClient();
  const params: Record<string, unknown> = { days };
  if (product) params.product = product;
  return useQuery({
    ...ISAC_QUERY_DEFAULTS,
    queryKey: queryKeys.competitiveIntel.trends(params),
    queryFn: () => get<CompetitiveTrendsResponse>("/g2/competitive-trends", params),
    staleTime: 5 * 60 * 1000,
  });
}

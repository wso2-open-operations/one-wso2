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

import { authedGet } from "@api/http";

// Read at call time, not at import. The preview switch works the same way:
// a test (and a config.js edit) has to be able to change the answer without
// reimporting the page.

export function productDownloadStatsBackendUrl(): string {
  return (window.config?.ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL ?? "").replace(
    /\/+$/,
    "",
  );
}

export function isProductDownloadStatsConfigured(): boolean {
  return productDownloadStatsBackendUrl().length > 0;
}

// The access token goes on every Product Download Stats request. An http
// address would put that token on the wire in the clear. Localhost is the
// only http host allowed, for a developer running the API on their machine.
// `new URL("http://[::1]").hostname` keeps the brackets. The bare form is
// included in case a host reports it without them.
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isCredentialedProductDownloadStatsUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  return parsed.protocol === "http:" && LOCAL_HTTP_HOSTS.has(parsed.hostname);
}

function credentialedBase(): string {
  const base = productDownloadStatsBackendUrl();
  if (!isCredentialedProductDownloadStatsUrl(base)) {
    throw new Error("Product Download Stats requires an https URL");
  }
  return base;
}

export interface TopProduct {
  repoId: number;
  repoName: string;
  productName: string | null;
  todayDownloads: number;
  totalDownloads: number;
  stars: number;
}

export interface Summary {
  trackedRepositories: number;
  totalDownloads: number;
  totalClonesLast14d: number;
  todayDownloads: number;
  todayDeltaPct: number | null;
  asOfDate?: string | null;
  monthDownloads: number;
  topProducts: TopProduct[];
}

export interface DailyPoint {
  date: string;
  value: number;
}

export interface DailySeries {
  repoId: number;
  repoName: string;
  points: DailyPoint[];
}

export interface DailyResponse {
  series: DailySeries[];
}

export interface RepositorySnapshot {
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  openIssuesCount: number;
}

export interface TrackedRepository {
  id: number;
  repoName: string;
  productName: string | null;
  isActive?: boolean;
  latestSnapshot?: RepositorySnapshot | null;
}

export interface RepositoriesResponse {
  repositories: TrackedRepository[];
}

export function getSummary(accessToken: string): Promise<Summary> {
  return authedGet(`${credentialedBase()}/api/v1/stats/summary`, accessToken);
}

// Last 30 days through today, UTC.
// The API already labels each point; this only chooses the window.
export function dailyRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

/** Every UTC calendar date from `from` through `to`, inclusive. */
export function utcDatesInclusive(from: string, to: string): string[] {
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return [];
  const dates: string[] = [];
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function getDaily(accessToken: string, now = new Date()): Promise<DailyResponse> {
  const { from, to } = dailyRange(now);
  const params = new URLSearchParams({ from, to, interval: "day" });
  return authedGet(
    `${credentialedBase()}/api/v1/stats/daily?${params}`,
    accessToken,
  );
}

export function getRepositories(accessToken: string): Promise<RepositoriesResponse> {
  return authedGet(`${credentialedBase()}/api/v1/repositories`, accessToken);
}

export type ReleaseDownloadGrain = "day" | "month" | "cumulative";

export function getReleaseDownloads(
  accessToken: string,
  query: { from: string; to: string; interval: ReleaseDownloadGrain; repos: number[] },
): Promise<DailyResponse> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.repos.length > 0) params.set("repos", query.repos.join(","));
  if (query.interval === "cumulative") {
    return authedGet(`${credentialedBase()}/api/v1/stats/total?${params}`, accessToken);
  }
  params.set("interval", query.interval);
  return authedGet(`${credentialedBase()}/api/v1/stats/daily?${params}`, accessToken);
}

export interface VersionPoint {
  date: string;
  value: number;
}

export interface VersionSeriesItem {
  releaseTag: string;
  releaseName: string | null;
  points: VersionPoint[];
}

export interface VersionSeriesResponse {
  series: VersionSeriesItem[];
}

export interface ReleaseFile {
  assetName: string;
  downloadCount: number;
  releaseTag: string;
}

export interface ReleaseFilesResponse {
  assets: ReleaseFile[];
}

export function getVersionSeries(
  accessToken: string,
  query: { repoId: number; from: string; to: string; interval: ReleaseDownloadGrain },
): Promise<VersionSeriesResponse> {
  const params = new URLSearchParams({ from: query.from, to: query.to, interval: query.interval });
  return authedGet(
    `${credentialedBase()}/api/v1/stats/versions/${query.repoId}/series?${params}`,
    accessToken,
  );
}

export function getReleaseFiles(
  accessToken: string,
  query: { repoId: number; from: string; to: string; version: string },
): Promise<ReleaseFilesResponse> {
  const params = new URLSearchParams({ from: query.from, to: query.to, version: query.version });
  return authedGet(
    `${credentialedBase()}/api/v1/stats/assets/${query.repoId}?${params}`,
    accessToken,
  );
}

export interface PackageProduct {
  repoId: number;
  repoName: string;
  productName: string | null;
  packageCount: number;
}

export interface PackageProductsResponse {
  count: number;
  repos: PackageProduct[];
}

export interface PackageBreakdownItem {
  packageName: string;
  periodDownloads: number;
  totalDownloads: number;
  versionCount: number | null;
}

export interface PackageBreakdownResponse {
  packages: PackageBreakdownItem[];
}

export interface PackageSeriesItem {
  packageName: string;
  points: VersionPoint[];
}

export interface PackageSeriesResponse {
  series: PackageSeriesItem[];
}

export interface PackageVersionItem {
  versionId: number;
  tags: string | null;
  periodDownloads: number;
  totalDownloads: number;
}

export interface PackageVersionsResponse {
  versions: PackageVersionItem[];
}

export function getPackageProducts(accessToken: string): Promise<PackageProductsResponse> {
  return authedGet(`${credentialedBase()}/api/v1/stats/packages/repos`, accessToken);
}

export function getPackageBreakdown(
  accessToken: string,
  query: { repoId: number; from: string; to: string },
): Promise<PackageBreakdownResponse> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  return authedGet(
    `${credentialedBase()}/api/v1/stats/packages/${query.repoId}?${params}`,
    accessToken,
  );
}

export function getPackageSeries(
  accessToken: string,
  query: { repoId: number; from: string; to: string; interval: ReleaseDownloadGrain },
): Promise<PackageSeriesResponse> {
  const params = new URLSearchParams({ from: query.from, to: query.to, interval: query.interval });
  return authedGet(
    `${credentialedBase()}/api/v1/stats/packages/${query.repoId}/series?${params}`,
    accessToken,
  );
}

export function getPackageVersions(
  accessToken: string,
  query: { repoId: number; from: string; to: string; packageName: string },
): Promise<PackageVersionsResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    package: query.packageName,
  });
  return authedGet(
    `${credentialedBase()}/api/v1/stats/packages/${query.repoId}/versions?${params}`,
    accessToken,
  );
}

export type RepositoryMeasure = "stars" | "forks" | "watchers" | "openIssues";

export interface MetricSeriesResponse {
  series: DailySeries[];
}

export interface ClonePoint {
  date: string;
  count: number;
  uniques: number;
}

export interface CloneSeriesItem {
  repoId: number;
  repoName: string;
  points: ClonePoint[];
}

export interface CloneSeriesResponse {
  series: CloneSeriesItem[];
}

function statsQuery(query: {
  from: string;
  to: string;
  repos: number[];
  interval?: ReleaseDownloadGrain;
  metric?: RepositoryMeasure;
}): string {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.interval) params.set("interval", query.interval);
  if (query.metric) params.set("metric", query.metric);
  if (query.repos.length > 0) params.set("repos", query.repos.join(","));
  return params.toString();
}

export function getMetricSeries(
  accessToken: string,
  query: {
    metric: RepositoryMeasure;
    from: string;
    to: string;
    interval: ReleaseDownloadGrain;
    repos: number[];
  },
): Promise<MetricSeriesResponse> {
  return authedGet(
    `${credentialedBase()}/api/v1/stats/metric?${statsQuery(query)}`,
    accessToken,
  );
}

export function getCloneSeries(
  accessToken: string,
  query: { from: string; to: string; repos: number[] },
): Promise<CloneSeriesResponse> {
  return authedGet(
    `${credentialedBase()}/api/v1/stats/clones?${statsQuery(query)}`,
    accessToken,
  );
}

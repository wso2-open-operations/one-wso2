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

// Wire response from GET /update/stats. The service returns maps keyed by its
// lifecycle and build-status names rather than a fixed list of fields.
export interface UmtDashboardStats {
  updateCount: number;
  updateLifeCycleCounts: Record<string, number>;
  createdReleaseChunkBuildCount: number;
  createdReleaseChunkBuildStatusCounts: Record<string, number>;
}

export type UmtDashboardDatum = { name: string; value: number };

function count(counts: Record<string, number>, name: string): number {
  return counts[name] ?? 0;
}

function buildCount(counts: Record<string, number>, name: string): number {
  // Build-status casing has varied between typed source values and live payloads.
  const matchingEntry = Object.entries(counts).find(([status]) => status.toUpperCase() === name);
  return matchingEntry?.[1] ?? 0;
}

export function lifecycleChartData(stats: UmtDashboardStats): UmtDashboardDatum[] {
  const counts = stats.updateLifeCycleCounts ?? {};
  // These are the four states the source dashboard counts as Active. Labels are
  // presentation terms; values must continue to come from the service keys.
  return [
    { name: "Development", value: count(counts, "Development") },
    { name: "Testing", value: count(counts, "Staging") },
    { name: "Verifying", value: count(counts, "UAT") },
    { name: "Pending", value: count(counts, "UATStaging") },
  ];
}

export function releaseChunkChartData(stats: UmtDashboardStats): UmtDashboardDatum[] {
  const counts = stats.createdReleaseChunkBuildStatusCounts ?? {};
  // The source presents every terminal or unavailable build outcome as Failed,
  // and treats a rebuild in progress as Building rather than a separate slice.
  const failed = ["FAILURE", "UNSTABLE", "ABORTED", "UNKNOWN", "NOT_BUILT", "CANCELLED", "NO_BUILD_JOB"]
    .reduce((total, status) => total + buildCount(counts, status), 0);

  return [
    { name: "Pending", value: buildCount(counts, "PENDING") },
    { name: "Building", value: buildCount(counts, "BUILDING") + buildCount(counts, "REBUILDING") },
    { name: "Successful", value: buildCount(counts, "SUCCESS") },
    { name: "Failed", value: failed },
  ];
}

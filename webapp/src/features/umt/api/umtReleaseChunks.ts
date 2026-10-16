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

// Wire types and boundary mapping for the /update/releaseChunk family.
//
// These endpoints serialize the fields inside an update level in kebab-case
// ("product-name", "build-status", ...) while the chunk's own top-level
// fields stay camelCase like the rest of this feature's /update endpoints.
// The conversion happens here, at the boundary, so no consumer downstream
// ever has to know which casing a given field arrives in.

// A pending chunk's per-update-level summary, from GET /update/releaseChunk.
export interface UmtReleaseChunkUpdateLevel {
  productName?: string | null;
  productVersion?: string | null;
  updateLevel?: number | null;
  buildStatus?: string | null;
  tgBuildStatus?: string | null;
}

// One row of GET /update/releaseChunk (the pending-chunks list).
export interface UmtReleaseChunk {
  id: number;
  updateIds: number[];
  updateLevels: UmtReleaseChunkUpdateLevel[];
}

// One row of GET /update/releaseChunk?states=released.
export interface UmtReleasedChunk {
  id: number;
  updateIds: number[];
  updateLevels: UmtReleaseChunkUpdateLevel[];
  status?: string | null;
  releaseMessage?: string | null;
  releasedOn?: string | null;
}

export interface UmtReleaseChunkBuildStatusLevel {
  productName?: string | null;
  productVersion?: string | null;
  channel?: string | null;
  updateLevel?: number | null;
  appliedUpdates?: number[];
  buildStatus?: string | null;
  tgBuildStatus?: string | null;
}

// GET /update/releaseChunk/{id}/buildStatus.
export interface UmtReleaseChunkBuildStatus {
  id: number;
  updateIds: number[];
  overallCstBuildStatus?: string | null;
  updateLevels: UmtReleaseChunkBuildStatusLevel[];
}

// GET /update/releaseChunk/{id}/docker-build-statuses.
export interface UmtDockerBuildStatus {
  productName?: string | null;
  productVersion?: string | null;
  buildStatus?: string | null;
}

// GET /update/releaseChunk/{id} — the chunk's own lifecycle status, distinct
// from the per-level build statuses above. `status` is one of
// UmtReleaseChunkLifecycleStatus's values, but kept as a plain string here
// since the backend is free to return values this port doesn't yet branch on.
export interface UmtReleaseChunkStatus {
  id: number;
  updateIds: number[];
  status?: string | null;
  isContainerizedUpdateRelease?: boolean | null;
  releasedOn?: string | null;
  failedReason?: string | null;
}

// The chunk-level lifecycle statuses returned by GET /update/releaseChunk/{id}.
// Distinct from, and cased differently than, the per-level build statuses
// (UmtBuildStatus below) — the two families must not be conflated.
export type UmtReleaseChunkLifecycleStatus =
  | "created"
  | "releasing"
  | "releasingFailed"
  | "releasingDockerFailed"
  | "retriggering";

// Per-update-level / docker build statuses, as returned by the buildStatus
// and docker-build-statuses endpoints. Uppercase, unlike the lifecycle
// statuses above.
export type UmtBuildStatus =
  | "BUILDING"
  | "PENDING"
  | "SUCCESS"
  | "SUCCEEDED"
  | "UNKNOWN"
  | "UNSTABLE"
  | "NO_BUILD_JOB";

// Body for POST /update/releaseChunk — a raw array, not wrapped in an object.
export type UmtCreateReleaseChunkRequest = number[];

// Body for POST /update/releaseChunk/{id}/release.
export interface UmtReleaseChunkReleaseRequest {
  "release-message": string;
}

// One update level as GET /update/releaseChunk and its ?states=released
// variant return it. Every field here is kebab-case; the chunk's own
// top-level fields (id, updateIds, status, releaseMessage, releasedOn) are
// not. `update-level` is the number that identifies which release of a
// product a row is about, and Released Chunks needs it to tell two releases
// of the same product apart.
interface RawUmtReleaseChunkUpdateLevel {
  "product-name"?: string | null;
  "product-version"?: string | null;
  "update-level"?: number | null;
  "build-status"?: string | null;
  "tg-build-status"?: string | null;
}

function mapUmtReleaseChunkUpdateLevel(raw: RawUmtReleaseChunkUpdateLevel): UmtReleaseChunkUpdateLevel {
  return {
    productName: raw["product-name"],
    productVersion: raw["product-version"],
    updateLevel: raw["update-level"],
    buildStatus: raw["build-status"],
    tgBuildStatus: raw["tg-build-status"],
  };
}

// A chunk only gets its update levels when the update synchronizer reports
// them back, so one still in requestedToCreate has none and the backend leaves
// the key out. Such a chunk maps to an empty list rather than failing the
// whole pending list over a single row.
export interface RawUmtReleaseChunk {
  id: number;
  updateIds: number[];
  updateLevels?: RawUmtReleaseChunkUpdateLevel[] | null;
}

export function mapUmtReleaseChunk(raw: RawUmtReleaseChunk): UmtReleaseChunk {
  return {
    id: raw.id,
    updateIds: raw.updateIds,
    updateLevels: (raw.updateLevels ?? []).map(mapUmtReleaseChunkUpdateLevel),
  };
}

export interface RawUmtReleasedChunk {
  id: number;
  updateIds: number[];
  updateLevels: RawUmtReleaseChunkUpdateLevel[];
  status?: string | null;
  releaseMessage?: string | null;
  releasedOn?: string | null;
}

export function mapUmtReleasedChunk(raw: RawUmtReleasedChunk): UmtReleasedChunk {
  return {
    id: raw.id,
    updateIds: raw.updateIds,
    updateLevels: raw.updateLevels.map(mapUmtReleaseChunkUpdateLevel),
    status: raw.status,
    releaseMessage: raw.releaseMessage,
    releasedOn: raw.releasedOn,
  };
}

// One update level as GET /update/releaseChunk/{id}/buildStatus returns it: a
// larger set of fields than the chunk list above, in the same kebab-case. The
// response also carries a "dependant-repo-build-details" array that nothing
// here reads, so it is left off.
interface RawUmtReleaseChunkBuildStatusLevel {
  "product-name"?: string | null;
  "product-version"?: string | null;
  channel?: string | null;
  "update-level"?: number | null;
  "applied-updates"?: number[];
  "build-status"?: string | null;
  "tg-build-status"?: string | null;
}

function mapUmtReleaseChunkBuildStatusLevel(
  raw: RawUmtReleaseChunkBuildStatusLevel,
): UmtReleaseChunkBuildStatusLevel {
  return {
    productName: raw["product-name"],
    productVersion: raw["product-version"],
    channel: raw.channel,
    updateLevel: raw["update-level"],
    appliedUpdates: raw["applied-updates"],
    buildStatus: raw["build-status"],
    tgBuildStatus: raw["tg-build-status"],
  };
}

export interface RawUmtReleaseChunkBuildStatus {
  id: number;
  updateIds: number[];
  overallCstBuildStatus?: string | null;
  updateLevels: RawUmtReleaseChunkBuildStatusLevel[];
}

export function mapUmtReleaseChunkBuildStatus(raw: RawUmtReleaseChunkBuildStatus): UmtReleaseChunkBuildStatus {
  return {
    id: raw.id,
    updateIds: raw.updateIds,
    overallCstBuildStatus: raw.overallCstBuildStatus,
    updateLevels: raw.updateLevels.map(mapUmtReleaseChunkBuildStatusLevel),
  };
}

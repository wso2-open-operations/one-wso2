// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import {
  mapUmtReleaseChunk,
  mapUmtReleaseChunkBuildStatus,
  mapUmtReleasedChunk,
  type RawUmtReleaseChunk,
  type RawUmtReleaseChunkBuildStatus,
  type RawUmtReleasedChunk,
} from "./umtReleaseChunks";

// These mappings are the only thing standing between the kebab-case keys on
// the wire and the camelCase every consumer reads, and a type declaration
// alone will not do it: declaring the camelCase shape and skipping the
// transform costs nothing at compile time and silently reads `undefined` for
// every field at runtime, so each update level renders as "N/A" and each
// build status falls through to "Failed".
describe("mapUmtReleaseChunk", () => {
  it("turns a pending chunk's kebab-case update levels into camelCase", () => {
    const raw: RawUmtReleaseChunk = {
      id: 42,
      updateIds: [101, 102],
      updateLevels: [
        {
          "product-name": "wso2am",
          "product-version": "4.2.0",
          "update-level": 135,
          "build-status": "SUCCESS",
          "tg-build-status": "SUCCESS",
        },
      ],
    };

    expect(mapUmtReleaseChunk(raw)).toEqual({
      id: 42,
      updateIds: [101, 102],
      updateLevels: [
        {
          productName: "wso2am",
          productVersion: "4.2.0",
          updateLevel: 135,
          buildStatus: "SUCCESS",
          tgBuildStatus: "SUCCESS",
        },
      ],
    });
  });

  it("maps a chunk whose update levels never arrived to an empty list", () => {
    const raw: RawUmtReleaseChunk = { id: 43, updateIds: [103] };

    expect(mapUmtReleaseChunk(raw)).toEqual({
      id: 43,
      updateIds: [103],
      updateLevels: [],
    });
  });
});

describe("mapUmtReleasedChunk", () => {
  it("maps a released chunk's update levels the same way, leaving its own top-level fields alone", () => {
    const raw: RawUmtReleasedChunk = {
      id: 7,
      updateIds: [55],
      updateLevels: [
        {
          "product-name": "wso2is",
          "product-version": "7.0.0",
          // The released-chunks view renders "<product> <version>.<level>",
          // so this one has to survive the mapping — it is absent from the
          // source's listReleaseChunks mapping only because the pending grid
          // never shows it.
          "update-level": 42,
          "build-status": "SUCCESS",
        },
      ],
      status: "Released",
      releaseMessage: "2026-09 release",
      releasedOn: "2026-09-01",
    };

    expect(mapUmtReleasedChunk(raw)).toEqual({
      id: 7,
      updateIds: [55],
      updateLevels: [
        {
          productName: "wso2is",
          productVersion: "7.0.0",
          updateLevel: 42,
          buildStatus: "SUCCESS",
          tgBuildStatus: undefined,
        },
      ],
      status: "Released",
      releaseMessage: "2026-09 release",
      releasedOn: "2026-09-01",
    });
  });
});

describe("mapUmtReleaseChunkBuildStatus", () => {
  it("maps the buildStatus endpoint's larger kebab-case level shape", () => {
    // The exact shape GET /update/releaseChunk/{id}/buildStatus returns.
    const raw: RawUmtReleaseChunkBuildStatus = {
      id: 42,
      updateIds: [101],
      overallCstBuildStatus: "SUCCESS",
      updateLevels: [
        {
          "product-name": "wso2ei",
          "product-version": "6.1.1",
          channel: "full",
          "update-level": 1,
          "applied-updates": [97],
          "build-status": "SUCCESS",
        },
      ],
    };

    expect(mapUmtReleaseChunkBuildStatus(raw)).toEqual({
      id: 42,
      updateIds: [101],
      overallCstBuildStatus: "SUCCESS",
      updateLevels: [
        {
          productName: "wso2ei",
          productVersion: "6.1.1",
          channel: "full",
          updateLevel: 1,
          appliedUpdates: [97],
          buildStatus: "SUCCESS",
          tgBuildStatus: undefined,
        },
      ],
    });
  });
});

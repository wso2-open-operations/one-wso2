// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { umtBackLink } from "./umtBackLink";
import { umtPaths } from "./umtPaths";

describe("umtBackLink", () => {
  it("defaults to the updates list", () => {
    expect(umtBackLink(null)).toEqual({ backTo: umtPaths.updates });
    expect(umtBackLink({ other: 1 })).toEqual({ backTo: umtPaths.updates });
  });

  it("uses the caller's UMT path and state", () => {
    expect(umtBackLink({ backTo: umtPaths.newReleaseChunk, backState: { selectedIds: [1] } })).toEqual({
      backTo: umtPaths.newReleaseChunk,
      backState: { selectedIds: [1] },
    });
  });

  it("ignores a path outside UMT", () => {
    expect(umtBackLink({ backTo: "https://example.com" })).toEqual({ backTo: umtPaths.updates });
    expect(umtBackLink({ backTo: "/finance" })).toEqual({ backTo: umtPaths.updates });
  });
});

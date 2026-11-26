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

import { describe, expect, it } from "vitest";
import type { NativeIntent } from "../api/amplifyTypes";
import { foundRepostText, intentsByCampaign, nativeRepostState } from "./nativeRepost";

const intent = (campaignId: string, nativeStatus: NativeIntent["nativeStatus"]): NativeIntent => ({
  campaignId,
  openedAt: "2026-11-20T10:00:00Z",
  detectedAt: nativeStatus === "DETECTED" ? "2026-11-20T12:00:00Z" : null,
  nativeStatus,
});

describe("native repost state", () => {
  it("is NONE for a post never opened, and the latest status otherwise", () => {
    const byCampaign = intentsByCampaign([intent("c-1", "LOOKING"), intent("c-2", "NOT_FOUND"), intent("c-1", "NOT_FOUND")]);
    expect(nativeRepostState(byCampaign, "c-1")).toBe("LOOKING");
    expect(nativeRepostState(byCampaign, "c-2")).toBe("NOT_FOUND");
    expect(nativeRepostState(byCampaign, "c-3")).toBe("NONE");
    expect(nativeRepostState(intentsByCampaign(undefined), "c-1")).toBe("NONE");
  });

  it("says what a found repost earned when the point value is known", () => {
    expect(foundRepostText(2)).toBe("Found your repost · +2");
    expect(foundRepostText(undefined)).toBe("Found your repost");
  });
});

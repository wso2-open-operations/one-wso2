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
import { dealPath, meetingPath } from "./salesPaths";

describe("meetingPath", () => {
  it("opens on Summary by default, and on a tab, or a MEDDPICC Letter, when asked", () => {
    expect(meetingPath(42)).toBe("/sales/meetings/42");
    expect(meetingPath(42, { tab: "summary", letter: "E" })).toBe("/sales/meetings/42");
    expect(meetingPath(42, { tab: "transcript" })).toBe("/sales/meetings/42?tab=transcript");
    expect(meetingPath(42, { tab: "meddpicc" })).toBe("/sales/meetings/42?tab=meddpicc");
    expect(meetingPath(42, { tab: "meddpicc", letter: "DC" })).toBe("/sales/meetings/42?tab=meddpicc&letter=DC");
  });
});

describe("dealPath", () => {
  it("escapes the id and adds a Letter when given", () => {
    expect(dealPath("a/b", "E")).toBe("/sales/deals/a%2Fb?letter=E");
  });
});

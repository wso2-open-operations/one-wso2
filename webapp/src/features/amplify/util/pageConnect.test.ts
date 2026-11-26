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

import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetPageConnect, isPageConnectState, rememberPageConnect } from "./pageConnect";

describe("page connect state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("knows the state it remembered, and only that one", () => {
    expect(isPageConnectState("s-1")).toBe(false);
    rememberPageConnect("s-1");
    expect(isPageConnectState("s-1")).toBe(true);
    expect(isPageConnectState("s-2")).toBe(false);
    expect(isPageConnectState(null)).toBe(false);
  });

  it("forgets it once used", () => {
    rememberPageConnect("s-1");
    forgetPageConnect();
    expect(isPageConnectState("s-1")).toBe(false);
  });

  it("treats storage that throws as the employee flow", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberPageConnect("s-1")).not.toThrow();
    expect(isPageConnectState("s-1")).toBe(false);
  });
});

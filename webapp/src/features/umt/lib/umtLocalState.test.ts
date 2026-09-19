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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPersistedBundleInfoChanges,
  readPersistedEditStep,
  readPersistedManualFiles,
  readPersistedPullRequests,
  readPersistedSelectedTab,
  writePersistedBundleInfoChanges,
  writePersistedEditStep,
  writePersistedManualFiles,
  writePersistedPullRequests,
  writePersistedSelectedTab,
} from "./umtLocalState";

describe("umtLocalState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the edit-tab stepper position and removes it on null", () => {
    expect(readPersistedEditStep("100")).toBeNull();
    writePersistedEditStep("100", "validate");
    expect(readPersistedEditStep("100")).toBe("validate");
    writePersistedEditStep("100", null);
    expect(readPersistedEditStep("100")).toBeNull();
  });

  it("round-trips PR Analysis pull-request rows", () => {
    expect(readPersistedPullRequests("100")).toEqual([]);
    const rows = [{ pr: "https://github.com/wso2/x/pull/1", preferredVersion: "" }];
    writePersistedPullRequests("100", rows);
    expect(readPersistedPullRequests("100")).toEqual(rows);
  });

  it("round-trips PR Analysis manual file rows", () => {
    const rows = [{ file: "a/b/c.jar", operation: "Added" }];
    writePersistedManualFiles("100", rows);
    expect(readPersistedManualFiles("100")).toEqual(rows);
  });

  it("round-trips PR Analysis bundle-info rows", () => {
    const rows = [{ bundlesInfoPath: "/plugins/", jarName: "x.jar", jarVersion: "1.0", entryType: "New" }];
    writePersistedBundleInfoChanges("100", rows);
    expect(readPersistedBundleInfoChanges("100")).toEqual(rows);
  });

  it("round-trips the selected detail tab", () => {
    expect(readPersistedSelectedTab("100")).toBeNull();
    writePersistedSelectedTab("100", "branch");
    expect(readPersistedSelectedTab("100")).toBe("branch");
  });

  it("scopes every key by update id, so two different updates never collide", () => {
    writePersistedEditStep("100", "validate");
    writePersistedPullRequests("100", [{ pr: "https://github.com/wso2/x/pull/1", preferredVersion: "" }]);
    writePersistedSelectedTab("100", "branch");

    expect(readPersistedEditStep("200")).toBeNull();
    expect(readPersistedPullRequests("200")).toEqual([]);
    expect(readPersistedSelectedTab("200")).toBeNull();
  });

  describe("when localStorage throws", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("read functions fall back safely instead of throwing", () => {
      vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });
      expect(() => readPersistedEditStep("100")).not.toThrow();
      expect(readPersistedEditStep("100")).toBeNull();
      expect(() => readPersistedPullRequests("100")).not.toThrow();
      expect(readPersistedPullRequests("100")).toEqual([]);
    });

    it("write functions swallow errors instead of throwing", () => {
      vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      expect(() => writePersistedEditStep("100", "validate")).not.toThrow();
      expect(() => writePersistedPullRequests("100", [])).not.toThrow();
    });
  });
});

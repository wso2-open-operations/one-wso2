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

// PR Analysis input rules.

import { describe, expect, it } from "vitest";
import { GITHUB_PR_REGEX, isPrAnalyzeDisabled, jarNameError, jarVersionError } from "../lib/umtPrAnalysis";

describe("PR URL", () => {
  it("accepts a GitHub pull request and rejects issues and other hosts", () => {
    expect(GITHUB_PR_REGEX.test("https://github.com/wso2/carbon-kernel/pull/12")).toBe(true);
    expect(GITHUB_PR_REGEX.test("https://github.com/wso2/carbon-kernel/issues/12")).toBe(false);
    expect(GITHUB_PR_REGEX.test("https://gitlab.com/wso2/carbon-kernel/pull/12")).toBe(false);
  });

  it("rejects a pull request URL with an empty owner or repo", () => {
    for (const url of [
      "https://github.com///pull/1",
      "https://github.com//carbon-kernel/pull/1",
      "https://github.com/wso2//pull/1",
    ]) {
      expect(GITHUB_PR_REGEX.test(url)).toBe(false);
    }
  });
});

describe("Analyze button", () => {
  it("is disabled while an analysis is queued or running", () => {
    for (const status of ["QUEUED", "PROCESSING"]) {
      expect(
        isPrAnalyzeDisabled({
          status,
          hasNewInputsSinceLastAnalysis: true,
          updateType: "generalUpdate",
          pullRequestCount: 1,
          manualFileCount: 0,
        }),
      ).toBe(true);
    }
  });

  // A failed analysis can be run again as it is: keeping Analyze disabled until
  // some input changes would leave a transient failure stuck.
  it("is enabled after a failed analysis, without any new input", () => {
    for (const status of ["FAILED_PR_MERGE_CONFLICT", "FAILED", "failure"]) {
      expect(
        isPrAnalyzeDisabled({
          status,
          hasNewInputsSinceLastAnalysis: false,
          updateType: "generalUpdate",
          pullRequestCount: 1,
          manualFileCount: 0,
        }),
      ).toBe(false);
    }
  });

  it("still needs something to analyze after a failed analysis", () => {
    expect(
      isPrAnalyzeDisabled({
        status: "FAILED_PR_MERGE_CONFLICT",
        hasNewInputsSinceLastAnalysis: false,
        updateType: "generalUpdate",
        pullRequestCount: 0,
        manualFileCount: 0,
      }),
    ).toBe(true);
  });

  it("stays disabled with no new input after a completed analysis", () => {
    expect(
      isPrAnalyzeDisabled({
        status: "COMPLETED",
        hasNewInputsSinceLastAnalysis: false,
        updateType: "generalUpdate",
        pullRequestCount: 1,
        manualFileCount: 0,
      }),
    ).toBe(true);
  });
});

describe("Bundle info JAR name", () => {
  it("rejects a name carrying the version or a .jar suffix", () => {
    expect(jarNameError("org.foo_1.2.0", "1.2.0")).toBeDefined();
    expect(jarNameError("org.foo.jar", "1.2.0")).toBeDefined();
    expect(jarNameError("org.foo", "1.2.0")).toBeUndefined();
  });

  // A JAR version can't be empty.
  it("requires a JAR version", () => {
    expect(jarVersionError("")).toBeDefined();
    expect(jarVersionError("   ")).toBeDefined();
    expect(jarVersionError("1.0.0")).toBeUndefined();
  });
});

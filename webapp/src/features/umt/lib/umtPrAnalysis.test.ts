// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import {
  GITHUB_PR_REGEX,
  PREFERRED_VERSION_REGEX,
  bundleInfoApplies,
  bundlesInfoPathError,
  groupFileOperationsByType,
  isManualFileTooLarge,
  isPrAnalyzeDisabled,
  isZipDisallowedForPath,
  jarNameError,
  manualFileNameMatchesPath,
  pluginsFileHasMatchingBundleInfo,
  prAnalysisStatusMessage,
  relativeJarPathError,
  umtSvnLocationRegex,
} from "./umtPrAnalysis";

describe("GITHUB_PR_REGEX", () => {
  it("matches a valid GitHub pull request URL", () => {
    expect(GITHUB_PR_REGEX.test("https://github.com/wso2/carbon-kernel/pull/123")).toBe(true);
  });

  it("rejects a non-GitHub or non-pull URL", () => {
    expect(GITHUB_PR_REGEX.test("https://gitlab.com/wso2/carbon-kernel/pull/123")).toBe(false);
    expect(GITHUB_PR_REGEX.test("https://github.com/wso2/carbon-kernel/issues/123")).toBe(false);
  });
});

describe("PREFERRED_VERSION_REGEX", () => {
  it("accepts blank and well-formed versions (major.minor.patch.build)", () => {
    expect(PREFERRED_VERSION_REGEX.test("")).toBe(true);
    expect(PREFERRED_VERSION_REGEX.test("6.7.206.298")).toBe(true);
    expect(PREFERRED_VERSION_REGEX.test("6.7.206-wso2v1.298")).toBe(true);
  });

  it("rejects malformed versions", () => {
    expect(PREFERRED_VERSION_REGEX.test("not-a-version")).toBe(false);
  });
});

describe("umtSvnLocationRegex", () => {
  it("requires http(s), the largefileSVN path, and the update id", () => {
    const regex = umtSvnLocationRegex("42");
    expect(regex.test("https://svn.example.com/svn/largefileSVN/42/file.jar")).toBe(true);
    expect(regex.test("https://svn.example.com/svn/largefileSVN/99/file.jar")).toBe(false);
    expect(regex.test("ftp://svn.example.com/svn/largefileSVN/42/file.jar")).toBe(false);
  });
});

describe("isPrAnalyzeDisabled", () => {
  const base = {
    status: undefined as string | undefined,
    hasNewInputsSinceLastAnalysis: true,
    updateType: "generalUpdate" as const,
    pullRequestCount: 1,
    manualFileCount: 0,
  };

  it("is disabled while queued or processing", () => {
    expect(isPrAnalyzeDisabled({ ...base, status: "QUEUED" })).toBe(true);
    expect(isPrAnalyzeDisabled({ ...base, status: "PROCESSING" })).toBe(true);
  });

  it("is disabled when nothing changed since the last analysis", () => {
    expect(isPrAnalyzeDisabled({ ...base, hasNewInputsSinceLastAnalysis: false })).toBe(true);
  });

  it("is disabled for a non-instructions-only update with no PRs or files", () => {
    expect(isPrAnalyzeDisabled({ ...base, pullRequestCount: 0, manualFileCount: 0 })).toBe(true);
  });

  it("is enabled for instructions-only updates even with no PRs or files", () => {
    expect(
      isPrAnalyzeDisabled({
        ...base,
        updateType: "instructionsOnlyUpdate",
        pullRequestCount: 0,
        manualFileCount: 0,
      }),
    ).toBe(false);
  });

  it("is enabled when inputs exist and nothing is in flight", () => {
    expect(isPrAnalyzeDisabled(base)).toBe(false);
    expect(isPrAnalyzeDisabled({ ...base, pullRequestCount: 0, manualFileCount: 1 })).toBe(false);
  });
});

describe("prAnalysisStatusMessage", () => {
  it("reports queued and processing with primary tone", () => {
    expect(prAnalysisStatusMessage("QUEUED")).toEqual({
      lines: ["PR Analysis task is queued."],
      tone: "primary",
    });
    expect(prAnalysisStatusMessage("PROCESSING")).toEqual({
      lines: ["PR Analysis task is being processed."],
      tone: "primary",
    });
  });

  it("reports completion with success tone", () => {
    expect(prAnalysisStatusMessage("COMPLETED")).toEqual({
      lines: ["PR Analysis was successfully completed."],
      tone: "success",
    });
  });

  it("reports the prompt message with primary tone when nothing has run yet", () => {
    expect(prAnalysisStatusMessage(undefined)).toEqual({
      lines: ["Add PR information to analyze."],
      tone: "primary",
    });
  });

  it("splits a failed status into readable detail lines with error tone", () => {
    const result = prAnalysisStatusMessage("FAILED_TIMEOUT: Request timed out while cloning repo");
    expect(result.tone).toBe("error");
    expect(result.lines[0]).toBe("PR Analysis task was failed.");
    expect(result.lines.slice(1).join(" ")).not.toContain(":");
  });

  it("does not split a colon inside a URL", () => {
    const result = prAnalysisStatusMessage("failed: see https://ci.example.com/job/1");
    expect(result.lines).toContain("see https://ci.example.com/job/1");
  });
});

describe("groupFileOperationsByType", () => {
  it("groups files by operation, case-insensitively, with unknowns as other", () => {
    const files = [
      { file: "a.jar", operation: "Added" },
      { file: "b.jar", operation: "modified" },
      { file: "c.jar", operation: "REMOVED" },
      { file: "d.jar", operation: "renamed" },
    ];
    const groups = groupFileOperationsByType(files);
    expect(groups.added.map((f) => f.file)).toEqual(["a.jar"]);
    expect(groups.modified.map((f) => f.file)).toEqual(["b.jar"]);
    expect(groups.removed.map((f) => f.file)).toEqual(["c.jar"]);
    expect(groups.other.map((f) => f.file)).toEqual(["d.jar"]);
  });
});

describe("isManualFileTooLarge", () => {
  it("rejects files over 50MB and accepts files at or under the limit", () => {
    const big = new File([new Uint8Array(1)], "big.bin");
    Object.defineProperty(big, "size", { value: 50 * 1024 * 1024 + 1 });
    const ok = new File([new Uint8Array(1)], "ok.bin");
    Object.defineProperty(ok, "size", { value: 50 * 1024 * 1024 });

    expect(isManualFileTooLarge(big)).toBe(true);
    expect(isManualFileTooLarge(ok)).toBe(false);
  });
});

describe("isZipDisallowedForPath", () => {
  it("disallows zip files under a /plugins/ path only", () => {
    expect(isZipDisallowedForPath("bundle.zip", "/repository/components/plugins/bundle.zip")).toBe(true);
    expect(isZipDisallowedForPath("bundle.zip", "/repository/components/lib/bundle.zip")).toBe(false);
    expect(isZipDisallowedForPath("bundle.jar", "/repository/components/plugins/bundle.jar")).toBe(false);
  });
});

describe("manualFileNameMatchesPath", () => {
  it("requires the file name to match the path's last segment", () => {
    expect(manualFileNameMatchesPath("bundle.jar", "/repository/components/plugins/bundle.jar")).toBe(true);
    expect(manualFileNameMatchesPath("other.jar", "/repository/components/plugins/bundle.jar")).toBe(false);
  });

  it("allows any file name when the path has no segments", () => {
    expect(manualFileNameMatchesPath("bundle.jar", "")).toBe(true);
  });
});

describe("bundleInfoApplies", () => {
  it("applies only under /plugins/ with Added or Removed (fixes legacy's always-truthy check)", () => {
    expect(bundleInfoApplies("/repository/components/plugins/bundle.jar", "Added")).toBe(true);
    expect(bundleInfoApplies("/repository/components/plugins/bundle.jar", "Removed")).toBe(true);
    expect(bundleInfoApplies("/repository/components/plugins/bundle.jar", "Modified")).toBe(false);
    expect(bundleInfoApplies("/repository/components/lib/bundle.jar", "Added")).toBe(false);
  });
});

describe("pluginsFileHasMatchingBundleInfo", () => {
  it("matches when a bundle-info entry's relativeJarPath shares the file's basename", () => {
    expect(
      pluginsFileHasMatchingBundleInfo("/repository/components/plugins/foo.jar", [
        { relativeJarPath: "../plugins/foo.jar" },
      ]),
    ).toBe(true);
  });

  it("does not match on a different basename", () => {
    expect(
      pluginsFileHasMatchingBundleInfo("/repository/components/plugins/foo.jar", [
        { relativeJarPath: "../plugins/bar.jar" },
      ]),
    ).toBe(false);
  });

  it("is false with no bundle-info entries", () => {
    expect(pluginsFileHasMatchingBundleInfo("/repository/components/plugins/foo.jar", [])).toBe(false);
  });
});

describe("bundle info field validators", () => {
  it("validates the bundles.info path suffix", () => {
    expect(bundlesInfoPathError("plugins/bundle.info")).toBeUndefined();
    expect(bundlesInfoPathError("plugins/bundles.info")).toBeUndefined();
    expect(bundlesInfoPathError("plugins/other.txt")).toBeDefined();
  });

  it("validates the JAR name doesn't include its version or a .jar suffix", () => {
    expect(jarNameError("my-component", "1.2.3")).toBeUndefined();
    expect(jarNameError("my-component-1.2.3", "1.2.3")).toBeDefined();
    expect(jarNameError("my-component.jar", "1.2.3")).toBeDefined();
  });

  it("validates the relative JAR path starts with ../ and avoids restricted paths", () => {
    expect(relativeJarPathError("../repository/components/plugins/my-component_1.2.3.jar")).toBeUndefined();
    expect(relativeJarPathError("repository/components/plugins/my-component_1.2.3.jar")).toBeDefined();
    expect(relativeJarPathError("../dropins/my-component_1.2.3.jar")).toBeDefined();
  });
});

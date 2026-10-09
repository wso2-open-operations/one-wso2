// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  GITHUB_PR_REGEX,
  PREFERRED_VERSION_REGEX,
  bundleInfoApplies,
  bundlesInfoPathError,
  extractZipEntriesWithinLimits,
  findUnsafeZipEntry,
  groupFileOperationsByType,
  isManualFileTooLarge,
  isPrAnalyzeDisabled,
  isZipDisallowedForPath,
  jarNameError,
  manualFileNameMatchesPath,
  manualFilePathError,
  pluginsFileHasMatchingBundleInfo,
  prAnalysisStatusMessage,
  relativeJarPathError,
  sourceUrlFileNameError,
  umtSvnLocationRegex,
  UmtZipRejectedError,
  zipTargetDirectory,
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

  it("always allows zip files, regardless of the path's last segment", () => {
    // A zip is a container unpacked client-side; the archive's own name has
    // nothing to do with `relativePath`, which for a zip is the directory
    // its entries extract into. Forcing the archive's name to appear as the
    // path's last segment is what turned it into a stored directory segment.
    expect(manualFileNameMatchesPath("patch.zip", "repository/components/dropins")).toBe(true);
    expect(manualFileNameMatchesPath("patch.zip", "repository/components/dropins/patch.zip")).toBe(true);
    expect(manualFileNameMatchesPath("patch.zip", "repository/components/dropins/unrelated.jar")).toBe(true);
    expect(manualFileNameMatchesPath("PATCH.ZIP", "repository/components/dropins")).toBe(true);
    expect(manualFileNameMatchesPath("patch.zip", "")).toBe(true);
  });
});

describe("zipTargetDirectory", () => {
  it("strips the archive's own name off the end of the path", () => {
    expect(zipTargetDirectory("repository/components/dropins/patch.zip", "patch.zip")).toBe(
      "repository/components/dropins",
    );
  });

  it("matches the archive name case-insensitively", () => {
    expect(zipTargetDirectory("repository/components/dropins/PATCH.ZIP", "patch.zip")).toBe(
      "repository/components/dropins",
    );
  });

  it("leaves a plain directory path alone", () => {
    expect(zipTargetDirectory("repository/components/dropins", "patch.zip")).toBe(
      "repository/components/dropins",
    );
  });

  it("does not strip a different archive name that happens to be last", () => {
    expect(zipTargetDirectory("repository/components/dropins/other.zip", "patch.zip")).toBe(
      "repository/components/dropins/other.zip",
    );
  });

  it("ignores trailing slashes", () => {
    expect(zipTargetDirectory("repository/components/dropins/patch.zip/", "patch.zip")).toBe(
      "repository/components/dropins",
    );
    expect(zipTargetDirectory("repository/components/dropins/", "patch.zip")).toBe(
      "repository/components/dropins",
    );
  });

  // Only a name preceded by a separator is treated as a stray archive segment.
  // A bare "patch.zip" is left as-is: with no directory part there is nothing
  // to distinguish "the archive name typed by habit" from a real target.
  it("leaves a bare archive name untouched", () => {
    expect(zipTargetDirectory("patch.zip", "patch.zip")).toBe("patch.zip");
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

describe("manualFilePathError", () => {
  it("accepts product-pack-relative paths, with or without a trailing slash", () => {
    expect(manualFilePathError("repository/components/foo.jar")).toBeUndefined();
    expect(manualFilePathError("repository/components/dropins/")).toBeUndefined();
    expect(manualFilePathError("bin/./wso2server.sh")).toBeUndefined();
    expect(manualFilePathError("lib/my..component.jar")).toBeUndefined();
  });

  it("rejects traversal segments", () => {
    expect(manualFilePathError("../x")).toBeDefined();
    expect(manualFilePathError("a/../../x")).toBeDefined();
    expect(manualFilePathError("a/..")).toBeDefined();
    expect(manualFilePathError("a/ .. /x")).toBeDefined();
  });

  it("rejects absolute, Windows-style and empty paths", () => {
    expect(manualFilePathError("/absolute")).toBeDefined();
    expect(manualFilePathError(" /absolute")).toBeDefined();
    expect(manualFilePathError("a\\b")).toBeDefined();
    expect(manualFilePathError("C:/x")).toBeDefined();
    expect(manualFilePathError("")).toBeDefined();
    expect(manualFilePathError("   ")).toBeDefined();
  });

  it("rejects control characters", () => {
    expect(manualFilePathError("a\u0000b")).toBeDefined();
    expect(manualFilePathError("a/b\nc")).toBeDefined();
    expect(manualFilePathError("a\u007fb")).toBeDefined();
  });

  it("rejects invisible and text-direction characters", () => {
    expect(manualFilePathError("lib/\u202eraj.exe")).toBeDefined();
    expect(manualFilePathError("lib/a\u200b.jar")).toBeDefined();
    expect(manualFilePathError("lib/\u2066a.jar")).toBeDefined();
    expect(manualFilePathError("lib/\ufeffa.jar")).toBeDefined();
    expect(manualFilePathError("lib/a\u0085.jar")).toBeDefined();
  });

  it("accepts non-ASCII names", () => {
    expect(manualFilePathError("lib/café.jar")).toBeUndefined();
    expect(manualFilePathError("docs/説明.txt")).toBeUndefined();
    expect(manualFilePathError("docs/ملف.txt")).toBeUndefined();
  });

  it("rejects paths longer than 200 characters", () => {
    expect(manualFilePathError("a".repeat(200))).toBeUndefined();
    expect(manualFilePathError("a".repeat(201))).toBeDefined();
  });

  it("rejects paths more than 40 levels deep", () => {
    expect(manualFilePathError(Array.from({ length: 40 }, () => "a").join("/"))).toBeUndefined();
    expect(manualFilePathError(Array.from({ length: 41 }, () => "a").join("/"))).toBeDefined();
  });
});

describe("findUnsafeZipEntry", () => {
  it("returns undefined when every entry is safe", () => {
    expect(findUnsafeZipEntry([{ name: "lib/a.jar" }, { name: "bin/b.sh" }])).toBeUndefined();
  });

  it("names the first unsafe entry", () => {
    expect(findUnsafeZipEntry([{ name: "lib/a.jar" }, { name: "/etc/passwd" }])?.name).toBe("/etc/passwd");
  });

  it("checks the name as stored in the archive rather than JSZip's cleaned-up one", async () => {
    const source = new JSZip();
    source.file("lib/safe.jar", "ok");
    source.file("lib/../../evil.jar", "bad");
    const loaded = await JSZip.loadAsync(await source.generateAsync({ type: "uint8array" }));
    const entries = Object.values(loaded.files).filter((entry) => !entry.dir);

    expect(entries.some((entry) => entry.name === "evil.jar")).toBe(true);
    expect(findUnsafeZipEntry(entries)?.name).toBe("lib/../../evil.jar");
  });
});

describe("extractZipEntriesWithinLimits", () => {
  const MB = 1024 * 1024;

  /** Loads a zip and returns its file entries. */
  async function loadEntries(bytes: Uint8Array) {
    const zip = await JSZip.loadAsync(bytes);
    return Object.values(zip.files).filter((entry) => !entry.dir);
  }

  /** Builds a deflate-compressed zip from name-to-content pairs. */
  async function buildZip(files: Record<string, Uint8Array | string>) {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(files)) zip.file(name, content);
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  /** Forges every entry's declared uncompressed size. */
  function forgeDeclaredSizes(bytes: Uint8Array, size: number): Uint8Array {
    const forged = bytes.slice();
    const view = new DataView(forged.buffer);
    for (let i = 0; i + 4 <= forged.length; i++) {
      const signature = view.getUint32(i, true);
      if (signature === 0x04034b50) view.setUint32(i + 22, size, true);
      else if (signature === 0x02014b50) view.setUint32(i + 24, size, true);
    }
    return forged;
  }

  /** Returns `count` files of `bytes` bytes each. */
  function filesOfSize(count: number, bytes: number): Record<string, Uint8Array> {
    const content = new Uint8Array(bytes);
    return Object.fromEntries(Array.from({ length: count }, (_, i) => [`lib/file-${i}.jar`, content]));
  }

  it("unpacks every entry of an archive within the limits", async () => {
    const entries = await loadEntries(await buildZip({ "lib/a.jar": "alpha", "bin/b.sh": "beta" }));
    const extracted = await extractZipEntriesWithinLimits(entries);

    expect(extracted.map((entry) => entry.name).sort()).toEqual(["bin/b.sh", "lib/a.jar"]);
    expect(extracted.find((entry) => entry.name === "lib/a.jar")?.blob.size).toBe("alpha".length);
  });

  it("rejects an archive with an unsafe entry path", async () => {
    const entries = await loadEntries(await buildZip({ "lib/../../evil.jar": "bad" }));
    await expect(extractZipEntriesWithinLimits(entries)).rejects.toThrow(/not a safe path/);
  });

  it("rejects an archive with more than 100 files", async () => {
    const entries = await loadEntries(await buildZip(filesOfSize(101, 1)));
    await expect(extractZipEntriesWithinLimits(entries)).rejects.toThrow(/at most 100 files/);

    const atLimit = await loadEntries(await buildZip(filesOfSize(100, 1)));
    await expect(extractZipEntriesWithinLimits(atLimit)).resolves.toHaveLength(100);
  });

  it("rejects an entry declared larger than 2 MB, and accepts one of exactly 2 MB", async () => {
    const tooLarge = await loadEntries(await buildZip({ "lib/big.jar": new Uint8Array(2 * MB + 1) }));
    await expect(extractZipEntriesWithinLimits(tooLarge)).rejects.toThrow(/"lib\/big.jar" is larger than 2 MB/);

    const atLimit = await loadEntries(await buildZip({ "lib/big.jar": new Uint8Array(2 * MB) }));
    await expect(extractZipEntriesWithinLimits(atLimit)).resolves.toHaveLength(1);
  });

  it("rejects an archive whose declared total is over 70 MB", async () => {
    const entries = await loadEntries(await buildZip(filesOfSize(36, 2 * MB)));
    await expect(extractZipEntriesWithinLimits(entries)).rejects.toThrow(/larger than 70 MB/);
  });

  it("stops unpacking an entry that is larger than its forged declared size", async () => {
    const forged = forgeDeclaredSizes(await buildZip({ "lib/bomb.jar": new Uint8Array(3 * MB) }), 10);
    const entries = await loadEntries(forged);
    await expect(extractZipEntriesWithinLimits(entries)).rejects.toThrow(UmtZipRejectedError);
    await expect(extractZipEntriesWithinLimits(entries)).rejects.toThrow(/"lib\/bomb.jar" is larger than 2 MB/);
  });

  it("lets a programming error through instead of reporting a corrupted zip", async () => {
    const [entry] = await loadEntries(await buildZip({ "lib/a.jar": "alpha" }));
    const broken = Object.assign(Object.create(entry), { internalStream: undefined });

    await expect(extractZipEntriesWithinLimits([broken])).rejects.toThrow(TypeError);
  });

  it("rejects an entry within the limits whose real size doesn't match its forged declared size", async () => {
    const forged = forgeDeclaredSizes(await buildZip({ "lib/small.jar": new Uint8Array(MB) }), 10);
    const entries = await loadEntries(forged);
    await expect(extractZipEntriesWithinLimits(entries)).rejects.toThrow(/"lib\/small.jar" could not be unzipped/);
  });
});


describe("sourceUrlFileNameError", () => {
  it("accepts ordinary file names", () => {
    expect(sourceUrlFileNameError("my-component_1.2.3.jar")).toBeUndefined();
    expect(sourceUrlFileNameError("wso2server.sh")).toBeUndefined();
    expect(sourceUrlFileNameError("README")).toBeUndefined();
  });

  it("rejects names that point at a directory rather than a file", () => {
    expect(sourceUrlFileNameError("..")).toBeDefined();
    expect(sourceUrlFileNameError(".")).toBeDefined();
    expect(sourceUrlFileNameError("")).toBeDefined();
  });

  it("rejects names the path check rejects", () => {
    expect(sourceUrlFileNameError("a\\b.jar")).toBeDefined();
  });
});

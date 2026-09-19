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

import { UMT_PR_ANALYSIS_STATUS, isUmtPrAnalysisFailed, type UmtUpdateType } from "../api/umtTypes";
import type { UmtFileOperation } from "../api/umtUpdates";

export const GITHUB_PR_REGEX = /^https:\/\/github\.com\/([^/]*\/){2}pull\/[0-9]*/;
export const PREFERRED_VERSION_REGEX = /(^$)|(^\d+\.\d+\.(\d+|\d+-wso2v\d+)(\.\d+|\.\d+-.*-hotfix-\d+)$)/;

export function umtSvnLocationRegex(updateId: string): RegExp {
  return new RegExp(`^(https?://).*(/svn/largefileSVN/${updateId}/).*`);
}

const MAX_MANUAL_FILE_BYTES = 50 * 1024 * 1024;
const RESTRICTED_RELATIVE_JAR_PATHS = ["/dropins"];

export function isPrAnalyzeDisabled(params: {
  status: string | null | undefined;
  hasNewInputsSinceLastAnalysis: boolean;
  updateType: UmtUpdateType;
  pullRequestCount: number;
  manualFileCount: number;
}): boolean {
  const { status, hasNewInputsSinceLastAnalysis, updateType, pullRequestCount, manualFileCount } = params;

  if (status === UMT_PR_ANALYSIS_STATUS.QUEUED || status === UMT_PR_ANALYSIS_STATUS.PROCESSING) return true;
  if (!hasNewInputsSinceLastAnalysis) return true;
  if (updateType !== "instructionsOnlyUpdate" && pullRequestCount === 0 && manualFileCount === 0) return true;
  return false;
}

export interface UmtPrAnalysisStatusMessage {
  lines: string[];
  tone: "error" | "success" | "primary";
}

// The failed-status detail is split on a colon not immediately followed by
// "//" (so it doesn't break URLs), or right before the phrase
// "Request timed out".
const PR_ANALYSIS_FAILURE_DETAIL_SPLIT = /(?::(?!\/\/)\s*)|(?=Request timed out)/g;

export function prAnalysisStatusMessage(status: string | null | undefined): UmtPrAnalysisStatusMessage {
  if (status === UMT_PR_ANALYSIS_STATUS.QUEUED) {
    return { lines: ["PR Analysis task is queued."], tone: "primary" };
  }
  if (status === UMT_PR_ANALYSIS_STATUS.PROCESSING) {
    return { lines: ["PR Analysis task is being processed."], tone: "primary" };
  }
  if (status === UMT_PR_ANALYSIS_STATUS.COMPLETED) {
    return { lines: ["PR Analysis was successfully completed."], tone: "success" };
  }
  if (isUmtPrAnalysisFailed(status)) {
    const detail = (status ?? "")
      .split(PR_ANALYSIS_FAILURE_DETAIL_SPLIT)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return { lines: ["PR Analysis task was failed.", ...detail], tone: "error" };
  }
  return { lines: ["Add PR information to analyze."], tone: "primary" };
}

export interface UmtGroupedFileOperations {
  added: UmtFileOperation[];
  modified: UmtFileOperation[];
  removed: UmtFileOperation[];
  other: UmtFileOperation[];
}

export function groupFileOperationsByType(files: UmtFileOperation[]): UmtGroupedFileOperations {
  const groups: UmtGroupedFileOperations = { added: [], modified: [], removed: [], other: [] };

  for (const file of files) {
    const operation = file.operation?.toLowerCase();
    if (operation === "added") groups.added.push(file);
    else if (operation === "modified") groups.modified.push(file);
    else if (operation === "removed") groups.removed.push(file);
    else groups.other.push(file);
  }

  return groups;
}

export function isManualFileTooLarge(file: File): boolean {
  return file.size > MAX_MANUAL_FILE_BYTES;
}

export function isZipDisallowedForPath(fileName: string, relativePath: string): boolean {
  return fileName.toLowerCase().endsWith(".zip") && relativePath.includes("/plugins/");
}

export function manualFileNameMatchesPath(fileName: string, relativePath: string): boolean {
  const expectedFileName = relativePath.split("/").filter(Boolean).pop();
  return !expectedFileName || expectedFileName === fileName;
}

// Uses relativePath.includes(...), not a stricter directoryPath ===
// "/plugins/" equality (which would only match a path with nothing after
// "/plugins/"), to apply one consistent substring rule everywhere.
export function bundleInfoApplies(relativePath: string, operation: string | null | undefined): boolean {
  return relativePath.includes("/plugins/") && (operation === "Added" || operation === "Removed");
}

// True when a manual file requiring a bundle-info entry (bundleInfoApplies)
// has one — matched by file basename rather than a direct
// `bundle.relativeJarPath === file.file` comparison, since those two values
// live in different coordinate systems (a product-pack-relative upload path
// vs a "../"-prefixed JAR-relative path) and would otherwise never match.
// Matching by basename preserves the check's intent: "did you add a bundle
// entry for this JAR".
export function pluginsFileHasMatchingBundleInfo(
  filePath: string,
  bundlesInfoChanges: { relativeJarPath?: string | null }[],
): boolean {
  const fileBaseName = filePath.split("/").filter(Boolean).pop();
  if (!fileBaseName) return false;
  return bundlesInfoChanges.some((change) => {
    const jarBaseName = (change.relativeJarPath ?? "").split("/").filter(Boolean).pop();
    return Boolean(jarBaseName) && jarBaseName === fileBaseName;
  });
}

export function bundlesInfoPathError(value: string): string | undefined {
  if (!value.endsWith("bundle.info") && !value.endsWith("bundles.info")) {
    return "The path should end with 'bundle.info' or 'bundles.info'.";
  }
  return undefined;
}

export function jarNameError(jarName: string, jarVersion: string): string | undefined {
  if ((jarVersion && jarName.includes(jarVersion)) || jarName.endsWith(".jar")) {
    return "The JAR name should not contain the JAR version and should not end with '.jar'.";
  }
  return undefined;
}

export function relativeJarPathError(value: string): string | undefined {
  if (!value.startsWith("../")) {
    return "The relative JAR path should start with '../'.";
  }
  if (RESTRICTED_RELATIVE_JAR_PATHS.some((path) => value.includes(path))) {
    return `The relative JAR path cannot contain ${RESTRICTED_RELATIVE_JAR_PATHS.join(", ")}.`;
  }
  return undefined;
}

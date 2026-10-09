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

import type JSZip from "jszip";
import { UMT_PR_ANALYSIS_STATUS, isUmtPrAnalysisFailed, type UmtUpdateType } from "../api/umtTypes";
import type { UmtFileOperation } from "../api/umtUpdates";

// `[0-9]+` not `[0-9]*` (a missing PR number is not a PR link) and anchored at
// both ends (trailing path segments point at a diff/file view, not the PR).
// This is the only client-side gate before the link is sent for analysis, and
// the backend only checks that it parses as a URL, so a malformed link would
// otherwise fail deep inside the analyser as an opaque praStatus.
export const GITHUB_PR_REGEX = /^https:\/\/github\.com\/([^/]*\/){2}pull\/[0-9]+\/?$/;
export const PREFERRED_VERSION_REGEX = /(^$)|(^\d+\.\d+\.(\d+|\d+-wso2v\d+)(\.\d+|\.\d+-.*-hotfix-\d+)$)/;

export function umtSvnLocationRegex(updateId: string): RegExp {
  return new RegExp(`^(https?://).*(/svn/largefileSVN/${updateId}/).*`);
}

// Anchored the same way umtSvnLocationRegex anchors the SVN location: this
// value is persisted as `sourceFilePath` and later rendered as an href in both
// the Edit tab's Manual Files grid and the View tab's file tables, so a
// `javascript:`/`data:` value would become a live link for every viewer.
const GITHUB_RAW_URL_REGEX = /^https?:\/\/[^\s]+$/i;

export function githubRawUrlError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Provide the GitHub raw source URL.";
  if (!GITHUB_RAW_URL_REGEX.test(trimmed)) {
    return "The GitHub raw source URL must start with http:// or https://.";
  }
  return undefined;
}

const MAX_MANUAL_FILE_BYTES = 50 * 1024 * 1024;
const RESTRICTED_RELATIVE_JAR_PATHS = ["/dropins"];

const MAX_MANUAL_PATH_LENGTH = 200;
const MAX_MANUAL_PATH_DEPTH = 40;
// Control, invisible and text-direction characters, which can disguise a name.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_REGEX = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;
const DRIVE_LETTER_REGEX = /^[a-z]:/i;

/** Returns why a path is unsafe, or undefined. Paths must be relative to the product pack. */
export function manualFilePathError(path: string): string | undefined {
  const trimmed = path.trim();
  if (!trimmed) return "The path is empty.";
  if (trimmed.length > MAX_MANUAL_PATH_LENGTH) {
    return `The path is longer than ${MAX_MANUAL_PATH_LENGTH} characters.`;
  }
  if (CONTROL_CHARACTER_REGEX.test(trimmed)) return "The path contains control or invisible characters.";
  if (trimmed.includes("\\")) return "The path must use '/' as the separator, not '\\'.";
  if (trimmed.startsWith("/")) return "The path must be relative to the product pack, not start with '/'.";
  if (DRIVE_LETTER_REGEX.test(trimmed)) return "The path must not start with a drive letter.";

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.some((segment) => segment.trim() === "..")) return "The path must not contain '..'.";
  if (segments.length > MAX_MANUAL_PATH_DEPTH) {
    return `The path is more than ${MAX_MANUAL_PATH_DEPTH} levels deep.`;
  }
  return undefined;
}

/** Validates the file name an SVN or GitHub source takes from the end of its URL. */
export function sourceUrlFileNameError(fileName: string): string | undefined {
  if (fileName === "." || fileName === ".." || manualFilePathError(fileName)) {
    return `The end of the source URL ("${fileName}") is not a valid file name.`;
  }
  return undefined;
}

/** Returns the first unsafe zip entry. Checks the original name, as JSZip strips `..` from `name`. */
export function findUnsafeZipEntry(
  entries: { name: string; unsafeOriginalName?: string }[],
): { name: string; error: string } | undefined {
  for (const entry of entries) {
    const name = entry.unsafeOriginalName ?? entry.name;
    const error = manualFilePathError(name);
    if (error) return { name, error };
  }
  return undefined;
}

const MAX_ZIP_ENTRIES = 100;
const MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_EXPANDED_BYTES = 70 * 1024 * 1024;

/** Thrown when a zip fails a check, before any entry is uploaded. */
export class UmtZipRejectedError extends Error {
  /** @param message Shown to the user in the Add Manual File dialog. */
  constructor(message: string) {
    super(message);
    this.name = "UmtZipRejectedError";
  }
}

/** Returns the uncompressed size the archive declares for an entry, from a private JSZip field. */
function declaredUncompressedSize(entry: JSZip.JSZipObject): number | undefined {
  const size = (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize;
  return typeof size === "number" ? size : undefined;
}

/** Unpacks an entry, resolving undefined once more than `limit` bytes have been unpacked. */
function readZipEntryWithinLimit(entry: JSZip.JSZipObject, limit: number): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    const stream = (
      entry as unknown as { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> }
    ).internalStream("uint8array");
    stream
      .on("data", (chunk) => {
        size += chunk.length;
        if (size > limit) {
          stream.pause();
          resolve(undefined);
          return;
        }
        chunks.push(chunk);
      })
      .on("error", reject)
      .on("end", () => resolve(new Blob(chunks as BlobPart[])))
      .resume();
  });
}

/** Formats a byte count in MB for error messages. */
function formatMb(bytes: number): string {
  return `${bytes / (1024 * 1024)} MB`;
}

/** Checks and unpacks every entry before anything is uploaded. Throws UmtZipRejectedError on failure. */
export async function extractZipEntriesWithinLimits(
  entries: JSZip.JSZipObject[],
): Promise<{ name: string; blob: Blob }[]> {
  const unsafeEntry = findUnsafeZipEntry(entries);
  if (unsafeEntry) {
    throw new UmtZipRejectedError(
      `The zip cannot be added because "${unsafeEntry.name}" is not a safe path. ${unsafeEntry.error}`,
    );
  }
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new UmtZipRejectedError(
      `The zip has ${entries.length} files. A zip can contain at most ${MAX_ZIP_ENTRIES} files.`,
    );
  }

  const entryTooLarge = (name: string) =>
    new UmtZipRejectedError(
      `The zip cannot be added because "${name}" is larger than ${formatMb(MAX_ZIP_ENTRY_BYTES)} when unzipped.`,
    );
  const totalTooLarge = () =>
    new UmtZipRejectedError(
      `The zip cannot be added because its contents are larger than ${formatMb(MAX_ZIP_EXPANDED_BYTES)} when unzipped.`,
    );

  // Declared sizes can be forged; the streaming check below is the real limit.
  let declaredTotal = 0;
  for (const entry of entries) {
    const declared = declaredUncompressedSize(entry);
    if (declared === undefined) continue;
    if (declared > MAX_ZIP_ENTRY_BYTES) throw entryTooLarge(entry.name);
    declaredTotal += declared;
  }
  if (declaredTotal > MAX_ZIP_EXPANDED_BYTES) throw totalTooLarge();

  const extracted: { name: string; blob: Blob }[] = [];
  let total = 0;
  for (const entry of entries) {
    const remaining = MAX_ZIP_EXPANDED_BYTES - total;
    const limit = Math.min(MAX_ZIP_ENTRY_BYTES, remaining);
    let blob: Blob | undefined;
    try {
      blob = await readZipEntryWithinLimit(entry, limit);
    } catch (error) {
      // A TypeError is a bug in this code, not a bad zip.
      if (error instanceof TypeError) throw error;
      // JSZip errors when an entry doesn't match its header.
      throw new UmtZipRejectedError(
        `The zip cannot be added because "${entry.name}" could not be unzipped. The zip may be corrupted.`,
      );
    }
    if (!blob) throw limit < MAX_ZIP_ENTRY_BYTES ? totalTooLarge() : entryTooLarge(entry.name);
    total += blob.size;
    extracted.push({ name: entry.name, blob });
  }
  return extracted;
}

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

// `relativePath` is the DIRECTORY an archive's entries unpack into. Users type
// the archive's own name at the end of it because both this port and the legacy
// React app rejected a zip otherwise (manualFileNameMatchesPath compared the
// path's last segment against the archive name), so drop it rather than
// creating a literal `.zip` directory segment inside the product pack. The
// Java tool never had this problem — there the user types the directory and the
// server unpacks.
export function zipTargetDirectory(path: string, zipName: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.toLowerCase().endsWith(`/${zipName.toLowerCase()}`)
    ? trimmed.slice(0, -(zipName.length + 1))
    : trimmed;
}

export function manualFileNameMatchesPath(fileName: string, relativePath: string): boolean {
  // A zip is a container that gets unpacked client-side — its entries, not
  // the archive itself, are what land in the pack — so the archive's own
  // name is never the target file name and has nothing to do with
  // `relativePath`, which for a zip is purely the directory its entries
  // extract into. Applying this check to zips is what forced users to type
  // the archive's own name onto the end of the path (the only way to pass
  // the check), which `addZipEntries` then reused as-is for both the upload
  // target and the row prefix — turning the zip's own name into a literal
  // directory segment in the stored path.
  if (fileName.toLowerCase().endsWith(".zip")) return true;
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

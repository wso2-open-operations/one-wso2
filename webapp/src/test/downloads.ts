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

// Watching what a test asked the browser to save.
//
// This lives beside `setup.ts` for the same reason `timeZone.ts` does: it
// exists to work around the environment rather than to test anything. jsdom
// has no object URLs and does not follow a download, so a feature that saves a
// file has no observable behaviour at all without these — and two suites now
// need that (the ARR Build's export and the customer drill-down's).
//
// Only the browser boundary is stubbed. Everything between the click and the
// bytes stays real: the real builders, the real ExcelJS, the real Blob.

import { vi } from "vitest";

export interface CapturedDownloads {
  /** The blobs handed to the browser, in the order they were saved. */
  blobs: Blob[];
  /** Their filenames, in the same order. */
  filenames: string[];
}

/**
 * Start recording downloads.
 *
 * Call inside a test, after `vi.restoreAllMocks()`. jsdom defines neither
 * `createObjectURL` nor `revokeObjectURL`, so they are assigned before being
 * spied on — `vi.spyOn` needs something to replace.
 */
export function captureDownloads(): CapturedDownloads {
  const captured: CapturedDownloads = { blobs: [], filenames: [] };
  URL.createObjectURL = () => "blob:mis-test";
  URL.revokeObjectURL = () => {};
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    captured.blobs.push(blob as Blob);
    return "blob:mis-test";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    captured.filenames.push(this.download);
  });
  return captured;
}

/**
 * The bytes inside a Blob.
 *
 * Through `FileReader` rather than `blob.arrayBuffer()`, which jsdom's Blob
 * does not have.
 */
export const bytesOf = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

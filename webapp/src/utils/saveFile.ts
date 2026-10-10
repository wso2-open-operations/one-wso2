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

// Hand a generated file to the browser as a download.
//
// Moved up here from `features/people-ops/api/useEmployeeReport.ts`, where it
// had been written as `saveCsv`. Its existence was never the problem — its
// LOCATION was: the next feature that needed to save a file had no shared one
// to reach for, and MIS's Excel export is that feature.
//
// Nothing about this is specific to a format. The Safari note below is the only
// non-obvious line in it, and it is the reason a second hand-rolled copy is
// worth avoiding: it is the sort of thing that gets omitted when the code is
// written again from memory, and the bug it prevents appears on one browser.

// The formats this app writes. Anything else is saved as bare bytes, so a
// caller handing over a server-influenced type can never have the browser treat
// the file as HTML in the app's origin — the same guard as financeReceipts's
// `safeType`. A new format is one line here, and until it has one it still
// downloads, just untyped.
const SAVEABLE_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv;charset=utf-8",
  "application/pdf",
]);

/**
 * Save `blob` to the reader's downloads as `filename`.
 *
 * The object URL is revoked on a timer rather than immediately: Safari aborts
 * the download if the blob is freed in the same tick as the click.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const safe = SAVEABLE_TYPES.has(blob.type) ? blob : new Blob([blob], { type: "application/octet-stream" });
  const url = URL.createObjectURL(safe);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

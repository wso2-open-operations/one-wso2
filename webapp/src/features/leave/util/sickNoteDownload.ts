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

import { fetchWithReauth } from "@api/http";
import { leaveServiceUrls } from "@config/apiConfig";

const FALLBACK_MESSAGE = "Couldn't download the sick note.";

// How long the object URL outlives the click. Revoking in the same tick can
// abort the download in Safari (same reason as utils/saveFile).
const REVOKE_DELAY_MS = 10_000;

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// File extension (no dot) for a sick-note content type; "" when unknown.
export function extensionForContentType(type: string): string {
  return EXTENSIONS[type] ?? "";
}

// `message` from a JSON error body, or null when the body is not JSON or has none.
export function messageFromErrorText(text: string): string | null {
  try {
    const body = JSON.parse(text) as { message?: unknown } | null;
    if (typeof body?.message === "string" && body.message) return body.message;
  } catch {
    // Not JSON — caller falls back.
  }
  return null;
}

// GET /leaves/{id}/sick-note and hand the bytes to the browser as a download.
export async function downloadSickNote(leaveId: number, accessToken: string): Promise<void> {
  const res = await fetchWithReauth(leaveServiceUrls.sickNote(leaveId), { method: "GET" }, accessToken);
  if (!res.ok) {
    throw new Error(messageFromErrorText(await res.text().catch(() => "")) ?? FALLBACK_MESSAGE);
  }
  const blob = await res.blob();
  // Only the three accepted types keep their type; anything else is saved as
  // bare bytes so a server-influenced type is never rendered in our origin.
  const type = (res.headers.get("Content-Type") ?? blob.type).split(";")[0].trim();
  const ext = extensionForContentType(type);
  const saved = ext ? new Blob([blob], { type }) : new Blob([blob], { type: "application/octet-stream" });

  const url = URL.createObjectURL(saved);
  const a = document.createElement("a");
  a.href = url;
  a.download = ext ? `sick-note-${leaveId}.${ext}` : `sick-note-${leaveId}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

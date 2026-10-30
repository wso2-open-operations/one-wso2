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

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const fetchWithReauth = vi.fn();
vi.mock("@api/http", () => ({ fetchWithReauth: (...a: unknown[]) => fetchWithReauth(...a) }));
vi.mock("@config/apiConfig", () => ({
  leaveServiceUrls: { sickNote: (id: number) => `https://leave.test/leaves/${id}/sick-note` },
}));

const { downloadSickNote, extensionForContentType, messageFromErrorText } = await import("./sickNoteDownload");

describe("extensionForContentType", () => {
  it("maps the three accepted types and nothing else", () => {
    expect(extensionForContentType("application/pdf")).toBe("pdf");
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("image/png")).toBe("png");
    expect(extensionForContentType("text/html")).toBe("");
    expect(extensionForContentType("")).toBe("");
  });
});

describe("messageFromErrorText", () => {
  it("reads message from a JSON body", () => {
    expect(messageFromErrorText('{"message":"No sick note"}')).toBe("No sick note");
  });
  it("gives null for JSON without a message", () => {
    expect(messageFromErrorText('{"other":1}')).toBeNull();
    expect(messageFromErrorText('{"message":""}')).toBeNull();
  });
  it("gives null for non-JSON", () => {
    expect(messageFromErrorText("<html>Bad gateway</html>")).toBeNull();
  });
});

describe("downloadSickNote", () => {
  let click: Mock;
  let downloadName: string | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchWithReauth.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:note");
    URL.revokeObjectURL = vi.fn();
    downloadName = undefined;
    click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
      click();
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves the bytes as sick-note-<id>.<ext> and revokes the URL only after a delay", async () => {
    fetchWithReauth.mockResolvedValue(
      new Response(new Blob(["%PDF"], { type: "application/pdf" }), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    await downloadSickNote(12, "tok");

    expect(fetchWithReauth).toHaveBeenCalledWith("https://leave.test/leaves/12/sick-note", { method: "GET" }, "tok");
    expect(click).toHaveBeenCalledTimes(1);
    expect(downloadName).toBe("sick-note-12.pdf");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:note");
  });

  it("throws the body's message on a non-OK response", async () => {
    fetchWithReauth.mockResolvedValue(
      new Response(JSON.stringify({ message: "Sick note was deleted" }), { status: 404 }),
    );
    await expect(downloadSickNote(1, "tok")).rejects.toThrow("Sick note was deleted");
    expect(click).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the body has none", async () => {
    fetchWithReauth.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(downloadSickNote(1, "tok")).rejects.toThrow("Couldn't download the sick note.");
  });
});

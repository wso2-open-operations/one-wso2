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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IMAGE_CHECK_TIMEOUT_MS, checkImageUrl } from "./imageUrlCheck";
import { useUrlCheck, type UrlChecker } from "./useUrlCheck";

class FakeImage {
  static last: FakeImage;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    FakeImage.last = this;
  }
}

describe("checkImageUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = (value: string) => checkImageUrl(value, new AbortController().signal);

  it("is ok when the image loads", async () => {
    const p = run("https://media.licdn.com/a.png");
    FakeImage.last.onload?.();
    expect(await p).toBe("ok");
    expect(FakeImage.last.src).toBe("https://media.licdn.com/a.png");
  });

  it("is bad when the image fails to load", async () => {
    const p = run("https://example.com/a.png");
    FakeImage.last.onerror?.();
    expect(await p).toMatchObject({ verdict: "bad" });
  });

  it("says the host is not allowed when the policy blocked it", async () => {
    const p = run("https://example.com/a.png");
    const event = new Event("securitypolicyviolation") as Event & { effectiveDirective: string; blockedURI: string };
    event.effectiveDirective = "img-src";
    event.blockedURI = "https://example.com/a.png";
    document.dispatchEvent(event);
    FakeImage.last.onerror?.();
    expect(await p).toMatchObject({ verdict: "bad", message: expect.stringContaining("doesn't allow images") });
  });

  it("is bad when it times out", async () => {
    const p = run("https://example.com/slow.png");
    await vi.advanceTimersByTimeAsync(IMAGE_CHECK_TIMEOUT_MS);
    expect(await p).toMatchObject({ verdict: "bad", message: expect.stringContaining("in time") });
  });

  it("is bad, without loading, for text that is not an https link", async () => {
    expect(await run("not a url")).toMatchObject({ verdict: "bad" });
    expect(await run("http://example.com/a.png")).toMatchObject({ verdict: "bad" });
  });

  it("is unknown when aborted", async () => {
    const controller = new AbortController();
    const p = checkImageUrl("https://example.com/a.png", controller.signal);
    controller.abort();
    expect(await p).toBe("unknown");
  });
});

describe("useUrlCheck", () => {
  it("goes idle, checking, then the verdict, and is idle again once the text changes", async () => {
    let resolve!: (v: "ok") => void;
    const checker: UrlChecker = () => new Promise((r) => (resolve = r));
    const { result, rerender } = renderHook(({ value }) => useUrlCheck(checker, value), {
      initialProps: { value: "abc" },
    });
    expect(result.current.state).toBe("idle");
    act(() => result.current.check("abc"));
    expect(result.current.state).toBe("checking");
    await act(async () => resolve("ok"));
    expect(result.current.state).toBe("ok");
    rerender({ value: "abcd" });
    expect(result.current.state).toBe("idle");
  });

  it("keeps an empty value idle without calling the checker", () => {
    const checker = vi.fn();
    const { result } = renderHook(() => useUrlCheck(checker, ""));
    act(() => result.current.check("  "));
    expect(checker).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("treats a thrown checker as idle and ignores a stale answer", async () => {
    const checker = vi.fn<UrlChecker>().mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useUrlCheck(checker, "x"));
    act(() => result.current.check("x"));
    await waitFor(() => expect(result.current.state).toBe("idle"));

    let first!: (v: "bad") => void;
    checker.mockImplementationOnce(() => new Promise((r) => (first = r)));
    checker.mockResolvedValueOnce("ok");
    act(() => result.current.check("x"));
    act(() => result.current.check("x"));
    await waitFor(() => expect(result.current.state).toBe("ok"));
    await act(async () => first("bad"));
    expect(result.current.state).toBe("ok");
  });

  it("checks the initial value on mount", async () => {
    const checker = vi.fn<UrlChecker>().mockResolvedValue("bad");
    const { result } = renderHook(() => useUrlCheck(checker, "https://a", "https://a"));
    await waitFor(() => expect(result.current.state).toBe("bad"));
    expect(checker).toHaveBeenCalledWith("https://a", expect.anything());
  });
});

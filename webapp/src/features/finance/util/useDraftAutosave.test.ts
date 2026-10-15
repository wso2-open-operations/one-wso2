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

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDraftAutosave } from "./useDraftAutosave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets the debounce elapse and the save's promise settle. */
const elapse = async (ms = 1000) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("the draft autosave arms on a change", () => {
  it("saves a change made while ready, once the debounce elapses", async () => {
    const run = vi.fn(async () => {});
    const { rerender } = renderHook(({ sig }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "a" },
    });

    rerender({ sig: "b" });
    await elapse();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not save the state it was seeded with", async () => {
    const run = vi.fn(async () => {});
    renderHook(() => useDraftAutosave("a", true, run));

    await elapse();

    expect(run).not.toHaveBeenCalled();
  });

  it("stays unarmed while not ready", async () => {
    const run = vi.fn(async () => {});
    const { rerender } = renderHook(({ sig }) => useDraftAutosave(sig, false, run), {
      initialProps: { sig: "a" },
    });

    rerender({ sig: "b" });
    await elapse();

    expect(run).not.toHaveBeenCalled();
  });
});

// CcCategorisePanel holds `ready` back for the whole of a job number lookup, so
// the first armed render can be several edits after the one the server has.
describe("a caller that names the persisted state up front", () => {
  it("saves an edit made before it turned ready", async () => {
    const run = vi.fn(async () => {});
    const { rerender } = renderHook(
      ({ sig, ready }) => useDraftAutosave(sig, ready, run, 1000, "persisted"),
      { initialProps: { sig: "persisted", ready: false } },
    );

    // Edited while the lookup was in flight, then the lookup lands.
    rerender({ sig: "edited", ready: false });
    rerender({ sig: "edited", ready: true });
    await elapse();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("still does not save when nothing was edited during the wait", async () => {
    const run = vi.fn(async () => {});
    const { rerender } = renderHook(
      ({ sig, ready }) => useDraftAutosave(sig, ready, run, 1000, "persisted"),
      { initialProps: { sig: "persisted", ready: false } },
    );

    rerender({ sig: "persisted", ready: true });
    await elapse();

    expect(run).not.toHaveBeenCalled();
  });
});

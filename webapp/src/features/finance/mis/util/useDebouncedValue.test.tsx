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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

// What the ARR Analysis reads are keyed on, as against what its controls show.
//
// Ticket 13 dropped the source's 250ms debounce deliberately: the table was two
// requests, and delaying every deliberate click to smooth over two number
// fields was the wrong trade. Ticket 14's charts take that up to TEN reads per
// filter change — one per industry, one per partner model, plus the table and
// the summary — which is the trade the source was making all along.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  // The first render must NOT wait. A cold load has nothing to debounce, and a
  // screen that sat blank for a quarter second before asking for anything would
  // be paying the cost with none of the benefit.
  it("reports the first value at once", () => {
    const { result } = renderHook(() => useDebouncedValue({ region: "EMEA" }, 250));
    expect(result.current).toEqual({ region: "EMEA" });
  });

  it("holds a change back until the delay has passed", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 1 },
    });
    rerender({ value: 2 });
    expect(result.current).toBe(1);

    act(() => void vi.advanceTimersByTime(249));
    expect(result.current).toBe(1);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(2);
  });

  // The whole point. A reader typing "50000" into the ARR Range, or stepping
  // through four Sales Regions, produces one settled value rather than four —
  // which on this screen is ten reads instead of forty.
  it("reports only the last of a burst", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 0 },
    });
    for (const value of [1, 2, 3, 4]) {
      rerender({ value });
      act(() => void vi.advanceTimersByTime(100));
    }
    expect(result.current).toBe(0);

    act(() => void vi.advanceTimersByTime(250));
    expect(result.current).toBe(4);
  });

  // A value that goes away and comes back within the window is not a change at
  // all, and re-keying every query for it would refetch the view already shown.
  it("reports nothing when a change is undone inside the window", () => {
    const held = { region: "EMEA" };
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: held },
    });
    const first = result.current;

    rerender({ value: { region: "APAC" } });
    act(() => void vi.advanceTimersByTime(100));
    rerender({ value: held });
    act(() => void vi.advanceTimersByTime(250));

    expect(result.current).toBe(first);
  });

  // Every MIS read is keyed on its request body, and a body is built from this
  // value. A new object identity for an unchanged value would re-key all ten
  // queries and refetch a view nobody changed.
  it("keeps the same identity when nothing actually changed", () => {
    const value = { region: "EMEA" };
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: value },
    });
    const first = result.current;
    rerender({ v: value });
    act(() => void vi.advanceTimersByTime(250));
    expect(result.current).toBe(first);
  });

  // Asserted on `clearTimeout` rather than on "it did not throw": React 19
  // neither throws nor warns on a post-unmount `setState`, so a not-toThrow
  // assertion here passes whether or not the timer is ever cleared — which is
  // the whole of what this test is for.
  it("clears a pending change when it unmounts, rather than firing after", () => {
    const cleared = vi.spyOn(globalThis, "clearTimeout");
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 1 },
    });
    rerender({ value: 2 });
    cleared.mockClear();
    unmount();
    expect(cleared).toHaveBeenCalled();
    cleared.mockRestore();
  });
});

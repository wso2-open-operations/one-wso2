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

// The hook keeps `run` in a ref so a change of signature does not re-arm the
// debounce every time the caller re-renders with a fresh closure. These pin
// WHICH closure a save ends up calling, so the ref can be rewritten without
// quietly saving against a stale one.
describe("which run callback a save uses", () => {
  it("calls the callback from the render that changed the signature", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    const { rerender } = renderHook(({ sig, run }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "a", run: first },
    });

    // The signature changes and the caller hands over a new closure in the
    // same render — that is the one holding the edited items.
    rerender({ sig: "b", run: second });
    await elapse();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("ignores a closure that arrives after the debounce was armed", async () => {
    const armed = vi.fn(async () => {});
    const later = vi.fn(async () => {});
    const { rerender } = renderHook(({ sig, run }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "a", run: armed },
    });

    rerender({ sig: "b", run: armed });
    // A re-render with no signature change must not swap the queued callback.
    rerender({ sig: "b", run: later });
    await elapse();

    expect(armed).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });
});

// Leaving the page inside the debounce window must not drop the edit.
describe("the flush on unmount", () => {
  it("runs a queued save when the hook unmounts early", async () => {
    const run = vi.fn(async () => {});
    const { rerender, unmount } = renderHook(({ sig }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "a" },
    });

    rerender({ sig: "b" });
    // Unmount before the debounce elapses.
    await act(async () => {
      unmount();
    });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not run twice when the debounce already fired", async () => {
    const run = vi.fn(async () => {});
    const { rerender, unmount } = renderHook(({ sig }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "a" },
    });

    rerender({ sig: "b" });
    await elapse();
    await act(async () => {
      unmount();
    });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not save on unmount when nothing was queued", async () => {
    const run = vi.fn(async () => {});
    const { unmount } = renderHook(() => useDraftAutosave("a", true, run));

    await act(async () => {
      unmount();
    });

    expect(run).not.toHaveBeenCalled();
  });

  // The queue is cleared on the way through the same branch that handles a
  // revert, and both reach it with nothing to save by the hook's own reckoning.
  // These two separate them, because telling them apart is the whole of the
  // guard and getting it wrong silently drops an edit the user made.
  it("drops a queued save when the edit is reverted", async () => {
    const run = vi.fn(async () => {});
    const { rerender, unmount } = renderHook(({ sig }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "a" },
    });

    rerender({ sig: "b" });
    // Undone inside the debounce window, so there is nothing left to persist.
    rerender({ sig: "a" });
    await act(async () => {
      unmount();
    });

    expect(run).not.toHaveBeenCalled();
  });

  it("keeps a queued save when the caller withdraws readiness", async () => {
    const run = vi.fn(async () => {});
    const { rerender, unmount } = renderHook(
      ({ sig, ready }) => useDraftAutosave(sig, ready, run),
      { initialProps: { sig: "a", ready: true } },
    );

    rerender({ sig: "b", ready: true });
    // Still the edited list — only readiness went away, a refetch say. Leaving
    // must flush it rather than discard it as though the edit were undone.
    rerender({ sig: "b", ready: false });
    await act(async () => {
      unmount();
    });

    expect(run).toHaveBeenCalledTimes(1);
  });
});

// A save can still be in flight when the next one starts — a quick second edit,
// or a slow request. Whichever settles first, only the newest save describes
// what the server now holds, so an older one landing afterwards must not report
// itself. These pin that, because the failure mode is a silently lost error.
describe("overlapping saves that settle out of order", () => {
  /** A promise the test settles by hand, to interleave two saves. */
  const deferred = () => {
    let settle!: { resolve: () => void; reject: () => void };
    const promise = new Promise<void>((resolve, reject) => {
      settle = { resolve: () => resolve(), reject: () => reject(new Error("save failed")) };
    });
    return { promise, ...settle };
  };

  /** Arms and fires two saves, returning both still unsettled. */
  const twoInFlight = async () => {
    const first = deferred();
    const second = deferred();
    const queued = [first.promise, second.promise];
    const run = vi.fn(() => queued.shift() ?? Promise.resolve());
    const { result, rerender } = renderHook(({ sig }) => useDraftAutosave(sig, true, run), {
      initialProps: { sig: "seeded" },
    });

    rerender({ sig: "first" });
    await elapse();
    rerender({ sig: "second" });
    await elapse();
    expect(run).toHaveBeenCalledTimes(2);

    return { first, second, result };
  };

  it("reports the newer save's failure when the older one then succeeds", async () => {
    const { first, second, result } = await twoInFlight();

    await act(async () => second.reject());
    await act(async () => first.resolve());

    // The older success says nothing about the edit the user is looking at.
    expect(result.current).toBe("error");
  });

  it("keeps the newer save's success when the older one then fails", async () => {
    const { first, second, result } = await twoInFlight();

    await act(async () => second.resolve());
    await act(async () => first.reject());

    expect(result.current).toBe("saved");
  });
});

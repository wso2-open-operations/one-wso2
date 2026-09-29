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

import { describe, expect, it } from "vitest";
import type { Session } from "@features/marketing-ops/event-platform/types/eventPlatformTypes";
import {
  applyPlacement,
  collectSessions,
  refileSessions,
  removeById,
  replaceById,
  sessionMatchesFilters,
  UNPLACED,
  unplaceEach,
} from "./cacheUpdates";

function session(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    configId: "e1",
    kind: "session",
    title: "Opening",
    description: "",
    durationSlots: 2,
    dayId: "d1",
    trackId: "t1",
    slotIndex: 3,
    sectionId: "sec1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    speakers: [],
    roomId: null,
    room: null,
    roomIsManual: false,
    topicId: null,
    topicIsManual: false,
    articleUrl: null,
    articleLabel: null,
    videoUrl: null,
    videoLabel: null,
    ...over,
  };
}

describe("sessionMatchesFilters", () => {
  it("keeps a session out of another event's lists", () => {
    expect(sessionMatchesFilters(session(), { configId: "e1" })).toBe(true);
    expect(sessionMatchesFilters(session(), { configId: "e2" })).toBe(false);
  });

  it("matches the day when one is asked for", () => {
    expect(sessionMatchesFilters(session(), { configId: "e1", dayId: "d1" })).toBe(true);
    expect(sessionMatchesFilters(session(), { configId: "e1", dayId: "d2" })).toBe(false);
  });

  it("treats scheduled as having a day, as the backend does", () => {
    const placed = session();
    const unplaced = session({ ...UNPLACED });
    expect(sessionMatchesFilters(placed, { configId: "e1", scheduled: true })).toBe(true);
    expect(sessionMatchesFilters(placed, { configId: "e1", scheduled: false })).toBe(false);
    expect(sessionMatchesFilters(unplaced, { configId: "e1", scheduled: false })).toBe(true);
    expect(sessionMatchesFilters(unplaced, { configId: "e1", scheduled: true })).toBe(false);
  });
});

describe("applyPlacement", () => {
  it("clears every placement field on unschedule, the section included", () => {
    const moved = applyPlacement(session(), UNPLACED);
    expect(moved).toMatchObject({ dayId: null, trackId: null, slotIndex: null, sectionId: null });
  });

  it("moves without touching the rest of the session", () => {
    const moved = applyPlacement(session(), { dayId: "d2", trackId: "t2", slotIndex: 0, sectionId: null });
    expect(moved).toMatchObject({ dayId: "d2", trackId: "t2", slotIndex: 0, sectionId: null, title: "Opening" });
  });
});

describe("refileSessions", () => {
  const palette = { configId: "e1", scheduled: false };
  const day1 = { configId: "e1", dayId: "d1" };
  const ids = (list: Session[]) => list.map((s) => s.id);

  // A card dragged from the palette onto day d1.
  it("moves a placed session out of the palette and into its day", () => {
    const waiting = session({ id: "a", ...UNPLACED });
    const placed = applyPlacement(waiting, { dayId: "d1", trackId: "t1", slotIndex: 0, sectionId: null });
    expect(refileSessions([waiting], palette, [placed])).toEqual([]);
    expect(refileSessions([], day1, [placed])).toEqual([placed]);
  });

  // And back again.
  it("moves an unscheduled session out of its day and into the palette", () => {
    const placed = session({ id: "a" });
    const waiting = applyPlacement(placed, UNPLACED);
    expect(refileSessions([placed], day1, [waiting])).toEqual([]);
    expect(refileSessions([], palette, [waiting])).toEqual([waiting]);
  });

  it("replaces a session that still belongs, keeping its position", () => {
    const list = [session({ id: "a" }), session({ id: "b" })];
    const moved = applyPlacement(list[0], { dayId: "d1", trackId: "t2", slotIndex: 5, sectionId: null });
    expect(refileSessions(list, day1, [moved])).toEqual([moved, list[1]]);
  });

  it("leaves another day's and another event's lists alone", () => {
    const other = [session({ id: "x", dayId: "d2" })];
    expect(refileSessions(other, { configId: "e1", dayId: "d2" }, [session({ id: "a" })])).toBe(other);
    expect(refileSessions([], { configId: "e2" }, [session({ id: "a" })])).toEqual([]);
  });

  it("adds a session only once, however often it is filed", () => {
    const a = session({ id: "a" });
    expect(ids(refileSessions([a], day1, [a, a]))).toEqual(["a"]);
  });

  it("only patches a list whose filters it cannot read", () => {
    const list = [session({ id: "a" })];
    const moved = applyPlacement(list[0], UNPLACED);
    expect(refileSessions(list, undefined, [moved])).toEqual([moved]);
    expect(refileSessions([], undefined, [moved])).toEqual([]);
  });
});

describe("collectSessions", () => {
  it("picks each matching session once across lists", () => {
    const a = session({ id: "a", trackId: "t1" });
    const b = session({ id: "b", trackId: "t2" });
    const found = collectSessions(
      [
        [["k1"], [a, b]],
        [["k2"], [a]],
        [["k3"], undefined],
      ],
      (s) => s.trackId === "t1",
    );
    expect(found).toEqual([a]);
  });
});

describe("unplaceEach", () => {
  it("waits for every unplace and reports the ones that failed", async () => {
    const boom = new Error("rate limited");
    const seen: string[] = [];
    const outcome = await unplaceEach(["a", "b", "c"], async (id) => {
      seen.push(id);
      if (id !== "a") throw id === "b" ? boom : new Error("later");
    });
    expect(seen).toEqual(["a", "b", "c"]);
    expect(outcome).toEqual({ failed: ["b", "c"], firstError: boom });
  });

  it("reports nothing when every unplace lands", async () => {
    expect(await unplaceEach(["a"], async () => undefined)).toEqual({ failed: [], firstError: undefined });
    expect(await unplaceEach([], async () => undefined)).toEqual({ failed: [], firstError: undefined });
  });
});

describe("replaceById and removeById", () => {
  const list = [{ id: "a", n: 1 }, { id: "b", n: 2 }];

  it("replace the matching item and keep order", () => {
    expect(replaceById(list, { id: "b", n: 9 })).toEqual([{ id: "a", n: 1 }, { id: "b", n: 9 }]);
  });

  it("remove the matching item", () => {
    expect(removeById(list, "a")).toEqual([{ id: "b", n: 2 }]);
  });
});

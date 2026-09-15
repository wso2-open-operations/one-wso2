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
import { generateAvailableTimeSlots } from "./parF2fSlots";
import type { ParFreeBusyResponse } from "../api/types";

// Local-clock helper — 9am on 10 March 2026 in whatever timezone the test
// runs in, expressed as the ISO string generateAvailableTimeSlots itself
// would produce for that local hour. Hardcoding a literal "...Z" string
// would only pass in UTC.
function localIso(hour: number, minute = 0): string {
  return new Date(2026, 2, 10, hour, minute, 0, 0).toISOString();
}

describe("generateAvailableTimeSlots", () => {
  beforeEach(() => {
    // Fix "now" well before working hours so a same-day date doesn't trim
    // the slot list in tests that aren't specifically testing that.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
  });
  afterEach(() => vi.useRealTimers());

  const noBusy: ParFreeBusyResponse = { calendars: {}, kind: "calendar#freeBusy", timeMax: "", timeMin: "" };

  it("covers every half-hour from 9am to 5pm, plus one slot starting at 5pm", () => {
    const slots = generateAvailableTimeSlots("2026-03-10", noBusy);
    expect(slots[0].label).toBe("9:00 AM - 9:30 AM");
    // WORKING_HOURS_END is an inclusive hour, not an end-of-day cutoff —
    // calendarSlice's own loop keeps the on-the-hour slot at that hour too
    // (`hour === WORKING_HOURS_END && minute > 0` is what it skips), so the
    // last slot runs 5:00–5:30pm, not stopping at 5:00pm. Matches source.
    expect(slots[slots.length - 1].label).toBe("5:00 PM - 5:30 PM");
    expect(slots).toHaveLength(17);
  });

  it("excludes a slot that overlaps a busy period", () => {
    const busy: ParFreeBusyResponse = {
      calendars: { "lead@wso2.com": { busy: [{ start: localIso(10), end: localIso(10, 30) }] } },
      kind: "calendar#freeBusy",
      timeMax: "",
      timeMin: "",
    };
    const slots = generateAvailableTimeSlots("2026-03-10", busy);
    expect(slots.some((s) => s.start === localIso(10))).toBe(false);
  });

  it("does not exclude a slot merely adjacent to a busy period", () => {
    const busy: ParFreeBusyResponse = {
      calendars: { "lead@wso2.com": { busy: [{ start: localIso(10), end: localIso(10, 30) }] } },
      kind: "calendar#freeBusy",
      timeMax: "",
      timeMin: "",
    };
    const slots = generateAvailableTimeSlots("2026-03-10", busy);
    expect(slots.some((s) => s.start === localIso(9, 30))).toBe(true);
    expect(slots.some((s) => s.start === localIso(10, 30))).toBe(true);
  });

  it("unions busy periods across every attendee's calendar", () => {
    const busy: ParFreeBusyResponse = {
      calendars: {
        "me@wso2.com": { busy: [{ start: localIso(9), end: localIso(9, 30) }] },
        "lead@wso2.com": { busy: [{ start: localIso(11), end: localIso(11, 30) }] },
      },
      kind: "calendar#freeBusy",
      timeMax: "",
      timeMin: "",
    };
    const slots = generateAvailableTimeSlots("2026-03-10", busy);
    expect(slots.some((s) => s.start === localIso(9))).toBe(false);
    expect(slots.some((s) => s.start === localIso(11))).toBe(false);
  });

  it("starts from the current hour rather than 9am when the date is today", () => {
    vi.setSystemTime(new Date(2026, 2, 10, 13, 15, 0));
    const slots = generateAvailableTimeSlots("2026-03-10", noBusy);
    expect(new Date(slots[0].start).getHours()).toBe(13);
  });

  it("excludes the current partial hour's slot once it has already elapsed", () => {
    vi.setSystemTime(new Date(2026, 2, 10, 13, 15, 0));
    const slots = generateAvailableTimeSlots("2026-03-10", noBusy);
    // The 13:00 slot started before 13:15 "now" — only 13:30 onward is offered.
    expect(slots[0].label).toBe("1:30 PM - 2:00 PM");
  });
});

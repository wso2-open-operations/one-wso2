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
import type { MeetingPart, TranscriptLine } from "../api/salesTypes";
import { attachedParts, partLabel, partsAreTimed, placeLine, placeSecond } from "./meetingParts";

const part = (id: number, startTime: string | null, endTime: string | null = null): MeetingPart => ({
  id,
  startTime,
  endTime,
  state: "ATTACHED",
});

const line = (startTime: string, offsetSeconds = 0): TranscriptLine => ({
  speaker: "A",
  text: "hello",
  offsetSeconds,
  startTime,
  endTime: startTime,
});

// A call recorded from 10:00 to 10:20, stopped, then recorded again from 10:30 to 10:50.
const first = part(1, "2026-10-25T10:00:00Z", "2026-10-25T10:20:00Z");
const second = part(2, "2026-10-25T10:30:00Z", "2026-10-25T10:50:00Z");

describe("attachedParts", () => {
  it("keeps only the parts that can be opened, in order", () => {
    const failed: MeetingPart = { ...part(3, null), state: "FAILED" };
    expect(attachedParts([first, failed, second]).map((p) => p.id)).toEqual([1, 2]);
    expect(attachedParts(undefined)).toEqual([]);
  });
});

describe("placeLine", () => {
  it("puts a line on the recording it was spoken during, timed from that recording's start", () => {
    expect(placeLine(line("2026-10-25T10:35:00Z"), [first, second], 1)).toEqual({
      recordingId: 2,
      offsetSeconds: 300,
    });
  });

  it("reads Meet's nanosecond timestamps", () => {
    expect(placeLine(line("2026-10-25T10:00:30.123456789Z"), [first, second], 1)?.recordingId).toBe(1);
  });

  it("returns null for a line said while nothing was recording", () => {
    expect(placeLine(line("2026-10-25T10:25:00Z"), [first, second], 1)).toBeNull();
  });

  it("places every line on the fallback recording when the meeting lists none", () => {
    expect(placeLine(line("2026-10-25T10:35:00Z", 42), [], -1)).toEqual({ recordingId: -1, offsetSeconds: 42 });
  });

  it("puts lines on the first recording by their own offset when the recordings have no times", () => {
    const untimed = [part(1, null), part(2, null)];
    expect(partsAreTimed(untimed)).toBe(false);
    // The offset counts from the call's start, where the first recording starts -- not from
    // whichever part is open, so the default id is ignored when there are recordings.
    expect(placeLine(line("2026-10-25T10:35:00Z", 42), untimed, -1)).toEqual({ recordingId: 1, offsetSeconds: 42 });
  });
});

describe("partLabel", () => {
  it("numbers the part, with its local start time when known", () => {
    expect(partLabel(part(9, null), 1)).toBe("Part 2");
    expect(partLabel(first, 0)).toMatch(/^Part 1 · \d{2}:\d{2}$/);
    expect(partLabel(part(9, null), 0, "Transcript")).toBe("Transcript 1");
  });
});

describe("placeSecond", () => {
  // A quote's offset counts from the call's start, where the first recording starts.
  it("puts a second from the call's start on the recording playing then, timed from its start", () => {
    expect(placeSecond(300, [first, second], 1)).toEqual({ recordingId: 1, offsetSeconds: 300 });
    expect(placeSecond(35 * 60, [first, second], 1)).toEqual({ recordingId: 2, offsetSeconds: 300 });
  });

  it("returns null for a moment while nothing was recording", () => {
    expect(placeSecond(25 * 60, [first, second], 1)).toBeNull();
  });

  it("counts from the call's first recording even when that one cannot be opened", () => {
    // The first part failed to attach, so only the second can be played: 35 minutes into
    // the call is still 5 minutes into the second part.
    const failed: MeetingPart = { ...first, state: "FAILED" };
    expect(placeSecond(35 * 60, [second], 1, [failed, second])).toEqual({ recordingId: 2, offsetSeconds: 300 });
  });

  it("keeps the second as it is on untimed parts, or on the default recording with none", () => {
    expect(placeSecond(760, [part(1, null), part(2, null)], -1)).toEqual({ recordingId: 1, offsetSeconds: 760 });
    expect(placeSecond(760, [], -1)).toEqual({ recordingId: -1, offsetSeconds: 760 });
  });
});

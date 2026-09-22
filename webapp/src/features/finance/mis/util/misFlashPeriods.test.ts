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
import { inZone } from "@/test/timeZone";
import {
  FLASH_MONTHS_BACK,
  addMonths,
  chosenMonth,
  defaultFlashMonths,
  firstOfMonth,
  flashDetailColumns,
  flashMonthLabel,
  flashMonthlyRanges,
  flashRangeLabel,
  flashRangeOf,
  lastOfMonth,
  loadedMonth,
  monthFromInput,
  monthInputValue,
  pacificMonth,
  resetFlashMonths,
  type MisMonth,
} from "./misFlashPeriods";

// The months a Flash reader is looking at, and the two date strings the flash
// backend is asked for.
//
// Spec §3: every Period boundary is Pacific. These are month boundaries rather
// than the Build's year boundaries, and the rule is the same one — so every
// test here runs under an explicit non-Pacific zone, because `src/test/setup.ts`
// pins the suite to America/Los_Angeles and a Pacific-versus-local confusion
// passes silently there.

const SEPTEMBER_2026: MisMonth = { year: 2026, month: 9 };

describe("which month it is", () => {
  // 02:00 UTC on 1 September is still 31 August in California, so the two zones
  // disagree about which MONTH a Flash opens on — which is the whole of the
  // default range below.
  const FIRST_OF_SEPTEMBER_UTC = new Date("2026-09-01T02:00:00Z");

  it("is August in California while UTC has already turned the month", () => {
    expect(inZone("UTC", () => pacificMonth(FIRST_OF_SEPTEMBER_UTC))).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("is the same in Colombo as in UTC", () => {
    expect(inZone("Asia/Colombo", () => pacificMonth(FIRST_OF_SEPTEMBER_UTC))).toEqual(
      inZone("UTC", () => pacificMonth(FIRST_OF_SEPTEMBER_UTC)),
    );
  });
});

describe("stepping a month", () => {
  it("walks back through a year boundary", () => {
    expect(addMonths({ year: 2026, month: 2 }, -3)).toEqual({ year: 2025, month: 11 });
  });

  it("walks forward through a year boundary", () => {
    expect(addMonths({ year: 2025, month: 11 }, 3)).toEqual({ year: 2026, month: 2 });
  });

  it("stands still at nought", () => {
    expect(addMonths(SEPTEMBER_2026, 0)).toEqual(SEPTEMBER_2026);
  });

  it("walks back a whole year", () => {
    expect(addMonths(SEPTEMBER_2026, -12)).toEqual({ year: 2025, month: 9 });
  });
});

describe("the months a Flash opens on", () => {
  // The source's mount effect builds thirteen first-of-month dates and opens on
  // the outermost pair (`FlashConsole.js`, the `useEffect` at the bottom).
  it("is this month, and the same month a year back", () => {
    expect(defaultFlashMonths(SEPTEMBER_2026)).toEqual({
      start: { year: 2025, month: 9 },
      end: SEPTEMBER_2026,
    });
  });

  it("spans thirteen months, counting both ends", () => {
    const { start, end } = defaultFlashMonths(SEPTEMBER_2026);
    expect(flashMonthlyRanges(start, end)).toHaveLength(FLASH_MONTHS_BACK + 1);
  });
});

describe("a month as a date", () => {
  it("writes the first day", () => {
    expect(firstOfMonth(SEPTEMBER_2026)).toBe("2026-09-01");
  });

  it("writes the last day", () => {
    expect(lastOfMonth(SEPTEMBER_2026)).toBe("2026-09-30");
  });

  it("knows February in a leap year", () => {
    expect(lastOfMonth({ year: 2028, month: 2 })).toBe("2028-02-29");
    expect(lastOfMonth({ year: 2026, month: 2 })).toBe("2026-02-28");
  });

  it("pads a single-digit month and day", () => {
    expect(firstOfMonth({ year: 2026, month: 1 })).toBe("2026-01-01");
  });
});

// Spec §8. The source sends a different DATE for a month the reader moved than
// for one they did not, and it decides that per PICKER rather than per Search —
// so one screen has several paths and only two of them agree. Reproduced rather
// than corrected; the module says why.
describe("what each end of the range sends", () => {
  const SEPTEMBER_2025: MisMonth = { year: 2025, month: 9 };

  it("sends the FIRST of a month the reader has not moved", () => {
    expect(loadedMonth(SEPTEMBER_2025)).toEqual({ month: SEPTEMBER_2025, date: "2025-09-01" });
  });

  it("sends the LAST of a month the reader moved", () => {
    expect(chosenMonth(SEPTEMBER_2025)).toEqual({ month: SEPTEMBER_2025, date: "2025-09-30" });
  });

  it("keeps showing the same month either way — only the date differs", () => {
    expect(chosenMonth(SEPTEMBER_2025).month).toEqual(loadedMonth(SEPTEMBER_2025).month);
    expect(chosenMonth(SEPTEMBER_2025).date).not.toBe(loadedMonth(SEPTEMBER_2025).date);
  });

  // The paths through the source, each asserted as the pair it sends. The table
  // in spec §8 is this list.
  it("asks what the load asked when neither picker was moved", () => {
    expect(flashRangeOf(loadedMonth(SEPTEMBER_2025), loadedMonth(SEPTEMBER_2026))).toEqual({
      startDate: "2025-09-01",
      endDate: "2026-09-01",
    });
  });

  it("mixes the two when only one picker was moved", () => {
    expect(flashRangeOf(chosenMonth(SEPTEMBER_2025), loadedMonth(SEPTEMBER_2026))).toEqual({
      startDate: "2025-09-30",
      endDate: "2026-09-01",
    });
    expect(flashRangeOf(loadedMonth(SEPTEMBER_2025), chosenMonth(SEPTEMBER_2026))).toEqual({
      startDate: "2025-09-01",
      endDate: "2026-09-30",
    });
  });

  it("asks for two month ends when both were moved", () => {
    expect(flashRangeOf(chosenMonth(SEPTEMBER_2025), chosenMonth(SEPTEMBER_2026))).toEqual({
      startDate: "2025-09-30",
      endDate: "2026-09-30",
    });
  });
});

// And a third computation, in the same screen. `handleReset` builds its dates
// with `setDate(0)` — the day BEFORE the first of a month — so both land a month
// earlier than the pickers were showing.
describe("where Reset goes back to", () => {
  it("is the last COMPLETED month, and the twelve before it", () => {
    expect(resetFlashMonths(SEPTEMBER_2026)).toEqual({
      start: { year: 2025, month: 8 },
      end: { year: 2026, month: 8 },
    });
  });

  it("is not where the screen opened, which is the finding", () => {
    expect(resetFlashMonths(SEPTEMBER_2026)).not.toEqual(defaultFlashMonths(SEPTEMBER_2026));
  });

  it("still spans thirteen months", () => {
    const { start, end } = resetFlashMonths(SEPTEMBER_2026);
    expect(flashMonthlyRanges(start, end)).toHaveLength(FLASH_MONTHS_BACK + 1);
  });

  // `handleReset` writes two LAST-of-month strings straight into `filterState`,
  // so a Search pressed straight after a Reset sends those rather than the
  // first-of-month pair the load sent.
  it("sends two month ends, as though both pickers had been moved", () => {
    const { start, end } = resetFlashMonths(SEPTEMBER_2026);
    expect(flashRangeOf(chosenMonth(start), chosenMonth(end))).toEqual({
      startDate: "2025-08-31",
      endDate: "2026-08-31",
    });
  });

  it("walks back through a year boundary", () => {
    expect(resetFlashMonths({ year: 2026, month: 1 })).toEqual({
      start: { year: 2024, month: 12 },
      end: { year: 2025, month: 12 },
    });
  });
});

describe("the monthly ranges behind a detail view", () => {
  const RANGES = flashMonthlyRanges({ year: 2025, month: 11 }, { year: 2026, month: 2 });

  // Month M is asked for as the last day of M−1 to the last day of M — what the
  // source sends from Colombo. February's end is 28 in 2026.
  it("asks for each month as the month-ends either side of it", () => {
    expect(RANGES).toEqual([
      { month: { year: 2025, month: 11 }, startDate: "2025-10-31", endDate: "2025-11-30" },
      { month: { year: 2025, month: 12 }, startDate: "2025-11-30", endDate: "2025-12-31" },
      { month: { year: 2026, month: 1 }, startDate: "2025-12-31", endDate: "2026-01-31" },
      { month: { year: 2026, month: 2 }, startDate: "2026-01-31", endDate: "2026-02-28" },
    ]);
  });

  // The finding behind the shape. Every financial-account section is summed
  // over `month > SUBSTRING(startDate, 1, 7) AND month <= SUBSTRING(endDate, 1,
  // 7)` (`entity-service/modules/database/transaction.bal`). Written out here as
  // the backend's rule, not as this module's: the range must select its own
  // month and no other. `[first of M, first of M+1]`, which ticket 15 sent,
  // selects M+1.
  it("is read by the financial accounts as exactly the month it is for", () => {
    const selects = (range: { startDate: string; endDate: string }, yyyyMm: string) =>
      yyyyMm > range.startDate.slice(0, 7) && yyyyMm <= range.endDate.slice(0, 7);
    const september = flashMonthlyRanges(SEPTEMBER_2026, SEPTEMBER_2026)[0];
    expect(["2026-08", "2026-09", "2026-10"].filter((m) => selects(september, m))).toEqual([
      "2026-09",
    ]);
  });

  it("knows a leap February at both ends", () => {
    expect(flashMonthlyRanges({ year: 2028, month: 2 }, { year: 2028, month: 3 })).toEqual([
      { month: { year: 2028, month: 2 }, startDate: "2028-01-31", endDate: "2028-02-29" },
      { month: { year: 2028, month: 3 }, startDate: "2028-02-29", endDate: "2028-03-31" },
    ]);
  });

  it("runs oldest first, which is the order the columns are drawn in", () => {
    expect(RANGES[0].startDate < RANGES[RANGES.length - 1].startDate).toBe(true);
  });

  it("is one range when both ends are the same month", () => {
    expect(flashMonthlyRanges(SEPTEMBER_2026, SEPTEMBER_2026)).toEqual([
      { month: SEPTEMBER_2026, startDate: "2026-08-31", endDate: "2026-09-30" },
    ]);
  });

  it("has nothing to say when the months are the wrong way round", () => {
    expect(flashMonthlyRanges(SEPTEMBER_2026, { year: 2025, month: 9 })).toEqual([]);
  });

  // The zone rule, on the shape it actually bites: the source builds these by
  // serialising local midnights, so it sends a different pair from every zone.
  // Asserted against the dates written out, not against another call to the
  // same function.
  it.each(["UTC", "Asia/Colombo"])("is the same list in %s", (tz) => {
    expect(inZone(tz, () => flashMonthlyRanges({ year: 2025, month: 12 }, { year: 2026, month: 1 })))
      .toEqual([
        { month: { year: 2025, month: 12 }, startDate: "2025-11-30", endDate: "2025-12-31" },
        { month: { year: 2026, month: 1 }, startDate: "2025-12-31", endDate: "2026-01-31" },
      ]);
  });
});

// The source fetches thirteen months and draws twelve of them: its monthly grid
// declares fields "1" through "12" and reads `summary[1]`…`summary[12]`, so
// `summary[0]` — the oldest month — is requested and never rendered. Spec §9.
describe("which of the fetched months the detail view actually draws", () => {
  const MONTHS = defaultFlashMonths(SEPTEMBER_2026);
  const RANGES = flashMonthlyRanges(MONTHS.start, MONTHS.end);

  it("drops the oldest of the thirteen", () => {
    const drawn = flashDetailColumns(RANGES);
    expect(drawn).toHaveLength(12);
    expect(drawn[0].range).toEqual(RANGES[1]);
    expect(drawn[drawn.length - 1].range).toEqual(RANGES[RANGES.length - 1]);
  });

  // The index matters as much as the range: it is what a response's `summary`
  // array is read at, and the source's own columns are numbered by it.
  it("remembers where in the response each drawn month sits", () => {
    expect(flashDetailColumns(RANGES).map((one) => one.index)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("draws nothing at all when only the dropped month was asked for", () => {
    expect(flashDetailColumns(RANGES.slice(0, 1))).toEqual([]);
  });
});

describe("the value a month picker holds", () => {
  it("is the year and the month, padded", () => {
    expect(monthInputValue(SEPTEMBER_2026)).toBe("2026-09");
    expect(monthInputValue({ year: 2026, month: 1 })).toBe("2026-01");
  });

  it("reads one back", () => {
    expect(monthFromInput("2026-09")).toEqual(SEPTEMBER_2026);
  });

  it("round-trips", () => {
    expect(monthFromInput(monthInputValue({ year: 1999, month: 12 }))).toEqual({
      year: 1999,
      month: 12,
    });
  });

  // A month input genuinely produces these while someone is using it. The
  // caller keeps the month it had rather than jumping to whatever `new Date`
  // would have made of the fragment.
  it.each(["", "2026", "2026-", "2026-9", "not-a-month", "2026-13", "2026-00"])(
    "reads nothing out of %o",
    (value) => {
      expect(monthFromInput(value)).toBeNull();
    },
  );
});

describe("how a month is headed", () => {
  // Headed from the month the range is FOR, which it carries — not recovered
  // from one of its dates, now that neither date is in that month's first day.
  it("is the short month and the year", () => {
    expect(flashMonthLabel({ year: 2026, month: 1 })).toBe("Jan 2026");
    expect(flashMonthLabel({ year: 2026, month: 12 })).toBe("Dec 2026");
  });

  it("heads a range with its own month, not the month its start date falls in", () => {
    const [september] = flashMonthlyRanges(SEPTEMBER_2026, SEPTEMBER_2026);
    expect(flashMonthLabel(september.month)).toBe("Sep 2026");
  });

  it("says nothing about a month that does not exist", () => {
    expect(flashMonthLabel({ year: 2026, month: 13 })).toBe("");
    expect(flashMonthLabel({ year: 2026, month: 0 })).toBe("");
  });
});

describe("the span a detail view is headed with", () => {
  // The source's `ytdRange`: the SECOND range's start to the last one's end,
  // which is exactly the twelve months it goes on to draw — and, from Colombo,
  // exactly these two dates.
  it("names the drawn months, not the fetched ones", () => {
    const { start, end } = defaultFlashMonths(SEPTEMBER_2026);
    expect(flashRangeLabel(flashMonthlyRanges(start, end))).toBe("2025-09-30 to 2026-09-30");
  });

  it("says nothing when there is nothing to span", () => {
    expect(flashRangeLabel([])).toBe("");
    expect(flashRangeLabel(flashMonthlyRanges(SEPTEMBER_2026, SEPTEMBER_2026))).toBe("");
  });
});

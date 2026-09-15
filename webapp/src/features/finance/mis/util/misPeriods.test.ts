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

import { afterEach, describe, expect, it, vi } from "vitest";
import { inZone } from "@/test/timeZone";
import {
  ENDING_MONTH_TODAY,
  MIS_PERIODS,
  MIS_WINDOWS,
  type MisAppliedFilters,
  type MisWindow,
} from "./misViewVocabulary";
import {
  buildColumnLabel,
  columnOpeningDate,
  asOfColumnLabel,
  getAnnualPeriods,
  customerColumnRanges,
  getMonthlyPeriods,
  getQuarterlyPeriods,
  getTtmPeriods,
  pacificColumnRanges,
  buildColumnRanges,
} from "./misPeriods";

// The Annually column ranges, in Pacific Time. Spec §3 and §10.8.
//
// Every date here is a business fact rather than a clock reading, so `asOf` is
// a parameter throughout and the expected values below are written out rather
// than recomputed — a range built the way the code builds it would agree with
// any bug in it.

afterEach(() => {
  vi.useRealTimers();
});

/** Saturday 12 September 2026, Pacific. */
const ASOF = { year: 2026, month: 9, day: 12 } as const;

describe("Annually on a Calendar Window", () => {
  it("gives Years Back prior years plus the current one, priors ending 31 December", () => {
    expect(getAnnualPeriods({ isYtd: false, yearsBack: 3, asOf: ASOF })).toEqual([
      { start: "2023/01/01", end: "2023/12/31" },
      { start: "2024/01/01", end: "2024/12/31" },
      { start: "2025/01/01", end: "2025/12/31" },
      { start: "2026/01/01", end: "2026/09/12" },
    ]);
  });

  it("ends every year at today's month and day once YTD is on", () => {
    expect(getAnnualPeriods({ isYtd: true, yearsBack: 2, asOf: ASOF })).toEqual([
      { start: "2024/01/01", end: "2024/09/12" },
      { start: "2025/01/01", end: "2025/09/12" },
      { start: "2026/01/01", end: "2026/09/12" },
    ]);
  });

  it("ends at the last day of a named Ending Month, and knows February's length", () => {
    expect(
      getAnnualPeriods({ isYtd: true, endingMonth: "February", yearsBack: 2, asOf: ASOF }),
    ).toEqual([
      { start: "2024/01/01", end: "2024/02/29" },
      { start: "2025/01/01", end: "2025/02/28" },
      { start: "2026/01/01", end: "2026/02/28" },
    ]);
  });

  it("applies an Ending Month to the current year only while YTD is off", () => {
    expect(
      getAnnualPeriods({ isYtd: false, endingMonth: "April", yearsBack: 1, asOf: ASOF }),
    ).toEqual([
      { start: "2025/01/01", end: "2025/12/31" },
      { start: "2026/01/01", end: "2026/04/30" },
    ]);
  });

  it("clamps a 29 February as-of into a common year rather than rolling into March", () => {
    // `new Date(2025, 1, 29)` is 1 March. A year-to-date "as at 29 February"
    // that silently includes a day of March would be off by a day of revenue in
    // three years out of four.
    expect(
      getAnnualPeriods({ isYtd: true, yearsBack: 1, asOf: { year: 2024, month: 2, day: 29 } }),
    ).toEqual([
      { start: "2023/01/01", end: "2023/02/28" },
      { start: "2024/01/01", end: "2024/02/29" },
    ]);
  });
});

describe("Annually on a TTM Window", () => {
  it("gives Years Back windows, each opening a year and a day before it ends", () => {
    expect(getTtmPeriods({ yearsBack: 2, asOf: ASOF })).toEqual([
      {
        opening: "2024/09/12",
        start: "2024/09/13",
        end: "2025/09/12",
        header: "2024/09/12 - 2025/09/12",
      },
      {
        opening: "2025/09/12",
        start: "2025/09/13",
        end: "2026/09/12",
        header: "2025/09/12 - 2026/09/12",
      },
    ]);
  });

  it("ends on the last day of a named Ending Month", () => {
    expect(getTtmPeriods({ yearsBack: 1, endingMonth: "April", asOf: ASOF })).toEqual([
      {
        opening: "2025/04/30",
        start: "2025/05/01",
        end: "2026/04/30",
        header: "2025/04/30 - 2026/04/30",
      },
    ]);
  });

  it("opens the day after a month end rather than on a 31st that does not exist", () => {
    expect(getTtmPeriods({ yearsBack: 1, endingMonth: "February", asOf: ASOF })).toEqual([
      {
        opening: "2025/02/28",
        start: "2025/03/01",
        end: "2026/02/28",
        header: "2025/02/28 - 2026/02/28",
      },
    ]);
  });

  it("still gives one window when Years Back is below the legal range", () => {
    expect(getTtmPeriods({ yearsBack: 0, asOf: ASOF })).toHaveLength(1);
  });
});

// Spec §10.8. The suite is pinned to America/Los_Angeles, so these have to name
// their own zone or they prove nothing.
describe("the viewer's timezone", () => {
  // Each of these asserts absolute dates, not just that two zones agree. UTC
  // and Asia/Colombo are BOTH east of Pacific, so a regression that read the
  // host calendar would shift them identically and an equality-only test would
  // watch it happen.
  const PRIOR_YEAR_YTD = { start: "2025/01/01", end: "2025/09/12" };
  const THIS_YEAR_YTD = { start: "2026/01/01", end: "2026/09/12" };

  it.each(["UTC", "Asia/Colombo"])("does not change the boundaries in %s", (tz) => {
    expect(inZone(tz, () => getAnnualPeriods({ isYtd: true, yearsBack: 1, asOf: ASOF }))).toEqual([
      PRIOR_YEAR_YTD,
      THIS_YEAR_YTD,
    ]);
  });

  it.each(["UTC", "Asia/Colombo"])("does not change the TTM ranges in %s", (tz) => {
    expect(inZone(tz, () => getTtmPeriods({ yearsBack: 1, asOf: ASOF }))).toEqual([
      {
        opening: "2025/09/12",
        start: "2025/09/13",
        end: "2026/09/12",
        header: "2025/09/12 - 2026/09/12",
      },
    ]);
  });

  it("does not decide which year the current one is", () => {
    // 02:00 UTC on New Year's Day: California is still in the old year, and the
    // Build's newest column is therefore 2025's, for a reader anywhere.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));

    const utc = inZone("UTC", () => getAnnualPeriods({ isYtd: false, yearsBack: 1 }));
    const colombo = inZone("Asia/Colombo", () => getAnnualPeriods({ isYtd: false, yearsBack: 1 }));

    expect(utc).toEqual([
      { start: "2024/01/01", end: "2024/12/31" },
      { start: "2025/01/01", end: "2025/12/31" },
    ]);
    expect(colombo).toEqual(utc);
  });
});

describe("the column-range computer the URL contract takes", () => {
  // Years Back counts PRIOR years here, so 2 is three ranges on a Calendar
  // Window — faithful to `getAnnualPeriods`. Which of them the Subscription
  // table draws is a separate question, below.
  const filters = {
    isYtd: false,
    endingMonth: ENDING_MONTH_TODAY,
    yearsBack: 2,
  } as unknown as MisAppliedFilters;

  // The real exported constant, reading the real clock — there is no as-of
  // parameter on it, because a screen has no business telling MIS what day it
  // is. 18:00 UTC on 12 September is 11:00 in California, the same date.
  function atAsOf<T>(tz: string, fn: () => T): T {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T18:00:00Z"));
    return inZone(tz, fn);
  }

  it("gives calendar years on a Calendar Window", () => {
    expect(atAsOf("Asia/Colombo", () => pacificColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, filters))).toEqual(
      [
        { start: "2024/01/01", end: "2024/12/31" },
        { start: "2025/01/01", end: "2025/12/31" },
        { start: "2026/01/01", end: "2026/09/12" },
      ],
    );
  });

  it("gives quarters on Quarterly and months on Monthly, whatever the Window says", () => {
    // The Window is Annually's alone, so the Period decides first. A
    // `window=ttm` that reached one of the other two routes is already being
    // ignored, and it must not turn a Quarterly Build into a trailing one.
    const quarters = atAsOf("UTC", () =>
      pacificColumnRanges(MIS_PERIODS.QUARTERLY, MIS_WINDOWS.TTM, filters),
    );
    expect(quarters.map((r) => r.header)).toEqual([
      "As of 2024 Q1", "As of 2024 Q2", "As of 2024 Q3", "As of 2024 Q4",
      "As of 2025 Q1", "As of 2025 Q2", "As of 2025 Q3", "As of 2025 Q4",
      "As of 2026 Q1", "As of 2026 Q2", "As of 2026/09/12",
    ]);
    const months = atAsOf("UTC", () =>
      pacificColumnRanges(MIS_PERIODS.MONTHLY, MIS_WINDOWS.CALENDAR, filters),
    );
    // Years Back 2, so 24 months plus the current one.
    expect(months).toHaveLength(25);
    expect(months.at(-1)?.header).toBe("As of 2026/09/12");
  });

  it("gives trailing-twelve-month ranges on a TTM Window", () => {
    expect(atAsOf("UTC", () => pacificColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.TTM, filters))).toEqual([
      {
        opening: "2024/09/12",
        start: "2024/09/13",
        end: "2025/09/12",
        header: "2024/09/12 - 2025/09/12",
      },
      {
        opening: "2025/09/12",
        start: "2025/09/13",
        end: "2026/09/12",
        header: "2025/09/12 - 2026/09/12",
      },
    ]);
  });

  it("is not where the Subscription table's column count is decided", () => {
    // The seam feeds `columnDateRanges`, which NINE other Annually tables
    // draw their columns from directly. Narrowing it here would quietly shorten
    // all of them; only the Subscription table wants fewer — see below.
    const calendar = atAsOf("UTC", () => pacificColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, filters));
    expect(calendar).toHaveLength(filters.yearsBack + 1);
  });
});

describe("an Ending Month that is not a month", () => {
  // Unreachable from a link — `parseViewState` validates it first — but the two
  // halves of the source disagree here, and the port reproduces the
  // disagreement rather than tidying it (ADR 0003).
  it("ends a Calendar year on 31 December", () => {
    expect(
      getAnnualPeriods({ isYtd: true, endingMonth: "Nonsense", yearsBack: 0, asOf: ASOF }),
    ).toEqual([{ start: "2026/01/01", end: "2026/12/31" }]);
  });

  it("ends a TTM range at today", () => {
    expect(getTtmPeriods({ yearsBack: 1, endingMonth: "Nonsense", asOf: ASOF })[0].end).toBe(
      "2026/09/12",
    );
  });

  it("treats an empty Ending Month as Today on both, as the source's truthiness check does", () => {
    expect(getAnnualPeriods({ isYtd: true, endingMonth: "", yearsBack: 0, asOf: ASOF })).toEqual([
      { start: "2026/01/01", end: "2026/09/12" },
    ]);
    expect(getTtmPeriods({ yearsBack: 1, endingMonth: "", asOf: ASOF })[0].end).toBe("2026/09/12");
  });
});

describe("the header above an Annually column", () => {
  // Both halves of a Build column are balance dates: the one it opens from and
  // the one it closes on. The header states them, so a reader can see which
  // twelve months a figure covers without consulting the filter bar.
  it("reads from the opening balance to the close, on a Calendar year", () => {
    expect(buildColumnLabel({ start: "2026/01/01", end: "2026/09/12" })).toBe(
      "2025/12/31 - 2026/09/12",
    );
  });

  it("uses the TTM range's own header, which already says the same thing", () => {
    const [ttm] = getTtmPeriods({ yearsBack: 1, asOf: ASOF });
    expect(buildColumnLabel(ttm)).toBe("2025/09/12 - 2026/09/12");
  });
});

describe("the header above an Exit ARR summary column", () => {
  // A summary is a BALANCE, not a movement: Exit ARR by Region and by Business
  // Unit report what was on the books at one moment, so their columns are
  // headed with that moment alone rather than with the span a Build rolls
  // forward over. `toAsOfAnnualLabel`, `tableUtils.js:34`.
  it("names only the date the column closes on", () => {
    expect(asOfColumnLabel({ start: "2026/01/01", end: "2026/09/12" })).toBe("As of 2026/09/12");
  });

  it("keeps a TTM range's own header, which the source heads these columns with too", () => {
    // `getColumnDefinitions` takes `ttmColumnPeriods` on a TTM Window, whose
    // label is the range's `header` — so a TTM summary column reads
    // `{opening} - {end}` exactly as a Build's does, and only a Calendar column
    // says "As of".
    const [ttm] = getTtmPeriods({ yearsBack: 1, asOf: ASOF });
    expect(asOfColumnLabel(ttm)).toBe("2025/09/12 - 2026/09/12");
  });
});

describe("the balance an Annually column opens from", () => {
  it("is the previous 31 December on a Calendar year, wherever the year closes", () => {
    // Year-to-date moves where a column CLOSES; it never moves where the
    // opening balance is read, which is always the last close of the year before.
    expect(columnOpeningDate({ start: "2026/01/01", end: "2026/09/12" })).toBe("2025/12/31");
    expect(columnOpeningDate({ start: "2026/01/01", end: "2026/12/31" })).toBe("2025/12/31");
  });

  it("is the TTM range's own opening, a year and a day back", () => {
    const [ttm] = getTtmPeriods({ yearsBack: 1, asOf: ASOF });
    expect(columnOpeningDate(ttm)).toBe("2025/09/12");
  });
});

describe("how many columns the Subscription Build draws", () => {
  // Years Back 5 draws FIVE columns, not six.
  //
  // The source reaches that through two generators that disagree, and the
  // Subscription table is the only one that reads the shorter.
  // `columnDateRanges` is `getAnnualPeriods({yearsBack})` — yearsBack + 1
  // ranges (`viewState.js:267`) — and nine other Annually tables take their
  // columns straight from it. The Subscription grid instead builds its own with
  // `generateFullYearRanges(-(yearsBack - 1), 0)` (`tableUtils.js`), which is
  // yearsBack of them. A TTM Window has no such split.
  const filtersAt = (yearsBack: number, viewWindow: MisWindow = MIS_WINDOWS.CALENDAR) => {
    const base = { yearsBack, isYtd: true, endingMonth: ENDING_MONTH_TODAY };
    const columnDateRanges = pacificColumnRanges(
      MIS_PERIODS.ANNUALLY,
      viewWindow,
      base as unknown as MisAppliedFilters,
    );
    return { ...base, columnDateRanges } as unknown as MisAppliedFilters;
  };

  it("draws exactly Years Back columns on a Calendar Window", () => {
    expect(buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, filtersAt(5))).toHaveLength(5);
    expect(buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, filtersAt(1))).toHaveLength(1);
  });

  it("drops the OLDEST range, keeping the years nearest today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T18:00:00Z"));
    const filters = inZone("UTC", () => filtersAt(5));
    const columns = buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, filters);
    expect(columns[0].start).toBe("2022/01/01");
    expect(columns.at(-1)?.end).toBe("2026/09/12");
    // The one it dropped is the one the source computes and never draws.
    expect(filters.columnDateRanges?.[0].start).toBe("2021/01/01");
  });

  it("draws every range on a TTM Window, where the two agree", () => {
    const filters = filtersAt(5, MIS_WINDOWS.TTM);
    expect(buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.TTM, filters)).toEqual(
      filters.columnDateRanges,
    );
    expect(buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.TTM, filters)).toHaveLength(5);
  });

  it("draws nothing when the Applied set carries no ranges at all", () => {
    expect(
      buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, { yearsBack: 5 } as MisAppliedFilters),
    ).toEqual([]);
  });
});

// Ticket 12. ASOF is 12 September 2026, which is Q3 and month 9 — so both
// generators here are cut mid-period, which is the case with the rules in it.
describe("Quarterly columns", () => {
  it("runs whole prior years and stops at the current quarter", () => {
    // `-max(1, yearsBack)` to 0 inclusive, so Years Back 1 is TWO years of
    // quarters: all four of 2025 and the three of 2026 that have started.
    // Each opens at the close of the quarter before it, because a Build rolls
    // a balance forward rather than measuring a span.
    expect(getQuarterlyPeriods({ yearsBack: 1, asOf: ASOF })).toEqual([
      { opening: "2024/12/31", start: "2025/01/01", end: "2025/03/31", header: "As of 2025 Q1" },
      { opening: "2025/03/31", start: "2025/04/01", end: "2025/06/30", header: "As of 2025 Q2" },
      { opening: "2025/06/30", start: "2025/07/01", end: "2025/09/30", header: "As of 2025 Q3" },
      { opening: "2025/09/30", start: "2025/10/01", end: "2025/12/31", header: "As of 2025 Q4" },
      { opening: "2025/12/31", start: "2026/01/01", end: "2026/03/31", header: "As of 2026 Q1" },
      { opening: "2026/03/31", start: "2026/04/01", end: "2026/06/30", header: "As of 2026 Q2" },
      // The current quarter closes TODAY, not on 30 September — the rest of it
      // has not happened — and says so in its header rather than naming a
      // quarter that is still open.
      { opening: "2026/06/30", start: "2026/07/01", end: "2026/09/12", header: "As of 2026/09/12" },
    ]);
  });

  it("treats Years Back below 1 as 1, so there is always a column", () => {
    expect(getQuarterlyPeriods({ yearsBack: 0, asOf: ASOF })).toHaveLength(7);
  });
});

describe("Monthly columns", () => {
  it("gives THIRTEEN months at Years Back 1, which is the source's own off-by-one", () => {
    // `generateMonths` walks `i <= totalMonths` where `totalMonths` is
    // `yearsBack * 12`, so a year back is twelve months PLUS the current one —
    // September 2025 through September 2026. Reproduced under ADR 0003: a
    // column count that differs from the live app's is the first thing finance
    // would notice reconciling the two, and it is a column of real figures
    // rather than a duplicate.
    const months = getMonthlyPeriods({ yearsBack: 1, asOf: ASOF });
    expect(months).toHaveLength(13);
    expect(months[0]).toEqual({
      opening: "2025/08/31",
      start: "2025/09/01",
      end: "2025/09/30",
      header: "As of Sep 2025",
    });
    expect(months[11]).toEqual({
      opening: "2026/07/31",
      start: "2026/08/01",
      end: "2026/08/31",
      header: "As of Aug 2026",
    });
    // The thirteenth is the current month, closing today.
    expect(months[12]).toEqual({
      opening: "2026/08/31",
      start: "2026/09/01",
      end: "2026/09/12",
      header: "As of 2026/09/12",
    });
  });

  it("crosses a year boundary without losing December", () => {
    const labels = getMonthlyPeriods({ yearsBack: 1, asOf: ASOF }).map((m) => m.header);
    expect(labels).toContain("As of Dec 2025");
    expect(labels).toContain("As of Jan 2026");
  });
});

describe("which of the ranges a Build actually draws, off Annually", () => {
  it("draws every quarter and every month, with no Years Back slice", () => {
    // The slice is an ANNUALLY rule and only an annual one. It exists because
    // the source computes annual bounds with two generators that disagree by
    // one, and the Subscription grid reads the shorter — `generateQuarters`
    // and `generateMonths` have no such twin, so slicing here would cut seven
    // quarters down to one at the default Years Back.
    const quarters = getQuarterlyPeriods({ yearsBack: 1, asOf: ASOF });
    expect(quarters).toHaveLength(7);
    expect(
      buildColumnRanges(MIS_PERIODS.QUARTERLY, MIS_WINDOWS.CALENDAR, {
        columnDateRanges: quarters,
        yearsBack: 1,
      }),
    ).toHaveLength(7);

    const months = getMonthlyPeriods({ yearsBack: 1, asOf: ASOF });
    expect(
      buildColumnRanges(MIS_PERIODS.MONTHLY, MIS_WINDOWS.CALENDAR, {
        columnDateRanges: months,
        yearsBack: 1,
      }),
    ).toHaveLength(13);
  });
});

// Carried here by ticket 10. The Software/Cloud Customers table is the one
// table with column ranges of its own, and only on a Delayed type: the source
// gives it "historic data plus current day" there (`useCustomerAccounts.js:59`)
// rather than the whole Period. Everywhere else it takes the Build's.
describe("the customers table's own ranges on a Delayed type", () => {
  const at = (extra: Record<string, unknown>) =>
    ({ yearsBack: 1, ...extra }) as unknown as MisAppliedFilters;

  it("gives two historic quarters plus today on Delayed QRR", () => {
    expect(
      customerColumnRanges(MIS_PERIODS.QUARTERLY, MIS_WINDOWS.CALENDAR, at({ qrrType: "Delayed QRR" }), ASOF),
    ).toEqual([
      { opening: "2025/12/31", start: "2026/01/01", end: "2026/03/31", header: "As of 2026 Q1" },
      { opening: "2026/03/31", start: "2026/04/01", end: "2026/06/30", header: "As of 2026 Q2" },
      // The current quarter, closing today — the "plus current day" half.
      { opening: "2026/06/30", start: "2026/07/01", end: "2026/09/12", header: "As of 2026/09/12" },
    ]);
  });

  it("gives six historic months plus today on Delayed MRR", () => {
    const months = customerColumnRanges(
      MIS_PERIODS.MONTHLY,
      MIS_WINDOWS.CALENDAR,
      at({ mrrType: "Delayed MRR" }),
      ASOF,
    );
    expect(months).toHaveLength(7);
    expect(months[0]).toEqual({
      opening: "2026/02/28", start: "2026/03/01", end: "2026/03/31", header: "As of Mar 2026",
    });
    expect(months.at(-1)).toEqual({
      opening: "2026/08/31", start: "2026/09/01", end: "2026/09/12", header: "As of 2026/09/12",
    });
  });

  it("takes the Build's own ranges on every other type", () => {
    // Not a Delayed type, so there is no special case: it hands back the
    // Applied set's own ranges, which off Annually is every month the Build
    // draws. It READS them rather than generating them — the hydrated set is
    // the single source of which Periods are on screen.
    const months = getMonthlyPeriods({ yearsBack: 1, asOf: ASOF });
    expect(
      customerColumnRanges(
        MIS_PERIODS.MONTHLY,
        MIS_WINDOWS.CALENDAR,
        at({ mrrType: "Total MRR", columnDateRanges: months }),
        ASOF,
      ),
    ).toEqual(months);
    // And a Delayed ANNUALLY type is not one of the two cases either — the
    // source's branch names `quarterly` and `monthly` only.
    expect(
      customerColumnRanges(
        MIS_PERIODS.ANNUALLY,
        MIS_WINDOWS.CALENDAR,
        at({ arrType: "Delayed ARR", columnDateRanges: getAnnualPeriods({ isYtd: true, yearsBack: 1, asOf: ASOF }) }),
        ASOF,
      ),
    ).toHaveLength(1);
  });
});

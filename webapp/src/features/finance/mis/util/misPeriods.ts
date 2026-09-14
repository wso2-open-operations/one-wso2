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

// Which dates each Annually column covers.
//
// Ported from digiops-finance `arrDashboard/utils/annualPeriods.js` and
// `ttmPeriods.js`. The rules are the source's; what changed is that every one of
// them is now arithmetic on a Pacific calendar date rather than on a `Date`
// built from local fields, so the answer no longer depends on where the reader
// is sitting — spec §10.8. See `misPacificTime.ts` for why that mattered.
//
// This is the module that plugs into the `annualRangesFor` seam the URL
// contract leaves open (`hydrateAppliedFilters`, `applyWindow`): Pacific Time is
// handed in rather than imported there, so the contract stays testable without a
// timezone in it — spec §7.

import {
  addYears,
  endOfMonth,
  endOfYear,
  formatCivilDate,
  lastDayOfMonth,
  nextDay,
  pacificCivilDate,
  startOfYear,
  type MisCivilDate,
} from "./misPacificTime";
import type { AnnualRangesFor } from "./misViewState";
import {
  ENDING_MONTH_TODAY,
  MIS_WINDOWS,
  MONTH_NAMES,
  type MisAppliedFilters,
  type MisDateRange,
  type MisWindow,
} from "./misViewVocabulary";

export interface AnnualPeriodsOptions {
  /** Whether every year ends at the as-of month and day, not just the current one. */
  isYtd: boolean;
  /** A month name, or Today. Anything else is treated as Today. */
  endingMonth?: string;
  /** Prior years to include. The current year is always added on top. */
  yearsBack?: number;
  /** Today, on the Pacific calendar. Read from the clock when omitted. */
  asOf?: MisCivilDate;
}

/**
 * The Annually columns on a Calendar Window: `yearsBack` prior years plus the
 * current Pacific one, each opening on 1 January.
 *
 * Where a year CLOSES is the rule with the detail in it. A prior year closes on
 * 31 December unless YTD is on, which is what makes the columns comparable:
 * with YTD on, every year is cut at the same month and day, so 2024-to-date sits
 * beside 2025-to-date. The current year always closes at the as-of end, because
 * the rest of it has not happened.
 *
 * Oldest first, as the columns read.
 */
export function getAnnualPeriods({
  isYtd,
  endingMonth,
  yearsBack = 5,
  asOf,
}: AnnualPeriodsOptions): MisDateRange[] {
  const today = asOf ?? pacificCivilDate();
  const ranges: MisDateRange[] = [];
  for (let back = yearsBack; back >= 0; back--) {
    const year = today.year - back;
    ranges.push({
      start: formatCivilDate(startOfYear(year)),
      end: formatCivilDate(annualEnd(year, today, { isYtd, endingMonth })),
    });
  }
  return ranges;
}

function annualEnd(
  year: number,
  today: MisCivilDate,
  { isYtd, endingMonth }: Pick<AnnualPeriodsOptions, "isYtd" | "endingMonth">,
): MisCivilDate {
  if (!isYtd && year !== today.year) return endOfYear(year);
  if (asksForAMonth(endingMonth)) {
    // A month name that is not a month can only arrive from the app's own
    // state, not from a link — `parseViewState` validates `endingMonth` against
    // `ENDING_MONTH_VALUES` first. Closing the year is what the source does
    // with it, and it is the same degrade-to-default the URL contract makes
    // everywhere else (spec §4).
    const month = monthNumber(endingMonth);
    return month == null ? endOfYear(year) : endOfMonth(year, month);
  }
  // Today, cut into the year in question. Clamped rather than rolled: 29
  // February has no counterpart in a common year, and 1 March would quietly add
  // a day of revenue to three years in every four.
  return { year, month: today.month, day: Math.min(today.day, lastDayOfMonth(year, today.month)) };
}

/**
 * Whether the Ending Month is asking for a particular month rather than Today.
 *
 * Falsy is Today's branch, not a month's, matching the source's truthiness
 * check (`annualPeriods.js`, `ttmPeriods.js`) — an empty string ends at today,
 * not on 31 December.
 */
const asksForAMonth = (endingMonth?: string): endingMonth is string =>
  Boolean(endingMonth) && endingMonth !== ENDING_MONTH_TODAY;

/** 1–12 for a month name, or null when the string is not one. */
const monthNumber = (endingMonth: string): number | null => {
  const index = MONTH_NAMES.indexOf(endingMonth as (typeof MONTH_NAMES)[number]);
  return index >= 0 ? index + 1 : null;
};

export interface TtmPeriodsOptions {
  /** How many TTM columns. Below 1 is treated as 1 — there is always a window. */
  yearsBack?: number;
  /** A month name, or Today. Anything else is treated as Today. */
  endingMonth?: string;
  /** Today, on the Pacific calendar. Read from the clock when omitted. */
  asOf?: MisCivilDate;
}

/**
 * The Annually columns on a TTM Window: `yearsBack` trailing-twelve-month
 * ranges, the newest ending at the as-of end and each earlier one a year before
 * it.
 *
 * (Ranges, not "windows". CONTEXT.md warns that Window is overloaded in this
 * port, and `misViewVocabulary.ts` has already spent it on the column CUT —
 * Calendar or TTM. One column of a TTM cut is a range, and calling it a window
 * too would make the word mean two things inside one module.)
 *
 * A range carries an `opening` as well as a start and end, and the opening is a
 * day before the start on purpose. `opening` is the BALANCE the column rolls
 * forward from — the closing balance of the day before it begins — while
 * `start`–`end` is the MOVEMENT inside it. Counting the opening day's movement
 * twice is exactly the error the extra field exists to prevent.
 *
 * Oldest first, as the columns read.
 */
export function getTtmPeriods({
  yearsBack = 5,
  endingMonth,
  asOf,
}: TtmPeriodsOptions = {}): MisDateRange[] {
  const end = ttmEnd(asOf ?? pacificCivilDate(), endingMonth);
  const ranges: MisDateRange[] = [];
  for (let back = Math.max(1, yearsBack) - 1; back >= 0; back--) {
    ranges.push(trailingYearEnding(addYears(end, -back)));
  }
  return ranges;
}

/**
 * Where the newest TTM column closes.
 *
 * Note the fallback differs from `annualEnd`'s: an Ending Month that is not a
 * month ends a TTM column at today, where it ends a Calendar year on 31
 * December. That asymmetry is the source's, between `ttmPeriods.js` and
 * `annualPeriods.js`, and it is reproduced rather than reconciled (ADR 0003).
 * Neither branch is reachable from a link.
 */
const ttmEnd = (today: MisCivilDate, endingMonth?: string): MisCivilDate => {
  const month = asksForAMonth(endingMonth) ? monthNumber(endingMonth) : null;
  return month == null ? today : endOfMonth(today.year, month);
};

const trailingYearEnding = (end: MisCivilDate): MisDateRange => {
  const opening = addYears(end, -1);
  return {
    opening: formatCivilDate(opening),
    start: formatCivilDate(nextDay(opening)),
    end: formatCivilDate(end),
    header: `${formatCivilDate(opening)} - ${formatCivilDate(end)}`,
  };
};

/**
 * The balance date an Annually column opens from, `yyyy/MM/dd`.
 *
 * A TTM range carries its own, computed a year and a day back. A Calendar year
 * always opens at the previous 31 December — Year-to-date moves where a column
 * CLOSES, never where its opening balance is read.
 *
 * Both the column header and the `/arr-summary` request need this date, which
 * is why it is a named rule here rather than a slice of the end date computed
 * twice in two modules that could drift apart.
 */
export function annualOpeningDate(range: MisDateRange): string {
  return range.opening ?? formatCivilDate(endOfYear(Number(range.end.slice(0, 4)) - 1));
}

/**
 * The header a Build shows above an Annually column: `{opening} - {end}`.
 *
 * Both halves are balance dates, so the header says which twelve months the
 * figures beneath it cover without a reader having to open the filter bar.
 */
export const annualColumnLabel = (range: MisDateRange): string =>
  range.header ?? `${annualOpeningDate(range)} - ${range.end}`;

/**
 * The header an Exit ARR summary shows above a column: `As of {end}`.
 *
 * A summary reports a BALANCE and a Build reports a MOVEMENT, which is why the
 * two do not share `annualColumnLabel`. Exit ARR by Region and by Business Unit
 * say what was on the books at one moment, so naming the span they were
 * computed over would claim a roll-forward that is not on screen.
 *
 * A TTM range keeps its own header, so only a Calendar column says "As of" —
 * that asymmetry is the source's, between `toAsOfAnnualLabel` and
 * `ttmColumnPeriods` (`tableUtils.js:34` and `:170`), and both are reached from
 * the same `getColumnDefinitions` branch.
 */
export const asOfColumnLabel = (range: MisDateRange): string =>
  range.header ?? `As of ${range.end}`;

/**
 * The Annually column ranges, ready to hand to `useMisViewState` — which is the
 * `annualRangesFor` seam spec §7 leaves open, filled in Pacific Time.
 *
 * A module-level constant rather than something a screen builds, because the
 * URL contract rebuilds the whole Applied set whenever this changes identity: a
 * screen that composed it inside its render would rehydrate on every keystroke.
 *
 * It reads the clock on every call, deliberately. A session left open across
 * Pacific midnight recomputes rather than going on reporting yesterday.
 *
 */
export const pacificAnnualRanges: AnnualRangesFor = (viewWindow: MisWindow, filters) =>
  viewWindow === MIS_WINDOWS.TTM
    ? getTtmPeriods({ yearsBack: filters.yearsBack, endingMonth: filters.endingMonth })
    : getAnnualPeriods({
        isYtd: filters.isYtd,
        endingMonth: filters.endingMonth,
        yearsBack: filters.yearsBack,
      });

/**
 * The ranges the SUBSCRIPTION Build's columns cover — which is not the same
 * list as the Applied set's `annuallyDateRanges`, on a Calendar Window.
 *
 * The source computes Annually bounds with two generators that disagree by one,
 * and the tables on the ARR Build screen read the SHORTER of the two:
 *
 *   annuallyDateRanges   getAnnualPeriods({yearsBack})              6 at Years Back 5
 *                        (viewState.js:267) — and nine other Annually
 *                        tables take their columns straight from it
 *   Subscription         generateFullYearRanges(-(yearsBack - 1), 0)  5 at Years Back 5
 *                        (tableUtils.js, `case 'subscription'`)
 *
 * So on a Calendar Window these tables draw the LAST `yearsBack` of the ranges
 * and the oldest is never shown — see spec §9. Kept as a slice of the Applied
 * set rather than a second computation, so the columns are literally drawn from
 * the ranges the filters carry and the two cannot drift.
 *
 * **Software/Cloud Customers reads this too, which is not obvious from the
 * source.** That table FETCHES `generateFullYearRanges(-yearsBack, 0)` — one
 * year more than Subscription — while its column definition
 * (`tableUtils.js:1091`) is `-(yearsBack - 1)`, identical to Subscription's. So
 * the source asks the backend for a year it then never renders. This port
 * renders what the source renders and does not make the wasted call; recorded
 * in `docs/ported-apps/mis.md` §7. Ticket 10 shipped the fetch list by mistake
 * and showed six Periods where the source shows five.
 *
 * A TTM Window has no such split: there the columns ARE `annuallyDateRanges`.
 */
export function buildColumnRanges(
  viewWindow: MisWindow,
  filters: Pick<MisAppliedFilters, "annuallyDateRanges" | "yearsBack">,
): readonly MisDateRange[] {
  const ranges = filters.annuallyDateRanges ?? [];
  if (viewWindow === MIS_WINDOWS.TTM) return ranges;
  return ranges.slice(-Math.max(1, filters.yearsBack));
}

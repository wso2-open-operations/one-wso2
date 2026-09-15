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
// This is the module that plugs into the `columnRangesFor` seam the URL
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
import { MIS_PERIODS, type MisPeriod } from "./misViewVocabulary";
import type { ColumnRangesFor } from "./misViewState";
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

// ---- Quarterly and Monthly columns ---------------------------------------
//
// Ported from `generateQuarters` and `generateMonths` (`tableUtils.js:256`
// and `:198`) together with the labelling in `toAsOfQuarterlyText` /
// `toAsOfMonthlyText` (`:84`, `:50`).
//
// A Q/M column is the same `MisDateRange` an Annually column is, and it carries
// its `opening` explicitly — the field TTM introduced. It has to: a quarter
// opens at the close of the quarter before it, which `columnOpeningDate`'s
// fallback (the previous 31 December) would get wrong for three quarters in
// four. The source sends only an end date for these and lets the backend infer
// the rest; this port sends both balance dates, as it does on Annually, because
// `arrSummaryRequests` is one code path for all three Periods.

/** The three-letter forms the source's period keys are written with. */
const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** 1–4. `Math.ceil` rather than a lookup, so a bad month cannot silently map. */
const quarterOf = ({ month }: MisCivilDate): number => Math.ceil(month / 3);

/** The balance date a quarter opens from: the close of the one before it. */
const quarterOpening = (year: number, quarter: number): MisCivilDate =>
  quarter === 1 ? endOfYear(year - 1) : endOfMonth(year, (quarter - 1) * 3);

/** The balance date a month opens from: the close of the one before it. */
const monthOpening = (year: number, month: number): MisCivilDate =>
  month === 1 ? endOfYear(year - 1) : endOfMonth(year, month - 1);

/**
 * One column, given where it opens, where it closes, and what to call it.
 *
 * The header is `As of {period}` except on the period still running, which is
 * `As of {today}` — because naming a quarter that has not finished would claim
 * figures for months that have not happened. The source arrives at the same
 * answer twice, in `toAsOfQuarterlyText`'s current-period branch and again in
 * `ensureLastPeriodUsesCurrent`; once is enough.
 */
function periodColumn(
  opening: MisCivilDate,
  close: MisCivilDate,
  periodKey: string,
  asOf: MisCivilDate,
  isCurrent: boolean,
): MisDateRange {
  const end = isCurrent ? asOf : close;
  return {
    opening: formatCivilDate(opening),
    start: formatCivilDate(nextDay(opening)),
    end: formatCivilDate(end),
    header: `As of ${isCurrent ? formatCivilDate(asOf) : periodKey}`,
  };
}

export interface PeriodColumnsOptions {
  /** Prior years to include. Below 1 is treated as 1 — there is always a column. */
  yearsBack?: number;
  /** Today, on the Pacific calendar. Read from the clock when omitted. */
  asOf?: MisCivilDate;
}

/**
 * The Quarterly Build's columns: every quarter of the prior `yearsBack` years,
 * plus the quarters of the current year that have started.
 *
 * So Years Back 1 is TWO calendar years of quarters, not one — the source's
 * loop runs `-max(1, yearsBack)` to 0 INCLUSIVE (`tableUtils.js:274`). Whole
 * prior years rather than a trailing count of quarters, so the columns line up
 * with a financial year rather than with the day the screen was opened.
 *
 * Oldest first, as the columns read.
 */
export function getQuarterlyPeriods({
  yearsBack = 1,
  asOf,
}: PeriodColumnsOptions = {}): MisDateRange[] {
  const today = asOf ?? pacificCivilDate();
  const currentQuarter = quarterOf(today);
  const columns: MisDateRange[] = [];
  for (let back = Math.max(1, Math.floor(yearsBack)); back >= 0; back--) {
    const year = today.year - back;
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (year === today.year && quarter > currentQuarter) break;
      columns.push(
        periodColumn(
          quarterOpening(year, quarter),
          endOfMonth(year, quarter * 3),
          `${year} Q${quarter}`,
          today,
          year === today.year && quarter === currentQuarter,
        ),
      );
    }
  }
  return columns;
}

/**
 * The Monthly Build's columns: `yearsBack * 12` months back, ending at the
 * current month.
 *
 * **That is thirteen columns at Years Back 1, not twelve**, and the extra one
 * is the source's rather than a mistake here: `generateMonths` walks
 * `i <= totalMonths` (`tableUtils.js:228`), so a year back is twelve months
 * PLUS the current one. Reproduced under ADR 0003 — it is a column of real
 * figures, and a port showing twelve where the live app shows thirteen is the
 * first thing finance would trip over reconciling the two.
 *
 * Oldest first, as the columns read.
 */
export function getMonthlyPeriods({
  yearsBack = 1,
  asOf,
}: PeriodColumnsOptions = {}): MisDateRange[] {
  const today = asOf ?? pacificCivilDate();
  const span = Math.max(1, Math.floor(yearsBack) * 12);
  // Walk back `span` months from the current one, then forward again — the
  // source's own arithmetic, and the reason the count is span + 1.
  let year = today.year;
  let month = today.month - span;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  const columns: MisDateRange[] = [];
  for (let step = 0; step <= span; step++) {
    const isCurrent = year === today.year && month === today.month;
    columns.push(
      periodColumn(
        monthOpening(year, month),
        endOfMonth(year, month),
        `${MONTH_ABBREVIATIONS[month - 1]} ${year}`,
        today,
        isCurrent,
      ),
    );
    if (isCurrent) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return columns;
}

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
export function columnOpeningDate(range: MisDateRange): string {
  return range.opening ?? formatCivilDate(endOfYear(Number(range.end.slice(0, 4)) - 1));
}

/**
 * The header a Build shows above an Annually column: `{opening} - {end}`.
 *
 * Both halves are balance dates, so the header says which twelve months the
 * figures beneath it cover without a reader having to open the filter bar.
 */
export const buildColumnLabel = (range: MisDateRange): string =>
  range.header ?? `${columnOpeningDate(range)} - ${range.end}`;

/**
 * The header an Exit ARR summary shows above a column: `As of {end}`.
 *
 * A summary reports a BALANCE and a Build reports a MOVEMENT, which is why the
 * two do not share `buildColumnLabel`. Exit ARR by Region and by Business Unit
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
 * `columnRangesFor` seam spec §7 leaves open, filled in Pacific Time.
 *
 * A module-level constant rather than something a screen builds, because the
 * URL contract rebuilds the whole Applied set whenever this changes identity: a
 * screen that composed it inside its render would rehydrate on every keystroke.
 *
 * It reads the clock on every call, deliberately. A session left open across
 * Pacific midnight recomputes rather than going on reporting yesterday.
 *
 */
export const pacificColumnRanges: ColumnRangesFor = (period, viewWindow, filters) => {
  // The Period decides first, because the Window belongs to Annually alone. A
  // `window=ttm` that reached a Quarterly or Monthly route is a parameter
  // already being ignored there — `allowedTypeValues` ignores it too — and
  // must not turn either Build into a trailing one.
  if (period === MIS_PERIODS.QUARTERLY) return getQuarterlyPeriods(filters);
  if (period === MIS_PERIODS.MONTHLY) return getMonthlyPeriods(filters);
  return viewWindow === MIS_WINDOWS.TTM
    ? getTtmPeriods({ yearsBack: filters.yearsBack, endingMonth: filters.endingMonth })
    : getAnnualPeriods({
        isYtd: filters.isYtd,
        endingMonth: filters.endingMonth,
        yearsBack: filters.yearsBack,
      });
};

/**
 * The ranges the SUBSCRIPTION Build's columns cover — which is not the same
 * list as the Applied set's `columnDateRanges`, on a Calendar Window.
 *
 * The source computes Annually bounds with two generators that disagree by one,
 * and the tables on the ARR Build screen read the SHORTER of the two:
 *
 *   columnDateRanges   getAnnualPeriods({yearsBack})              6 at Years Back 5
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
 * A TTM Window has no such split: there the columns ARE `columnDateRanges`.
 */
export function buildColumnRanges(
  period: MisPeriod,
  viewWindow: MisWindow,
  filters: Pick<MisAppliedFilters, "columnDateRanges" | "yearsBack">,
): readonly MisDateRange[] {
  const ranges = filters.columnDateRanges ?? [];
  // The slice below is an ANNUALLY rule and only an annual one: it exists
  // because the source computes annual bounds with two generators that
  // disagree by one. `generateQuarters` and `generateMonths` have no such
  // twin — one generator feeds both the columns and the fetch — so slicing a
  // Quarterly Build would cut seven quarters to one at the default Years Back.
  if (period !== MIS_PERIODS.ANNUALLY) return ranges;
  if (viewWindow === MIS_WINDOWS.TTM) return ranges;
  return ranges.slice(-Math.max(1, filters.yearsBack));
}

/**
 * The Software/Cloud Customers table's column ranges, which are the Build's
 * except on a Delayed type.
 *
 * On Delayed QRR the source shows **two historic quarters plus the current
 * day**, and on Delayed MRR **six historic months plus the current day**
 * (`useCustomerAccounts.js:59-133`) — "historic data plus current day", where
 * every other type gets the whole Period. The reason is the type itself: a
 * Delayed figure is revenue that has not landed yet, so a long tail of closed
 * quarters says nothing, and what a reader wants is the recent run plus where
 * it stands today.
 *
 * It is the one table with ranges of its own, which is why this is a wrapper
 * rather than a branch inside `buildColumnRanges` — the other three tables and
 * the Build itself must not see it.
 *
 * The source's branch names `quarterly` and `monthly` only, so a Delayed
 * ANNUALLY type has no special case and falls through: reproduced rather than
 * extended, since a third window nobody asked for is a figure Finance would
 * have to explain.
 */
export function customerColumnRanges(
  period: MisPeriod,
  viewWindow: MisWindow,
  filters: Pick<MisAppliedFilters, "columnDateRanges" | "yearsBack" | "qrrType" | "mrrType">,
  asOf?: MisCivilDate,
): readonly MisDateRange[] {
  const today = asOf ?? pacificCivilDate();
  if (period === MIS_PERIODS.QUARTERLY && filters.qrrType === "Delayed QRR") {
    return recentQuarters(today, 2);
  }
  if (period === MIS_PERIODS.MONTHLY && filters.mrrType === "Delayed MRR") {
    return recentMonths(today, 6);
  }
  return buildColumnRanges(period, viewWindow, filters);
}

/** `back` whole quarters, then the one still running, closing today. */
function recentQuarters(today: MisCivilDate, back: number): MisDateRange[] {
  const columns: MisDateRange[] = [];
  for (let offset = -back; offset <= 0; offset++) {
    let year = today.year;
    let quarter = quarterOf(today) + offset;
    while (quarter < 1) {
      quarter += 4;
      year -= 1;
    }
    columns.push(
      periodColumn(
        quarterOpening(year, quarter),
        endOfMonth(year, quarter * 3),
        `${year} Q${quarter}`,
        today,
        offset === 0,
      ),
    );
  }
  return columns;
}

/** `back` whole months, then the one still running, closing today. */
function recentMonths(today: MisCivilDate, back: number): MisDateRange[] {
  const columns: MisDateRange[] = [];
  for (let offset = -back; offset <= 0; offset++) {
    let year = today.year;
    let month = today.month + offset;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    columns.push(
      periodColumn(
        monthOpening(year, month),
        endOfMonth(year, month),
        `${MONTH_ABBREVIATIONS[month - 1]} ${year}`,
        today,
        offset === 0,
      ),
    );
  }
  return columns;
}

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

// The months a Flash reader is looking at, and the dates the flash backend is
// asked for.
//
// Where `misPeriods.ts` answers the Build's question — which YEARS, quarters or
// months a column covers — this answers the Flash's, which is a plain span of
// calendar months between two month pickers. The two share `misPacificTime`
// and nothing else: the Build's ranges are derived from Years Back and a
// Window, and these are simply the two months a reader chose.
//
// ---- everything here is integer arithmetic on {year, month} ----------------
//
// Spec §3 and §10.8. The source reaches its months by round-tripping ISO date
// strings through a local `Date`: `new Date("2026-09-01")` is UTC midnight,
// `.getMonth()` on it is LOCAL, and the two disagree for anyone not on UTC. In
// California that lands the whole monthly range list's dates one month early
// (`FlashConsole.js`'s `getMonthlyRangeObject`), and in Colombo every date lands
// a day early (`date.toISOString().split("T")[0]` over a local-midnight
// `Date`) — which, because the backend reads a range by its end MONTH, moves
// whole months of figures rather than a day. See `flashMonthlyRanges`. So a
// Flash reader sees a different P&L depending on where they opened it, which is
// precisely what Pacific Time being canonical exists to prevent.
//
// Nothing here parses a date. A month is two integers, a date string is built
// from them, and a date string is read by its own characters.
//
// ---- two date formats, and this file is not the Build's --------------------
//
// The ARR backend wants `yyyy/MM/dd` (`formatCivilDate`); the flash backend
// wants `yyyy-MM-dd`, which is what its own frontend sends it via
// `toLocaleDateString("sv-SE")`. Neither is converted into the other anywhere:
// they are two services, and a date crossing between them would be a bug in
// whichever screen did the crossing.

import { lastDayOfMonth, pacificCivilDate } from "./misPacificTime";

/** A calendar month, Pacific. `month` is 1–12, as a person writes it. */
export interface MisMonth {
  year: number;
  /** 1–12. */
  month: number;
}

/** One period the flash backend is asked about, in the format it wants. */
export interface MisFlashRange {
  /** `yyyy-MM-dd`. */
  startDate: string;
  /** `yyyy-MM-dd`. */
  endDate: string;
}

/**
 * How far back a Flash opens.
 *
 * Thirteen months of ranges, of which the detail views draw twelve — see
 * `flashDetailColumns`. The source arrives at the same number by building
 * thirteen first-of-month dates in a loop and taking the outermost pair.
 */
export const FLASH_MONTHS_BACK = 12;

/** Which month it is in California at `instant`. */
export function pacificMonth(instant: Date = new Date()): MisMonth {
  const { year, month } = pacificCivilDate(instant);
  return { year, month };
}

/** The month `delta` months away, rolling the year. */
export function addMonths({ year, month }: MisMonth, delta: number): MisMonth {
  // Zero-based for the arithmetic, one-based either side of it: `month - 1 + delta`
  // can go negative, and a remainder in JavaScript keeps the sign of its left
  // operand, so the floor division is what carries the borrow correctly.
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** How many months from `from` to `to`. Negative when `to` is the earlier. */
export function monthsBetween(from: MisMonth, to: MisMonth): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/** The pair of months a Flash opens on: this month, and the same month a year back. */
export function defaultFlashMonths(today: MisMonth): { start: MisMonth; end: MisMonth } {
  return { start: addMonths(today, -FLASH_MONTHS_BACK), end: today };
}

/**
 * The pair Reset goes back to — which is NOT the pair it opened on.
 *
 * `handleReset` builds its two dates with `setDate(0)`, the day BEFORE the
 * first of a month, so both land a month earlier than the pickers were showing:
 * the last completed month and the twelve before it, rather than this month and
 * the twelve before that. So Reset does not restore the view the reader
 * arrived on.
 *
 * This is the third of the three date computations in one screen — the other
 * two are `loadedFlashRange` and `searchedFlashRange` — and it is reproduced for
 * the same reason as those. Spec §8.
 */
export function resetFlashMonths(today: MisMonth): { start: MisMonth; end: MisMonth } {
  const end = addMonths(today, -1);
  return { start: addMonths(end, -FLASH_MONTHS_BACK), end };
}

/** `yyyy-MM-01`. */
export function firstOfMonth({ year, month }: MisMonth): string {
  return `${year}-${pad(month)}-01`;
}

/** `yyyy-MM-<last>`, leap years included. */
export function lastOfMonth({ year, month }: MisMonth): string {
  return `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`;
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** `yyyy-MM` — what an `<input type="month">` holds. */
export function monthInputValue({ year, month }: MisMonth): string {
  return `${year}-${pad(month)}`;
}

/**
 * The month an `<input type="month">` is holding, or nothing.
 *
 * Nothing for an empty or half-typed value, which a month input genuinely
 * produces while someone is using it — and for a month outside 1–12, which a
 * pasted value can be. The caller keeps the month it had rather than jumping to
 * whatever `new Date` would have made of it.
 */
export function monthFromInput(value: string): MisMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

/**
 * One end of the range, as the source's `filterState` holds it: the month a
 * picker is showing, and the date string that month contributes to the request.
 *
 * ---- why the two are carried together, and why that is not redundant -------
 *
 * The source asks the backend for a different date depending on whether the
 * reader TOUCHED that picker, and it does so per picker rather than per Search:
 *
 *   * the mount seeds `startMonthFilter` and `endMonthFilter` with
 *     FIRST-of-month strings (`FlashConsole.js`'s `useEffect`, via
 *     `toLocaleDateString("sv-SE")` over `dateRangeArr`);
 *   * `DateFilter.js` calls `onDateChange` from its two change handlers and
 *     from nowhere else — `setStartMonthFunc` writes `startMonthFilter` alone
 *     and `setEndMonthFunc` writes `endMonthFilter` alone — and each writes the
 *     LAST day of the month it was given;
 *   * `handleFilter` then sends whatever the two hold, unmodified.
 *
 * So a Search after moving only the Start picker asks for
 * `[last of the chosen month, FIRST of the end month]`, and a Search with
 * neither picker moved asks for exactly what the load asked for. The month a
 * picker SHOWS and the date it SENDS are genuinely two different facts, and
 * collapsing them into one loses four of the five paths.
 *
 * Reproduced rather than corrected, under ADR 0003: the two apps run in
 * parallel and Finance reconciles them path by path. Spec §8.
 */
export interface FlashMonthFilter {
  /** What the picker shows. */
  month: MisMonth;
  /** `yyyy-MM-dd` — what that end of the range sends. */
  date: string;
}

/** A month the reader has NOT moved: it sends the first of the month. */
export function loadedMonth(month: MisMonth): FlashMonthFilter {
  return { month, date: firstOfMonth(month) };
}

/**
 * A month the reader HAS moved: it sends the last of the month.
 *
 * Reset produces these too, for both ends at once — `handleReset` writes two
 * last-of-month strings straight into `filterState`, so a Search immediately
 * after a Reset sends them unchanged.
 */
export function chosenMonth(month: MisMonth): FlashMonthFilter {
  return { month, date: lastOfMonth(month) };
}

/** The two ends as the range a read is asked for. */
export function flashRangeOf(start: FlashMonthFilter, end: FlashMonthFilter): MisFlashRange {
  return { startDate: start.date, endDate: end.date };
}

/** One month of a detail view, and the range that asks the backend for it. */
export interface FlashMonthlyRange extends MisFlashRange {
  /**
   * The month this range is FOR. Carried beside the dates because neither date
   * falls on that month's first day, so reading it back off one of them is a
   * rule a later reader would have to rediscover.
   */
  month: MisMonth;
}

/**
 * One range per month from `start` to `end`, both included, oldest first.
 *
 * ---- month M is asked for as `[last of M−1, last of M]` --------------------
 *
 * Not the obvious pair, which is `[first of M, first of M+1]` — ticket 15 sent
 * that one, and it was wrong. The flash backend reads one range two ways:
 *
 *   * every financial account — Revenue, Cost of Sales and everything below
 *     them — is summed over `month > SUBSTRING(startDate, 1, 7) AND month <=
 *     SUBSTRING(endDate, 1, 7)` (`entity-service/modules/database/
 *     transaction.bal`, in every group search), so a range is its END month;
 *   * ARR and Booking read the two dates as instants: opening at the start,
 *     closing at the end (`flash-backend/modules/compute/arr_bookings.bal`).
 *
 * So `[first of M, first of M+1]` is month M for ARR and month M+1 for every
 * financial account, and a detail view built on it showed each column's
 * Revenue a month late under its own header. `[last of M−1, last of M]` is M
 * for both halves.
 *
 * It is also exactly what the source sends from Colombo, where Finance works:
 * `getMonthlyRangeObject` builds local midnights and serialises them with
 * `toISOString`, which east of UTC lands each on the day before. From UTC or
 * California it sends `[first of M−1, first of M]` for the column it heads M —
 * the right financial accounts, and ARR a month early. Spec §8 has the table.
 * The port writes the Colombo answer out as arithmetic rather than recovering
 * it from a `Date`, which is the only way to send it from every zone.
 *
 * ---- and what does not reach this ------------------------------------------
 *
 * The two date STRINGS the balance statement is asked for. The source derives
 * its monthly ranges from them but only ever reads the month off each, so
 * first-of-month and last-of-month produce the same list. Taking the months
 * directly says that, instead of leaving it to be rediscovered.
 *
 * Empty when the months are the wrong way round. The pickers hold each other
 * apart, so that is a link or a state restored from somewhere rather than
 * something a reader can do — and an empty list reaches the screen as a detail
 * view with no columns rather than as a backwards one.
 */
export function flashMonthlyRanges(start: MisMonth, end: MisMonth): FlashMonthlyRange[] {
  const span = monthsBetween(start, end);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, offset) => {
    const month = addMonths(start, offset);
    return { month, startDate: lastOfMonth(addMonths(month, -1)), endDate: lastOfMonth(month) };
  });
}

/** One column of a detail view: a month, and where it sits in the response. */
export interface FlashDetailColumn {
  /** The index into a response's `summary` array. */
  index: number;
  range: FlashMonthlyRange;
}

/**
 * The months a detail view draws, out of the months it asked for.
 *
 * **The oldest is dropped.** The source's monthly grid declares twelve numeric
 * columns, `"1"` through `"12"`, each reading `summary[<its own field>]` — so
 * `summary[0]` is fetched and never rendered (`MonthlyViewTable.js:126-292`).
 * Its tab label agrees, spanning `dateRangeArr[1]` to the last range.
 *
 * The range is still REQUESTED, and deliberately: the backend walks the list it
 * is given in order and a month's opening figures are the previous month's
 * closing ones, so dropping the oldest from the body could change the figures
 * in the columns that are drawn. ADR 0001 — the backends are not touched, and
 * that includes not second-guessing what they do with a request.
 *
 * The same shape as spec §9's sixth Annual Period: a range computed and fetched
 * on every read, and drawn by nothing.
 */
export function flashDetailColumns(ranges: readonly FlashMonthlyRange[]): FlashDetailColumn[] {
  return ranges.slice(1).map((range, offset) => ({ index: offset + 1, range }));
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * How a month column is headed: `Jan 2026`.
 *
 * From the month itself. The source's `formatHeader` reads the characters of
 * `period.endDate`, which with these ranges names the same month — and which is
 * the RIGHT month, for the financial accounts at least, in every zone: the
 * backend sums a range under its end month (see `flashMonthlyRanges`). Ticket
 * 15 recorded that header as a defect and headed by the start date instead;
 * spec §8 says what that cost.
 *
 * Empty for a month outside 1–12. A header is a label, and a label that cannot
 * be built should be absent rather than `undefined 2026`.
 */
export function flashMonthLabel({ year, month }: MisMonth): string {
  const label = MONTH_LABELS[month - 1];
  return label ? `${label} ${year}` : "";
}

/**
 * The span a detail view is headed with — the source's `ytdRange`.
 *
 * It names the months actually DRAWN, not the ones fetched: it begins at the
 * second range, which is exactly the one `flashDetailColumns` begins at.
 */
export function flashRangeLabel(ranges: readonly FlashMonthlyRange[]): string {
  const drawn = flashDetailColumns(ranges);
  if (!drawn.length) return "";
  return `${drawn[0].range.startDate} to ${drawn[drawn.length - 1].range.endDate}`;
}

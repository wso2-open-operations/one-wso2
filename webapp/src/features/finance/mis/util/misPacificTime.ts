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

// The clock every MIS Period is measured on, and the calendar arithmetic that
// goes with it.
//
// Pacific Time is canonical for Finance MIS — not the viewer's zone and not UTC
// (CONTEXT.md, spec §3). A Period boundary is a business fact: the year a figure
// lands in is decided in California, and a reader in Colombo has to be shown the
// same one.
//
// Two rules hold this file together, and both exist because breaking either is
// silent:
//
// 1. **The zone is named, never offset.** Pacific observes DST, so the
//    fixed-offset trick in `features/menu/util/menuTime.ts` is not reusable
//    here: it is right for IST, which has no transitions, and wrong for this by
//    an hour for eight months of the year. `Intl.DateTimeFormat` with
//    `timeZone: "America/Los_Angeles"` and `formatToParts` is the only thing
//    that knows when the transitions are.
//
// 2. **Nothing round-trips through a local `Date`.** Once an instant has been
//    reduced to a Pacific calendar date, every subsequent step — a year back, a
//    last-of-month, the day after — is arithmetic on those three numbers.
//    `new Date(2026, 0, 1)` is midnight in the HOST's zone, so reading Pacific
//    parts back out of it yields 31 December 2025 for anyone east of California.
//    That is spec §10.8's test, and it is the reason these helpers are plain
//    integer arithmetic rather than `Date` maths.
//
// `instant` is always a parameter. It defaults to now for callers that genuinely
// mean now, but every rule here can be pinned to a moment by a test.

/** The canonical business timezone. Spelled once, and only here. */
const PACIFIC_TIME_ZONE = "America/Los_Angeles";

/**
 * A date on the Pacific calendar, with no time and no zone left in it.
 *
 * `month` is 1–12, as a person writes it — not `Date`'s 0–11. Nothing here is a
 * `Date`, so there is no convention to match and one fewer off-by-one to make.
 */
export interface MisCivilDate {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
}

// Built once. A formatter carrying an explicit `timeZone` is immune to the
// host's — which is the whole point — so there is nothing per-call to vary.
const CIVIL_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ZONE_NAME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  timeZoneName: "short",
});

const namedParts = (
  formatter: Intl.DateTimeFormat,
  instant: Date,
): Partial<Record<Intl.DateTimeFormatPartTypes, string>> => {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return parts;
};

/** Which day it is in California at `instant`. */
export function pacificCivilDate(instant: Date = new Date()): MisCivilDate {
  const parts = namedParts(CIVIL_DATE_FORMAT, instant);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/**
 * `PST` or `PDT`, whichever California is actually on at `instant`.
 *
 * Falls back to `PT` only if the runtime declines to name the zone. That is not
 * hypothetical — a stripped-down ICU build resolves every zone to UTC — and a
 * chip reading "Pacific Time (GMT+0)" would state something false, where
 * "Pacific Time (PT)" merely states less.
 */
export function pacificZoneAbbreviation(instant: Date = new Date()): string {
  const named = namedParts(ZONE_NAME_FORMAT, instant).timeZoneName;
  return named === "PST" || named === "PDT" ? named : "PT";
}

/**
 * The permanent chip every MIS screen carries: `Pacific Time (PDT)`.
 *
 * Derived from the same instant as the boundaries, so the label cannot drift
 * from the dates it is describing — spec §10.9.
 */
export function pacificTimeLabel(instant: Date = new Date()): string {
  return `Pacific Time (${pacificZoneAbbreviation(instant)})`;
}

/** `yyyy/MM/dd` — the shape both MIS backends want a date in. */
export function formatCivilDate({ year, month, day }: MisCivilDate): string {
  return `${year}/${pad(month)}/${pad(day)}`;
}

const pad = (value: number): string => String(value).padStart(2, "0");

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** How many days month `month` (1–12) of `year` has. */
export function lastDayOfMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** 1 January of `year`. */
export const startOfYear = (year: number): MisCivilDate => ({ year, month: 1, day: 1 });

/** 31 December of `year`. */
export const endOfYear = (year: number): MisCivilDate => ({ year, month: 12, day: 31 });

/** The last day of month `month` (1–12) in `year`. */
export const endOfMonth = (year: number, month: number): MisCivilDate => ({
  year,
  month,
  day: lastDayOfMonth(year, month),
});

/**
 * The same month and day, `delta` years away, clamped into the month.
 *
 * 29 February has no counterpart in a common year. Clamping to the 28th is what
 * the source does, and it is what a TTM window opening on a leap day has to do:
 * the alternative — rolling into 1 March, which `Date` would do silently — moves
 * a window boundary past a month end and mis-attributes a day of revenue.
 */
export function addYears({ year, month, day }: MisCivilDate, delta: number): MisCivilDate {
  const shifted = year + delta;
  return { year: shifted, month, day: Math.min(day, lastDayOfMonth(shifted, month)) };
}

/** The day after, rolling the month and the year. */
export function nextDay({ year, month, day }: MisCivilDate): MisCivilDate {
  if (day < lastDayOfMonth(year, month)) return { year, month, day: day + 1 };
  if (month < 12) return { year, month: month + 1, day: 1 };
  return { year: year + 1, month: 1, day: 1 };
}

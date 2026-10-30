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

// Date helpers for the Leave feature. Native Date only (no dayjs / date
// picker lib in one-wso2). `YYYY-MM-DD` strings are parsed in the LOCAL
// calendar to avoid the UTC-midnight off-by-one that new Date("YYYY-MM-DD")
// causes for users west of UTC.

const MS_PER_DAY = 86_400_000;

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse "YYYY-MM-DD[...]" as a local calendar day at midnight. Returns null
// if the string isn't a recognisable ISO date.
export function parseIso(input: string | null | undefined): Date | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

export function startOfYearIso(year: number): string {
  return `${year}-01-01`;
}

export function endOfYearIso(year: number): string {
  return `${year}-12-31`;
}

// Inclusive calendar-day span between two ISO dates (a=b → 1). Returns 0
// when either date is unparseable or end < start.
export function calendarDaysInclusive(startIso: string, endIso: string): number {
  const a = parseIso(startIso);
  const b = parseIso(endIso);
  if (!a || !b) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
  return diff < 0 ? 0 : diff + 1;
}

// "Aug 15, 2026" — from an ISO date string.
export function formatNice(input: string | null | undefined): string {
  const d = parseIso(input);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Month abbreviation ("AUG") + day number, for the mini-calendar chip.
export function monthAbbr(input: string | null | undefined): string {
  const d = parseIso(input);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

export function dayNumber(input: string | null | undefined): string {
  const d = parseIso(input);
  if (!d) return "";
  return String(d.getDate());
}

// Whole days between `iso` and today (or `today`, for tests), positive when
// `iso` is in the past.
export function daysAgo(iso: string | null | undefined, today: Date = new Date()): number {
  const d = parseIso(iso);
  if (!d) return 0;
  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  return Math.round((t0.getTime() - d.getTime()) / MS_PER_DAY);
}

/**
 * "MMM YYYY" for an entitlement period boundary — `LeaveBalanceSummary.tsx:63-66`.
 * Returns null for anything unparseable so the caller can drop the label rather
 * than render "Invalid Date".
 */
export function monthYear(input: string | null | undefined): string | null {
  const d = parseIso(input);
  if (!d) return null;
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

/**
 * The period a balance row covers — `LeaveBalanceSummary.tsx:148-152`.
 *
 * RTT and sick are always reported over the calendar year; everything else uses
 * the entitlement's own window, which for congés payés is not the calendar year.
 * Null when the entitlement carries no period, matching the source's
 * `formatPeriod` returning undefined and the chip then not rendering.
 */
export function entitlementPeriodLabel(
  usesCalendarYear: boolean,
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
): string | null {
  if (usesCalendarYear) {
    const year = new Date().getFullYear();
    return `${monthYear(startOfYearIso(year))} – ${monthYear(endOfYearIso(year))}`;
  }
  const from = monthYear(periodStart);
  const to = monthYear(periodEnd);
  return from && to ? `${from} – ${to}` : null;
}

/**
 * The date as the sabbatical tables print it — `String(value).substring(0, 10)`,
 * ApproveLeaveTable.tsx:105 and ApprovalHistoryTable.tsx:39. Deliberately not
 * reformatted: slicing the ISO string cannot shift the day, which is what
 * `new Date(...)` does west of UTC elsewhere in the source.
 */
export function isoDay(value: string | null | undefined): string {
  return String(value ?? "").substring(0, 10);
}

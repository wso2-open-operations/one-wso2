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

import type { DashboardAnnouncement, GroupSort, ScorecardMeasure, SortDir } from "../api/amplifyTypes";

/** A whole number with thousands separators. */
export function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US");
}

/** A 0..1 rate as a whole percent, e.g. 0.667 -> "67%". */
export function rate(r: number | null | undefined): string {
  return `${Math.round((r ?? 0) * 100)}%`;
}

/** part / whole as a whole percent, "-" when there is no whole. */
export function percentOf(part: number, whole: number | null | undefined): string {
  if (!whole) return "-";
  return `${Math.round((part / whole) * 100)}%`;
}

/** This period against the one before: "+23 vs previous", "same as previous", "-4 vs previous". */
export function deltaText(now: number, before: number, noun = "previous period"): string {
  const d = now - before;
  if (d === 0) return `same as ${noun}`;
  return `${d > 0 ? "+" : "-"}${num(Math.abs(d))} vs ${noun}`;
}

/** Percent change between two counts, "-" when there is nothing to compare with. */
export function changePercent(now: number, before: number): string {
  if (before <= 0) return "-";
  const c = Math.round(((now - before) / before) * 100);
  return `${c >= 0 ? "+" : "-"}${Math.abs(c)}%`;
}

/** An ISO timestamp as "Oct 21". */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Oct 2026" for the month an ISO date falls in (UTC). */
export function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Oct 20 - Nov 19" for a post's window. */
export function windowText(opensAt: string, closesAt: string): string {
  return `${shortDate(opensAt)} – ${shortDate(closesAt)}`;
}

/** The Novera announcement's state in words. Queued means the outbox is still retrying it. */
export function announcementLabel(a: DashboardAnnouncement | undefined): string {
  if (!a || a.status === "NONE") return "Not announced";
  if (a.status === "SENT") return "Sent";
  if (a.status === "FAILED") return "Failed after retries";
  return a.attempts && a.attempts > 0 ? `Retrying · attempt ${a.attempts}` : "Queued";
}

/** A scorecard value with its unit, e.g. "18%" or "187". */
export function measureValue(m: Pick<ScorecardMeasure, "unit" | "value">): string {
  const v = Math.round(m.value * 10) / 10;
  return m.unit === "PERCENT" ? `${v}%` : num(v);
}

/** The target in words: "at least 25%" or "at most 5%". */
export function targetText(m: ScorecardMeasure): string {
  const v = Math.round(m.target * 10) / 10;
  const t = m.unit === "PERCENT" ? `${v}%` : num(v);
  return `${m.comparison === "AT_MOST" ? "At most" : "At least"} ${t}`;
}

/** The "42 / 150" detail under a scorecard value, when the API gave both numbers. */
export function fraction(m: ScorecardMeasure): string | null {
  if (m.numerator == null || m.denominator == null) return null;
  return `${num(m.numerator)} / ${num(m.denominator)}`;
}

/** One zone's clock as "3:05 PM" plus its short zone name. */
function clockIn(d: Date, timeZone: string): { time: string; zone: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { time: `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`, zone: get("timeZoneName") };
}

/**
 * The data's age on every board, in three zones on one line:
 * "Updated 3:05 PM LK | Updated 5:35 AM EDT | Updated 9:35 AM UTC".
 * LK is Sri Lanka (Asia/Colombo, UTC+5:30); the US Eastern label follows the date (EST or EDT).
 */
export function updatedStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const lk = clockIn(d, "Asia/Colombo");
  const east = clockIn(d, "America/New_York");
  const utc = clockIn(d, "UTC");
  return `Updated ${lk.time} LK | Updated ${east.time} ${east.zone} | Updated ${utc.time} UTC`;
}

/** Plain reposts: the total less those with the employee's own comment. */
export function plainReposts(c: { reposts: number; repostsWithCommentary?: number }): number {
  return Math.max(0, c.reposts - (c.repostsWithCommentary ?? 0));
}

/** Reposts that carry the employee's own comment. */
export function commentedReposts(c: { reposts: number; repostsWithCommentary?: number }): number {
  return Math.min(c.reposts, c.repostsWithCommentary ?? 0);
}

/**
 * The next sort for a click on a column header. A new numeric column starts largest-on-top (desc); a new
 * Team column starts A to Z (asc); `#` starts at rank 1 on top (asc), since rank 1 is the largest score;
 * clicking the active column toggles.
 */
export function nextSort(current: { sort: GroupSort; dir: SortDir }, col: GroupSort): { sort: GroupSort; dir: SortDir } {
  if (current.sort === col) return { sort: col, dir: current.dir === "asc" ? "desc" : "asc" };
  return { sort: col, dir: col === "name" || col === "rank" ? "asc" : "desc" };
}

/** How a scorecard measure draws as a bar. Positions are fractions of the bar's width, 0 to 1. */
export interface ScoreBar {
  /** How much of the bar is filled: the current value on the bar's scale. */
  fill: number;
  /** Where the target (or the ceiling) is marked on the same scale. */
  tick: number;
  /** The words under the mark, "Target 25%", "Ceiling 5%" or "Target 100". */
  tickLabel: string;
  /** For `role="progressbar"`: the scale's top and the value on it, in the measure's own unit. */
  max: number;
  now: number;
  /** The words for assistive tech, e.g. "18% of 25% target". */
  text: string;
}

/** A value in the measure's unit, whole or to one decimal, e.g. "25%" or "187". */
function inUnit(m: Pick<ScorecardMeasure, "unit">, v: number): string {
  const r = Math.round(v * 10) / 10;
  return m.unit === "PERCENT" ? `${r}%` : num(r);
}

/**
 * The fill maths for a scorecard bar, on one scale for the value and the mark.
 *  - PERCENT: the bar is 0 to 100%. The fill is the value, the mark sits at the target (AT_LEAST) or the ceiling
 *    (AT_MOST), so a 25% target is a quarter of the way along.
 *  - COUNT: the bar runs to max(value, target) * 1.25, so a value over target still shows the mark inside the bar.
 * Out-of-range and non-finite numbers are clamped.
 */
export function scoreBar(m: Pick<ScorecardMeasure, "unit" | "value" | "target" | "comparison">): ScoreBar {
  const value = Math.max(0, Number.isFinite(m.value) ? m.value : 0);
  const target = Math.max(0, Number.isFinite(m.target) ? m.target : 0);
  const max = m.unit === "PERCENT" ? 100 : Math.max(value, target, 0) * 1.25 || 1;
  const ceiling = m.comparison === "AT_MOST";
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return {
    fill: clamp(value / max),
    tick: clamp(target / max),
    tickLabel: `${ceiling ? "Ceiling" : "Target"} ${inUnit(m, target)}`,
    max,
    now: Math.min(value, max),
    text: ceiling ? `${inUnit(m, value)} against a ${inUnit(m, target)} ceiling` : `${inUnit(m, value)} of ${inUnit(m, target)} target`,
  };
}

export type ExportPeriod = "day" | "week" | "month" | "year";

/** The longest export the API takes, in days. */
export const EXPORT_MAX_DAYS = 366;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The UTC date range a Day / Week / Month / Year pill stands for, ending today: today; Monday to today;
 * the 1st to today; 1 January to today. Same calendar the Operations points tiles use.
 */
export function exportRange(period: ExportPeriod, now: Date = new Date()): { from: string; to: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today);
  if (period === "week") start.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  if (period === "month") start.setUTCDate(1);
  if (period === "year") start.setUTCMonth(0, 1);
  return { from: isoDay(start), to: isoDay(today) };
}

/** Why a from/to pair can't be exported, or null when it can. */
export function exportRangeProblem(from: string, to: string): string | null {
  if (!from || !to) return "Pick both dates.";
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return "Pick both dates.";
  if (b < a) return "The end date is before the start date.";
  if ((b - a) / 86_400_000 + 1 > EXPORT_MAX_DAYS) return `Pick at most ${EXPORT_MAX_DAYS} days.`;
  return null;
}

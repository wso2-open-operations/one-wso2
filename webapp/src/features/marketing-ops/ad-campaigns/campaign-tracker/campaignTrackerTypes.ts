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

// Row shapes + picklists for the three campaign-tracking tabs — Register,
// Weekly Log, Budget Pacing — ported from Marketing Ops' campaign-tracker
// (frontend/operations/ad-campaigns/campaign-tracker/types.ts), which itself
// was scoped from a source spreadsheet's columns/formulas. The backend
// contract (campaign_tracker/store.py, linkedin_snapshot.py) is unchanged by
// this port. Computed columns (Days Since Review, Flag, Expected/Actual Pace
// %, Variance, Pacing Flag) are derived client-side by the functions below,
// mirroring the original sheet's formulas.

export const BUSINESS_UNITS = ["IAM", "Integration", "CRoP", "Other", "Solutions", "APIM"] as const;
export type BusinessUnit = (typeof BUSINESS_UNITS)[number];

export const AD_PLATFORMS = ["Google Ads", "LinkedIn"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const CAMPAIGN_STATUSES = ["Active", "Watch", "Paused", "Ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// 'Not Set' is the initial state of an auto-created (Google Ads-derived) log
// entry — nobody has actually reviewed/assigned it a status yet.
export const LOG_STATUSES = ["Not Set", "Not Started", "In Progress", "Completed"] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];

export const ENTRY_TYPES = [
  "Routine Optimization",
  "Major Change",
  "Launch",
  "Pause",
  "Budget Change",
  "Creative Change",
  "Targeting Change",
  "Escalation",
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export type RegisterFlag = "OK" | "REVIEW OVERDUE" | "NEVER REVIEWED" | "PAST END DATE" | "—";

export const PACING_FLAGS = ["ON TRACK", "OVERSPENDING", "UNDERSPENDING"] as const;
export type PacingFlag = (typeof PACING_FLAGS)[number];

export interface CampaignRegisterRow {
  id: string;
  bu: BusinessUnit;
  platform: AdPlatform;
  campaignName: string;
  objective: string;
  owner: string;
  startDate: string;
  endDate: string | null;
  monthlyBudget: number;
  // LinkedIn only (null for Google Ads): monthlyBudget is the vendor's own
  // totalBudget when set, else derived as dailyBudget * days-in-month;
  // dailyBudget is the vendor's own dailyBudget when set, else derived as
  // monthlyBudget / days-in-month — each *IsDerived flag says which case
  // that field got.
  monthlyBudgetIsDerived: boolean | null;
  dailyBudget: number | null;
  dailyBudgetIsDerived: boolean | null;
  actualCpl: number | null;
  // True when actualCpl is a live spend/conversions default rather than a
  // human-typed override — the UI uses this to show a "Calculated" badge, and
  // actualCplCalculation to explain it on hover. False/absent whenever a
  // human has set actualCpl via the Register edit form.
  actualCplIsComputed: boolean;
  actualCplCalculation?: { spend: number; conversions: number; windowStart: string; windowEnd: string };
  targetCpl: number | null;
  status: CampaignStatus;
  lastReviewed: string | null;
}

// A Weekly Log row is a "work session" (group); the actual changes made
// during it are its entries. Entry type/what-changed live per entry — not on
// the group — because one session can span multiple kinds of change (e.g. a
// Budget Change on one ad group and a Creative Change on another).
export interface WeeklyLogChangeDetail {
  label: string;
  oldValue: string;
  newValue: string;
}

export interface WeeklyLogEntryRow {
  id: string;
  entryType: EntryType;
  // Short, field-labels-only summary (e.g. "Budget amount") — for the
  // compact table row. changeDetails has the full readable diff (field +
  // old/new value) for the full-view popup; empty for CREATE/REMOVE/manual
  // entries, which have nothing structured to show.
  whatChanged: string;
  changeDetails: WeeklyLogChangeDetail[];
  occurredAt: string; // ISO datetime
  // Marked "unlog" by an operator (junk/not worth tracking) — excluded from
  // the default Weekly Log fetch server-side; only present at all when the
  // "Show unlogged" toggle asked for it.
  isUnlogged: boolean;
}

export interface WeeklyLogRow {
  id: string;
  completedDate: string;
  owner: string;
  status: LogStatus;
  bu: BusinessUnit;
  platform: AdPlatform;
  campaignName: string;
  why: string;
  expectedImpact: string;
  followUpDate: string | null;
  outcome: string;
  entries: WeeklyLogEntryRow[];
}

export interface BudgetPacingRow {
  id: string;
  month: string;
  bu: BusinessUnit;
  platform: AdPlatform;
  campaign: string;
  monthlyBudget: number;
  // LinkedIn only (null for Google Ads and manual rows) — see
  // CampaignRegisterRow's fields of the same name.
  monthlyBudgetIsDerived: boolean | null;
  dailyBudget: number | null;
  dailyBudgetIsDerived: boolean | null;
  mtdSpend: number;
  asOfDate: string;
  // Only rows added by hand via "Add pacing row" carry this — Google Ads rows
  // (fetched live) and the seeded LinkedIn rows don't, so only a manually
  // created row can be deleted (see BudgetPacingTable's delete action).
  isManual?: boolean;
}

const DAY_MS = 86_400_000;
const todayISO = () => new Date().toISOString().slice(0, 10);

// Accepts a bare date ("2026-01-05") or a full ISO timestamp
// ("2026-01-05T00:00:00Z") and reads only the date prefix — the time
// component (if any) is irrelevant to the day-level arithmetic below. Returns
// null rather than an Invalid Date so callers can fall back instead of
// propagating NaN through pacing math.
function parseISODateUTC(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

// A date-only string ("2026-01-05") rendered with toLocaleDateString needs to
// be built from local Y/M/D parts, not parsed as UTC-midnight — otherwise a
// viewer west of UTC sees the previous day. Use this (not `new Date(iso)`)
// wherever a date-only field is formatted for display.
export function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysSinceReview(lastReviewed: string | null): number | null {
  if (!lastReviewed) return null;
  const parsed = parseISODateUTC(lastReviewed);
  return parsed ? Math.floor((Date.now() - parsed.getTime()) / DAY_MS) : null;
}

// Mirrors: =IF(C="","",IF(OR(status="Ended",status="Paused"),"—",
//   IF(AND(end<>"",end<TODAY()),"PAST END DATE",
//   IF(lastReviewed="","NEVER REVIEWED",
//   IF(TODAY()-lastReviewed>14,"REVIEW OVERDUE","OK")))))
export function registerFlag(row: CampaignRegisterRow): RegisterFlag {
  if (!row.campaignName.trim()) return "—";
  if (row.status === "Ended" || row.status === "Paused") return "—";
  if (row.endDate && row.endDate < todayISO()) return "PAST END DATE";
  if (!row.lastReviewed) return "NEVER REVIEWED";
  const since = daysSinceReview(row.lastReviewed) ?? 0;
  return since > 14 ? "REVIEW OVERDUE" : "OK";
}

function paceForDate(d: Date): number {
  const daysInThisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return d.getUTCDate() / daysInThisMonth;
}

// Falls back to today's pace when asOfDate can't be parsed, rather than
// letting an invalid date produce NaN variance/flags for the whole row.
export function expectedPace(asOfDate: string): number {
  const parsed = parseISODateUTC(asOfDate) ?? parseISODateUTC(todayISO())!;
  return paceForDate(parsed);
}

export function actualPace(mtdSpend: number, monthlyBudget: number): number {
  return monthlyBudget > 0 ? mtdSpend / monthlyBudget : 0;
}

export function pacingVariance(row: BudgetPacingRow): number {
  return actualPace(row.mtdSpend, row.monthlyBudget) - expectedPace(row.asOfDate);
}

// Same variance as pacingVariance, in dollars instead of a normalized ratio:
// what's actually been spent minus what would have been spent by today if
// pacing were exactly on schedule. Positive = ahead of budget, negative = behind.
export function pacingVarianceDollars(row: BudgetPacingRow): number {
  return row.mtdSpend - row.monthlyBudget * expectedPace(row.asOfDate);
}

export function pacingFlag(row: BudgetPacingRow): PacingFlag {
  const v = pacingVariance(row);
  if (v > 0.15) return "OVERSPENDING";
  if (v < -0.15) return "UNDERSPENDING";
  return "ON TRACK";
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

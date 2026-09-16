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

/**
 * What the History screen's Advanced Filter is narrowing by, and how it says so.
 *
 * Kept out of the component because the interesting parts are decidable without
 * a DOM: which filters count as *active*, what each one's chip reads, and what
 * clearing one puts it back to. `HistoryFilterPopover.tsx:67-111` is the source.
 */

import type { CcTxnStatus } from "./ccTypes";

/** The "no narrowing" value, `FILTER_ALL` in the source. */
export const ALL = "all";

/** Where every filter sits when nothing has been narrowed (`:88-94`). */
export const CC_HISTORY_DEFAULTS = {
  status: "submitted" as CcTxnStatus | typeof ALL,
  lead: ALL,
  user: ALL,
  card: ALL,
  days: 7,
} as const;

export interface CcHistoryFilterState {
  status: CcTxnStatus | typeof ALL;
  lead: string;
  user: string;
  card: string;
  days: number;
}

export type CcHistoryFilterName = "Status" | "Lead" | "User" | "Card" | "Period";

/**
 * The periods the source offers (`FilterMenu.tsx:89-114`).
 *
 * "All Time" is 12600 days there — about 34 years, which is its way of saying
 * "no lower bound" to a backend that insists on one. Kept as the same number
 * rather than reinvented, so the request this screen makes matches.
 */
export const CC_HISTORY_PERIODS: { days: number; label: string }[] = [
  { days: 7, label: "Last 7 Days" },
  { days: 30, label: "Last 30 Days" },
  { days: 60, label: "Last 60 Days" },
  { days: 100, label: "Last 100 Days" },
  { days: 365, label: "Last Year" },
  { days: 12600, label: "All Time" },
];

/**
 * The statuses the filter offers.
 *
 * The source's list is mandatory — four statuses and no way out of them. Ours
 * keeps an **All statuses** option on the end, which is strictly more than the
 * source can do and costs nothing; it is recorded as a deviation in the spec.
 */
export const CC_HISTORY_STATUSES: { value: CcTxnStatus | typeof ALL; label: string }[] = [
  { value: "submitted", label: "Completed" },
  { value: "pending_finance", label: "Pending Finance" },
  { value: "pending_lead", label: "Pending Lead" },
  { value: "new", label: "Pending Submission" },
  { value: ALL, label: "All statuses" },
];

/**
 * Which fields the popover shows, given who is looking and what is selected.
 *
 * Two of the five come and go, and both conditions are the source's:
 *
 *  - **Lead** is finance's alone, and only once the rows could even have one —
 *    a transaction still with its lead, or one already booked (`:172`).
 *  - **Period** appears only while the status is the default, `submitted`
 *    (`:223`). The chosen period still governs the request when it is hidden,
 *    which is a trap worth knowing: narrowing to Pending Lead does not widen
 *    the window back to seven days.
 */
export function ccHistoryFieldsShown(
  state: CcHistoryFilterState,
  viewer: { canSeeOthers: boolean; isFinance: boolean },
) {
  return {
    status: true,
    lead:
      viewer.isFinance &&
      (state.status === "pending_finance" || state.status === "submitted"),
    user: viewer.canSeeOthers,
    card: true,
    period: state.status === "submitted",
  };
}

/**
 * The filters currently narrowing the list, in the source's own order
 * (`:67-78`).
 *
 * A filter is active only when it is off its default — which is why Status
 * counts only when it is not `submitted`, and Period only when it is not seven
 * days. Period is further gated on the status, because the source hides both
 * the control and its chip together.
 */
export function ccHistoryActiveFilters(
  state: CcHistoryFilterState,
  viewer: { canSeeOthers: boolean; isFinance: boolean },
): CcHistoryFilterName[] {
  const shown = ccHistoryFieldsShown(state, viewer);
  const active: CcHistoryFilterName[] = [];
  if (state.status !== CC_HISTORY_DEFAULTS.status) active.push("Status");
  if (shown.lead && state.lead !== ALL) active.push("Lead");
  if (viewer.canSeeOthers && state.user !== ALL) active.push("User");
  if (state.card !== ALL) active.push("Card");
  if (shown.period && state.days !== CC_HISTORY_DEFAULTS.days) active.push("Period");
  return active;
}

/**
 * What one filter's chip reads — `${name}: ${value}` (`:96-111`).
 *
 * Status and Period print their label rather than their stored value, so a chip
 * says "Period: Last 30 Days" and not "Period: 30". The rest are already
 * readable: an email, or a card number.
 */
export function ccHistoryChipLabel(
  name: CcHistoryFilterName,
  state: CcHistoryFilterState,
): string {
  switch (name) {
    case "Status":
      return `Status: ${CC_HISTORY_STATUSES.find((s) => s.value === state.status)?.label ?? state.status}`;
    case "Period":
      return `Period: ${CC_HISTORY_PERIODS.find((p) => p.days === state.days)?.label ?? state.days}`;
    case "Lead":
      return `Lead: ${state.lead}`;
    case "User":
      return `User: ${state.user}`;
    case "Card":
      return `Card: ${state.card}`;
  }
}

/**
 * Clearing one chip puts that filter back to its default and touches nothing
 * else (`:245-262`). Deliberately a patch rather than a whole state, so the
 * caller cannot lose a filter it did not mean to clear.
 */
export function ccHistoryClear(name: CcHistoryFilterName): Partial<CcHistoryFilterState> {
  switch (name) {
    case "Status":
      return { status: CC_HISTORY_DEFAULTS.status };
    case "Lead":
      return { lead: ALL };
    case "User":
      return { user: ALL };
    case "Card":
      return { card: ALL };
    case "Period":
      return { days: CC_HISTORY_DEFAULTS.days };
  }
}

/** Reset puts every filter back at once (`:88-94`). */
export function ccHistoryResetAll(): CcHistoryFilterState {
  return { ...CC_HISTORY_DEFAULTS };
}

/**
 * The card options, narrowed to whoever is selected and marked when the card is
 * closed (`:200-221`).
 *
 * History is the one screen that asks the backend for inactive cards, and this
 * is what the marking is for: a transaction can outlive the card it was made
 * on, and the reader needs to know that is why the card looks unfamiliar.
 *
 * The value stays the bare number — the source strips the suffix again with
 * `.split(" ")[0]` when it filters, which is a round trip worth not repeating.
 */
export function ccHistoryCardOptions(
  cards: { ccNumber: string; employeeEmail: string; status: string }[],
  selectedUser: string,
): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const c of cards) {
    if (selectedUser !== ALL && c.employeeEmail !== selectedUser) continue;
    if (seen.has(c.ccNumber)) continue;
    seen.add(c.ccNumber);
    const active = (c.status ?? "").toLowerCase() === "active";
    out.push({ value: c.ccNumber, label: active ? c.ccNumber : `${c.ccNumber} (Inactive)` });
  }
  return out.sort((a, b) => a.value.localeCompare(b.value));
}

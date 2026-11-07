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

// My Approvals as a list like the Quotes page (D144): searched, filtered by
// deadline, sorted and grouped in the browser. Pure functions, unit-tested.
// Groups only organise rows, with no totals (as D70).

import type { ApprovalInboxItem, SlaState } from "@features/sales/cado2/approvals/api/approvalTypes";
import type { ListSort } from "@features/sales/cado2/components/list-table/listTable";

/** Case-insensitive match on quote number, account, opportunity or submitter. */
export function searchInbox(items: readonly ApprovalInboxItem[], search: string): ApprovalInboxItem[] {
  const term = search.trim().toLowerCase();
  if (!term) return [...items];
  return items.filter((it) =>
    [it.quoteNumber, it.accountName, it.opportunityName, it.submittedByEmail].some((f) => f?.toLowerCase().includes(term)),
  );
}

/** The deadline filter: every step, or those in one SLA state. */
export type DeadlineFilter = "ALL" | SlaState;

export const DEADLINE_FILTERS: readonly { readonly value: DeadlineFilter; readonly label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "BREACHED", label: "Overdue" },
  { value: "AT_RISK", label: "At risk" },
  { value: "ON_TRACK", label: "On track" },
];

export function filterByDeadline(items: readonly ApprovalInboxItem[], deadline: DeadlineFilter): ApprovalInboxItem[] {
  return deadline === "ALL" ? [...items] : items.filter((it) => it.slaState === deadline);
}

/** A column My Approvals sorts on. */
export type InboxSortKey = "quote" | "account" | "opportunity" | "role" | "submitter" | "value" | "deadline" | "waiting";
export type InboxSort = ListSort<InboxSortKey>;

/** Most urgent first: the order the inbox arrives in. */
export const DEFAULT_INBOX_SORT: InboxSort = { key: "deadline", dir: "asc" };

const text = (s: string | null | undefined) => (s ?? "").toLowerCase();

/**
 * Each column's value. Value sorts on the number, whatever the currency
 * (amounts aren't converted). A step with no deadline or request time sorts
 * after every dated one, either way.
 */
const sortValue: Record<InboxSortKey, (it: ApprovalInboxItem) => string | number | null> = {
  quote: (it) => it.quoteNumber,
  account: (it) => text(it.accountName),
  opportunity: (it) => text(it.opportunityName),
  role: (it) => text(it.roleLabel),
  submitter: (it) => text(it.submittedByEmail),
  value: (it) => Number(it.tcv),
  // ISO timestamps sort as text.
  deadline: (it) => it.dueAt ?? null,
  waiting: (it) => it.requestedAt ?? null,
};

/** Sorted on one column, either way; ties keep the inbox's order (most urgent first). */
export function sortInbox(items: readonly ApprovalInboxItem[], sort: InboxSort): ApprovalInboxItem[] {
  const value = sortValue[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return items
    .map((it, i) => ({ it, i, v: value(it) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v));
      return sign * c || a.i - b.i;
    })
    .map((x) => x.it);
}

export interface InboxOpportunityGroup {
  readonly opportunityId: string;
  readonly opportunityName: string;
  readonly items: readonly ApprovalInboxItem[];
}

export interface InboxAccountGroup {
  readonly accountId: string;
  readonly accountName: string;
  readonly opportunities: readonly InboxOpportunityGroup[];
}

/**
 * Groups the rows by account, then opportunity, in the rows' order: a group
 * comes where its first row would, so the groups follow the sort.
 */
export function groupInbox(items: readonly ApprovalInboxItem[]): InboxAccountGroup[] {
  const accounts = new Map<string, { name: string; opps: Map<string, ApprovalInboxItem[]> }>();
  for (const it of items) {
    let a = accounts.get(it.sfAccountId);
    if (!a) {
      a = { name: it.accountName ?? "No account", opps: new Map() };
      accounts.set(it.sfAccountId, a);
    }
    const list = a.opps.get(it.sfOpportunityId) ?? [];
    list.push(it);
    a.opps.set(it.sfOpportunityId, list);
  }
  return [...accounts.entries()].map(([accountId, a]) => ({
    accountId,
    accountName: a.name,
    opportunities: [...a.opps.entries()].map(([opportunityId, rows]) => ({
      opportunityId,
      opportunityName: rows[0].opportunityName ?? "No opportunity",
      items: rows,
    })),
  }));
}

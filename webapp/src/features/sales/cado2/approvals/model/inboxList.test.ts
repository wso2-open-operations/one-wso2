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

import { describe, expect, it } from "vitest";
import type { ApprovalInboxItem } from "@features/sales/cado2/approvals/api/approvalTypes";
import { filterByDeadline, filterByRegion, groupInbox, searchInbox, sortInbox } from "./inboxList";

const item = (o: Partial<ApprovalInboxItem> & { stepId: number }): ApprovalInboxItem => ({
  role: "DEAL_DESK", roleLabel: "Deal Desk", requestedAt: null, quoteId: o.stepId, quoteNumber: `Q-26-0000${o.stepId}`,
  versionNumber: 1, sfAccountId: "001A", sfOpportunityId: "006A", accountName: "Acme", opportunityName: "Opp A",
  currencyIsoCode: "USD", tcv: "100.00", submittedByEmail: "rep@wso2.com", submittedAt: null, ...o,
});

const ids = (rows: readonly ApprovalInboxItem[]) => rows.map((r) => r.stepId);

// My Approvals as a list (D144).
describe("inboxList", () => {
  const rows = [
    item({ stepId: 1, accountSalesRegion: "EU", accountName: "Pinecrest", submittedByEmail: "nimal@wso2.com", dueAt: "2026-11-07T10:00:00Z", slaState: "BREACHED", tcv: "127520.00" }),
    item({ stepId: 2, accountSalesRegion: "NA", accountName: "lakeshore", quoteNumber: "Q-26-00009", dueAt: "2026-11-08T10:00:00Z", slaState: "AT_RISK", tcv: "9000.00" }),
    item({ stepId: 3, accountName: "Harborview", tcv: "48000.00" }),
  ];

  it("searches quote, account, opportunity and submitter, ignoring case", () => {
    expect(ids(searchInbox(rows, "NIMAL"))).toEqual([1]);
    expect(ids(searchInbox(rows, "q-26-00009"))).toEqual([2]);
    expect(ids(searchInbox(rows, "  "))).toEqual([1, 2, 3]);
  });

  it("filters by deadline state", () => {
    expect(ids(filterByDeadline(rows, "BREACHED"))).toEqual([1]);
    expect(ids(filterByDeadline(rows, "ALL"))).toEqual([1, 2, 3]);
  });

  it("filters by the customer's region; one without a region shows only under all", () => {
    expect(ids(filterByRegion(rows, "EU"))).toEqual([1]);
    expect(ids(filterByRegion(rows, "APAC"))).toEqual([]);
    expect(ids(filterByRegion(rows, ""))).toEqual([1, 2, 3]);
  });

  it("sorts each column either way; value as a number, a missing deadline last", () => {
    expect(ids(sortInbox(rows, { key: "value", dir: "asc" }))).toEqual([2, 3, 1]); // 9,000 < 48,000 < 127,520
    expect(ids(sortInbox(rows, { key: "value", dir: "desc" }))).toEqual([1, 3, 2]);
    expect(ids(sortInbox(rows, { key: "account", dir: "asc" }))).toEqual([3, 2, 1]); // case-insensitive
    expect(ids(sortInbox(rows, { key: "deadline", dir: "asc" }))).toEqual([1, 2, 3]);
    expect(ids(sortInbox(rows, { key: "deadline", dir: "desc" }))).toEqual([2, 1, 3]); // no deadline stays last
  });

  it("groups by account, then opportunity, in the rows' order", () => {
    const grouped = groupInbox([
      item({ stepId: 1, sfAccountId: "001B", accountName: "Beta", sfOpportunityId: "006B1", opportunityName: "B1" }),
      item({ stepId: 2, sfAccountId: "001A", accountName: "Acme" }),
      item({ stepId: 3, sfAccountId: "001B", accountName: "Beta", sfOpportunityId: "006B2", opportunityName: "B2" }),
      item({ stepId: 4, sfAccountId: "001B", accountName: "Beta", sfOpportunityId: "006B1", opportunityName: "B1" }),
    ]);
    expect(grouped.map((a) => a.accountName)).toEqual(["Beta", "Acme"]);
    expect(grouped[0].opportunities.map((o) => [o.opportunityName, ids(o.items)])).toEqual([["B1", [1, 4]], ["B2", [3]]]);
  });
});

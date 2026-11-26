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
import type { LedgerEntry } from "../api/amplifyTypes";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_STATUS_LABELS,
  activityStatus,
  activityText,
  historyRows,
  matchesActivityFilter,
  type ActivityFilter,
} from "./activity";

const row = (reference: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  reference,
  employeeId: "e-1",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points: 2,
  createdAt: "2026-11-01T00:00:00Z",
  ...extra,
});

const rows: LedgerEntry[] = [
  row("REPOST", { action: "REPOST" }),
  row("REPOST_COMMENTARY", { action: "REPOST_COMMENTARY" }),
  row("SHARE", { action: "SHARE" }),
  row("SHARE_COMMENTARY", { action: "SHARE_COMMENTARY" }),
  row("REACTION", { action: "REACTION" }),
  row("COMMENT", { action: "COMMENT" }),
  row("OWN_POST", { sourceType: "EXTERNAL_SHARE", action: "OWN_POST" }),
  row("OWN_POST_AMPLIFIED", { sourceType: "EXTERNAL_SHARE", action: "OWN_POST_AMPLIFIED" }),
  row("ADJUSTMENT", { sourceType: "ADJUSTMENT", action: null }),
  // A reversal that carries the action of the row it cancels is still a correction.
  row("REVERSAL", { sourceType: "REVERSAL", action: "REPOST", points: -2 }),
];

const under = (filter: ActivityFilter) => rows.filter((r) => matchesActivityFilter(r, filter)).map((r) => r.reference);

describe("the activity filters", () => {
  it("are All, Reposts, Reactions & comments, Own posts and Corrections", () => {
    expect(ACTIVITY_FILTERS.map((f) => f.label)).toEqual([
      "All",
      "Reposts",
      "Reactions & comments",
      "Own posts",
      "Corrections",
    ]);
  });

  it("sort each row under its kind", () => {
    expect(under("all")).toHaveLength(rows.length);
    expect(under("reposts")).toEqual(["REPOST", "REPOST_COMMENTARY", "SHARE", "SHARE_COMMENTARY"]);
    expect(under("reactions")).toEqual(["REACTION", "COMMENT"]);
    expect(under("own-posts")).toEqual(["OWN_POST", "OWN_POST_AMPLIFIED"]);
    expect(under("corrections")).toEqual(["ADJUSTMENT", "REVERSAL"]);
  });
});

describe("activityText", () => {
  it("says what happened in plain words", () => {
    expect(activityText(row("a", { action: "REPOST_COMMENTARY" }))).toBe("You reposted with your thoughts");
    expect(activityText(row("b", { sourceType: "EXTERNAL_SHARE", action: "OWN_POST_AMPLIFIED" }))).toBe(
      "Your own post was featured",
    );
    expect(activityText(row("c", { sourceType: "ADJUSTMENT", action: null, points: 30 }))).toBe(
      "The PO team added points",
    );
    expect(activityText(row("d", { sourceType: "ADJUSTMENT", action: null, points: -5 }))).toBe(
      "The PO team removed points",
    );
    expect(activityText(row("e", { sourceType: "REVERSAL", action: "REPOST", points: -2 }))).toBe(
      "The PO team reversed points",
    );
    expect(activityText(row("f", { action: "SOMETHING_NEW" }))).toBe("Points activity");
  });
});

describe("activityStatus", () => {
  it("is the Coins status, in the employee's words", () => {
    expect(activityStatus(row("a", { settlement: "HELD" }))).toBe("HELD");
    expect(activityStatus(row("b", { settlement: "PAID" }))).toBe("PAID");
    expect(activityStatus(row("c", { settlement: "ACTION_REQUIRED" }))).toBe("ACTION_REQUIRED");
    expect(ACTIVITY_STATUS_LABELS).toEqual({
      HELD: "Counts toward next Coins",
      PAID: "Coins sent",
      ACTION_REQUIRED: "Waiting for the PO team",
      REVERSED: "Reversed",
    });
  });

  it("is Reversed once another row cancelled it, whatever its Coins status", () => {
    expect(activityStatus(row("a", { settlement: "PAID", reversedBy: "REV-1" }))).toBe("REVERSED");
  });

  it("is nothing when the row has no status", () => {
    expect(activityStatus(row("a"))).toBeNull();
  });
});

describe("historyRows", () => {
  it("joins the pages newest first, keeping a row that moved onto the next page once", () => {
    const pages = [{ items: [row("R-3"), row("R-2")] }, { items: [row("R-2"), row("R-1")] }];
    expect(historyRows(pages).map((r) => r.reference)).toEqual(["R-3", "R-2", "R-1"]);
    expect(historyRows([])).toEqual([]);
  });
});

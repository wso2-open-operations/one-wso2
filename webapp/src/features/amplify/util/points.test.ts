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
  canReverse,
  effectPreview,
  ledgerActionLabel,
  parseAdjustmentPoints,
  parseRulePoints,
  pointActionOrder,
  POINT_ACTION_LABELS,
  reversedReferences,
  signedPoints,
  totalPoints,
} from "./points";

const row = (reference: string, points: number, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  reference,
  employeeId: "e-1",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points,
  createdAt: "2026-11-01T00:00:00Z",
  ...extra,
});

describe("effectPreview", () => {
  it("shows the total before and after, with thousands separators", () => {
    expect(effectPreview(1040, -2)).toBe("1,040 → 1,038");
    expect(effectPreview(990, 25)).toBe("990 → 1,015");
    expect(effectPreview(5, -10)).toBe("5 → -5");
  });
});

describe("signedPoints", () => {
  it("puts a sign on non-zero points", () => {
    expect(signedPoints(10)).toBe("+10");
    expect(signedPoints(-2)).toBe("−2");
    expect(signedPoints(-1500)).toBe("−1,500");
    expect(signedPoints(0)).toBe("0");
  });
});

describe("totalPoints and reversals", () => {
  const rows = [
    row("REV-1", -10, { sourceType: "REVERSAL", action: null, reversesReference: "R-1" }),
    row("R-2", 5),
    row("R-1", 10),
  ];

  it("sums every row, reversals included", () => {
    expect(totalPoints(rows)).toBe(5);
    expect(totalPoints([])).toBe(0);
  });

  it("knows which rows are reversed", () => {
    expect([...reversedReferences(rows)]).toEqual(["R-1"]);
  });

  it("offers Reverse only on a row that is neither a reversal nor reversed", () => {
    const reversed = reversedReferences(rows);
    expect(canReverse(rows[0], reversed)).toBe(false);
    expect(canReverse(rows[1], reversed)).toBe(true);
    expect(canReverse(rows[2], reversed)).toBe(false);
  });
});

describe("parseAdjustmentPoints", () => {
  it("takes a signed whole number within ±10,000", () => {
    expect(parseAdjustmentPoints("5")).toBe(5);
    expect(parseAdjustmentPoints(" -2 ")).toBe(-2);
    expect(parseAdjustmentPoints("+15")).toBe(15);
    expect(parseAdjustmentPoints("10000")).toBe(10000);
    expect(parseAdjustmentPoints("-10000")).toBe(-10000);
  });

  it.each(["", "0", "-0", "1.5", "abc", "10001", "-10001", "1e3"])("refuses %j", (text) => {
    expect(parseAdjustmentPoints(text)).toBeNull();
  });
});

describe("parseRulePoints", () => {
  it("takes a whole number from 0 to 10,000", () => {
    expect(parseRulePoints("0")).toBe(0);
    expect(parseRulePoints("25")).toBe(25);
    expect(parseRulePoints("10000")).toBe(10000);
  });

  it.each(["", "-1", "2.5", "10001", "ten"])("refuses %j", (text) => {
    expect(parseRulePoints(text)).toBeNull();
  });
});

describe("action labels", () => {
  it("names the actions in plain words", () => {
    expect(POINT_ACTION_LABELS.REPOST).toBe("Repost");
    expect(POINT_ACTION_LABELS.REPOST_COMMENTARY).toBe("Repost with your thoughts");
    expect(POINT_ACTION_LABELS.REACTION).toBe("Reaction on LinkedIn");
    expect(POINT_ACTION_LABELS.COMMENT).toBe("Comment on LinkedIn");
    expect(POINT_ACTION_LABELS.OWN_POST).toBe("Own post approved");
    expect(POINT_ACTION_LABELS.OWN_POST_AMPLIFIED).toBe("Own post featured (total)");
  });

  it("orders the actions as Amplify Admin lists them, unknown ones last", () => {
    expect(pointActionOrder("REPOST")).toBeLessThan(pointActionOrder("OWN_POST"));
    expect(pointActionOrder("SOMETHING_NEW")).toBeGreaterThan(pointActionOrder("CHALLENGE_WINNER"));
  });

  it("labels ledger rows by where they came from", () => {
    expect(ledgerActionLabel({ sourceType: "ENGAGEMENT", action: "REPOST_COMMENTARY" })).toBe("Repost with your thoughts");
    expect(ledgerActionLabel({ sourceType: "EXTERNAL_SHARE", action: "OWN_POST" })).toBe("Own post approved");
    // The top-up row holds only the extra points, so it isn't labelled as the total.
    expect(ledgerActionLabel({ sourceType: "EXTERNAL_SHARE", action: "OWN_POST_AMPLIFIED" })).toBe("Own post featured");
    expect(ledgerActionLabel({ sourceType: "ADJUSTMENT", action: null })).toBe("Correction by the PO team");
    expect(ledgerActionLabel({ sourceType: "REVERSAL", action: "REPOST" })).toBe("Reversal");
    expect(ledgerActionLabel({ sourceType: "ENGAGEMENT", action: "NEW_KIND" })).toBe("NEW_KIND");
  });
});

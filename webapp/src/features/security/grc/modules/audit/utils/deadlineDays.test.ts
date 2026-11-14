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

import { describe, expect, it } from "vitest";
import type { DeadlineDayRow } from "@features/security/grc/modules/audit/types/audit";
import {
  buildDeadlineDaysUpdate,
  draftFromRows,
  parseAllowedDays,
  validateDraft,
} from "./deadlineDays";

const ROWS: DeadlineDayRow[] = [
  { cycleType: "INITIAL", handledBy: "OWNER", allowedDays: 30, isDefault: true },
  { cycleType: "INITIAL", handledBy: "COMPLIANCE", allowedDays: 10, isDefault: true },
  { cycleType: "INITIAL", handledBy: "AUDITOR", allowedDays: 10, isDefault: true },
  { cycleType: "REVISION", handledBy: "OWNER", allowedDays: 15, isDefault: true },
  { cycleType: "REVISION", handledBy: "COMPLIANCE", allowedDays: 5, isDefault: true },
  { cycleType: "REVISION", handledBy: "AUDITOR", allowedDays: 5, isDefault: true },
];

describe("parseAllowedDays", () => {
  it("accepts whole numbers from 1 to 365", () => {
    expect(parseAllowedDays("1")).toBe(1);
    expect(parseAllowedDays(" 30 ")).toBe(30);
    expect(parseAllowedDays("365")).toBe(365);
  });

  it("rejects zero, over the maximum, fractions, signs, exponents and blanks", () => {
    for (const bad of ["0", "366", "1.5", "-3", "+3", "1e2", "", "  ", "abc"]) {
      expect(parseAllowedDays(bad), bad).toBeNull();
    }
  });
});

describe("validateDraft", () => {
  it("is empty when every cell is valid", () => {
    expect(validateDraft(draftFromRows(ROWS))).toEqual({});
  });

  it("names each invalid cell", () => {
    const draft = { ...draftFromRows(ROWS), "INITIAL:OWNER": "0", "REVISION:AUDITOR": "x" };
    expect(Object.keys(validateDraft(draft)).sort()).toEqual(["INITIAL:OWNER", "REVISION:AUDITOR"]);
  });
});

describe("buildDeadlineDaysUpdate", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildDeadlineDaysUpdate(ROWS, draftFromRows(ROWS))).toEqual({ days: [] });
  });

  it("sends only the rows that changed", () => {
    const draft = { ...draftFromRows(ROWS), "INITIAL:COMPLIANCE": "12", "REVISION:OWNER": "20" };
    expect(buildDeadlineDaysUpdate(ROWS, draft)).toEqual({
      days: [
        { cycleType: "INITIAL", handledBy: "COMPLIANCE", allowedDays: 12 },
        { cycleType: "REVISION", handledBy: "OWNER", allowedDays: 20 },
      ],
    });
  });

  it("never sends an invalid cell", () => {
    const draft = { ...draftFromRows(ROWS), "INITIAL:OWNER": "400" };
    expect(buildDeadlineDaysUpdate(ROWS, draft)).toEqual({ days: [] });
  });
});

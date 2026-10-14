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
import { sortAutoCompleteLists } from "./useMasterData";
import type { ExpenseTypeAutoComplete } from "./masterDataTypes";

/**
 * The backend returns these in whatever order the rows fall out of a GROUP BY,
 * which is no order at all to someone hunting one name among hundreds.
 */
const unsorted: ExpenseTypeAutoComplete = {
  // Real names from the catalogue, in the order the dropdown showed them.
  expenseTypes: ["Sprout Social", "Hot Jar", "SEO MOZ", "Mention", "ZENDESK, INC", "Zopim"],
  engagementCodes: ["RND-GEN", "AMER-SALES", "mktg-ops"],
  engagementCodeSuffixes: ["S2", "S10", "S1"],
  expenseCategoryIds: [
    { id: 3, label: "Travel" },
    { id: 1, label: "CC-Marketing" },
    { id: 2, label: "Software" },
  ],
  glCodeIds: [
    { id: 2, label: "61015-10" },
    { id: 1, label: "61015-9" },
  ],
};

describe("the expense-type option lists", () => {
  it("puts every list in alphabetical order", () => {
    const sorted = sortAutoCompleteLists(unsorted);

    expect(sorted.expenseTypes).toEqual([
      "Hot Jar",
      "Mention",
      "SEO MOZ",
      "Sprout Social",
      "ZENDESK, INC",
      "Zopim",
    ]);
    expect(sorted.engagementCodes).toEqual(["AMER-SALES", "mktg-ops", "RND-GEN"]);
    expect(sorted.expenseCategoryIds.map((o) => o.label)).toEqual([
      "CC-Marketing",
      "Software",
      "Travel",
    ]);
  });

  // "ZENDESK, INC" sorting under Z next to "Zopim" rather than being herded to
  // the top with every other capitalised name is the whole point of
  // `sensitivity: "base"` — the catalogue shouts some names and not others.
  it("ignores case rather than listing the shouted names first", () => {
    const { expenseTypes, engagementCodes } = sortAutoCompleteLists(unsorted);

    expect(expenseTypes.indexOf("ZENDESK, INC")).toBeGreaterThan(
      expenseTypes.indexOf("Sprout Social"),
    );
    expect(engagementCodes[1]).toBe("mktg-ops");
  });

  // Plain string order puts S10 before S2, because it compares "1" to "2" and
  // stops there.
  it("reads runs of digits as numbers", () => {
    const sorted = sortAutoCompleteLists(unsorted);

    expect(sorted.engagementCodeSuffixes).toEqual(["S1", "S2", "S10"]);
    expect(sorted.glCodeIds.map((o) => o.label)).toEqual(["61015-9", "61015-10"]);
  });

  it("leaves the caller's own arrays alone", () => {
    const before = [...unsorted.expenseTypes];
    sortAutoCompleteLists(unsorted);

    expect(unsorted.expenseTypes).toEqual(before);
  });
});

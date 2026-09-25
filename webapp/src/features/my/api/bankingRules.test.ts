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

import { describe, expect, it, vi } from "vitest";

// bankingRules.ts pulls in hasAnyGroup from @hooks/useAsgardeoGroups, whose
// module-level `import { useAsgardeo } from "@asgardeo/react"` fails to
// resolve under this sandbox's Node/pnpm setup (a directory import of
// @asgardeo/browser's `buffer` dependency) — unrelated to this file's own
// logic. Same workaround already used elsewhere in this codebase (e.g.
// useUmtGate.test.tsx): stub the package so the import chain never touches
// the broken resolution, even though nothing here calls it.
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const {
  consultancyAllowedLocations,
  formatOrdinal,
  initialConsultancyBankLocation,
  isConsultancyRestricted,
  isPastThreshold,
  isReimbursementEligible,
} = await import("./bankingRules");

describe("isPastThreshold", () => {
  it("is false on the threshold day itself", () => {
    expect(isPastThreshold(new Date(2026, 8, 18), 18)).toBe(false);
  });

  it("is false before the threshold day", () => {
    expect(isPastThreshold(new Date(2026, 8, 17), 18)).toBe(false);
  });

  it("is true the day after the threshold", () => {
    expect(isPastThreshold(new Date(2026, 8, 19), 18)).toBe(true);
  });

  it("is true well past the threshold", () => {
    expect(isPastThreshold(new Date(2026, 8, 30), 18)).toBe(true);
  });
});

describe("isReimbursementEligible", () => {
  const allowed = ["Colombo", "Bangalore"];

  it("is true for a location on the allow-list", () => {
    expect(isReimbursementEligible("Colombo", allowed)).toBe(true);
  });

  it("is false for a location not on the allow-list", () => {
    expect(isReimbursementEligible("Mountain View", allowed)).toBe(false);
  });

  it("is false when the employee has no work location on record", () => {
    expect(isReimbursementEligible(null, allowed)).toBe(false);
    expect(isReimbursementEligible(undefined, allowed)).toBe(false);
    expect(isReimbursementEligible("", allowed)).toBe(false);
  });

  it("is false against an empty allow-list rather than matching everything", () => {
    expect(isReimbursementEligible("Colombo", [])).toBe(false);
  });
});

describe("isConsultancyRestricted", () => {
  it("is true when the caller holds a restricted group", () => {
    expect(isConsultancyRestricted(["contractor", "wso2-everyone"], ["contractor"])).toBe(true);
  });

  it("is false when the caller holds none of the restricted groups", () => {
    expect(isConsultancyRestricted(["wso2-everyone"], ["contractor"])).toBe(false);
  });

  it("is false when there are no restricted groups configured", () => {
    expect(isConsultancyRestricted(["contractor"], [])).toBe(false);
  });

  it("ignores an empty-string group name rather than matching everyone", () => {
    // A caller with no groups claim decodes to [] — an unset/blank
    // restricted-group entry must never match that.
    expect(isConsultancyRestricted([], [""])).toBe(false);
  });
});

describe("formatOrdinal", () => {
  it("suffixes the common cases", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(2)).toBe("2nd");
    expect(formatOrdinal(3)).toBe("3rd");
    expect(formatOrdinal(4)).toBe("4th");
    expect(formatOrdinal(18)).toBe("18th");
    expect(formatOrdinal(21)).toBe("21st");
  });

  it("special-cases the 11th/12th/13th exceptions", () => {
    expect(formatOrdinal(11)).toBe("11th");
    expect(formatOrdinal(12)).toBe("12th");
    expect(formatOrdinal(13)).toBe("13th");
  });
});

describe("consultancyAllowedLocations", () => {
  const map = [
    { location: "Sri Lanka", customMap: ["Sri Lanka", "Maldives"] },
    { location: "Singapore", customMap: ["Malaysia"] },
  ];

  it("returns the matching entry's customMap when the work location has one", () => {
    expect(consultancyAllowedLocations("Sri Lanka", map)).toEqual(["Sri Lanka", "Maldives"]);
  });

  it("uses the entry's customMap as-is, even when it omits the work location itself", () => {
    expect(consultancyAllowedLocations("Singapore", map)).toEqual(["Malaysia"]);
  });

  it("falls back to just the work location when no entry matches", () => {
    expect(consultancyAllowedLocations("India", map)).toEqual(["India"]);
  });

  it("falls back to just the work location when the map is empty or not loaded yet", () => {
    expect(consultancyAllowedLocations("India", [])).toEqual(["India"]);
    expect(consultancyAllowedLocations("India", undefined)).toEqual(["India"]);
  });

  it("is empty when the work location is unknown and nothing matches", () => {
    expect(consultancyAllowedLocations(undefined, map)).toEqual([]);
    expect(consultancyAllowedLocations("", [])).toEqual([]);
  });
});

describe("initialConsultancyBankLocation", () => {
  it("prefills the work location when it is one of the allowed locations", () => {
    expect(initialConsultancyBankLocation("Sri Lanka", ["Maldives", "Sri Lanka"])).toBe("Sri Lanka");
  });

  it("prefills the first allowed location when the work location is not among them", () => {
    expect(initialConsultancyBankLocation("Singapore", ["Malaysia"])).toBe("Malaysia");
  });

  it("is empty when there are no allowed locations", () => {
    expect(initialConsultancyBankLocation(undefined, [])).toBe("");
  });
});

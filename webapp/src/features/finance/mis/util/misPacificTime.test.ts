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
import { inZone } from "@/test/timeZone";
import {
  pacificCivilDate,
  pacificTimeLabel,
  pacificZoneAbbreviation,
} from "./misPacificTime";

// Spec §3 and §10.8–10.9: a Period boundary means the same thing to a viewer in
// Colombo as to one in California.
//
// Every test here runs under an explicit non-Pacific zone. `src/test/setup.ts`
// pins the suite to America/Los_Angeles, where a Pacific-versus-local confusion
// passes silently — see `@/test/timeZone`.

describe("the Pacific calendar date of an instant", () => {
  // 02:00 UTC on New Year's Day is still 18:00 on 31 December in California:
  // the two zones disagree about which YEAR it is, which is the disagreement a
  // Build's column ranges are built out of.
  const NEW_YEAR_UTC = new Date("2026-01-01T02:00:00Z");

  it("reads 31 December while UTC has already turned the year", () => {
    expect(inZone("UTC", () => pacificCivilDate(NEW_YEAR_UTC))).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it("is the same in Colombo as in UTC", () => {
    expect(inZone("Asia/Colombo", () => pacificCivilDate(NEW_YEAR_UTC))).toEqual(
      inZone("UTC", () => pacificCivilDate(NEW_YEAR_UTC)),
    );
  });
});

describe("the Pacific Time chip label", () => {
  // 2026's transitions: forward at 02:00 PST on 8 March (10:00 UTC), back at
  // 02:00 PDT on 1 November (09:00 UTC).
  const CASES: ReadonlyArray<[string, string, string]> = [
    ["a minute before spring forward", "2026-03-08T09:59:00Z", "PST"],
    ["a minute after spring forward", "2026-03-08T10:01:00Z", "PDT"],
    ["a minute before falling back", "2026-11-01T08:59:00Z", "PDT"],
    ["a minute after falling back", "2026-11-01T09:01:00Z", "PST"],
  ];

  it.each(CASES)("says %s: %s is %s", (_when, iso, abbreviation) => {
    expect(inZone("Asia/Colombo", () => pacificZoneAbbreviation(new Date(iso)))).toBe(
      abbreviation,
    );
  });

  it("is the abbreviation in words, as the screens render it", () => {
    expect(inZone("UTC", () => pacificTimeLabel(new Date("2026-07-01T12:00:00Z")))).toBe(
      "Pacific Time (PDT)",
    );
  });

  it("is derived from the same instant as the calendar date", () => {
    // The half-hour in which Pacific has fallen back to PST but is still on the
    // 1st: label and date have to agree, which they only do if one instant
    // produces both.
    const instant = new Date("2026-11-01T09:30:00Z");
    expect(inZone("UTC", () => pacificZoneAbbreviation(instant))).toBe("PST");
    expect(inZone("UTC", () => pacificCivilDate(instant))).toEqual({
      year: 2026,
      month: 11,
      day: 1,
    });
  });
});

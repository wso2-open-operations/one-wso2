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
import { flashForecastMonth } from "./misFlashForecastMonth";

// Which month's forecasts an account view offers to edit.
//
// The source hides its Edit column on every month but the one before this one
// (`AccountViewTable.js:53`). The server never checks the month — its UPDATE is
// `WHERE id = ?` — but it is the month its P&L reads forecasts for:
// `DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 1 MONTH, '%Y-%m')`. So the rule is
// the SERVER'S month, in UTC — the one MIS month that is not Pacific (spec §3).
//
// Every case runs under three zones, because the whole point is that none of
// them moves it: `src/test/setup.ts` pins the suite to Pacific, where a
// local-versus-UTC confusion would pass for most of every month.

const ZONES = ["UTC", "Asia/Colombo", "America/Los_Angeles"];

describe("the month whose forecasts can be written", () => {
  it.each(ZONES)("is the month before this one, in %s", (tz) => {
    expect(inZone(tz, () => flashForecastMonth(new Date("2026-09-22T10:00:00Z")))).toEqual({
      year: 2026,
      month: 8,
    });
  });

  // 03:00 UTC on 1 October is still 30 September in California. The server has
  // already moved on, and its day is the 1st — before the cutoff — so it would
  // ACCEPT an edit to September. A Pacific rule would still be offering August.
  it.each(ZONES)("turns when UTC turns, not when California does, in %s", (tz) => {
    expect(inZone(tz, () => flashForecastMonth(new Date("2026-10-01T03:00:00Z")))).toEqual({
      year: 2026,
      month: 9,
    });
  });

  // 20:00 UTC on 30 September is already 1 October in Colombo, where the
  // source's own rule, being local, has moved on. The server has not.
  it.each(ZONES)("has not turned while UTC has not, in %s", (tz) => {
    expect(inZone(tz, () => flashForecastMonth(new Date("2026-09-30T20:00:00Z")))).toEqual({
      year: 2026,
      month: 8,
    });
  });

  // The source compares years as well as months, so in January — whose month
  // before is December of LAST year — it offers nothing at all. Not reproduced:
  // the server accepts December's edits on 1–15 January like any other month's.
  it.each(ZONES)("is last December in January, in %s", (tz) => {
    expect(inZone(tz, () => flashForecastMonth(new Date("2027-01-10T12:00:00Z")))).toEqual({
      year: 2026,
      month: 12,
    });
  });
});

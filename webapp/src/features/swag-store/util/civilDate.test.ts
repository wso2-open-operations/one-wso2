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
import { formatCivilDate, formatInstant } from "./civilDate";

describe("formatCivilDate", () => {
  it("shows the date it was given, whatever the viewer's timezone", () => {
    expect(formatCivilDate("2026-12-01", "en-GB")).toBe("1 Dec");
    expect(formatCivilDate("2026-12-31", "en-US")).toBe("Dec 31");
  });

  it("returns undefined for a value that isn't a date", () => {
    expect(formatCivilDate("soon", "en-GB")).toBeUndefined();
    expect(formatCivilDate("2026-13-40", "en-GB")).toBeUndefined();
  });
});

describe("formatInstant", () => {
  it("shows an instant with its date and time", () => {
    // Midday UTC is 13 November in every timezone from UTC-11 to UTC+11.
    expect(formatInstant("2026-11-13T12:00:00Z", "en-GB")).toMatch(/^13 Nov 2026, \d{2}:\d{2}$/);
  });

  it("shows a value it can't read as it came", () => {
    expect(formatInstant("yesterday")).toBe("yesterday");
  });
});

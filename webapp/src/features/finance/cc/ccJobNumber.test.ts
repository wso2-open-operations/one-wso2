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
import { formatJobDate, isValidJobNumberFormat, normalizeJobNumber } from "./ccJobNumber";

describe("a typed travel job number", () => {
  it("is upper-cased and trimmed, so it matches the list and the cache key", () => {
    expect(normalizeJobNumber("  trv-2023-04-0123 ")).toBe("TRV-2023-04-0123");
  });

  it("accepts the TRV-YYYY-MM-NNNN shape whatever case it is typed in", () => {
    expect(isValidJobNumberFormat("TRV-2023-04-0123")).toBe(true);
    expect(isValidJobNumberFormat("trv-2019-11-0007")).toBe(true);
  });

  // Shape only — a well-formed number for a job that does not exist is the
  // lookup's 404 to report, not this function's false.
  it("refuses anything that is not that shape", () => {
    for (const bad of [
      "",
      "TRV-2023-04-012", // three digits
      "TRV-2023-4-0123", // unpadded month
      "TRV-23-04-0123", // two-digit year
      "ABC-2023-04-0123", // wrong prefix
      "Hilton",
      "TRV-2023-04-0123-X",
    ]) {
      expect(isValidJobNumberFormat(bad), bad).toBe(false);
    }
  });
});

describe("a travel date in the job tooltip", () => {
  it("is written day-first, with a padded day", () => {
    expect(formatJobDate("2026-01-10")).toBe("10 Jan 2026");
  });

  // The entity sends "2016-10-11 00:00:00.0", which is not a string every
  // browser will parse as a date; only the date half is needed.
  it("reads the entity's date-and-time string", () => {
    expect(formatJobDate("2016-10-11 00:00:00.0")).toBe("11 Oct 2016");
  });

  // A date-only string is midnight UTC. Formatted in the reader's own zone,
  // anyone west of UTC saw the day before — these are calendar dates with no
  // time in them to convert. This test only means something west of UTC, so
  // run the file with TZ=America/Los_Angeles to see it bite.
  it("does not shift a day for a reader behind UTC", () => {
    expect(formatJobDate("2016-10-11 00:00:00.0")).toBe("11 Oct 2016");
    expect(formatJobDate("2026-03-01")).toBe("01 Mar 2026");
  });

  it("says so plainly when there is no date", () => {
    expect(formatJobDate(null)).toBe("—");
    expect(formatJobDate("")).toBe("—");
    expect(formatJobDate("not a date")).toBe("—");
  });
});

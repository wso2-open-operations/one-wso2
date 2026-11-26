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
import {
  SCHEDULE_LABELS,
  coinsText,
  conversionSentence,
  convertPoints,
  examplePoints,
  isCoinSchedule,
  pointsText,
  progressFraction,
  progressText,
  workedExample,
} from "./coins";

describe("convertPoints", () => {
  it("converts whole blocks only and carries the rest over", () => {
    expect(convertPoints(1240, 100, 10)).toEqual({ coins: 120, carried: 40 });
    expect(convertPoints(99, 100, 10)).toEqual({ coins: 0, carried: 99 });
    expect(convertPoints(300, 100, 10)).toEqual({ coins: 30, carried: 0 });
    expect(convertPoints(1240, 250, 30)).toEqual({ coins: 120, carried: 240 });
  });

  it("converts nothing below zero or without a positive block", () => {
    expect(convertPoints(-5, 100, 10)).toEqual({ coins: 0, carried: 0 });
    expect(convertPoints(500, 0, 10)).toEqual({ coins: 0, carried: 500 });
  });
});

describe("progress to the next Coins", () => {
  it("is points toward the next block over the block", () => {
    expect(progressFraction(40, 100)).toBe(0.4);
    expect(progressFraction(0, 100)).toBe(0);
    expect(progressText(40, 100)).toBe("40 / 100 points");
    expect(progressText(1250, 2000)).toBe("1,250 / 2,000 points");
  });

  it("stays between 0 and 1", () => {
    expect(progressFraction(150, 100)).toBe(1);
    expect(progressFraction(-3, 100)).toBe(0);
    expect(progressFraction(10, 0)).toBe(0);
  });
});

describe("conversionSentence", () => {
  it("states the rate and the schedule in plain words", () => {
    expect(conversionSentence(100, 10, "MONTHLY")).toBe(
      "Every 100 points becomes 10 Coins, automatically, monthly on the 1st.",
    );
    expect(conversionSentence(250, 20, "WEEKLY")).toBe("Every 250 points becomes 20 Coins, automatically, every Monday.");
    expect(conversionSentence(1000, 1, "DAILY")).toBe("Every 1,000 points becomes 1 Coin, automatically, every day.");
  });
});

describe("workedExample", () => {
  it("converts twelve and four tenths blocks, so it shows Coins and a carry-over", () => {
    expect(examplePoints(100)).toBe(1240);
    expect(workedExample(100, 10)).toBe("1,240 points becomes 120 Coins, with 40 points carried over.");
    expect(workedExample(250, 30)).toBe("3,100 points becomes 360 Coins, with 100 points carried over.");
  });

  it("leaves the carry-over out when there is none", () => {
    expect(workedExample(1, 2)).toBe("12 points becomes 24 Coins.");
  });

  it("has no example for a block below one", () => {
    expect(workedExample(0, 10)).toBeNull();
    expect(workedExample(100, 0)).toBeNull();
  });
});

describe("wording", () => {
  it("uses the singular for one", () => {
    expect(pointsText(1)).toBe("1 point");
    expect(pointsText(1240)).toBe("1,240 points");
    expect(coinsText(1)).toBe("1 Coin");
    expect(coinsText(0)).toBe("0 Coins");
  });

  it("knows the three schedules", () => {
    expect(Object.values(SCHEDULE_LABELS)).toEqual(["Monthly on the 1st", "Weekly on Mondays", "Daily"]);
    expect(isCoinSchedule("WEEKLY")).toBe(true);
    expect(isCoinSchedule("weekly")).toBe(false);
    expect(isCoinSchedule(null)).toBe(false);
  });
});

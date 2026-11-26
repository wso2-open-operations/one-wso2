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
import type { AmplifySetting } from "../api/amplifyTypes";
import {
  COIN_BLOCK_COINS,
  COIN_BLOCK_POINTS,
  COIN_SCHEDULE,
  COIN_WALLETS_ENABLED,
  OWN_POST_DAILY_LIMIT,
  SETTING_RANGES,
  booleanSetting,
  numberSetting,
  parseWholeNumber,
  settingChanges,
  settingsFormKey,
  stringSetting,
} from "./settings";

const setting = (key: string, value: unknown, version = 1): AmplifySetting => ({
  key,
  value,
  version,
  updatedBy: "po-1",
  updatedAt: "2026-11-01T00:00:00Z",
});

const settings = [
  setting(COIN_BLOCK_POINTS, 100, 3),
  setting(COIN_BLOCK_COINS, 10, 2),
  setting(COIN_SCHEDULE, "MONTHLY", 1),
  setting(COIN_WALLETS_ENABLED, false, 4),
];

describe("reading settings", () => {
  it("reads each value by its type, and null for a missing or mistyped one", () => {
    expect(numberSetting(settings, COIN_BLOCK_POINTS)).toBe(100);
    expect(numberSetting(settings, COIN_SCHEDULE)).toBeNull();
    expect(numberSetting(settings, OWN_POST_DAILY_LIMIT)).toBeNull();
    expect(numberSetting([setting(OWN_POST_DAILY_LIMIT, 2.5)], OWN_POST_DAILY_LIMIT)).toBeNull();
    expect(stringSetting(settings, COIN_SCHEDULE)).toBe("MONTHLY");
    expect(booleanSetting(settings, COIN_WALLETS_ENABLED)).toBe(false);
    expect(booleanSetting(settings, COIN_BLOCK_POINTS)).toBeNull();
  });
});

describe("parseWholeNumber", () => {
  it("takes a whole number inside the setting's range", () => {
    expect(parseWholeNumber("100", SETTING_RANGES[COIN_BLOCK_POINTS])).toBe(100);
    expect(parseWholeNumber(" 0 ", SETTING_RANGES[OWN_POST_DAILY_LIMIT])).toBe(0);
    expect(parseWholeNumber("50", SETTING_RANGES[OWN_POST_DAILY_LIMIT])).toBe(50);
  });

  it.each(["", "0", "-1", "2.5", "abc", "100001"])("refuses %j for a block", (text) => {
    expect(parseWholeNumber(text, SETTING_RANGES[COIN_BLOCK_POINTS])).toBeNull();
  });

  it("refuses a daily limit above 50", () => {
    expect(parseWholeNumber("51", SETTING_RANGES[OWN_POST_DAILY_LIMIT])).toBeNull();
  });
});

describe("settingChanges", () => {
  it("sends only the keys whose value changed, each with the version it was read at", () => {
    expect(
      settingChanges(settings, {
        [COIN_BLOCK_POINTS]: 200,
        [COIN_BLOCK_COINS]: 10,
        [COIN_SCHEDULE]: "WEEKLY",
        [COIN_WALLETS_ENABLED]: false,
      }),
    ).toEqual([
      { key: COIN_BLOCK_POINTS, value: 200, version: 3 },
      { key: COIN_SCHEDULE, value: "WEEKLY", version: 1 },
    ]);
  });

  it("sends nothing when nothing changed, and never a key the list lacks", () => {
    expect(settingChanges(settings, { [COIN_BLOCK_POINTS]: 100 })).toEqual([]);
    expect(settingChanges(settings, { [OWN_POST_DAILY_LIMIT]: 5 })).toEqual([]);
  });
});

describe("settingsFormKey", () => {
  it("changes when any version does", () => {
    const before = settingsFormKey(settings);
    expect(settingsFormKey(settings)).toBe(before);
    expect(settingsFormKey([setting(COIN_BLOCK_POINTS, 100, 4), ...settings.slice(1)])).not.toBe(before);
  });
});

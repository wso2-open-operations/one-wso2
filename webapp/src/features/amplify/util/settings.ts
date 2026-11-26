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

import type { AmplifySetting, SettingChange } from "../api/amplifyTypes";

/** Points in one conversion block (`/po/settings` and `/admin/settings`). */
export const COIN_BLOCK_POINTS = "coin.block_points";
/** Coins one block becomes. */
export const COIN_BLOCK_COINS = "coin.block_coins";
/** How often points convert: MONTHLY, WEEKLY or DAILY. */
export const COIN_SCHEDULE = "coin.schedule";
/** Whether Coins are sent to wallets (`/admin/settings` only). */
export const COIN_WALLETS_ENABLED = "coin.wallets_enabled";
/** "Amplify posting": off stops every "Post it for me" share at once (`/admin/settings` only). */
export const SHARING_ENABLED = "sharing.enabled";
/** Own posts one person may submit per UTC day; 0 = no limit. */
export const OWN_POST_DAILY_LIMIT = "external_share.daily_limit";

/** The range amplify-api accepts for a number setting. */
export interface SettingRange {
  min: number;
  max: number;
}

/** The ranges of the number settings Amplify Admin edits (amplify-api `EDITABLE_SETTINGS`). */
export const SETTING_RANGES = {
  [COIN_BLOCK_POINTS]: { min: 1, max: 100_000 },
  [COIN_BLOCK_COINS]: { min: 1, max: 100_000 },
  [OWN_POST_DAILY_LIMIT]: { min: 0, max: 50 },
} as const satisfies Record<string, SettingRange>;

/** The setting with `key`, if the list has it. */
export function findSetting(settings: readonly AmplifySetting[], key: string): AmplifySetting | undefined {
  return settings.find((s) => s.key === key);
}

/** A whole-number setting's value; null when missing or not a whole number. */
export function numberSetting(settings: readonly AmplifySetting[], key: string): number | null {
  const value = findSetting(settings, key)?.value;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** A true/false setting's value; null when missing or not a boolean. */
export function booleanSetting(settings: readonly AmplifySetting[], key: string): boolean | null {
  const value = findSetting(settings, key)?.value;
  return typeof value === "boolean" ? value : null;
}

/** A text setting's value; null when missing or not a string. */
export function stringSetting(settings: readonly AmplifySetting[], key: string): string | null {
  const value = findSetting(settings, key)?.value;
  return typeof value === "string" ? value : null;
}

/** The whole number a field holds, within `range`. Null for anything else (blank, a fraction, out of range). */
export function parseWholeNumber(text: string, range: SettingRange): number | null {
  const value = text.trim();
  if (!/^\d{1,7}$/.test(value)) return null;
  const n = Number(value);
  return n >= range.min && n <= range.max ? n : null;
}

/**
 * The changes that turn `settings` into `next`: one per key whose value differs, each with the version it was read
 * at. A key the list doesn't have is left out, since it can't be saved without a version.
 */
export function settingChanges(
  settings: readonly AmplifySetting[],
  next: Readonly<Record<string, number | boolean | string>>,
): SettingChange[] {
  const changes: SettingChange[] = [];
  for (const [key, value] of Object.entries(next)) {
    const current = findSetting(settings, key);
    if (current && current.value !== value) changes.push({ key, value, version: current.version });
  }
  return changes;
}

/** A key for a settings form that changes whenever any setting's version does, so the form starts again. */
export function settingsFormKey(settings: readonly AmplifySetting[]): string {
  return settings.map((s) => `${s.key}@${s.version}`).join("|");
}

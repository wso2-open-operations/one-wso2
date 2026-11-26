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

import type { CoinSchedule, CoinWallet } from "../api/amplifyTypes";
import { num } from "./dashboardFormat";

/** Shown while Coins aren't sent to wallets yet (`coins.walletsEnabled` false). */
export const WALLETS_OFF_NOTE = "Coins aren't being sent yet; your points keep counting toward them.";

/** When points convert, as the end of "Every 100 points becomes 10 Coins, automatically, …". */
export const SCHEDULE_PHRASES: Readonly<Record<CoinSchedule, string>> = {
  MONTHLY: "monthly on the 1st",
  WEEKLY: "every Monday",
  DAILY: "every day",
};

/** Each schedule as Amplify Admin offers it, in order. */
export const SCHEDULE_LABELS: Readonly<Record<CoinSchedule, string>> = {
  MONTHLY: "Monthly, on the 1st",
  WEEKLY: "Weekly, on Mondays",
  DAILY: "Daily",
};

/** Whether `value` is one of the schedules amplify-api accepts. */
export function isCoinSchedule(value: unknown): value is CoinSchedule {
  return value === "MONTHLY" || value === "WEEKLY" || value === "DAILY";
}

/** "1 point" or "1,240 points". */
export function pointsText(points: number): string {
  return `${num(points)} ${points === 1 ? "point" : "points"}`;
}

/** "1 Coin" or "120 Coins". */
export function coinsText(coins: number): string {
  return `${num(coins)} ${coins === 1 ? "Coin" : "Coins"}`;
}

/** What `points` become at the rate: Coins for every whole block, and the points carried over to the next one. */
export interface Conversion {
  coins: number;
  carried: number;
}

/**
 * Converts `points` at `blockPoints` points = `blockCoins` Coins. Only whole blocks convert; the rest carries over.
 * A rate without a positive block converts nothing.
 */
export function convertPoints(points: number, blockPoints: number, blockCoins: number): Conversion {
  const held = Math.max(0, Math.floor(points));
  if (!(blockPoints > 0)) return { coins: 0, carried: held };
  const blocks = Math.floor(held / blockPoints);
  return { coins: blocks * blockCoins, carried: held - blocks * blockPoints };
}

/** Progress to the next Coins, 0 to 1. Zero for a rate without a positive block. */
export function progressFraction(pointsTowardNext: number, blockPoints: number): number {
  if (!(blockPoints > 0)) return 0;
  return Math.max(0, Math.min(1, pointsTowardNext / blockPoints));
}

/** Progress to the next Coins in words, e.g. "40 / 100 points". */
export function progressText(pointsTowardNext: number, blockPoints: number): string {
  return `${num(pointsTowardNext)} / ${pointsText(blockPoints)}`;
}

/** The rate and schedule in plain words, e.g. "Every 100 points becomes 10 Coins, automatically, every Monday." */
export function conversionSentence(blockPoints: number, blockCoins: number, schedule: CoinSchedule): string {
  return `Every ${pointsText(blockPoints)} becomes ${coinsText(blockCoins)}, automatically, ${SCHEDULE_PHRASES[schedule]}.`;
}

/**
 * The points Amplify Admin's worked example converts: twelve blocks and four tenths of one, so the example always
 * shows both Coins and a carry-over (1,240 at 100 points a block).
 */
export function examplePoints(blockPoints: number): number {
  return blockPoints * 12 + Math.floor(blockPoints * 0.4);
}

/** Amplify Admin's worked example for a rate: the points, the Coins they become and the points carried over. */
export interface RateExample {
  points: number;
  coins: number;
  carried: number;
}

/**
 * Amplify Admin's worked example for a rate, e.g. 1,240 points → 120 Coins, 40 points carried over. Null for a rate
 * that can't be used (a block below one).
 */
export function rateExample(blockPoints: number, blockCoins: number): RateExample | null {
  if (!(blockPoints >= 1) || !(blockCoins >= 1)) return null;
  const points = examplePoints(blockPoints);
  return { points, ...convertPoints(points, blockPoints, blockCoins) };
}

/** The rate in plain words, e.g. "Every 100 points becomes 10 Coins, automatically." */
export function rateSentence(blockPoints: number, blockCoins: number): string {
  return `Every ${pointsText(blockPoints)} becomes ${coinsText(blockCoins)}, automatically.`;
}

/**
 * When points next convert on `schedule` (UTC, midnight): the 1st of next month, the next Monday, or tomorrow.
 * Amplify's scheduler runs the conversion on these days; the date is worked out here, not read from it.
 */
export function nextConversion(schedule: CoinSchedule, now: Date = new Date()): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (schedule === "MONTHLY") return new Date(Date.UTC(y, m + 1, 1));
  if (schedule === "DAILY") return new Date(Date.UTC(y, m, d + 1));
  const daysToMonday = ((8 - now.getUTCDay()) % 7) || 7;
  return new Date(Date.UTC(y, m, d + daysToMonday));
}

/**
 * The points that have become Coins so far: all points less the ones still held and the carry of the last conversion
 * (both still count toward the next Coins). Never negative.
 */
export function convertedPoints(allTimePoints: number, heldPoints: number, carryPoints = 0): number {
  return Math.max(0, allTimePoints - Math.max(0, heldPoints) - Math.max(0, carryPoints));
}

/**
 * How this visit's wallet check (POST /me/coins/wallet) went: still checking, found the wallet, the caller has no
 * WSO2 Coins wallet (NO_WALLET), or the Coins service couldn't be asked (COINS_UNAVAILABLE or any other failure).
 */
export type WalletCheck = "checking" | "captured" | "no-wallet" | "unavailable";

/** Under the Coins received when the caller has no WSO2 Coins wallet. */
export const NO_WALLET_NOTE = "Set up your WSO2 Coins wallet to receive Coins. Your points keep counting.";

/** Under the Coins received when the wallet couldn't be checked and none is on record. */
export const WALLET_UNKNOWN_NOTE = "Your WSO2 Coins wallet couldn't be checked just now. Your points keep counting.";

/** "Coins go to wallet 0x12ab…9f3c", for the masked address amplify-api answers. */
export function walletText(wallet: CoinWallet): string {
  return `Coins go to wallet ${wallet.walletAddress}`;
}

/**
 * The wallet line under the Coins received: the wallet on record, or guidance when the check found none, or a neutral
 * note when it couldn't be asked and none is on record. Nothing while the check runs and nothing is on record yet.
 */
export function walletLine(wallet: CoinWallet | null | undefined, check: WalletCheck): string | null {
  if (check === "no-wallet") return NO_WALLET_NOTE;
  if (wallet) return walletText(wallet);
  if (check === "unavailable") return WALLET_UNKNOWN_NOTE;
  return null;
}

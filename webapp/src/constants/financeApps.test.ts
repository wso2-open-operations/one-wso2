/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The expense app is behind a preview flag, so the registry is no longer a
 * constant — it depends on `window.config`. Everything here therefore imports
 * it fresh per state rather than at the top of the file.
 */
type FinanceApps = typeof import("./financeApps");

async function load(preview: { expenseSubmitter?: boolean } = {}): Promise<FinanceApps> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: preview,
  } as Window["config"];
  return import("./financeApps");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

// Which perspective an app belongs to is a decision, and nothing used to record
// it — the apps simply appeared wherever the registry happened to be spread.

const keys = (apps: readonly { key: string }[]) => apps.map((a) => a.key);
const paths = (apps: readonly { items: readonly { path?: string }[] }[]) =>
  apps.flatMap((a) => a.items.map((i) => i.path ?? ""));
const itemIds = (apps: readonly { items: readonly { id: string }[] }[]) =>
  apps.flatMap((a) => a.items.map((i) => i.id));

describe("where each finance app lives", () => {
  // Everyone files claims. Not everyone has a corporate card, which is why the
  // card app is not part of the set every employee needs.
  //
  // "expense" covers the same ground as "claims" → Expense under Me, but with
  // its own screens (expense/submitter, expense/history, expense/approvals)
  // rather than the Me ones — the Finance side can file for another employee
  // and decide on other people's claims, neither of which the Me side does. It
  // keeps its own registry key, distinct from "claims", which is what the other
  // invariants below actually depend on.
  it("keeps claims with the person, and both the card and expense claims with finance", async () => {
    const { ME_FINANCE_APPS, FINANCE_OVERVIEW_APPS, FINANCE_PERSPECTIVE_APPS } = await load();
    expect(keys(ME_FINANCE_APPS)).toEqual(["claims"]);
    expect(keys(FINANCE_PERSPECTIVE_APPS)).toEqual(["expense", "cc"]);
    // Reading how the allowance is spent is a different job from filing or
    // approving a claim, so the dashboards sit in their own section above the
    // apps rather than one inside each of them.
    expect(keys(FINANCE_OVERVIEW_APPS)).toEqual(["finance-overview"]);
  });

  // The flag gates the New Claim ITEM, not the whole app. New Claim duplicates
  // Me → Claims; Claim History and Finance Approvals have no such duplicate, and
  // hiding the app would take them with it.
  it("adds New Claim only when the preview flag is on", async () => {
    const off = await load({ expenseSubmitter: false });
    expect(itemIds(off.FINANCE_PERSPECTIVE_APPS)).not.toContain("expense-new");

    const on = await load({ expenseSubmitter: true });
    expect(itemIds(on.FINANCE_PERSPECTIVE_APPS)).toContain("expense-new");
  });

  it("hides New Claim on an absent flag, not only on an explicit false", async () => {
    // Production ships no entry at all; safety must not depend on remembering
    // to write `false`.
    const { FINANCE_PERSPECTIVE_APPS } = await load();
    expect(itemIds(FINANCE_PERSPECTIVE_APPS)).not.toContain("expense-new");
  });

  // The shipped entries stand on their own; only New Claim waits on the flag.
  it("keeps history and both approval entries whatever the flag says", async () => {
    for (const preview of [{}, { expenseSubmitter: true }]) {
      const { FINANCE_PERSPECTIVE_APPS } = await load(preview);
      expect(itemIds(FINANCE_PERSPECTIVE_APPS)).toContain("expense-history");
      expect(itemIds(FINANCE_PERSPECTIVE_APPS)).toContain("expense-lead-approvals");
      expect(itemIds(FINANCE_PERSPECTIVE_APPS)).toContain("expense-finance-approvals");
    }
  });

  // The order a claim travels, and the order the source app's sidebar lists
  // them in: file it, look it up, then the two review stages in sequence.
  it("lists the approval entries lead-before-finance", async () => {
    const { FINANCE_PERSPECTIVE_APPS } = await load();
    const ids = itemIds(FINANCE_PERSPECTIVE_APPS);
    expect(ids.indexOf("expense-lead-approvals")).toBeLessThan(
      ids.indexOf("expense-finance-approvals"),
    );
  });

  it("puts every app KEY in exactly one of the two", async () => {
    for (const preview of [{}, { expenseSubmitter: true }]) {
      const { FINANCE_APPS, ME_FINANCE_APPS, FINANCE_OVERVIEW_APPS, FINANCE_PERSPECTIVE_APPS } =
        await load(preview);
      const financeSide = [...keys(FINANCE_OVERVIEW_APPS), ...keys(FINANCE_PERSPECTIVE_APPS)];
      const overlap = keys(ME_FINANCE_APPS).filter((k) => financeSide.includes(k));
      expect(overlap).toEqual([]);
      expect(keys(FINANCE_APPS).sort()).toEqual([
        "cc",
        "claims",
        "expense",
        "finance-overview",
      ]);
    }
  });

  // A path under the wrong perspective is a rail entry that navigates out of
  // the perspective it was clicked in.
  it("gives each app paths under the perspective it is surfaced in", async () => {
    for (const preview of [{}, { expenseSubmitter: true }]) {
      const { ME_FINANCE_APPS, FINANCE_PERSPECTIVE_APPS } = await load(preview);
      for (const path of paths(ME_FINANCE_APPS)) expect(path.startsWith("/me/")).toBe(true);
      for (const path of paths(FINANCE_PERSPECTIVE_APPS)) {
        expect(path.startsWith("/finance/")).toBe(true);
      }
    }
  });

  it("routes every finance item through the finance gate, in both states", async () => {
    for (const preview of [{}, { expenseSubmitter: true }]) {
      const { FINANCE_APPS, FINANCE_ITEM_IDS } = await load(preview);
      for (const app of FINANCE_APPS) {
        for (const item of app.items) {
          expect(FINANCE_ITEM_IDS.has(item.id), `${item.id} bypasses the gate`).toBe(true);
        }
      }
    }
  });

  // Hiding the entry must not take the whole app down: FINANCE_EYEBROW is built
  // at module load by looking apps up in the registry, and an absent app used to
  // throw there before anything rendered.
  it("still builds its eyebrows when the expense app is hidden", async () => {
    const { FINANCE_EYEBROW } = await load();
    expect(FINANCE_EYEBROW.claims.label).toBeTruthy();
    expect(FINANCE_EYEBROW.cc.label).toBeTruthy();
    expect(FINANCE_EYEBROW.expense.label).toBeTruthy();
  });
});

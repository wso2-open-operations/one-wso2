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

/**
 * Features that are built and merged but not yet released.
 *
 * The same bundle ships everywhere and `public/config.js` differs per
 * deployment, so a feature can be live in stage and hidden in prod without
 * branching the build or holding work out of `main`.
 *
 * ```js
 * ONE_WSO2_PREVIEW_FEATURES: { expenseSubmitter: true },
 * ```
 *
 * ## Absent means off
 *
 * A feature nobody has listed is hidden. Prod is safe because nobody touched
 * its config, not because someone remembered to write `false` — the failure
 * mode of the opposite default is a half-finished screen appearing in
 * production on the day it merges.
 *
 * ## This is not the `is*Configured()` contract
 *
 * `apiConfig.ts` hides things when a backend URL is empty, which means *"not
 * wired up"*. This means *"wired up, but not for you yet"*. The two look alike
 * and answer different questions: if a preview feature's backend is also
 * missing, both apply and either one hiding it is correct.
 *
 * ## Delete the gate when the feature ships
 *
 * Every entry names the release it is waiting on. A set that only grows stops
 * describing anything — it becomes the list of things nobody cleaned up, and
 * then no one can say what production actually has. Removing a flag is part of
 * shipping the feature, not a follow-up.
 */

/**
 * Every gated feature. A union, not a string, so a typo is a compile error
 * rather than a feature that is silently never enabled anywhere.
 */
export type PreviewFeature =
  /**
   * Finance → Expense Claims → New Claim, the standalone submitter page added
   * in #43. Held back because Me → Claims already offers a new-claim flow and
   * the two entry points need reconciling before both are shown.
   */
  | "expenseSubmitter"
  /**
   * Finance → Claim Approval, rebuilt as its own section with the OPD queue
   * under it. Held back because the queue has not run against the real OPD
   * backend — the development account is refused by it — and because expense
   * approving belongs in the same section before either is shown for real.
   */
  | "claimApproval"
  /**
   * Finance → Expense Claims, the whole app.
   *
   * NOTE: this app is already in production. Gating it holds it back from prod
   * until the flag is set there, which is a deliberate decision rather than the
   * usual "not ready yet" case the other keys describe.
   */
  | "expenseClaims"
  /**
   * Finance → Credit Card Expenses, the whole app.
   *
   * NOTE: as with expenseClaims, this app is already in production and gating
   * it holds it back from prod until the flag is set there.
   */
  | "creditCardExpenses"
  /**
   * People Ops → Performance, par-app's Employee Portal ported in #61. Held back until
   * the Lead Portal, Admin Portal, Report Chain and F2F follow it over — see
   * docs/ported-apps/par-app.md §7.
   */
  | "par"
  /**
   * The whole UMT perspective — rail entry, launcher tile, landing-page
   * option, favourites eligibility, and the `/umt` route. UMT is still being
   * ported: only its dashboard exists so far (see perspectives.ts), and that
   * is gated as a whole rather than screen-by-screen because the thing that
   * needs to stay preview-only is the perspective's presence itself, not one
   * route inside it. `useUmtGate`'s own role check against the UMT backend is
   * unrelated and keeps working the same regardless of this flag.
   */
  | "umt";

/**
 * Whether a preview feature should be shown.
 *
 * Read per call rather than captured at module load: the registries that ask
 * are themselves module-level constants, and a test that flips the flag needs
 * the answer to change without reimporting half the app.
 */
export function isPreviewEnabled(feature: PreviewFeature): boolean {
  return window.config?.ONE_WSO2_PREVIEW_FEATURES?.[feature] === true;
}

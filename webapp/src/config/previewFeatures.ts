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
 * ONE_WSO2_PREVIEW_FEATURES: { quickquote: true },
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
   * Sales → QuickQuote (code name CadO2), the whole quote tool: its rail
   * group (My Quotes, My Approvals, Admin), every route under
   * `/sales/quickquote`, and its backend
   * calls. Held back as a whole until every screen is in place. CadO2's own
   * `/me` roles still decide who sees which item once this is on. See
   * docs/ported-apps/cado2.md.
   */
  | "quickquote"
  /**
   * Legal → NDA, the PDF generator — its rail entry and the `/legal/nda`
   * route. Held back until it is ready for production. Due Diligence, the
   * rest of the Legal perspective, is unaffected.
   */
  | "nda"
  /**
   * Marketing Ops → Marketing Calendar, the month view of events, content, social
   * posts and emails planned in GitHub: its rail group, the
   * `/marketing-ops/marketing-calendar` route, and its backend calls. Held back
   * while the business owners settle which GitHub items it shows
   * (digiops-marketing#1596).
   */
  | "marketingCalendar"
  /**
   * Marketing Ops → Events → Lead Import, which converts a raw event lead file
   * into the filled List Import Template: its rail entry and the
   * `/marketing-ops/events/lead-import` route. Held back until the MOP
   * lead-import backend is live in production. My Submissions and Review
   * Queue, the rest of Events, are unaffected.
   */
  | "eventsLeadImport"
  /**
   * Amplify, the whole app: its launcher tile, its rail group (Celebrate,
   * New Post, Current Posts) and every route under `/amplify`. Held back until
   * the Amplify API proxy is live for the phase 1 pilot. Who sees New Post and
   * Current Posts is still decided by amplify-api's `CAN_CAMPAIGN` grant
   * (GET /me) once this is on.
   */
  | "amplify"
  /**
   * Marketing Ops → Campaign Tracker → Pacing tab. The BudgetSyncPacingPanel
   * is still being built out; this flag hides the tab until it is ready.
   */
  | "campaignTrackerPacing"
  /**
   * Swag Store, where employees spend O2C coins on WSO2 swag: its top-bar
   * button, its launcher tile and rail, every route under `/store`, and its
   * backend calls. Held back until the store's first release is ready for
   * the pilot.
   */
  | "swagStore"
  /**
   * Finance → Procurement, where an employee raises a purchase request and
   * follows it: its rail group, every route under `/finance/procurement`, and
   * its backend calls. Held back while the app is being built: submitting a
   * request is not connected to the backend yet.
   */
  | "procurement"
  /**
   * TopBar → Ask Novera, the conversational AI assistant in the top bar. Held
   * back while it is built. With the flag on and
   * `ONE_WSO2_AGENT_ORCHESTRATOR_URL` unset, the palette says "not connected"
   * and makes no requests.
   */
  | "novera";

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

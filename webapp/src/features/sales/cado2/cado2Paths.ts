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

// Every CadO2 URL, built in one place. Nested under the Sales perspective's own
// path: findPerspectiveByPath matches with `pathname.startsWith`, so anything
// under /sales keeps the Sales rail around CadO2's screens.

export const CADO2_PATH = "/sales/cado2";

/** Admin sections, each its own route under /admin. */
export type Cado2AdminSection =
  | "approval-matrix"
  | "approval-slas"
  | "email-notifications"
  | "legal-entities"
  | "currencies"
  | "product-categories"
  | "product-bundles"
  | "legal-texts"
  | "quote-access"
  | "salesforce-sync"
  | "pricing-formulas";

/** Insights' tabs, each its own route (D106). */
export type Cado2InsightsTab = "operations" | "report";

/** The quote page's tabs, each its own route. */
export type Cado2QuoteTab = "quote" | "approvals" | "versions" | "history";

export const cado2Paths = {
  home: CADO2_PATH,
  quotes: `${CADO2_PATH}/quotes`,
  newQuote: `${CADO2_PATH}/quotes/new`,
  /**
   * A quote's page, on one of its tabs. `fromApprovals` makes the back link
   * lead to My Approvals; `version` shows an older version (view mode,
   * 2026-10-13; the latest when absent). Both are in the URL so a shared link
   * opens the same screen.
   */
  quote: (quoteId: number, tab: Cado2QuoteTab = "quote", fromApprovals = false, version?: number): string => {
    const q = new URLSearchParams();
    if (fromApprovals) q.set("from", "approvals");
    if (version) q.set("version", String(version));
    const s = q.toString();
    return `${CADO2_PATH}/quotes/${quoteId}/${tab}${s ? `?${s}` : ""}`;
  },
  /**
   * A quote's page opened from the Quote Report: its back link returns to
   * `back` (the report with its filters), labelled "Quote Report".
   */
  quoteFromInsights: (quoteId: number, back: string): string =>
    `${CADO2_PATH}/quotes/${quoteId}/quote?${new URLSearchParams({ from: "insights", back }).toString()}`,
  editVersion: (quoteId: number, version: number): string =>
    `${CADO2_PATH}/quotes/${quoteId}/versions/${version}/edit`,
  approvals: `${CADO2_PATH}/approvals`,
  /** Insights, on one of its tabs; `search` keeps a report's filters (D106). */
  insights: (tab: Cado2InsightsTab = "operations", search = ""): string =>
    `${CADO2_PATH}/insights/${tab}${search ? `?${search}` : ""}`,
  admin: `${CADO2_PATH}/admin`,
  adminSection: (section: Cado2AdminSection): string => `${CADO2_PATH}/admin/${section}`,
  /** One product's pricing formula and its version history (D82). */
  adminPricingFormula: (productId: string): string =>
    `${CADO2_PATH}/admin/pricing-formulas/${encodeURIComponent(productId)}`,
} as const;

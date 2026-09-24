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

// Registry of the Finance MIS screens, surfaced inside the Finance
// perspective. Ported from digiops-finance/apps/mis; see
// docs/ported-apps/mis.md for the behaviour each screen owes.
//
// ---- why its own file, and not financeApps.ts -----------------------------
//
// The port spec says "one MenuApp in FINANCE_PERSPECTIVE_APPS", and putting it
// there literally would break the gating. That constant feeds FINANCE_ITEM_IDS,
// which is how usePerspectiveVisibility decides to ask useFinanceGate — the
// gate for the three claim backends, which knows nothing about MIS privileges
// and would answer for every MIS id by falling through to its open default. So
// MIS gets its own registry and its own id set, exactly as Marketing Ops does,
// and is spread into the Finance perspective's sections where it is surfaced.
//
// ---- on `requires` --------------------------------------------------------
//
// `requires` takes One WSO2 capabilities, which are derived from people-app
// privilege numbers and bear no relation to MIS's own. Every entry here says
// `["admin"]` to mean RESTRICTED, nothing more — useMisGate makes the real
// decision against the MIS ARR backend's /user-info. The same convention, and
// the same reason, as marketingOpsApps.ts.
//
// This is not belt-and-braces, it is load-bearing: MIS privilege 987 is the
// same number as One WSO2's PRIVILEGE.EMPLOYEE, which every signed-in user
// holds. An MIS item that reached `sectionAllowed(requires, caps)` would be
// visible to the whole company.

import { ChartNoAxesCombinedIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";
import { MIS_PERIODS, type MisPeriod } from "@features/finance/mis/util/misViewVocabulary";

/** Root of every MIS route. */
export const MIS_PATH = "/finance/mis";

// Nested under the Finance perspective's own path, not alongside it. The source
// app lived at /finance-mis/*, which cannot be kept: findPerspectiveByPath
// matches with a bare `pathname.startsWith`, so "/finance-mis" resolves to the
// `finance` perspective and would render the wrong rail around every MIS
// screen. See docs/ported-apps/mis.md §7.
export const misPaths = {
  arrBuild: `${MIS_PATH}/arr-build`,
  qrrBuild: `${MIS_PATH}/qrr-build`,
  mrrBuild: `${MIS_PATH}/mrr-build`,
  analysis: `${MIS_PATH}/analysis`,
} as const;

/**
 * Which Build route each Period is, which is the whole of "the Period lives in
 * the path".
 *
 * Here rather than beside the view state because it is the one fact that joins
 * the two halves: `misViewState.ts` knows what a Period MEANS and nothing about
 * URLs, the registry above knows the URLs and nothing about Periods. The Period
 * control navigates through this map, and so does every test that renders a
 * Build at a Period.
 */
export const MIS_BUILD_PATH_BY_PERIOD: Readonly<Record<MisPeriod, string>> = {
  [MIS_PERIODS.ANNUALLY]: misPaths.arrBuild,
  [MIS_PERIODS.QUARTERLY]: misPaths.qrrBuild,
  [MIS_PERIODS.MONTHLY]: misPaths.mrrBuild,
};

// Only the screens that HAVE a route are listed, and all five now do. Listing
// one early is not harmless: the rail renders every visible child of a group
// whether or not it carries a path, and a pathless one falls through SideRail's
// onSelect to scrollToSection() — a no-op anywhere but the perspective's own
// overview page. So an entry without a route is a row that silently does
// nothing when clicked.
//
// A new screen joins this list in the ticket that ports it, together with its
// route, its case in useMisGate, and its tests. misApps.test.ts and
// misRail.test.ts both assert the registry and the routes stay in step.
export const MIS_APPS: readonly MenuApp[] = [
  {
    key: "mis",
    name: "MIS",
    icon: ChartNoAxesCombinedIcon,
    purpose: "Company recurring revenue, and how it moved over a period.",
    // Stay a group: an ARR reader has three or four rows depending on the ARR
    // Analysis flag, and a group that collapsed to a leaf for one of them would
    // teach a shape that changes under them. The case appMenu.ts names for this
    // flag. The Flash Dashboard is not here — it stays in the MIS app (ADR 0005).
    alwaysGroup: true,
    items: [
      {
        id: "mis-arr-build",
        label: "ARR Build",
        desc: "The annual Build: recurring revenue from an Opening to a Closing balance, by period.",
        requires: ["admin"],
        path: misPaths.arrBuild,
      },
      {
        id: "mis-qrr-build",
        label: "QRR Build",
        desc: "The same Build, quarterly, with a Cumulative toggle the annual one does not have.",
        requires: ["admin"],
        path: misPaths.qrrBuild,
      },
      {
        id: "mis-mrr-build",
        label: "MRR Build",
        desc: "The same Build, monthly, with a Cumulative toggle the annual one does not have.",
        requires: ["admin"],
        path: misPaths.mrrBuild,
      },
      // ARR Analysis is listed like any other screen, flag and all. The flag is
      // a per-reader runtime answer from GET /app-configs and this is a module
      // constant evaluated once at import, so it could not live here even if it
      // wanted to: the rail hides the row by asking `useMisGate`, which folds
      // `productsUsageEnabled` into its answer for this id. Off means the row
      // is ABSENT rather than disabled, and the route redirects to ARR Build.
      {
        id: "mis-analysis",
        label: "ARR Analysis",
        desc: "Current ARR by partner model, region and industry, over an account-level table.",
        requires: ["admin"],
        path: misPaths.analysis,
      },
    ],
  },
];

// Every MIS item id, so usePerspectiveVisibility — which answers for the rail
// and for the Finance landing alike — can dispatch these, and only these, to
// useMisGate rather than to the coarse capability check.
//
// An id missing from this set does not merely go ungated: it falls through to
// `sectionAllowed(requires, caps)`, and `requires: ["admin"]` there means a
// people-app admin, which is a different population entirely. misApps.test.ts
// asserts the set covers the registry for that reason.
export const MIS_ITEM_IDS: ReadonlySet<string> = new Set(
  MIS_APPS.flatMap((app) => app.items.map((it) => it.id)),
);

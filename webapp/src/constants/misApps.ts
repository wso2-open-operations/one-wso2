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
  flash: `${MIS_PATH}/flash`,
} as const;

export const MIS_APPS: readonly MenuApp[] = [
  {
    key: "mis",
    name: "MIS",
    icon: ChartNoAxesCombinedIcon,
    purpose: "Company recurring revenue, how it moved over a period, and the monthly P&L flash.",
    items: [
      {
        id: "mis-arr-build",
        label: "ARR Build",
        desc: "Annual recurring revenue from opening to closing balance, by period.",
        requires: ["admin"],
        path: misPaths.arrBuild,
      },
      // No `path` yet on the three below, deliberately. A pathless item is a
      // "not here yet" card on the Finance overview rather than a rail entry
      // that navigates nowhere — the same way marketingOpsApps.ts stays ahead
      // of its own implementation, phase by phase. The ticket that ports each
      // screen uncomments its path here and adds the route, in one change, so
      // the rail never advertises a screen that does not exist.
      {
        id: "mis-qrr-build",
        label: "QRR Build",
        desc: "The same build, quarterly, with a cumulative view.",
        requires: ["admin"],
        // path: misPaths.qrrBuild,   ← ticket 12
      },
      {
        id: "mis-mrr-build",
        label: "MRR Build",
        desc: "The same build, monthly, with a cumulative view.",
        requires: ["admin"],
        // path: misPaths.mrrBuild,   ← ticket 12
      },
      {
        id: "mis-analysis",
        label: "ARR Analysis",
        desc: "Current ARR by partner model, region, industry and customer lifetime.",
        requires: ["admin"],
        // path: misPaths.analysis,   ← ticket 13
      },
      {
        id: "mis-flash",
        label: "Flash Dashboard",
        desc: "The monthly P&L flash: revenue, cost of sales, gross profit and margin.",
        requires: ["admin"],
        path: misPaths.flash,
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

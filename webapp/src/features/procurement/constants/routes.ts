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

// Every Procurement route in one place, behind one prefix.
//
// The standalone purchasing app owns its whole origin, so its routes are
// top-level (/requests, /approvals, /vendors, /settings…). Inside One WSO2 those
// would collide with the portal's namespace, so everything moves under
// /procurement. `p()` exists so the ~31 absolute path literals ported from that
// app become one edit rather than thirty-one, and so a future move of the
// prefix is a single change here.
export const PROCUREMENT_BASE = "/procurement";

/** Prefixes an in-app purchasing path. `p("/requests/4")` → "/procurement/requests/4". */
export function p(path = ""): string {
  return `${PROCUREMENT_BASE}${path}`;
}

// Named routes, so pages and the rail registry cannot drift apart.
//
// Most of these are NOT registered in App.tsx yet — the table is deliberately
// ahead of the routes, the same way the rail registry is. Nothing may link to an
// entry before its `<Route>` exists: App.tsx's catch-all turns such a click into
// a silent redirect to the user's landing perspective. `request` is the one that
// bit: until the detail view is ported, a reference links OUT to the standalone
// app instead — see PrReferenceLink and purchasingWebAppRequestUrl.
export const procurementRoutes = {
  /** Routed. Also the perspective root, which is why the rail registry omits it. */
  home: p(),
  /** Routed. */
  myRequests: p("/my-requests"),
  /** NOT routed until Phase 2, which ports the requisition form. */
  newRequest: p("/requests/new"),
  requests: p("/requests"),
  /** NOT routed until Phase 2. See the note above before linking to this. */
  request: (id: number | string) => p(`/requests/${id}`),
  /** Routed. */
  approvals: p("/approvals"),
  quotations: p("/quotations"),
  contracts: p("/contracts"),
  grns: p("/grns"),
  invoices: p("/invoices"),
  vendors: p("/vendors"),
  businessUnits: p("/business-units"),
  analyticsPRs: p("/analytics/purchase-requests"),
  users: p("/users"),
  audit: p("/audit"),
  settings: p("/settings"),
} as const;

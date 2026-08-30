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

// @vitest-environment node
//
// These are pure functions over the /api/v1/me payload — no DOM, no React, so
// the node environment is the honest one to run them in and it keeps them fast.
//
// It was originally chosen to dodge a jsdom failure (html-encoding-sniffer@6
// require()ing the ESM-only @exodus/bytes). That turned out to be a Node 18
// artifact, not a repo bug: on Node 22 the whole suite passes under jsdom.
// Vite 7 requires Node 20.19+ anyway, so Node 18 cannot run the dev server.
//
// Importing the policy module rather than the hook keeps @asgardeo/* out of the
// graph, which the node resolver rejects (a directory import of buffer/). That
// separation is worth keeping on its own merits — the policy is testable without
// pulling in an auth SDK.

import { describe, expect, it } from "vitest";
import {
  ITEM_PERMISSION,
  permissionsFrom,
  procurementCanSee,
} from "./procurementPermissions";
import {
  PROCUREMENT_APPS,
  PROCUREMENT_ITEM_IDS,
  PROCUREMENT_ROUTED_ITEM_IDS,
} from "@constants/procurementApps";
import { PROCUREMENT_BASE } from "../constants/routes";
import type { PurchasingMe, Role } from "./purchasingTypes";

// These are the role rules the standalone purchasing app gates on
// (lib/nav/navModel.ts). They are duplicated across two front ends by necessity,
// so they are pinned here — a silent divergence would either hide screens from
// people who should have them or show screens the backend then 403s.

function me(roles: Role[], isApprover = false): PurchasingMe {
  return {
    id: 1,
    sub: "sub-1",
    email: "someone@wso2.com",
    name: "Someone",
    roles,
    is_approver: isApprover,
  };
}

const OPEN_TO_ALL = ["proc-home", "proc-my-requests", "proc-approvals"];
const QUEUE = [
  "proc-requests",
  "proc-quotations",
  "proc-contracts",
  "proc-grns",
  "proc-invoices",
];
const ADMIN_ONLY = ["proc-users"];
const ELEVATED = [
  "proc-vendors",
  "proc-business-units",
  "proc-audit",
  "proc-settings",
  "proc-analytics-prs",
];

function canSeeAll(roles: Role[], ids: string[]): boolean {
  const perms = permissionsFrom(me(roles));
  return ids.every((id) => procurementCanSee(id, perms, true));
}

describe("permissionsFrom", () => {
  it("gives plain staff nothing beyond the open screens", () => {
    const perms = permissionsFrom(me(["staff"]));
    expect(perms).toEqual({
      procurement: false,
      isAdmin: false,
      canManageVendors: false,
      canManageBusinessUnits: false,
      canViewAuditLog: false,
      canViewAnalytics: false,
      isApprover: false,
    });
  });

  it("gives `procurement` the working queue but no admin surface", () => {
    const perms = permissionsFrom(me(["staff", "procurement"]));
    expect(perms.procurement).toBe(true);
    expect(perms.isAdmin).toBe(false);
    expect(perms.canManageVendors).toBe(false);
    expect(perms.canViewAuditLog).toBe(false);
    expect(perms.canViewAnalytics).toBe(false);
  });

  it("treats procurement_admin as the master key short of user management", () => {
    const perms = permissionsFrom(me(["staff", "procurement_admin"]));
    expect(perms.procurement).toBe(true);
    expect(perms.canManageVendors).toBe(true);
    expect(perms.canManageBusinessUnits).toBe(true);
    expect(perms.canViewAuditLog).toBe(true);
    expect(perms.canViewAnalytics).toBe(true);
    // Managing users stays admin-only.
    expect(perms.isAdmin).toBe(false);
  });

  it("gives admin everything", () => {
    const perms = permissionsFrom(me(["staff", "admin"]));
    expect(Object.values(perms).every((v) => v === true || v === false)).toBe(true);
    expect(perms.procurement).toBe(true);
    expect(perms.isAdmin).toBe(true);
    expect(perms.canManageVendors).toBe(true);
    expect(perms.canViewAuditLog).toBe(true);
  });

  it("reads is_approver from the server, not from roles", () => {
    // legal/security/compliance approvers hold no procurement role, and a budget
    // approver may hold no role at all — which is exactly why the backend
    // computes this flag instead of the client deriving it.
    expect(permissionsFrom(me(["staff"], true)).isApprover).toBe(true);
    expect(permissionsFrom(me(["staff", "legal"], false)).isApprover).toBe(false);
  });

  it("is empty for an unresolved viewer", () => {
    const perms = permissionsFrom(undefined);
    expect(Object.values(perms).every((v) => v === false)).toBe(true);
  });
});

describe("procurementCanSee", () => {
  const admin = permissionsFrom(me(["staff", "admin"]));
  const staff = permissionsFrom(me(["staff"]));

  it("shows the routed screens to every role, including plain staff", () => {
    for (const roles of [["staff"], ["staff", "legal"], ["staff", "procurement"]] as Role[][]) {
      expect(canSeeAll(roles, OPEN_TO_ALL)).toBe(true);
    }
  });

  it("hides every screen that has no route yet, even from an admin", () => {
    // Phase 1 routes only the three open screens. An item with no route must be
    // hidden rather than rendered as a row that goes nowhere — and hidden from
    // ADMINS too, since permission is not the constraint here.
    for (const id of [...QUEUE, ...ELEVATED, ...ADMIN_ONLY]) {
      expect(procurementCanSee(id, admin, true)).toBe(false);
    }
    // This is the assertion that will fail — deliberately — as Phase 2 lands:
    // adding a route to the registry should force a look at this test.
    expect([...PROCUREMENT_ROUTED_ITEM_IDS].sort()).toEqual([...OPEN_TO_ALL].sort());
  });

  it("shows nothing at all until the viewer is authorized", () => {
    for (const id of PROCUREMENT_ITEM_IDS) {
      expect(procurementCanSee(id, admin, false)).toBe(false);
    }
  });

  it("fails closed on an unrecognised id", () => {
    // A typo in the registry must hide a screen (visible, reported) rather than
    // open a restricted one (invisible, not reported).
    expect(procurementCanSee("proc-typo", staff, true)).toBe(false);
    expect(procurementCanSee("", staff, true)).toBe(false);
  });

  it("decides a permission for every registered item", () => {
    // Guards the other direction: adding a rail item and forgetting to decide who
    // sees it. Every id must be either explicitly permissioned or explicitly open.
    const open = new Set(OPEN_TO_ALL);
    for (const id of PROCUREMENT_ITEM_IDS) {
      const decided = id in ITEM_PERMISSION || open.has(id);
      expect(decided, `${id} has no permission decision`).toBe(true);
    }
    expect(PROCUREMENT_ITEM_IDS.size).toBe(14);
  });

  it("permissions each restricted item at the level the standalone app does", () => {
    // Routing aside, the role rules themselves: this is the table that must not
    // drift from lib/nav/navModel.ts.
    expect(ITEM_PERMISSION["proc-requests"]).toBe("procurement");
    expect(ITEM_PERMISSION["proc-quotations"]).toBe("procurement");
    expect(ITEM_PERMISSION["proc-contracts"]).toBe("procurement");
    expect(ITEM_PERMISSION["proc-grns"]).toBe("procurement");
    expect(ITEM_PERMISSION["proc-invoices"]).toBe("procurement");
    expect(ITEM_PERMISSION["proc-analytics-prs"]).toBe("canViewAnalytics");
    expect(ITEM_PERMISSION["proc-vendors"]).toBe("canManageVendors");
    expect(ITEM_PERMISSION["proc-business-units"]).toBe("canManageBusinessUnits");
    expect(ITEM_PERMISSION["proc-users"]).toBe("isAdmin");
    expect(ITEM_PERMISSION["proc-audit"]).toBe("canViewAuditLog");
    expect(ITEM_PERMISSION["proc-settings"]).toBe("canManageBusinessUnits");
  });
});

// The registry feeds three things that live in files this port shares with the
// rest of One WSO2 (perspectives.ts, SideRail.tsx, App.tsx), so its invariants
// are what an upstream rebase is most likely to break quietly.
describe("PROCUREMENT_APPS registry", () => {
  const items = PROCUREMENT_APPS.flatMap((app) => app.items);

  it("has unique ids", () => {
    const ids = items.map((it) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("namespaces every id, so the rail's gate dispatch cannot collide with another perspective", () => {
    for (const it of items) expect(it.id.startsWith("proc-")).toBe(true);
  });

  it("keeps every route under the perspective's own prefix", () => {
    // A path outside /procurement would switch the active perspective mid-click.
    for (const it of items) {
      if (it.path) expect(it.path.startsWith(PROCUREMENT_BASE)).toBe(true);
    }
  });

  it("derives the routed set from the paths actually present", () => {
    const withPath = items.filter((it) => it.path).map((it) => it.id).sort();
    expect([...PROCUREMENT_ROUTED_ITEM_IDS].sort()).toEqual(withPath);
    expect(PROCUREMENT_ITEM_IDS.size).toBe(items.length);
  });

  it("gives every item a description, since the launcher renders it", () => {
    for (const it of items) expect(it.desc.length).toBeGreaterThan(0);
  });
});

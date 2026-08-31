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

// Who may see what, as pure functions over /api/v1/me.
//
// Deliberately free of React and of @asgardeo/* so it can be unit-tested on its
// own: these rules are duplicated from the standalone purchasing app's
// lib/nav/navModel.ts by necessity (two front ends, two repos, no shared
// package), so they are the one part of this port that most needs tests.
//
// Everything here is UX only. Every endpoint is enforced server-side regardless.

import { PROCUREMENT_ITEM_IDS, PROCUREMENT_ROUTED_ITEM_IDS } from "@constants/procurementApps";
import type { PurchasingMe, Role } from "./purchasingTypes";

/** The viewer's derived permissions. Mirrors navModel.ts's NavPermissions. */
export interface ProcurementPermissions {
  /** May act on procurement work — the queue, quotations, contracts, GRNs, invoices. */
  procurement: boolean;
  isAdmin: boolean;
  canManageVendors: boolean;
  canManageBusinessUnits: boolean;
  canViewAuditLog: boolean;
  canViewAnalytics: boolean;
  /** Approves PRs they didn't submit. Server-computed; roles cannot tell. */
  isApprover: boolean;
}

const NONE: ProcurementPermissions = {
  procurement: false,
  isAdmin: false,
  canManageVendors: false,
  canManageBusinessUnits: false,
  canViewAuditLog: false,
  canViewAnalytics: false,
  isApprover: false,
};

function has(roles: Role[] | undefined, ...wanted: Role[]): boolean {
  return Boolean(roles?.some((r) => wanted.includes(r)));
}

/** Pure: /api/v1/me → permissions. Exported for the tests. */
export function permissionsFrom(me: PurchasingMe | undefined): ProcurementPermissions {
  if (!me) return NONE;
  const roles = me.roles;
  // admin / procurement_admin is the master key for every master-data and
  // reporting surface; `procurement` alone gets the working queue but no admin.
  const elevated = has(roles, "admin", "procurement_admin");
  return {
    procurement: has(roles, "procurement", "procurement_admin", "admin"),
    isAdmin: has(roles, "admin"),
    canManageVendors: elevated,
    canManageBusinessUnits: elevated,
    canViewAuditLog: elevated,
    canViewAnalytics: elevated,
    isApprover: Boolean(me.is_approver),
  };
}

// Which permission each rail item needs. Items absent from this map are open to
// every authenticated caller (My requests, New request, Approvals — the things
// any employee does for themself). The perspective's overview is not listed at
// all: SideRail renders that row from `active.path`, not from this registry.
export const ITEM_PERMISSION: Record<string, keyof ProcurementPermissions> = {
  "proc-requests": "procurement",
  "proc-quotations": "procurement",
  "proc-contracts": "procurement",
  "proc-grns": "procurement",
  "proc-invoices": "procurement",
  "proc-analytics-prs": "canViewAnalytics",
  "proc-vendors": "canManageVendors",
  "proc-business-units": "canManageBusinessUnits",
  "proc-users": "isAdmin",
  "proc-audit": "canViewAuditLog",
  "proc-settings": "canManageBusinessUnits",
};

/**
 * Pure: may this viewer see this rail item?
 *
 * Two gates: the item must be ROUTED (its screen exists in this build) and the
 * viewer must hold the permission it needs.
 *
 * Fails CLOSED for an unknown id that looks like one of ours — a typo in the
 * registry hides a screen (visible, reported) rather than opening a restricted
 * one (invisible, not reported). Ids from other perspectives are not ours to
 * judge and pass through.
 */
export function procurementCanSee(
  itemId: string,
  perms: ProcurementPermissions,
  authorized: boolean,
): boolean {
  if (!authorized) return false;
  // Not built yet — hidden regardless of role. Dropping this check is all Phase 2
  // needs once the screens have routes.
  if (!PROCUREMENT_ROUTED_ITEM_IDS.has(itemId)) return false;
  const needed = ITEM_PERMISSION[itemId];
  if (needed) return perms[needed];
  if (PROCUREMENT_ITEM_IDS.has(itemId)) return true; // open to everyone
  return false; // unrecognised procurement id → closed
}

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

// The rail's view of the Swag Store admin screens, beside the other rail
// gates. Nothing here is access control: the backend re-checks every call.

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { describeError } from "@api/errors";
import { isSwagStoreBackendConfigured } from "@config/apiConfig";
import { swagStoreAccess, type SwagStoreAccess } from "../../api/swagStoreAccess";
import { useSwagStoreUserInfo } from "../../api/useSwagStoreUserInfo";
import { SWAG_STORE_ADMIN_GROUP_ID, SWAG_STORE_ADMIN_ITEM } from "../swagStoreAdminItems";

/** Who an admin screen is for. */
export type SwagStoreAdminNeed = "CATALOG_MANAGER" | "FULFILMENT_OPS" | "ANY";

/** Whether an access answer lets a person use a screen that needs `need`. */
export function swagStoreAdminAllows(need: SwagStoreAdminNeed, access: SwagStoreAccess): boolean {
  switch (need) {
    case "CATALOG_MANAGER":
      return access.isCatalogManager;
    case "FULFILMENT_OPS":
      return access.isFulfilmentOps;
    case "ANY":
      return access.isAdmin;
  }
}

/** Which rail rows an access answer opens. The group shows when any of its rows does. */
export function swagStoreAdminCanSee(itemId: string, access: SwagStoreAccess): boolean {
  switch (itemId) {
    case SWAG_STORE_ADMIN_GROUP_ID:
    case SWAG_STORE_ADMIN_ITEM.dashboard:
      return access.isAdmin;
    case SWAG_STORE_ADMIN_ITEM.orders:
    case SWAG_STORE_ADMIN_ITEM.settings:
      return access.isFulfilmentOps;
    case SWAG_STORE_ADMIN_ITEM.products:
    case SWAG_STORE_ADMIN_ITEM.demand:
      return access.isCatalogManager;
    default:
      // Fail closed: an admin id with no case here is hidden from everyone.
      return false;
  }
}

export interface SwagStoreAdminRailGate {
  canSee: (itemId: string) => boolean;
  isResolving: boolean;
  /** The access check itself failed; reported as "couldn't check", never as "no access". */
  isError: boolean;
  errorMessage: string | undefined;
  retry: () => void;
}

/**
 * Hidden while the store's /users/me is in flight, so rows never flash in for
 * someone without a role, and when the check failed (failing closed, reported
 * through isError). With no backend URL every row stays: there is nothing to
 * ask, and each page explains what is missing.
 *
 * @param enabled - Whether People Ops is the open perspective and the store is switched on
 */
export function useSwagStoreAdminRailGate(enabled: boolean): SwagStoreAdminRailGate {
  const me = useSwagStoreUserInfo(enabled);
  const configured = isSwagStoreBackendConfigured();
  const active = enabled && configured;
  const isResolving = active && (me.isPending || me.isLoading);
  const failed = active && me.isError;
  const access = swagStoreAccess(me.data);
  return {
    canSee: (itemId) => {
      if (!configured) return true;
      if (!active || isResolving || failed) return false;
      return swagStoreAdminCanSee(itemId, access);
    },
    isResolving,
    isError: failed,
    errorMessage: failed ? describeError(me.error) : undefined,
    retry: () => void me.refetch(),
  };
}

export function swagStoreAdminVisibility(gate: SwagStoreAdminRailGate): VisibilityAnswer {
  const canSee = (id: string) => gate.canSee(id);
  return gate.isError
    ? { canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee, resolving: gate.isResolving, retry: () => undefined };
}

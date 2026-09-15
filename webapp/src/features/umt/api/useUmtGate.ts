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

import { describeError } from "@api/errors";
import { UMT_ROLE_ID, type UmtRole } from "./umtTypes";
import { useUmtUserInfo } from "./useUmtUserInfo";

export interface UmtGate {
  /** The caller holds at least one role accepted by UMT. */
  isAuthorized: boolean;
  isUser: boolean;
  isAdmin: boolean;
  isProductLead: boolean;
  hasRole: (role: UmtRole) => boolean;
  /** True until identity and /update/user-info produce an access decision. */
  isResolving: boolean;
  /** A failed access check, distinct from a completed denial. */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

// `/update/user-info` deliberately exposes numeric privileges. Convert them at
// the authorization boundary so dashboard consumers only deal with the named
// UMT roles rather than service-specific IDs.
function umtRolesFromIds(roleIds: readonly number[] | undefined): Set<UmtRole> {
  const roles = new Set<UmtRole>();
  if (!roleIds) return roles;

  for (const [role, id] of Object.entries(UMT_ROLE_ID) as [UmtRole, number][]) {
    if (roleIds.includes(id)) roles.add(role);
  }

  return roles;
}

// Translates UMT's numeric service roles into the named decisions consumed by
// the shell and dashboard. Any recognised role grants entry to the perspective;
// `isAdmin` additionally gates product management and release-chunk creation.
//
// This deliberately does not read People capabilities. UMT owns a separate
// role vocabulary, returned by its own /update/user-info endpoint.
export function useUmtGate(enabled = true): UmtGate {
  const userInfo = useUmtUserInfo(enabled);
  const roles = umtRolesFromIds(userInfo.data?.roles);
  const hasRole = (role: UmtRole): boolean => roles.has(role);

  return {
    isAuthorized: roles.size > 0,
    isUser: hasRole("UMT_USER"),
    isAdmin: hasRole("UMT_ADMIN"),
    isProductLead: hasRole("PRODUCT_LEAD"),
    hasRole,
    // `isPending`, not `isLoading`: the query is disabled while the Asgardeo
    // subject resolves, but the authorization decision is still outstanding.
    isResolving: enabled && userInfo.isPending,
    isError: userInfo.isError,
    errorMessage: userInfo.isError ? describeError(userInfo.error) : undefined,
    retry: () => void userInfo.refetch(),
  };
}

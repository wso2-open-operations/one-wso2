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

// The Procurement authorization gate.
//
// Purchasing keeps its roles in its OWN database — granted and revoked by admins
// in-app, re-read on every request — so they bear no relation to the people-app
// privilege numbers the rest of One WSO2 gates on (@constants/appMenu). Reading
// the registry's `requires` against those capabilities would show a people-app
// admin every procurement screen and hide them from an actual procurement admin.
// SideRail therefore asks this gate, exactly as it already asks useFinanceGate
// and useMarketingOpsGate.
//
// The predicates below are the same ones the standalone app's lib/nav/navModel.ts
// gates on. They are the shared contract between the two front ends: change a
// role rule here and there in the same PR. Everything is UX only — every
// endpoint is enforced server-side regardless. The role matrix this implements is
// tabulated in docs/ported-apps/purchasing-app.md §4.

import { describeError } from "@api/errors";
import { usePurchasingMe } from "./usePurchasingMe";
import {
  permissionsFrom,
  procurementCanSee,
  type ProcurementPermissions,
  type ProcurementRequirement,
} from "./procurementPermissions";

export { permissionsFrom, procurementCanSee };
export type { ProcurementPermissions, ProcurementRequirement };

export interface ProcurementGate {
  canSee: (itemId: string) => boolean;
  /** True once /api/v1/me answered — every WSO2 employee is authorized. */
  isAuthorized: boolean;
  permissions: ProcurementPermissions;
  isResolving: boolean;
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function useProcurementGate(enabled = true): ProcurementGate {
  const me = usePurchasingMe(enabled);
  const permissions = permissionsFrom(me.data);
  // Unlike Marketing Ops there is no "member of the app" notion: the backend
  // self-provisions any authenticated employee with the `staff` role, so a 200
  // from /me IS the authorization. What varies is which items they see.
  const isAuthorized = Boolean(me.data);

  return {
    canSee: (itemId: string) => procurementCanSee(itemId, permissions, isAuthorized),
    isAuthorized,
    permissions,
    isResolving: enabled && me.isPending,
    isError: me.isError,
    errorMessage: me.isError ? describeError(me.error) : undefined,
    retry: () => void me.refetch(),
  };
}

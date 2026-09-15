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
import { isMisArrConfigured } from "@config/apiConfig";
import { useMisUserInfo } from "./useMisUserInfo";
import { MIS_PRIVILEGE, misHasPrivilege } from "./misTypes";

// Which MIS privilege each menu item needs. The ONLY place a One WSO2 menu id
// is tied to a MIS privilege number — same shape, and the same reason, as
// useMarketingOpsGate's ITEM_CAPABILITY.
//
// One privilege covers ALL the ARR screens, not one per screen: the source app
// gates ARR Build, QRR, MRR and ARR Analysis on a single ARR_DASHBOARD number
// (Config.js:56). QRR and MRR joined in ticket 12 and share that number, so the
// ARR privilege opens all three Builds at once; ARR Analysis is the last one
// still to come, and joins with ARR_DASHBOARD in the ticket that routes it.
//
// An id missing from this map is refused. That is stricter than the sibling
// gates, which fall through to an open default for their unrestricted items —
// MIS has no unrestricted screen, so there is nothing for a default to open.
const ITEM_PRIVILEGE: Record<string, number> = {
  "mis-arr-build": MIS_PRIVILEGE.ARR_DASHBOARD,
  "mis-qrr-build": MIS_PRIVILEGE.ARR_DASHBOARD,
  "mis-mrr-build": MIS_PRIVILEGE.ARR_DASHBOARD,
  "mis-flash": MIS_PRIVILEGE.FLASH_DASHBOARD,
};

export interface MisGate {
  // May this menu item be shown? Used by the rail and the pages alike, so a
  // visible item is always one whose screen the caller can actually open.
  canSee: (itemId: string) => boolean;
  // Does the caller hold ANY MIS privilege. False for an authenticated WSO2
  // employee who simply isn't in either MIS group — which is most of the
  // company, so the screens say so plainly rather than rendering an empty rail.
  isAuthorized: boolean;
  // True while /user-info is in flight. Callers must hold off on rendering a
  // denial until this clears, or every cold load flashes one.
  isResolving: boolean;
  // The call itself failed — network, gateway, or identity. Distinct from
  // `isAuthorized === false` on purpose: both leave us without privileges and
  // it would be easy to collapse them, but "you're not in the MIS group" is a
  // reason to go and ask, while "the request failed" is a reason to retry.
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

// Gates the Finance MIS menu against the MIS ARR backend's own privileges
// rather than the One WSO2 capabilities the rail normally reads.
//
// It has to be its own gate, not a `requires` rule, because MIS's privilege
// 987 and One WSO2's PRIVILEGE.EMPLOYEE 987 are the same number meaning
// opposite things — "may see company ARR" versus "is signed in". Reading one
// for the other publishes the revenue of the company to everybody. See
// misTypes.ts and CONTEXT.md.
//
// `enabled` avoids firing /user-info while MIS isn't on screen.
export function useMisGate(enabled = true): MisGate {
  const userInfo = useMisUserInfo(enabled);

  // Independent, not nested. The backend pushes each number on its own group
  // check, so holding one and not the other is the ordinary case: finance sees
  // Flash, revenue leadership sees ARR, and few people see both.
  const hasArr = misHasPrivilege(userInfo.data, MIS_PRIVILEGE.ARR_DASHBOARD);
  const hasFlash = misHasPrivilege(userInfo.data, MIS_PRIVILEGE.FLASH_DASHBOARD);

  const canSee = (itemId: string): boolean => {
    const required = ITEM_PRIVILEGE[itemId];
    if (required === MIS_PRIVILEGE.ARR_DASHBOARD) return hasArr;
    if (required === MIS_PRIVILEGE.FLASH_DASHBOARD) return hasFlash;
    // Unmapped: refused. A screen added to the registry without a line in
    // ITEM_PRIVILEGE is invisible rather than public.
    return false;
  };

  return {
    canSee,
    isAuthorized: hasArr || hasFlash,
    // `isPending`, not `isLoading`: this query waits on the Asgardeo sub, and
    // during that window isLoading is already false. Callers reading it would
    // see a finished check with no privileges and flash a denial on every cold
    // load. Same choice as useMarketingOpsGate and useLeaveGate.
    //
    // And only while there is a backend to ask. Unconfigured, the query is
    // disabled, and a disabled query is `isPending` for ever — so this would
    // never clear, and `usePerspectiveVisibility` holds the Finance landing
    // until every gate has. useDueDiligenceGate has the same guard.
    isResolving: enabled && isMisArrConfigured() && userInfo.isPending,
    isError: userInfo.isError,
    // describeError never surfaces the raw response body — see @api/errors.
    errorMessage: userInfo.isError ? describeError(userInfo.error) : undefined,
    retry: () => void userInfo.refetch(),
  };
}

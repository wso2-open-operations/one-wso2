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

import type { JSX, ReactNode } from "react";
import { Box } from "@wso2/oxygen-ui";
import { Navigate } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMasterDataAccess } from "@features/finance/masterdata/useMasterDataAccess";

/**
 * Closes the four Master Data screens to everyone else, at the route.
 *
 * The registry's `requires: ["admin"]` on these items only controls what the
 * RAIL offers — every one of `/finance/master-data/*` was still mounted
 * unconditionally in App.tsx, so a direct URL (typed, bookmarked, or shared)
 * opened it for any signed-in user regardless of role.
 *
 * The check is now this backend's OWN verdict, asked of its `/user-info`
 * (`useMasterDataAccess`). It used to be people-app privilege 999 (`admin`),
 * which was all the portal had while that endpoint returned nothing but an
 * email and an avatar — and 999 is the portal's generic administrator, not a
 * finance role, so it both admitted portal admins the backend then refused
 * and turned away the finance staff who actually maintain these tables.
 *
 * Note this guard is still the portal's own belt-and-braces, not the only
 * control: the backend refuses every master-data resource to a reader outside
 * `app-finance-masterdata-admin`. Keeping it means a reader who cannot use the
 * screen is told so instead of being shown four tables that all error.
 *
 * Deliberately NOT built on the full `useFinanceGate`. That hook also mounts
 * the cc/opd/expense queries, which have nothing to do with this answer, and
 * a route guard calling it would hold this page on a blank screen until all
 * three settled — so a slow or erroring one of those in some environment
 * blocked a page whose access question only ever depended on identity and
 * this one backend. `useMasterDataAccess` asks exactly that and nothing else.
 *
 * Same shape as SriLankaRoute / ParRequiresTeamLeadRoute:
 *
 *  - Wait rather than refuse. Unresolved reads as "not yet known", and
 *    redirecting on that would throw an actual admin off the screen on
 *    every cold load, before their privileges have loaded.
 *  - A failed lookup is not a refusal. Say the check failed and offer a
 *    retry — silently redirecting would send someone away with nothing to
 *    act on and no way back in without reloading.
 */
export default function MasterDataRoute({ children }: { children: ReactNode }): JSX.Element | null {
  const access = useMasterDataAccess();

  if (access.isResolving) return null;

  if (access.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={access.error} onRetry={access.retry}>
          Couldn&apos;t check your access.
        </ErrorNotice>
      </Box>
    );
  }

  if (!access.isAdmin) return <Navigate to="/finance" replace />;

  return <>{children}</>;
}

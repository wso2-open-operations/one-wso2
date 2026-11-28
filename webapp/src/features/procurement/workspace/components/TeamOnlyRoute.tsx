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

import { Outlet } from "react-router";
import { Alert, Button, Skeleton } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useProcurementMe } from "../../api/useProcurement";
import { hasAdminRole, hasTeamRole } from "../teamAccess";

/**
 * Renders the Procurement team's screens for the team, and tells anyone else so.
 *
 * @param adminOnly - Open the screens to the team's admins only
 */
export default function TeamOnlyRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const me = useProcurementMe();
  const allowed = (roles: string[]) => (adminOnly ? hasAdminRole(roles) : hasTeamRole(roles));
  return (
    <>
      {me.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void me.refetch()}>
              Retry
            </Button>
          }
        >
          {describeError(me.error)}
        </Alert>
      )}
      {me.isPending && !me.isError && <Skeleton variant="rounded" height={200} />}
      {me.data && !allowed(me.data.roles) && (
        <Alert severity="info">
          These screens are for {adminOnly ? "Procurement admins" : "the Procurement team"}. You don't have access to them.
        </Alert>
      )}
      {me.data && allowed(me.data.roles) && <Outlet />}
    </>
  );
}

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
import { Navigate } from "react-router";
import { swagStoreAccess } from "../../api/swagStoreAccess";
import { useSwagStoreUserInfo } from "../../api/useSwagStoreUserInfo";
import { swagStoreAdminAllows, type SwagStoreAdminNeed } from "../api/useSwagStoreAdminGate";
import { swagStoreAdminPaths } from "../swagStoreAdminItems";

interface SwagStoreAdminRequiresProps {
  readonly need: SwagStoreAdminNeed;
  readonly children: ReactNode;
}

/**
 * One admin screen's role check. Someone who reaches a screen they can't use
 * is sent to the admin landing, which picks a screen they can; nothing is only
 * hidden. It renders inside SwagStoreAdminShell, so the answer is already in.
 */
export default function SwagStoreAdminRequires({ need, children }: SwagStoreAdminRequiresProps): JSX.Element {
  const me = useSwagStoreUserInfo();
  if (!swagStoreAdminAllows(need, swagStoreAccess(me.data))) {
    return <Navigate to={swagStoreAdminPaths.root} replace />;
  }
  return <>{children}</>;
}

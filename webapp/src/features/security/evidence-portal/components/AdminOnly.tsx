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

import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { evidencePortalPaths } from "../paths";

// Cost and Catalogue are admin only, as in the standalone app. Wait for the
// first /me round trip before deciding, so an admin is never bounced off their
// own page while their role is still loading.
export default function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, isLoaded } = useCurrentUser();
  if (!isLoaded) return null;
  return isAdmin ? children : <Navigate to={evidencePortalPaths.dashboard} replace />;
}

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

import { isIsacBackendConfigured } from "@config/apiConfig";
import { useIsacMe, type IsacUser } from "../api/queries";

/** The caller's ISAC role, as the ISAC screens read it. */
export interface UserRole {
  currentUser: IsacUser | null;
  isAdmin: boolean;
  /** True until the first answer from the ISAC API arrives. */
  loading: boolean;
  /** Asks the ISAC API for the role again. */
  refresh: () => void;
}

/** The current ISAC user, whether they are an ISAC admin, and a way to re-check. */
export function useUserRole(): UserRole {
  const me = useIsacMe(isIsacBackendConfigured());
  return {
    currentUser: me.data ?? null,
    isAdmin: me.data?.role === "admin",
    loading: me.isPending,
    refresh: () => void me.refetch(),
  };
}

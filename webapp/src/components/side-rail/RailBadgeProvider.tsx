/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { useCcRailBadges } from "@features/finance/cc/useCcRailBadges";
import type { ReactNode } from "react";
import type { RailBadgeMap } from "./railBadge";
import { RailBadgeContext, type RailBadges } from "./useRailBadges";

/**
 * Collects the badges every feature reports for its rail rows and tabs, once for the whole app, and gives them to
 * `useRailBadges`. An id shows one badge; if two features report one for the same id, the later wins. Mount it
 * inside `PerspectiveProvider`.
 */
export function RailBadgeProvider({ children }: { children: ReactNode }) {
  const perspective = useActivePerspective().key;
  // Each feature's badge hook, enabled only in its own perspective.
  const sources: RailBadgeMap[] = [useCcRailBadges(perspective === "finance")];
  const badges: RailBadgeMap = Object.assign({}, ...sources);
  const value: RailBadges = { resolveBadge: (id) => badges[id] };
  return <RailBadgeContext.Provider value={value}>{children}</RailBadgeContext.Provider>;
}

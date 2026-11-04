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

import { createContext, useContext } from "react";
import type { ResolveBadge } from "./railBadge";

/** The badges features report for rail rows and tabs. */
export interface RailBadges {
  /** The badge on a rail row or tab id, if a feature reports one. */
  resolveBadge: ResolveBadge;
}

/** No badges, for a component rendered outside `RailBadgeProvider`. */
const NO_BADGES: RailBadges = { resolveBadge: () => undefined };

/** Carries the badges `RailBadgeProvider` collects. */
export const RailBadgeContext = createContext<RailBadges>(NO_BADGES);

/** The badges every feature reports for its rail rows and tabs, or none outside `RailBadgeProvider`. */
export function useRailBadges(): RailBadges {
  return useContext(RailBadgeContext);
}

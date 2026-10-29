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

import type { ScreenBadge } from "@components/screen-badge/screenBadge";
import type { PerspectiveSection } from "@constants/perspectives";

/**
 * A badge on a rail row or tab. A row or tab has one at most. On a group's header it's drawn as a
 * dot; its label and reason aren't shown.
 */
export interface RailBadge extends ScreenBadge {
  /**
   * Whether a closed group marks its own row for this badge, for a badge too important to wait
   * until the group is opened. Off by default: the badge shows only on its row.
   */
  showOnGroup?: boolean;
}

/** Looks up the badge for a rail row or tab id, if it has one. */
export type ResolveBadge = (id: string) => RailBadge | undefined;

/** Rail row and tab ids mapped to their badges, as one feature reports them. */
export type RailBadgeMap = Readonly<Record<string, RailBadge>>;

/**
 * Whether a closed group's header shows its dot: the group has a badge of its own, or a child the
 * person can see has one with {@link RailBadge.showOnGroup} set.
 */
export function groupNeedsAttention(
  section: PerspectiveSection,
  resolveBadge: ResolveBadge,
  resolveVisible: (s: PerspectiveSection) => boolean,
): boolean {
  if (resolveBadge(section.id)) return true;
  return (section.children ?? []).filter(resolveVisible).some((c) => resolveBadge(c.id)?.showOnGroup);
}

/** A row label followed by its badge's reason, for a collapsed rail, where Oxygen names the row by its label alone. */
export function labelWithReason(label: string, reason: string): string {
  return `${label} (${reason})`;
}

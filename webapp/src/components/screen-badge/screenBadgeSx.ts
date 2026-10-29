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

import type { ScreenBadge } from "./screenBadge";

/** Height, in px, of a badge pill; a one-character badge is a circle this wide. */
const BADGE_HEIGHT = 18;
/** Font size, in px, of a badge pill's text. */
const BADGE_FONT_SIZE = 10;

/** Read by screen readers, not shown on screen. */
export const VISUALLY_HIDDEN_SX = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
} as const;

/** The size and shape of the Chip a badge is drawn in. A one-character badge is a circle. */
export function screenBadgePillSx(badge: ScreenBadge) {
  return {
    flexShrink: 0,
    height: BADGE_HEIGHT,
    fontSize: BADGE_FONT_SIZE,
    fontWeight: 600,
    ...(badge.label.length === 1 && { width: BADGE_HEIGHT, "& .MuiChip-label": { px: 0 } }),
  };
}

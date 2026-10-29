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

import { Box, Tooltip, type TooltipProps } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { ScreenBadge } from "./screenBadge";
import { VISUALLY_HIDDEN_SX } from "./screenBadgeSx";

/**
 * A badge's label, for inside its pill, with the reason, if the badge gives one, on hover and for
 * screen readers.
 *
 * @param placement - where the reason shows on hover, beside the pill
 */
export default function ScreenBadgeLabel({
  badge,
  placement = "right",
}: {
  badge: ScreenBadge;
  placement?: TooltipProps["placement"];
}): JSX.Element {
  if (!badge.reason) return <span>{badge.label}</span>;
  return (
    // describeChild: the pill keeps its label as its name. Labelling it by the tooltip would
    // replace "Fix" with the reason, which the hidden text already reads. The title is an
    // element, not a string, so MUI doesn't add it as a `title` that would be read again.
    <Tooltip title={<span>{badge.reason}</span>} placement={placement} arrow describeChild>
      <Box component="span">
        <span>{badge.label}</span>{" "}
        <Box component="span" sx={VISUALLY_HIDDEN_SX}>
          {badge.reason}
        </Box>
      </Box>
    </Tooltip>
  );
}

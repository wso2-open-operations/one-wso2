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

import type { JSX } from "react";
import { Chip, alpha, type ChipProps } from "@wso2/oxygen-ui";

/**
 * The store's status label: small and outlined, with a 10% tint of its own
 * colour inside, as status chips are across One WSO2. Never filled, because
 * the filled accent fails contrast.
 */
export default function TintedChip({ color = "default", sx, ...props }: Omit<ChipProps, "size" | "variant">): JSX.Element {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      sx={[
        (theme) => ({
          bgcolor: color === "default" ? theme.palette.action.hover : alpha(theme.palette[color].main, 0.1),
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    />
  );
}

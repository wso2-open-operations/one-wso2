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
import { Box, alpha, type Theme } from "@wso2/oxygen-ui";

type Tone = "warning" | "primary" | "success" | "error" | "info";

/** A warm, Coins-coloured surface: a soft amber fill with a matching edge (the Coins tile, the Coins band). */
export const warmSurfaceSx = {
  bgcolor: (t: Theme) => alpha(t.palette.warning.main, 0.08),
  borderColor: (t: Theme) => alpha(t.palette.warning.main, 0.45),
} as const;

/** The Coins mark: a ring with a dot, in the Coins colour. */
export function CoinMark({ size = 22 }: { size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${Math.max(2, Math.round(size / 8))}px solid`,
        borderColor: "warning.main",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <Box component="span" sx={{ width: "50%", height: "50%", borderRadius: "50%", bgcolor: "warning.main" }} />
    </Box>
  );
}

/** A status pill with a soft fill of its tone, e.g. "Waiting for review" or "Coins sent". */
export function SoftPill({ tone = "warning", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: `${tone}.dark`,
        bgcolor: (t: Theme) => alpha(t.palette[tone].main, 0.12),
      }}
    >
      {children}
    </Box>
  );
}

/** A status in plain bold text, for the quiet statuses ("Counts toward next Coins", "Reversed"). */
export function PlainStatus({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", color: muted ? "text.secondary" : "text.primary" }}
    >
      {children}
    </Box>
  );
}

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

// The small pieces the Campaign Tracker tabs share — the stat strip above the
// tables and its loading state. Ported off Marketing Ops' shared
// frontend/shared/aesthetics.tsx (PageHero/StatStrip/StatCell/LoadingBar),
// which this app doesn't have; the closest existing precedent already in
// this codebase is crm-upload/components/CrmUi.tsx's StatStrip/StatCell/
// CrmLoading, which solve the exact same "outcome strip" problem on top of
// oxygen-ui — this file follows that shape rather than reinventing it.
// `PageHero`'s job (eyebrow/title/subtitle) is already covered by
// MarketingOpsShell.

import type { ReactNode } from "react";
import { Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";

export const NUMERIC = { fontVariantNumeric: "tabular-nums" } as const;

/** A row of stat cells. */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "hidden",
        mb: 3,
      }}
    >
      {children}
    </Box>
  );
}

/** One number, its label, and (when `total` is given) what share of it this is. */
export function StatCell({
  label,
  value,
  color,
  total,
}: {
  label: string;
  value: number;
  color: string;
  total?: number;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <Box sx={{ px: 1.75, py: 1.5, borderLeft: 1, borderColor: "divider", "&:first-of-type": { borderLeft: 0 } }}>
      <Typography
        sx={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: "text.secondary",
          mb: 0.75,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
        <Typography
          sx={{
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: value > 0 ? color : "text.disabled",
            ...NUMERIC,
          }}
        >
          {value.toLocaleString()}
        </Typography>
        {pct !== null && (
          <Typography sx={{ fontSize: 11, color: "text.secondary", ...NUMERIC }}>{pct}%</Typography>
        )}
      </Box>
    </Box>
  );
}

export function TrackerLoading({ messages }: { messages: readonly string[] }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 3 }}>
      <CircularProgress size={16} />
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{messages[0]}</Typography>
    </Stack>
  );
}

// A chip whose colour carries meaning, tinted from a palette path (e.g.
// "success.main") or a fixed hex (used for the Weekly Log entry-type chips,
// which are categories rather than outcomes — see WeeklyLogTable).
export function ToneChip({ label, color }: { label: string; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        height: 18,
        lineHeight: "16px",
        px: 0.75,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color,
        border: 1,
        borderColor: color,
        borderRadius: 0.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

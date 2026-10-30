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


import type { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@wso2/oxygen-ui";
import { Bar, SectionLabel } from "./DashboardParts";
import { num } from "../util/dashboardFormat";

export interface RepostRow {
  key: string;
  title: string;
  subtitle?: string;
  /** Every repost, with or without a comment: the bar. */
  total: number;
  /** Plain reposts: the REPOSTS column. */
  plain: number;
  /** Reposts with the person's own comment: the WITH COMMENTS column. */
  commented: number;
  /** Points earned; the POINTS column shows when any row has it. */
  points?: number;
}

/**
 * A name column, a bar, and the same REPOSTS | WITH COMMENTS headers everywhere (posts, a person's posts,
 * categories). The bar sits under the name, so a narrow window never squeezes the numbers.
 */
export default function RepostGrid({
  label,
  rows,
  onPick,
  empty,
}: {
  label: string;
  rows: RepostRow[];
  /** Makes each name a button that opens a popup. */
  onPick?: (key: string) => void;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  const top = Math.max(1, ...rows.map((r) => r.total));
  const showPoints = rows.some((r) => r.points !== undefined);
  return (
    <Box
      role="table"
      aria-label={label}
      sx={{ display: "grid", gridTemplateColumns: showPoints ? "minmax(0, 1fr) auto auto auto" : "minmax(0, 1fr) auto auto", columnGap: 2, alignItems: "center", fontSize: 13 }}
    >
      <Box role="row" sx={{ display: "contents" }}>
        <Box role="columnheader" />
        <Box role="columnheader" sx={{ textAlign: "right" }}>
          <SectionLabel>Reposts</SectionLabel>
        </Box>
        <Box role="columnheader" sx={{ textAlign: "right" }}>
          <SectionLabel>With comments</SectionLabel>
        </Box>
        {showPoints && (
          <Box role="columnheader" sx={{ textAlign: "right" }}>
            <SectionLabel>Points</SectionLabel>
          </Box>
        )}
      </Box>
      {rows.map((r) => (
        <Box role="row" key={r.key} sx={{ display: "contents" }}>
          <Box role="rowheader" sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            {onPick ? (
              <ButtonBase onClick={() => onPick(r.key)} aria-haspopup="dialog" sx={{ textAlign: "left", display: "block", width: "100%", font: "inherit" }}>
                {r.title}
                {r.subtitle && (
                  <Typography variant="body2" color="text.secondary" component="div">
                    {r.subtitle}
                  </Typography>
                )}
              </ButtonBase>
            ) : (
              <>
                {r.title}
                {r.subtitle && (
                  <Typography variant="body2" color="text.secondary" component="div">
                    {r.subtitle}
                  </Typography>
                )}
              </>
            )}
          </Box>
          <Box role="cell" sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1, textAlign: "right", alignSelf: "stretch" }}>
            {num(r.plain)}
          </Box>
          <Box role="cell" sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1, textAlign: "right", alignSelf: "stretch" }}>
            {num(r.commented)}
          </Box>
          {showPoints && (
            <Box role="cell" sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1, textAlign: "right", alignSelf: "stretch" }}>
              {num(r.points ?? 0)}
            </Box>
          )}
          <Box role="cell" sx={{ gridColumn: "1 / -1", display: "flex", pb: 1.25, pt: 0.5 }}>
            <Bar fraction={r.total / top} label={`${r.title}: ${r.total} reposts in all`} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

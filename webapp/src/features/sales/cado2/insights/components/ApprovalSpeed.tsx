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
import { Box, Tooltip, Typography } from "@wso2/oxygen-ui";
import type { RoleSpeed } from "../api/insightsTypes";
import { splitHours } from "../utils/format";
import { useInsightsPalette } from "./insightsPalette";
import { BarRow, Legend, Swatch } from "./BarParts";

/** Within the SLA up to this share of it; "close" up to the SLA; "over" beyond. */
const CLOSE_FROM = 0.75;

/**
 * Approval time by role (v2): each role's average time from a step starting to
 * its decision, slowest first, against a mark at the role's SLA.
 */
export default function ApprovalSpeed({ data, days }: { readonly data: readonly RoleSpeed[]; readonly days: number }): JSX.Element {
  const c = useInsightsPalette();
  if (data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
        No approval decisions in the last {days} days.
      </Typography>
    );
  }
  // The scale fits the slowest role and every SLA mark.
  const max = Math.max(...data.map((r) => Math.max(r.averageHours, r.slaHours))) * 1.08;
  const slas = [...new Set(data.map((r) => r.slaHours))];
  return (
    <Box>
      <Box sx={{ display: "grid", gap: 1.75 }}>
        {data.map((r) => {
          const ratio = r.averageHours / r.slaHours;
          const color = ratio > 1 ? c.late : ratio >= CLOSE_FROM ? c.soon : c.ok;
          const t = splitHours(r.averageHours);
          return (
            <BarRow
              key={r.role}
              name={r.label}
              figure={
                <>
                  {t.value}
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>
                    {" "}
                    {t.unit}
                  </Box>
                </>
              }
              bar={
                <Tooltip title={`Average of ${r.decisions} decision${r.decisions === 1 ? "" : "s"} · SLA ${r.slaHours} h`} placement="top">
                  <Box
                    aria-label={`${r.label}: average ${t.value} ${t.unit}, SLA ${r.slaHours} h`}
                    sx={{ position: "relative", height: 16, bgcolor: c.track, borderRadius: 1 }}
                  >
                    <Box sx={{ width: `${(r.averageHours / max) * 100}%`, minWidth: 6, height: "100%", bgcolor: color, borderRadius: 1 }} />
                    <Box
                      sx={{
                        position: "absolute",
                        top: -4,
                        bottom: -4,
                        width: 2,
                        left: `${(r.slaHours / max) * 100}%`,
                        bgcolor: c.ink,
                        opacity: 0.55,
                      }}
                    />
                  </Box>
                </Tooltip>
              }
            />
          );
        })}
      </Box>
      <Legend
        items={[
          {
            label: slas.length === 1 ? `SLA (${slas[0]} h)` : "SLA",
            swatch: <Box sx={{ width: 2, height: 12, bgcolor: c.ink, opacity: 0.55 }} />,
          },
          { label: "Within", swatch: <Swatch color={c.ok} /> },
          { label: "Close to SLA", swatch: <Swatch color={c.soon} /> },
          { label: "Over SLA", swatch: <Swatch color={c.late} /> },
        ]}
      />
    </Box>
  );
}

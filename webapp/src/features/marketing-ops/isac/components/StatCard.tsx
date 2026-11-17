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

import { Box, Card, CardContent, Typography } from "@wso2/oxygen-ui";
import React from "react";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

interface Props {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}

/** Compact metric card displaying a label, numeric or string value, and an icon. */
export default function StatCard({ label, value, icon, color = C.orange }: Props) {
  return (
    <Card
      sx={{
        borderRadius: "6px",
        border: `1px solid ${C.border}`,
        boxShadow: "none",
        background: C.panel,
      }}
    >
      <CardContent sx={{ px: 2, py: "12px !important" }}>
        {/* Top row: icon + value */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          {/* Icon size, not text — kept at 18px. */}
          <Box sx={{ color, display: "flex", "& svg": { fontSize: 18 } }}> {/* type-scale-ignore */}
            {icon}
          </Box>
          <Typography fontWeight={FW.bold} fontSize={FS.display} lineHeight={1} color="text.primary">
            {typeof value === "number" ? value.toLocaleString() : value}
          </Typography>
        </Box>
        {/* Second row: label */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: FS.small, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: FW.medium, pl: "26px" }}
        >
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

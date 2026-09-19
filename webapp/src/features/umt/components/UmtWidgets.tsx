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
import { Alert, Box, Card, Skeleton, Stack, Typography, useTheme } from "@wso2/oxygen-ui";
import { PieChart } from "@wso2/oxygen-ui-charts-react";
import type { UmtDashboardDatum } from "../api/umtDashboardStats";

export type UmtDashboardColor = "primary" | "secondary" | "info" | "success" | "warning" | "error";

// Shared card frame for UMT dashboard widgets. The body remains a slot because
// different widgets combine charts, stat tiles and actions in different ways.
export function DashboardWidgetHolder({
  title,
  actions,
  children,
  backgroundColor = "transparent",
}: {
  title: ReactNode;
  actions: ReactNode;
  children: ReactNode;
  backgroundColor?: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{ backgroundColor, overflowX: "auto", p: { xs: 2, sm: 3 } }}
    >
      <Box
        sx={{
          alignItems: { sm: "center" },
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography component="h2" variant="h3">
          {title}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {actions}
        </Stack>
      </Box>

      <Box>{children}</Box>
    </Card>
  );
}

// A fixed drawing area keeps donuts optically equal even when their surrounding
// widget layouts differ.
const CHART_SIZE = 280;

export function DashboardDonut({
  title,
  legendTitle,
  data,
  colorMap,
  loading,
  error,
  total,
}: {
  title: string;
  legendTitle: string;
  data: UmtDashboardDatum[];
  colorMap: Record<string, UmtDashboardColor>;
  loading?: boolean;
  error?: boolean;
  total?: number;
}) {
  const theme = useTheme();
  const sliceTotal = data.reduce((sum, item) => sum + item.value, 0);
  const chartTotal = total ?? sliceTotal;

  if (loading) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        <Skeleton variant="circular" width={CHART_SIZE} height={CHART_SIZE} />
        <Stack spacing={1.5} sx={{ minWidth: 190 }}>
          <Skeleton variant="text" width={120} height={28} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="text" width="100%" height={24} />
          ))}
        </Stack>
      </Box>
    );
  }

  // Checked before emptiness: a failed request has no real slices either, but
  // saying "No data yet" about it is a false claim, not a rendering shortcut.
  if (error) {
    return (
      <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", minHeight: CHART_SIZE }}>
        <Alert severity="error" sx={{ width: "100%", maxWidth: 360 }}>
          Couldn&apos;t load chart data.
        </Alert>
      </Box>
    );
  }

  // Emptiness is a question about the slices, not the supplied total: a caller-
  // provided total of 0 alongside real slices must still render them.
  if (sliceTotal === 0) {
    return (
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          minHeight: CHART_SIZE,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No data yet
        </Typography>
      </Box>
    );
  }

  const colors = data.map((item) => {
    const color = colorMap[item.name] ?? "primary";

    // CSS variables change with the active color scheme; palette is the
    // fallback for older themes.
    return theme.vars?.palette[color].main ?? theme.palette[color].main;
  });
  const chartDescription = `${title}: ${data
    .map((item) => `${item.name} ${item.value}`)
    .join(", ")}, total ${chartTotal}`;

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        justifyContent: "center",
      }}
    >
      {/* The chart and legend are represented by one accessible summary. */}
      <Box
        role="img"
        aria-label={chartDescription}
        sx={{ display: "grid", flexShrink: 0, height: CHART_SIZE, width: CHART_SIZE }}
      >
        <Box
          sx={{
            "& .recharts-sector": { stroke: "none" },
            gridArea: "1 / 1",
            height: "100%",
            position: "relative",
            width: "100%",
            zIndex: 1,
          }}
          aria-hidden="true"
        >
          <PieChart
            data={data}
            innerRadius={95}
            outerRadius={132}
            pies={[{ dataKey: "value", nameKey: "name" }]}
            colors={colors}
            legend={{ show: false }}
            tooltip={{ formatter: (value) => formatPercentage(Number(value), chartTotal) }}
          />
        </Box>

        <Box
          aria-hidden="true"
          sx={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gridArea: "1 / 1",
            justifyContent: "center",
            position: "relative",
            textAlign: "center",
            transform: "translateY(-10px)",
            zIndex: 0,
          }}
        >
          <Typography variant="h1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {chartTotal.toLocaleString()}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Box>

      <Stack spacing={1.5} sx={{ minWidth: 190 }} aria-hidden="true">
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          {legendTitle}
        </Typography>

        {data.map((item, index) => (
          <Box key={item.name} sx={{ alignItems: "center", display: "flex", gap: 1.5 }}>
            <Box
              sx={{
                bgcolor: colors[index],
                borderRadius: 0.75,
                height: 16,
                width: 16,
              }}
            />
            <Typography variant="body1" sx={{ flex: 1 }}>
              {item.name}
            </Typography>
            <Typography variant="body1" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function formatPercentage(value: number, total: number) {
  return total === 0 ? "0.00%" : `${((value / total) * 100).toFixed(2)}%`;
}

export function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | ReactNode;
  icon: ReactNode;
  color: UmtDashboardColor;
}) {
  const theme = useTheme();
  const cardColor = theme.palette[color].main;

  return (
    <Box
      sx={{
        alignItems: "center",
        border: "2px solid",
        borderColor: cardColor,
        borderRadius: 2,
        color: "text.primary",
        display: "flex",
        justifyContent: "space-between",
        p: 2.5,
      }}
    >
      <Box>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </Typography>
      </Box>

      <Box sx={{ opacity: 0.85 }}>{icon}</Box>
    </Box>
  );
}

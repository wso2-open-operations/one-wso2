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
import { Link as RouterLink } from "react-router";
import { Box, LinearProgress, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMyPoints } from "../api/useAmplifyData";
import { coinsText, progressFraction } from "../util/coins";
import { num } from "../util/dashboardFormat";
import { SectionLabel } from "./DashboardParts";

/** One tile: a label, a number with an optional unit, a line of context and any extra content (a progress bar). */
function Tile({
  label,
  value,
  unit,
  detail,
  children,
  to,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  children?: ReactNode;
  /** Makes the whole tile a link to this path. */
  to?: string;
}) {
  const body = (
    <Box
      component="section"
      aria-label={label}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        transition: "border-color 120ms",
        ...(to && { "&:hover": { borderColor: "primary.main" } }),
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      <Typography sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, mt: 1 }}>
        {value}
        {unit && (
          <>
            {" "}
            <Box component="span" sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>
              {unit}
            </Box>
          </>
        )}
      </Typography>
      {children}
      {detail && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {detail}
        </Typography>
      )}
    </Box>
  );
  if (!to) return body;
  return (
    <Box component={RouterLink} to={to} sx={{ display: "block", color: "inherit", textDecoration: "none", minWidth: 0 }}>
      {body}
    </Box>
  );
}

/**
 * The caller's four numbers: points and rank this month, all-time points, Coins received, and progress to the next
 * Coins (GET /me/points, both periods). Loading shows placeholders; a failure shows a notice with Retry in their
 * place.
 *
 * @param linkTo - makes each tile a link there (Celebrate links them to My points & Coins)
 */
export default function PointsTiles({ linkTo }: { linkTo?: string }) {
  const all = useMyPoints("ALL");
  const month = useMyPoints("MONTH");
  const failed = all.isError ? all : month.isError ? month : null;

  if (failed) {
    return (
      <ErrorNotice
        error={failed.error}
        onRetry={() => {
          void all.refetch();
          void month.refetch();
        }}
        sx={{ mb: 3 }}
      >
        Couldn&apos;t load your points.
      </ErrorNotice>
    );
  }

  if (!all.data || !month.data) {
    return (
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: TILE_COLUMNS, mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={112} />
        ))}
      </Box>
    );
  }

  const { coins } = all.data;
  const rank = month.data.standing.rank;
  const toGo = Math.max(0, coins.blockPoints - coins.pointsTowardNext);
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: TILE_COLUMNS, mb: 3 }}>
      <Tile
        label="This month"
        value={num(month.data.standing.points)}
        unit="points"
        detail={rank != null ? `Rank #${num(rank)}` : "Not ranked yet"}
        to={linkTo}
      />
      <Tile label="All-time points" value={num(all.data.standing.points)} unit="points" to={linkTo} />
      <Tile label="Coins received" value={num(coins.coinsReceived)} unit="WSO2 Coins" to={linkTo} />
      <Tile
        label="Next Coins"
        value={`${num(coins.pointsTowardNext)} / ${num(coins.blockPoints)}`}
        unit="points"
        detail={`${num(toGo)} more ${toGo === 1 ? "point" : "points"} to ${coinsText(coins.blockCoins)}`}
        to={linkTo}
      >
        <LinearProgress
          variant="determinate"
          value={Math.round(progressFraction(coins.pointsTowardNext, coins.blockPoints) * 100)}
          aria-label="Progress to your next Coins"
          sx={{ mt: 1.25, height: 8, borderRadius: 4 }}
        />
      </Tile>
    </Box>
  );
}

// One column on a phone, two on a tablet, four on a desktop.
const TILE_COLUMNS = { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" };

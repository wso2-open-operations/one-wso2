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
import { Box, LinearProgress, Link, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMyPoints } from "../api/useAmplifyData";
import { coinsText, progressFraction } from "../util/coins";
import { num } from "../util/dashboardFormat";
import { CoinMark, warmSurfaceSx } from "./AmplifyTone";
import { SectionLabel } from "./DashboardParts";
import { AMPLIFY_RADIUS } from "../util/radius";

/** One tile: a label, the value, a line of context and any extra content (a progress bar). */
function Tile({
  label,
  value,
  detail,
  warm = false,
  children,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** The Coins colours. */
  warm?: boolean;
  children?: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: AMPLIFY_RADIUS,
        p: 2,
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        bgcolor: "background.paper",
        ...(warm && warmSurfaceSx),
      }}
    >
      <Box sx={warm ? { "& h2": { color: "warning.dark" } } : undefined}>
        <SectionLabel>{label}</SectionLabel>
      </Box>
      {value}
      {children}
      {detail && (
        <Typography variant="body2" sx={{ mt: 0.75, color: warm ? "warning.dark" : "text.secondary" }}>
          {detail}
        </Typography>
      )}
    </Box>
  );
}

/** A big number with a small unit after it, e.g. "185 points". */
function BigNumber({ value, unit, icon }: { value: string; unit?: string; icon?: ReactNode }) {
  return (
    <Typography
      component="p"
      sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, mt: 1, display: "flex", alignItems: "baseline", gap: 0.75 }}
    >
      {icon && <Box component="span" sx={{ alignSelf: "center", display: "inline-flex" }}>{icon}</Box>}
      {value}
      {unit && (
        <>
          {" "}
          <Box component="span" sx={{ fontSize: 15, fontWeight: 500, color: "text.secondary" }}>
            {unit}
          </Box>
        </>
      )}
    </Typography>
  );
}

/**
 * Celebrate's four tiles (GET /me/points, both periods): This month (points and rank), All time, Coins received and
 * Next Coins (progress, and a History link to My points & Coins). Loading shows placeholders; a failure shows a
 * notice with Retry in their place.
 *
 * @param historyTo - where the Next Coins tile's History link goes (My points & Coins); no link without it
 */
export default function PointsTiles({ historyTo }: { historyTo?: string }) {
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
        value={<BigNumber value={num(month.data.standing.points ?? 0)} unit="points" />}
        detail={rank != null ? `You're #${num(rank)}` : "Not ranked yet"}
      />
      <Tile
        label="All time"
        value={<BigNumber value={num(all.data.standing.points ?? 0)} unit="points" />}
        detail="Since you joined Amplify"
      />
      <Tile
        label="Coins received"
        warm
        value={<BigNumber value={num(coins.coinsReceived)} icon={<CoinMark size={24} />} />}
        detail="In your WSO2 Coins wallet"
      />
      <Tile
        label="Next Coins"
        value={
          <Typography component="p" sx={{ fontWeight: 700, mt: 1 }}>
            {num(coins.pointsTowardNext)} / {num(coins.blockPoints)} points
          </Typography>
        }
        detail={
          <>
            {num(toGo)} more for {coinsText(coins.blockCoins)}
            {historyTo && (
              <>
                {" · "}
                <Link component={RouterLink} to={historyTo} color="primary">
                  History
                </Link>
              </>
            )}
          </>
        }
      >
        <LinearProgress
          variant="determinate"
          color="warning"
          value={Math.round(progressFraction(coins.pointsTowardNext, coins.blockPoints) * 100)}
          aria-label="Progress to your next Coins"
          sx={{ mt: 1, height: 8, borderRadius: 2 }}
        />
      </Tile>
    </Box>
  );
}

const TILE_COLUMNS = { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" };

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

import { Box, Button, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import { EyeIcon } from "@wso2/oxygen-ui-icons-react";
import type { ReachConnection } from "../api/amplifyTypes";
import { useReachConnection } from "../api/useAmplifyData";
import { useReachToggle } from "../api/useReachToggle";
import { AMPLIFY_RADIUS } from "../util/radius";

const STATUS: Record<ReachConnection["status"], { label: string; color: "success" | "warning" | "default" }> = {
  CONNECTED: { label: "On", color: "success" },
  EXPIRED: { label: "Needs allowing again", color: "warning" },
  NOT_CONNECTED: { label: "Off", color: "default" },
};

/**
 * My points & Coins' Reach card (design 04): "See how far your reposts travel" with Allow reach on LinkedIn while it
 * is off; once on, a line saying so with Turn off reach; after the token lapsed, Allow reach again. Hidden while it
 * loads, and when the status can't be read (Reach is optional).
 */
export function ReachCard() {
  const reach = useReachConnection();
  const toggle = useReachToggle();
  if (reach.isPending || reach.isError) return null;
  const { status } = reach.data;

  const title =
    status === "CONNECTED"
      ? "Reach is on"
      : status === "EXPIRED"
        ? "Allow reach again to keep counting it"
        : "See how far your reposts travel";
  const text =
    status === "CONNECTED"
      ? "Amplify reads the impressions on your reposts from LinkedIn and counts them in team totals. You can turn it off any time."
      : "Let Amplify read the impressions on your reposts from LinkedIn. You'll see your reach here, and it's counted in team totals. Optional: everything else works without it.";

  return (
    <Box
      component="section"
      aria-label="Reach"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2.5,
        flexWrap: "wrap",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: AMPLIFY_RADIUS,
        px: 2.5,
        py: 2.5,
        mb: 3,
      }}
    >
      <Box sx={{ color: "primary.dark", display: "flex", flexShrink: 0 }}>
        <EyeIcon size={32} aria-hidden />
      </Box>
      <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
      </Box>
      {status === "CONNECTED" ? (
        <Button variant="outlined" onClick={() => void toggle.turnOff()} disabled={toggle.busy}>
          Turn off reach
        </Button>
      ) : (
        <Button variant="contained" onClick={() => void toggle.turnOn()} disabled={toggle.busy}>
          {status === "EXPIRED" ? "Allow reach again" : "Allow reach on LinkedIn"}
        </Button>
      )}
    </Box>
  );
}

/** Settings > My Connections' Reach row: on, off or lapsed, with Allow reach or Turn off. */
export function ReachConnectionRow() {
  const reach = useReachConnection();
  const toggle = useReachToggle();
  if (reach.isPending) return <Skeleton variant="rounded" height={72} sx={{ mt: 1.5 }} />;
  if (reach.isError) return null;
  const { status } = reach.data;
  const chip = STATUS[status] ?? STATUS.NOT_CONNECTED;
  return (
    <Box
      component="section"
      aria-label="Reach"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 2,
        mt: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: AMPLIFY_RADIUS,
      }}
    >
      <Box sx={{ color: "primary.main", display: "flex" }}>
        <EyeIcon size={24} aria-hidden />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>Reach</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Chip size="small" label={chip.label} color={chip.color} />
          <Typography variant="caption" color="text.secondary">
            Amplify reads the impressions on your reposts. Optional.
          </Typography>
        </Box>
      </Box>
      {status === "CONNECTED" ? (
        <Button color="error" onClick={() => void toggle.turnOff()} disabled={toggle.busy}>
          Turn off
        </Button>
      ) : (
        <Button variant="contained" onClick={() => void toggle.turnOn()} disabled={toggle.busy}>
          {status === "EXPIRED" ? "Allow again" : "Allow reach"}
        </Button>
      )}
    </Box>
  );
}

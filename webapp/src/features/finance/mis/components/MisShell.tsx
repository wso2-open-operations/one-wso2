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
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { ChartNoAxesCombinedIcon } from "@wso2/oxygen-ui-icons-react";
import { isMisArrConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMisGate } from "../api/useMisGate";
import MisLocked from "./MisLocked";

// Shared page frame for every Finance MIS screen: the app eyebrow, a title and
// subtitle, and — the reason this exists — ONE place that owns every degraded
// state, so no screen has to remember them and none of them differs:
//
//   1. ARR backend URL not set    → say which config key is missing
//   2. /user-info still in flight → spinner, never a premature denial
//   3. /user-info failed          → an error with a retry, NOT a denial
//   4. cannot open THIS screen    → a locked door, worded by which half they hold
//
// Rungs 3 and 4 are the pair worth keeping apart; see MisGate.isError.
//
// ---- how this differs from MarketingOpsShell ------------------------------
//
// That shell asks one question — are you authorized for this perspective — and
// every screen behind it follows. MIS cannot: it has two independent privileges
// over five screens, so authorization is per-screen and the shell takes a
// `gateId`. A Flash-only user is authorized for MIS and still refused ARR
// Build, which is an ordinary state here rather than an anomaly.
//
// ---- and why it checks the ARR key specifically ---------------------------
//
// All three MIS backends have their own config key, but /user-info lives on the
// ARR service and answers for the Flash screens too. So an unset ARR URL means
// no MIS screen can establish who you are, while an unset Flash or Admin URL is
// a per-screen concern for the ticket that ports it.
export default function MisShell({
  gateId,
  title,
  subtitle,
  children,
}: {
  // Which MIS menu item this screen is. The gate answers per item because the
  // two privileges do not imply one another — see useMisGate.
  gateId: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const configured = isMisArrConfigured();
  // Only ask who we are once we know there is a backend to ask.
  const gate = useMisGate(configured);

  // The header changes on the locked state, so the shell has to know which
  // branch the body will take. This mirrors the LAST rung of the ladder below —
  // every earlier rung has to be excluded, or someone whose check is still in
  // flight (or failed) reads as refused for one render.
  const isLocked = configured && !gate.isResolving && !gate.isError && !gate.canSee(gateId);

  return (
    <Box>
      <Chip
        icon={<ChartNoAxesCombinedIcon size={14} />}
        label="MIS"
        color="primary"
        // Outlined, not filled: white-on-orange at chip text sizes is ~3.6:1 and
        // fails WCAG AA. Outlined routes through the a11y overlay, which shifts
        // the label and border to primary.dark in light mode. Matches the
        // Finance, Leave and Marketing Ops shells.
        variant="outlined"
        size="small"
        sx={{ mb: 0.5 }}
      />
      {/* An h1, not a styled div: it is the page's heading, and a screen-reader
          user navigating by headings needs something to land on. */}
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
        {title}
      </Typography>
      {/* Dropped on the locked rung alone: a subtitle sells the screen, which is
          right on one you can use and wrong above a panel about to refuse you. */}
      {subtitle && !isLocked && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      <MisBody configured={configured} gate={gate} gateId={gateId}>
        {children}
      </MisBody>
    </Box>
  );
}

// Split out so the header stays readable — the ladder carries the logic, and it
// reads better as a sequence of guards than as nested ternaries inside JSX.
function MisBody({
  configured,
  gate,
  gateId,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useMisGate>;
  gateId: string;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        Finance MIS isn't connected yet. Set <code>ONE_WSO2_MIS_ARR_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> (the backend URL) and reload.
      </Alert>
    );
  }

  // Hold the page until the privilege decision lands.
  if (gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your MIS access…
        </Typography>
      </Stack>
    );
  }

  // Before the locked rung, not after. A failed request also leaves us with no
  // privileges, so this order is what stops a gateway timeout being reported as
  // a missing permission.
  if (gate.isError) {
    return (
      <ErrorNotice onRetry={gate.retry} sx={{ mt: 1.5 }}>
        Couldn't check your MIS access. {gate.errorMessage}
      </ErrorNotice>
    );
  }

  if (!gate.canSee(gateId)) {
    return <MisLocked isAuthorized={gate.isAuthorized} />;
  }

  return <>{children}</>;
}

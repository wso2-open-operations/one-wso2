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

// One place for every degraded state a Procurement screen can be in, so no page
// has to remember them. Modelled on MarketingOpsShell, and it keeps that shell's
// full state ladder rather than a subset:
//
//   1. backend URL not set    → say which config key is missing
//   2. /api/v1/me in flight   → spinner, never a premature denial
//   3. /api/v1/me failed      → an error with a retry, NOT a denial
//   4. /api/v1/me unresolved  → say the identity lookup didn't land
//   5. permission missing     → say plainly that access is missing
//
// The order is what stops a gateway failure being reported as a missing
// permission, which would send people chasing a role they already have.
//
// Rung 4 differs in meaning from Marketing Ops, where `isAuthorized: false` is a
// real answer — "authenticated, but not in a marketing group". Purchasing has no
// membership notion: the backend self-provisions every authenticated employee
// with `staff`, so a 200 from /me IS the authorization and false here is not a
// refusal but an unresolved lookup. It still needs its own rung: without one,
// children render against an unresolved identity and their queries — disabled
// for the same reason /me never resolved — sit on "Loading…" forever, which
// tells the reader nothing and offers them nothing to do.

import type { ReactNode } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPurchasingBackendConfigured } from "@config/apiConfig";
import {
  useProcurementGate,
  type ProcurementRequirement,
} from "@features/procurement/api/useProcurementGate";

export default function ProcurementShell({
  title,
  subtitle,
  actions,
  /** A permission the viewer must hold. Omit for screens open to everyone. */
  requires,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  requires?: ProcurementRequirement;
  children: ReactNode;
}) {
  const configured = isPurchasingBackendConfigured();
  const gate = useProcurementGate(configured);

  return (
    <Box>
      <Box
        sx={{
          mb: 2.5,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          {/* An h1, not a styled div: it is the page's heading, and a
              screen-reader user navigating by headings needs somewhere to land. */}
          <Typography component="h1" variant="h5" sx={{ mt: 0 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: "68ch" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions}
      </Box>

      <ProcurementBody configured={configured} gate={gate} requires={requires}>
        {children}
      </ProcurementBody>
    </Box>
  );
}

function ProcurementBody({
  configured,
  gate,
  requires,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useProcurementGate>;
  requires?: ProcurementRequirement;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        Procurement isn't connected yet. Set <code>ONE_WSO2_PURCHASING_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> (the purchasing backend URL) and reload.
      </Alert>
    );
  }

  if (gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your Procurement access…
        </Typography>
      </Stack>
    );
  }

  // Before the states below, both of which also leave us without permissions.
  if (gate.isError) {
    return (
      <ErrorNotice onRetry={gate.retry} sx={{ mt: 1.5 }}>
        Couldn't reach the purchasing backend. {gate.errorMessage}
      </ErrorNotice>
    );
  }

  // Not a refusal — see the note at the top of the file. Every WSO2 employee is
  // authorized here, so the honest report is that we don't yet know who you are
  // to the purchasing app, with something to do about it.
  if (!gate.isAuthorized) {
    return (
      <ErrorNotice onRetry={gate.retry} severity="warning" sx={{ mt: 1.5 }}>
        Couldn't confirm your identity with the purchasing app, so there's nothing to show yet.
      </ErrorNotice>
    );
  }

  if (requires && !gate.permissions[requires]) {
    return (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        You don't have access to this screen. Purchasing roles are granted inside the purchasing
        app — ask a purchasing administrator for the role you need.
      </Alert>
    );
  }

  return <>{children}</>;
}

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
// has to remember them. Modelled on MarketingOpsShell.
//
// "Backend not configured", "still resolving", "the request failed" and "you may
// not see this" stay four DISTINCT states on purpose: reporting a gateway failure
// as a missing permission sends people chasing a role they already have.

import type { ReactNode } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { isPurchasingBackendConfigured } from "@config/apiConfig";
import { useProcurementGate } from "@features/procurement/api/useProcurementGate";

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
  requires?: "procurement" | "isAdmin" | "canManageVendors" | "canManageBusinessUnits" | "canViewAuditLog" | "canViewAnalytics";
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
          <Typography component="h1" variant="h5" sx={{ fontWeight: 600, mt: 0 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: "70ch" }}>
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
  requires?: string;
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

  if (gate.isError) {
    return (
      <Alert
        severity="error"
        sx={{ mt: 1.5 }}
        action={
          <Button color="inherit" size="small" onClick={gate.retry}>
            Retry
          </Button>
        }
      >
        Couldn't reach the purchasing backend. {gate.errorMessage}
      </Alert>
    );
  }

  if (requires && !gate.permissions[requires as keyof typeof gate.permissions]) {
    return (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        You don't have access to this screen. Purchasing roles are granted inside the purchasing
        app — ask a purchasing administrator for the role you need.
      </Alert>
    );
  }

  return <>{children}</>;
}

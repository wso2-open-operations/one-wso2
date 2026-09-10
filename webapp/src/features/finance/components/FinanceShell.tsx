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
import { Alert, Box, Chip, Typography } from "@wso2/oxygen-ui";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";

// Shared page frame for the finance screens: an app eyebrow chip, a title +
// subtitle, and one place that renders the "backend not connected" state so
// every screen behaves the same when the app's backend URL isn't set. The
// eyebrow + config-key vary per app (OPD / Credit Card / Expense), so
// they're props rather than baked in like LeaveShell.
export default function FinanceShell({
  eyebrow,
  title,
  subtitle,
  configured,
  configKey,
  children,
}: {
  // Which finance app this screen belongs to (OPD / Credit Card / Expense).
  // Informational, not decorative — the shell is shared across all three.
  eyebrow: { icon: LucideIcon; label: string };
  title: string;
  subtitle?: string;
  configured: boolean;
  configKey: string; // e.g. "ONE_WSO2_OPD_BACKEND_URL"
  children: ReactNode;
}) {
  return (
    <Box>
      <Chip
        icon={<eyebrow.icon size={14} />}
        label={eyebrow.label}
        color="primary"
        // Outlined, not filled: white-on-orange at chip text sizes is ~3.6:1 and
        // fails WCAG AA. Outlined routes through the a11y overlay, which shifts
        // the label and border to primary.dark in light mode.
        variant="outlined"
        size="small"
        sx={{ mb: 0.5 }}
      />
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      {configured ? (
        children
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          This app isn't connected yet. Set <code>{configKey}</code> in{" "}
          <code>public/config.js</code> (the backend URL) and reload.
        </Alert>
      )}
    </Box>
  );
}

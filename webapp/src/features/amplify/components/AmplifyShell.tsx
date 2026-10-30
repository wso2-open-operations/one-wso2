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
import { Alert, Box, Typography } from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { isAmplifyBackendConfigured } from "../api/useAmplifyData";

// Page frame for Amplify: title, subtitle, and the "not connected" state when
// the API proxy URL isn't set. Same shape as TilShell.
export default function AmplifyShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useDocumentTitle(title);
  const configured = isAmplifyBackendConfigured();
  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      {configured ? (
        children
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Amplify isn&apos;t connected yet. Set <code>ONE_WSO2_AMPLIFY_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> (the Amplify API proxy URL) and reload.
        </Alert>
      )}
    </Box>
  );
}

/** A titled panel, the "POSTS TO AMPLIFY" / "TEAM LEADERBOARD" boxes on the wireframes. */
export function AmplifyPanel({
  title,
  ariaLabel,
  action,
  children,
}: {
  title: string;
  /** Accessible name when the visible title carries emoji or decoration. Defaults to the title. */
  ariaLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={ariaLabel ?? title}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, mb: 3 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, minHeight: 32 }}>
        <Typography
          component="h2"
          variant="overline"
          sx={{ fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", lineHeight: 1.5 }}
        >
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}

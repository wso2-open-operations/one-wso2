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

import { Box } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";

export interface AppShellLayoutProps {
  header: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

/**
 * Three-region application shell.
 *
 * Hand-rolled rather than using Oxygen's own `AppShell`, for a specific
 * reason: `AppShell` omits `minWidth: 0` on the main column, so inner content
 * can't size down to the viewport and gets silently clipped on any screen
 * narrower than its intrinsic width. Every `minWidth: 0` / `width: 0` below is
 * load-bearing — don't "tidy" them away.
 *
 * The header slot is a plain div, not `component="header"`: Oxygen's `Header`
 * renders an MUI AppBar, which is already a `<header>`, and nesting one inside
 * another would expose two banner landmarks.
 */
export default function AppShellLayout({
  header,
  sidebar,
  children,
}: AppShellLayoutProps): JSX.Element {
  return (
    <Box
      data-testid="app-shell"
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <Box
        data-testid="app-navbar"
        sx={{ flexShrink: 0, width: "100%", maxWidth: "100%", minWidth: 0 }}
      >
        {header}
      </Box>

      <Box
        sx={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {sidebar ? (
          <Box data-testid="app-sidebar" sx={{ flexShrink: 0, minWidth: 0 }}>
            {sidebar}
          </Box>
        ) : null}

        <Box
          component="main"
          data-testid="app-main"
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0",
            minWidth: 0,
            width: 0,
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

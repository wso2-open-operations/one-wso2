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

import { Fragment, type ReactNode } from "react";
import { Outlet } from "react-router";
import { Alert, Box, CircularProgress, Stack, Typography, useTheme } from "@wso2/oxygen-ui";
import { useLiveScheme } from "@components/charts/useLiveScheme";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isIsacBackendConfigured } from "@config/apiConfig";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { useIsacMe } from "../api/queries";
import { syncPageTokens } from "../theme/pageTokens";

/** The main content area's own padding, in theme spacing units, which a full-bleed screen cancels. */
const MAIN_GUTTER = 3;

/**
 * The frame every ISAC route renders inside. It resolves access before any
 * screen mounts — not connected, checking, failed, then the screen — and keeps
 * the screens' colour tokens in step with the active theme and scheme.
 */
export default function IsacShell() {
  const configured = isIsacBackendConfigured();
  const me = useIsacMe(configured);
  const theme = useTheme();
  const scheme = useLiveScheme();

  // During render, before any screen renders: screens read the tokens as they render.
  const tokenKey = syncPageTokens(theme, scheme);

  if (!configured) {
    return (
      <Alert severity="info">
        ISAC isn't connected yet. Set <code>ONE_WSO2_MARKETINGOPS_ISAC_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> and reload.
      </Alert>
    );
  }

  if (me.isPending) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your ISAC access…
        </Typography>
      </Stack>
    );
  }

  if (me.isError) {
    return (
      <ErrorNotice error={me.error} onRetry={() => void me.refetch()} retrying={me.isRefetching}>
        Couldn't check your ISAC access.
      </ErrorNotice>
    );
  }

  // Keyed on the tokens: the screens read colours while rendering, so a theme or
  // scheme switch has to render them again from the top.
  return (
    <Fragment key={tokenKey}>
      <Outlet />
    </Fragment>
  );
}

/**
 * One ISAC screen's place in the main content area.
 *
 * A `bleed` screen fills the area edge to edge and scrolls inside itself; any
 * other screen sits in the area's own padding and scrolls with the page.
 */
export function IsacScreen({ title, bleed = false, children }: { title: string; bleed?: boolean; children: ReactNode }) {
  useDocumentTitle(`${title} · ISAC`);
  return (
    <Box sx={bleed ? BLEED_SX : undefined}>
      <Typography component="h1" sx={VISUALLY_HIDDEN}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** Fills the main content area: cancels its padding and takes all of its height. */
const BLEED_SX = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  m: -MAIN_GUTTER,
  overflow: "auto",
  position: "relative",
} as const;

const VISUALLY_HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  p: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

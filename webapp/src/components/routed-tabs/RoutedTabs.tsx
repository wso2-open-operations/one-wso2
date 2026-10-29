/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Link, useLocation } from "react-router";
import { Box, Chip, Tab, Tabs } from "@wso2/oxygen-ui";
import type { ScreenBadge } from "@components/screen-badge/screenBadge";
import ScreenBadgeLabel from "@components/screen-badge/ScreenBadgeLabel";
import { screenBadgePillSx } from "@components/screen-badge/screenBadgeSx";

// A tab bar whose tabs are links, so which tab is open lives in the URL rather
// than in component state. That makes a tab linkable, survivable across a
// refresh, and reachable with the back button — none of which `useState` tabs
// can do.
//
// The component only draws the bar. The tab bodies are nested routes rendered
// through an <Outlet />, which is what keeps each one gated at the route rather
// than merely hidden from the bar.

export interface RoutedTabDef {
  /** URL segment under `basePath`, and the tab's identity. */
  segment: string;
  label: string;
  /** A badge drawn beside the label. */
  badge?: ScreenBadge;
}

/** A tab bar whose tabs link to routes under `basePath`, with the current route's tab selected. */
export default function RoutedTabs({
  basePath,
  tabs,
  ariaLabel,
  scrollable = false,
}: {
  basePath: string;
  tabs: readonly RoutedTabDef[];
  ariaLabel: string;
  /** One row that scrolls sideways when the labels do not fit. */
  scrollable?: boolean;
}) {
  const { pathname } = useLocation();

  // Match on the segment that follows basePath rather than on the whole path,
  // so a deeper URL (a future detail route under a tab) keeps its tab lit.
  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : "";
  const current = rest.replace(/^\//, "").split("/")[0];
  const active = tabs.find((t) => t.segment === current);

  // An unrecognised segment leaves every tab unlit rather than lighting the
  // wrong one. The route itself decides what to render in that case.
  if (tabs.length === 0) return null;

  return (
    <Tabs
      value={active ? active.segment : false}
      aria-label={ariaLabel}
      variant={scrollable ? "scrollable" : "standard"}
      scrollButtons={scrollable ? "auto" : undefined}
      allowScrollButtonsMobile={scrollable}
      sx={{
        mb: 2,
        minWidth: 0,
        maxWidth: "100%",
        minHeight: 36,
        "& .MuiTab-root": {
          minHeight: 36,
          textTransform: "none",
          fontSize: 13,
          fontWeight: 600,
        },
      }}
    >
      {tabs.map((t) => (
        <Tab
          key={t.segment}
          value={t.segment}
          label={t.badge ? badgedLabel(t.label, t.badge) : t.label}
          component={Link}
          to={`${basePath}/${t.segment}`}
        />
      ))}
    </Tabs>
  );
}

/** A tab label with its badge beside it. */
function badgedLabel(label: string, badge: ScreenBadge) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {label}
      <Chip
        size="small"
        color="primary"
        sx={screenBadgePillSx(badge)}
        label={<ScreenBadgeLabel badge={badge} placement="top" />}
      />
    </Box>
  );
}

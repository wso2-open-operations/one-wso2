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

import { Outlet, useLocation } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";

/** A routed tab of ISAC screens; `bleed` marks a screen that fills the area under the tab bar. */
export interface IsacTabDef extends RoutedTabDef {
  bleed?: boolean;
}

/** A tab bar over a group of ISAC screens, with the selected screen below it. */
export default function IsacTabs({
  basePath,
  tabs,
  ariaLabel,
}: {
  basePath: string;
  tabs: readonly IsacTabDef[];
  ariaLabel: string;
}) {
  const { pathname } = useLocation();
  const segment = pathname.slice(basePath.length).replace(/^\//, "").split("/")[0];
  const bleed = tabs.find((t) => t.segment === segment)?.bleed ?? false;

  return (
    <Box sx={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 3, pt: 2, flexShrink: 0, "& .MuiTabs-root": { mb: 0 } }}>
        <RoutedTabs basePath={basePath} tabs={tabs} ariaLabel={ariaLabel} scrollable />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "auto", p: bleed ? 0 : 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

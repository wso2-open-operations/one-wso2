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

import type { JSX } from "react";
import { Box, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from "@wso2/oxygen-ui";
import { ChevronsDownUpIcon, ChevronsUpDownIcon, ListIcon, ListTreeIcon } from "@wso2/oxygen-ui-icons-react";
import type { ListLayout } from "@features/sales/cado2/components/list-table/listTable";

/**
 * The List / Tree icons, and in the tree, "Collapse all" / "Expand all".
 * `treeLabel` says what the tree groups, e.g. "account › opportunity › quote".
 */
export default function LayoutControls({
  layout,
  onLayout,
  treeLabel,
  allCollapsed,
  onCollapseAll,
}: {
  readonly layout: ListLayout;
  readonly onLayout: (layout: ListLayout) => void;
  readonly treeLabel: string;
  readonly allCollapsed: boolean;
  /** Collapse every branch when true, open them all when false. */
  readonly onCollapseAll: (collapse: boolean) => void;
}): JSX.Element {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {layout === "tree" ? (
        <Tooltip title={allCollapsed ? "Expand all" : "Collapse all"}>
          <IconButton
            size="small"
            aria-label={allCollapsed ? "Expand all" : "Collapse all"}
            onClick={() => onCollapseAll(!allCollapsed)}
          >
            {allCollapsed ? <ChevronsUpDownIcon size={18} /> : <ChevronsDownUpIcon size={18} />}
          </IconButton>
        </Tooltip>
      ) : null}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={layout}
        onChange={(_, v: ListLayout | null) => {
          if (v) onLayout(v);
        }}
        aria-label="Layout"
      >
        {/* The tooltip sits inside the button: a group passes its state to its direct children. */}
        <ToggleButton value="list" aria-label="List" sx={{ px: 1 }}>
          <Tooltip title="List">
            <Box component="span" sx={{ display: "flex" }}>
              <ListIcon size={18} />
            </Box>
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="tree" aria-label="Tree" sx={{ px: 1 }}>
          <Tooltip title={`Tree: ${treeLabel}`}>
            <Box component="span" sx={{ display: "flex" }}>
              <ListTreeIcon size={18} />
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

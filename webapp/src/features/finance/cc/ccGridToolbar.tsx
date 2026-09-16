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

import { Box, DataGrid, TextField, Tooltip } from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";

/**
 * Everything v8's `showToolbar` gives, except the export buttons.
 *
 * For the three transaction grids. The source gives those a quick filter and
 * nothing else — each builds its own toolbar containing only
 * `GridToolbarQuickFilter` (NewTransactions / PendingTransactions /
 * ApproveTransactions DataGrid.tsx). Export appears on exactly two of its
 * five grids: submission-history, and the statement screen through the
 * all-in-one `GridToolbar`.
 *
 * So export is withheld here deliberately — these three show either other
 * people's card spend or transactions nobody has submitted yet, and v8's
 * default toolbar would hand out a CSV of all of it purely because the button
 * ships with the component. The column and filter panels are kept, which is
 * more than the source offers and costs nothing.
 */
export function ToolbarNoExport() {
  return (
    <DataGrid.Toolbar>
      <Tooltip title="Columns">
        <DataGrid.ColumnsPanelTrigger render={<DataGrid.ToolbarButton aria-label="Columns" />}>
          <DataGrid.GridColumnIcon fontSize="small" />
        </DataGrid.ColumnsPanelTrigger>
      </Tooltip>
      <Tooltip title="Filters">
        <DataGrid.FilterPanelTrigger render={<DataGrid.ToolbarButton aria-label="Filters" />}>
          <DataGrid.GridFilterListIcon fontSize="small" />
        </DataGrid.FilterPanelTrigger>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <DataGrid.GridToolbarQuickFilter />
    </DataGrid.Toolbar>
  );
}


/**
 * The toolbar History has, labels and all — `submission-history/index.tsx:43-61`.
 *
 * Columns, Density and Export on the left with their names beside the icons,
 * and a search box that is always there on the right.
 *
 * Three things v8's one-prop `showToolbar` gets wrong for this screen, all of
 * which the reader sees:
 *
 *  - it leaves the buttons as bare icons, and Export — the thing this screen
 *    exists to offer — is the least guessable of the four;
 *  - it adds a Filters button the source does not have, beside an Advanced
 *    Filter that does something else entirely;
 *  - it collapses the search to a magnifier you have to click before you can
 *    type, where the source shows the field.
 *
 * The buttons take `text.secondary` rather than the primary colour a plain
 * `Button` would default to. The source hardcodes `#6E7681`; the token is the
 * same grey and survives dark mode, which a hex would not.
 */
export function ToolbarWithExport() {
  return (
    <DataGrid.GridToolbarContainer
      sx={{ p: 1.5, gap: 2, "& .MuiButtonBase-root": { color: "text.secondary" } }}
    >
      <DataGrid.GridToolbarColumnsButton />
      <DataGrid.GridToolbarDensitySelector />
      <DataGrid.GridToolbarExport />
      <Box sx={{ flex: 1 }} />
      {/* `expanded`, so the field is on screen rather than behind its own
          trigger. */}
      <DataGrid.QuickFilter expanded>
        <DataGrid.QuickFilterControl
          render={(props) => (
            <TextField
              {...props}
              variant="standard"
              size="small"
              placeholder="Search..."
              sx={{ minWidth: 220 }}
              InputProps={{
                startAdornment: <SearchIcon size={16} style={{ marginRight: 6, opacity: 0.6 }} />,
              }}
            />
          )}
        />
      </DataGrid.QuickFilter>
    </DataGrid.GridToolbarContainer>
  );
}

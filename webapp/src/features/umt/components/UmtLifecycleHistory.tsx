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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useMemo } from "react";
import {
  DataGrid,
  Paper,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { UmtLifecycleHistoryEntry } from "../api/umtUpdates";
import { useUmtLifecycleHistory } from "../api/useUmtLifecycleHistory";

const { DataGrid: DataGridComponent } = DataGrid;

export default function UmtLifecycleHistory({ id }: { id: string }) {
  const history = useUmtLifecycleHistory(id);
  const rows = useMemo(
    () => [...(history.data ?? [])].sort(compareNewestFirst),
    [history.data],
  );

  if (history.isError) {
    return (
      <ErrorNotice
        error={history.error}
        onRetry={() => void history.refetch()}
        retrying={history.isFetching}
      >
        Couldn&apos;t load lifecycle history for update #{id}.
      </ErrorNotice>
    );
  }

  const gridRows = rows.map((entry, index) => ({
    id: `${entry.timestamp ?? "unknown"}-${entry.fromState ?? "unknown"}-${index}`,
    ...entry,
  }));

  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
      <DataGridComponent
        autoHeight
        columnHeaderHeight={40}
        columns={lifecycleColumns}
        disableRowSelectionOnClick
        getRowHeight={() => "auto"}
        hideFooter
        loading={history.isPending}
        rows={gridRows}
        slots={{ noRowsOverlay: LifecycleHistoryEmptyState }}
        sx={lifecycleGridSx}
      />
    </Paper>
  );
}

const lifecycleColumns: DataGrid.GridColDef[] = [
  lifecycleColumn("timestamp", "Timestamp", 180),
  lifecycleColumn("fromState", "From", 160),
  lifecycleColumn("toState", "To", 160),
  lifecycleColumn("changedBy", "Changed By", 180),
];

function lifecycleColumn(field: keyof UmtLifecycleHistoryEntry, headerName: string, minWidth: number): DataGrid.GridColDef {
  return {
    field,
    flex: 1,
    headerName,
    minWidth,
    renderCell: (params) => (
      <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
        {displayValue(params.row[field])}
      </Stack>
    ),
  };
}

function LifecycleHistoryEmptyState() {
  return (
    <Stack sx={{ alignItems: "center", backgroundColor: "background.default", color: "text.secondary", height: "100%", justifyContent: "center" }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>No Data</Typography>
    </Stack>
  );
}

// See UmtUpdateViewSections.tsx's denseDataGridSx: MUI DataGrid clips long
// cell text (e.g. long "From"/"To" state names) with nowrap/ellipsis unless
// told to wrap.
const lifecycleGridSx = {
  border: 0,
  minHeight: 100,
  "& .MuiDataGrid-cell": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
} as const;

function compareNewestFirst(a: UmtLifecycleHistoryEntry, b: UmtLifecycleHistoryEntry): number {
  return timestampValue(b.timestamp) - timestampValue(a.timestamp);
}

function timestampValue(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function displayValue(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized || "N/A";
}

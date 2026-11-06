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

import { Box, DataGrid, LinearProgress, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { InboxIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { UmtReleasedChunk } from "../../api/umtReleaseChunks";
import { useUmtReleasedChunks } from "../../api/useUmtReleaseChunks";
import { BuildStatusChip, ChunkCell, ChunkLine } from "./umtReleaseChunkGridPrimitives";
import { UMT_CHUNK_GRID_PAPER_SX, UMT_CHUNK_GRID_SX } from "./umtReleaseChunkGridSx";
import { useChunkGridPagination } from "./useChunkGridPagination";

const { DataGrid: DataGridComponent } = DataGrid;

// The two per-update-level columns sit under one "Updates" title, the same way
// the pending grid groups its build columns. The standalone columns carry their
// name on the group instead of on the column, which is why their own
// headerName is blank below.
const COLUMN_GROUPING_MODEL: DataGrid.GridColumnGroupingModel = [
  { groupId: "idGroup", headerName: "ID", children: [{ field: "id" }] },
  { groupId: "updateIdsGroup", headerName: "Update IDs", children: [{ field: "updateIds" }] },
  {
    groupId: "updates",
    headerName: "Updates",
    headerAlign: "center",
    children: [{ field: "updateLevels" }, { field: "buildStatus" }],
  },
  { groupId: "releaseMessageGroup", headerName: "Release Message", children: [{ field: "releaseMessage" }] },
  { groupId: "releasedOnGroup", headerName: "Released On", children: [{ field: "releasedOn" }] },
];

// Purely informational: a released chunk is finished, so there is nothing to
// act on here even for an administrator.
export default function UmtReleasedChunksGrid() {
  const { chunks: releasedChunks, gridProps } = useChunkGridPagination(useUmtReleasedChunks);
  const rows = releasedChunks.data?.chunks ?? [];

  const columns: DataGrid.GridColDef<UmtReleasedChunk>[] = [
    {
      field: "id",
      headerName: "",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {params.row.id}
            </Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
    {
      field: "updateIds",
      headerName: "",
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          {params.row.updateIds.map((id) => (
            <ChunkLine key={id}>
              <Typography variant="body2">{id}</Typography>
            </ChunkLine>
          ))}
        </ChunkCell>
      ),
    },
    {
      field: "updateLevels",
      headerName: "Update Level",
      flex: 3,
      minWidth: 260,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell divided>
          {params.row.updateLevels.map((level, index) => (
            <ChunkLine key={index}>
              {/* The trailing update level is what identifies which release
                  of the product this row is about; without it two releases of
                  the same product read identically. */}
              <Typography variant="body2">
                {level.productName ?? "N/A"} {level.productVersion ?? "N/A"}
                {level.updateLevel === null || level.updateLevel === undefined
                  ? ""
                  : `.${level.updateLevel}`}
              </Typography>
            </ChunkLine>
          ))}
        </ChunkCell>
      ),
    },
    {
      field: "buildStatus",
      headerName: "Status",
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell divided>
          {params.row.updateLevels.map((level, index) => (
            <ChunkLine key={index}>
              <BuildStatusChip status={level.buildStatus} />
            </ChunkLine>
          ))}
        </ChunkCell>
      ),
    },
    {
      field: "releaseMessage",
      headerName: "",
      flex: 2,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2">{params.row.releaseMessage ?? "N/A"}</Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
    {
      field: "releasedOn",
      headerName: "",
      width: 170,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2">{params.row.releasedOn ?? "N/A"}</Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
  ];

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      {releasedChunks.isError && (
        <ErrorNotice
          error={releasedChunks.error}
          onRetry={() => void releasedChunks.refetch()}
          retrying={releasedChunks.isFetching}
        >
          Couldn&apos;t load released chunks.
        </ErrorNotice>
      )}

      <Paper variant="outlined" sx={UMT_CHUNK_GRID_PAPER_SX}>
        {releasedChunks.isFetching && !releasedChunks.isPending && (
          <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }} />
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGridComponent
            columnHeaderHeight={40}
            columnGroupingModel={COLUMN_GROUPING_MODEL}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            loading={releasedChunks.isPending}
            rows={rows}
            {...gridProps}
            slots={{ noRowsOverlay: ReleasedChunksEmptyState }}
            sx={UMT_CHUNK_GRID_SX}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

function ReleasedChunksEmptyState() {
  return (
    <Stack sx={{ alignItems: "center", color: "text.disabled", height: "100%", justifyContent: "center" }} spacing={1}>
      <InboxIcon size={36} />
      <Typography variant="body2">No released chunks yet</Typography>
    </Stack>
  );
}

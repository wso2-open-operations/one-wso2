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

import {
  Button,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { RotateCwIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useUmtReleaseChunkDockerBuildStatus } from "../../api/useUmtReleaseChunks";
import type { UmtDockerBuildStatus } from "../../api/umtReleaseChunks";
import { BuildStatusChip, ChunkCell, ChunkLine } from "./umtReleaseChunkGridPrimitives";
import { UMT_CHUNK_GRID_BORDERED_SX } from "./umtReleaseChunkGridSx";

const { DataGrid: DataGridComponent } = DataGrid;

export interface UmtReleaseChunkBuildInfoDialogProps {
  open: boolean;
  chunkId: number | null;
  onClose: () => void;
  onRetriggerDocker: () => void;
  retriggerBusy: boolean;
}

// A chunk's per-product docker build statuses, with a "Retrigger Failed
// Builds" button that hands off to the shared confirm dialog. This is the
// only place the docker statuses are shown, and it opens from the row action
// a failed docker build puts on the chunk.
export default function UmtReleaseChunkBuildInfoDialog({
  open,
  chunkId,
  onClose,
  onRetriggerDocker,
  retriggerBusy,
}: UmtReleaseChunkBuildInfoDialogProps) {
  const dockerStatus = useUmtReleaseChunkDockerBuildStatus(chunkId, open);
  const rows = (dockerStatus.data ?? []).map((status, index) => ({
    ...status,
    id: `${status.productName ?? "unknown"}-${status.productVersion ?? "unknown"}-${index}`,
  }));

  const columns: DataGrid.GridColDef<UmtDockerBuildStatus & { id: string }>[] = [
    {
      field: "product",
      headerName: "Product",
      flex: 2,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2">
              {params.row.productName ?? "N/A"}-{params.row.productVersion ?? "N/A"}
            </Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
    {
      field: "buildStatus",
      headerName: "Build Status",
      flex: 1,
      minWidth: 140,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <BuildStatusChip status={params.row.buildStatus} />
          </ChunkLine>
        </ChunkCell>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <span>Build Information</span>
          <Button
            variant="contained"
            size="small"
            startIcon={<RotateCwIcon size={14} />}
            loading={retriggerBusy}
            disabled={chunkId === null || retriggerBusy}
            onClick={onRetriggerDocker}
          >
            Retrigger Failed Builds
          </Button>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {dockerStatus.isError ? (
          <ErrorNotice
            error={dockerStatus.error}
            onRetry={() => void dockerStatus.refetch()}
            retrying={dockerStatus.isFetching}
          >
            Couldn&apos;t load docker build statuses.
          </ErrorNotice>
        ) : dockerStatus.isPending ? (
          <Stack sx={{ alignItems: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
            <DataGridComponent
              autoHeight
              columnHeaderHeight={40}
              columns={columns}
              disableColumnMenu
              disableRowSelectionOnClick
              getRowHeight={() => "auto"}
              hideFooter
              rows={rows}
              sx={UMT_CHUNK_GRID_BORDERED_SX}
            />
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

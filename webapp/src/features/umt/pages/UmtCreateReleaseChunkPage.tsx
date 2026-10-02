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

import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { EyeIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtUpdateSummary } from "../api/umtUpdates";
import { useUmtUpdatesByLifecycleState } from "../api/useUmtUpdates";
import { useUmtCreateReleaseChunk } from "../api/useUmtReleaseChunkActions";
import { useUmtGate } from "../api/useUmtGate";
import { umtReleaseChunkCollisionProducts } from "../lib/umtReleaseChunks";
import UmtShell from "../components/UmtShell";
import type { UmtBackLinkState } from "../lib/umtBackLink";
import { ChunkCell, ChunkLine } from "../components/release-chunks/umtReleaseChunkGridPrimitives";
import { UMT_CHUNK_GRID_SX } from "../components/release-chunks/umtReleaseChunkGridSx";

const { DataGrid: DataGridComponent } = DataGrid;

// Small pages by default: this is a list to read through and tick, not scan.
const PAGE_SIZE_OPTIONS = [5, 10, 20];

// The grid reports selection as an include/exclude set (GridRowSelectionModel),
// not a plain id array — resolving it against the rows on screen keeps
// select-all correct even when it arrives as an empty exclude-set.
function selectedRowIds(
  model: { type: "include" | "exclude"; ids: Set<DataGrid.GridRowId> },
  rows: { id: number }[],
): number[] {
  if (model.type === "include") return [...model.ids].map(Number);
  return rows.map((row) => row.id).filter((id) => !model.ids.has(id));
}

const CREATE_RELEASE_CHUNK_PATH = "/umt/release-chunks/new";

function restoredSelectedIds(state: unknown): number[] {
  if (!state || typeof state !== "object" || !("selectedIds" in state)) return [];
  const { selectedIds } = state as { selectedIds: unknown };
  return Array.isArray(selectedIds) ? selectedIds.filter((id): id is number => typeof id === "number") : [];
}

export default function UmtCreateReleaseChunkPage() {
  return (
    <UmtShell title="Create Release Chunk" backTo="/umt/release-chunks">
      <UmtCreateReleaseChunkBody />
    </UmtShell>
  );
}

function UmtCreateReleaseChunkBody() {
  // Creating a chunk locks the updates in it out of further editing, so it is
  // an administrator's decision.
  const gate = useUmtGate();
  if (!gate.isAdmin) {
    return (
      <Alert severity="warning">
        Creating a release chunk requires UMT Admin access.
      </Alert>
    );
  }
  return <UmtCreateReleaseChunkForm />;
}

function UmtCreateReleaseChunkForm() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const createChunk = useUmtCreateReleaseChunk();

  // Both states are fetched whole: the chunk is assembled from everything in
  // UATStaging, and checked against everything in UAT.
  const uatStaging = useUmtUpdatesByLifecycleState("UATStaging");
  const uat = useUmtUpdatesByLifecycleState("UAT");
  const rows = uatStaging.data?.data ?? [];

  const location = useLocation();
  // The selection lives in this page's history entry as well, so leaving to
  // read an update and coming back (by the back arrow or the browser) finds
  // it still ticked.
  const [selectedIds, setSelectedIds] = useState<number[]>(() => restoredSelectedIds(location.state));

  function changeSelection(ids: number[]) {
    setSelectedIds(ids);
    void navigate(location, { replace: true, state: { selectedIds: ids } });
  }
  const [collisionProducts, setCollisionProducts] = useState<string[] | null>(null);

  // Creating is held until the UAT list is actually in hand. Without it the
  // collision check compares the selection against nothing, finds nothing,
  // and reports the selection clear — the same wrong answer it would give if
  // there really were no conflict. An absent list is not evidence of a clear
  // selection, so it blocks rather than passes.
  const uatUpdates = uat.data?.data;
  const canCreate = selectedIds.length > 0 && uatUpdates !== undefined && !createChunk.isPending;

  async function submitCreate(updateIds: number[]) {
    try {
      await createChunk.mutateAsync(updateIds);
      showSuccess("Release chunk created successfully.");
      navigate("/umt/release-chunks?status=pending");
    } catch (error) {
      showError(describeError(error));
    }
  }

  function handleCreateClick() {
    if (!canCreate || uatUpdates === undefined) return;
    const selectedUpdates = rows.filter((row) => selectedIds.includes(row.id));
    const collisions = umtReleaseChunkCollisionProducts(selectedUpdates, uatUpdates);
    if (collisions.length > 0) {
      setCollisionProducts(collisions);
      return;
    }
    void submitCreate(selectedIds);
  }

  const columns: DataGrid.GridColDef<UmtUpdateSummary>[] = [
    {
      field: "id",
      headerName: "ID",
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
      field: "products",
      headerName: "Products",
      flex: 2,
      minWidth: 240,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          {(params.row.products ?? []).map((item, index) => (
            <ChunkLine key={index}>
              <Typography variant="body2">
                {item.product?.name ?? "N/A"} - {item.product?.version ?? "N/A"}
              </Typography>
            </ChunkLine>
          ))}
        </ChunkCell>
      ),
    },
    {
      field: "lifecycle",
      headerName: "Lifecycle",
      width: 170,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2">{params.row.lifecycle ?? "N/A"}</Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
    // A link to the update itself, so whoever is choosing what goes into a
    // chunk can read one before ticking it.
    {
      field: "action",
      headerName: "Action",
      width: 90,
      align: "center",
      headerAlign: "center",
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Tooltip title="View">
              <IconButton
                size="small"
                aria-label={`View update ${params.row.id}`}
                component={RouterLink}
                to={`/umt/updates/${params.row.id}`}
                state={{ backTo: CREATE_RELEASE_CHUNK_PATH, backState: { selectedIds } } satisfies UmtBackLinkState}
              >
                <EyeIcon size={16} />
              </IconButton>
            </Tooltip>
          </ChunkLine>
        </ChunkCell>
      ),
    },
  ];

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      {uatStaging.isError && (
        <ErrorNotice
          error={uatStaging.error}
          onRetry={() => void uatStaging.refetch()}
          retrying={uatStaging.isFetching}
        >
          Couldn&apos;t load UATStaging updates.
        </ErrorNotice>
      )}

      {/* The "already in UAT" guard is only as good as this list: with no UAT
          updates to compare against, every selection looks collision-free and
          the chunk is created regardless. So a failure to load it is worth
          saying out loud rather than passing silently. */}
      {uat.isError && (
        <ErrorNotice error={uat.error} onRetry={() => void uat.refetch()} retrying={uat.isFetching}>
          Couldn&apos;t load the updates already in UAT, so release chunks can&apos;t be checked
          against them.
        </ErrorNotice>
      )}

      <Typography variant="body2" color="text.secondary">
        Select the UATStaging updates to include in a new release chunk.
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {uatStaging.isFetching && !uatStaging.isPending && (
          <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }} />
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGridComponent
            checkboxSelection
            columnHeaderHeight={40}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE_OPTIONS[0], page: 0 } } }}
            loading={uatStaging.isPending}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            rows={rows}
            sx={UMT_CHUNK_GRID_SX}
            rowSelectionModel={{ type: "include", ids: new Set(selectedIds) }}
            onRowSelectionModelChange={(model) =>
              changeSelection(selectedRowIds(model as { type: "include" | "exclude"; ids: Set<DataGrid.GridRowId> }, rows))
            }
          />
        </Box>
      </Paper>

      <Box>
        <Button
          variant="contained"
          disabled={!canCreate}
          loading={createChunk.isPending}
          onClick={handleCreateClick}
        >
          Create Release Chunk
        </Button>
      </Box>

      <UmtCollisionDialog
        open={collisionProducts !== null}
        products={collisionProducts ?? []}
        onClose={() => setCollisionProducts(null)}
      />
    </Stack>
  );
}

// Why a selection was refused: one of the chosen updates is for a product and
// version that already has an update sitting in UAT, and that one has to be
// released before this one can take its place.
function UmtCollisionDialog({
  open,
  products,
  onClose,
}: {
  open: boolean;
  products: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cannot Promote Updates</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Update entry of {products.join(", ")} cannot be promoted to the next level. Release the
          updates in UAT before proceeding with the above updates.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

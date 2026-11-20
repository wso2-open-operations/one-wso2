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

import { useCallback, useEffect, useMemo, useState } from "react";
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
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { EyeIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtUpdateSummary } from "../api/umtUpdates";
import { UMT_LIFECYCLES } from "../api/umtTypes";
import { useUmtUpdatesByLifecycleState } from "../api/useUmtUpdates";
import { useUmtCreateReleaseChunk } from "../api/useUmtReleaseChunkActions";
import { useUmtGate } from "../api/useUmtGate";
import { umtReleaseChunkCollisionProducts } from "../lib/umtReleaseChunks";
import { umtPaths } from "../lib/umtPaths";
import { UMT_ALL_ROWS_GRID_PROPS, UMT_GRID_PAPER_SX } from "../lib/umtGrid";
import UmtShell from "../components/UmtShell";
import type { UmtBackLinkState } from "../lib/umtBackLink";
import { ChunkCell, ChunkLine } from "../components/release-chunks/umtReleaseChunkGridPrimitives";
import { UMT_CHUNK_GRID_SX } from "../components/release-chunks/umtReleaseChunkGridSx";
const { DataGrid: DataGridComponent } = DataGrid;

// The release-chunk grids pin cell content to the top, so that per-level
// entries line up across columns. This grid has no per-level columns, and its
// checkbox cell makes each row taller than one line of text, so its cells are
// centred vertically instead.
const GRID_SX = {
  ...UMT_CHUNK_GRID_SX,
  "& .MuiDataGrid-cell": {
    ...UMT_CHUNK_GRID_SX["& .MuiDataGrid-cell"],
    alignItems: "center",
  },
} as const;

// What this page keeps in its history entry, so that leaving to read an update
// and coming back finds the same ticks and filters.
interface UmtCreateReleaseChunkPageState {
  selectedIds: number[];
  search: string;
  lifecycle: string;
}

// Location state can hold anything, so each field is checked and falls back
// to its empty value.
function restoredPageState(state: unknown): UmtCreateReleaseChunkPageState {
  const saved = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  const { selectedIds, search, lifecycle } = saved;
  return {
    selectedIds: Array.isArray(selectedIds)
      ? selectedIds.filter((id): id is number => typeof id === "number")
      : [],
    search: typeof search === "string" ? search : "",
    lifecycle: UMT_LIFECYCLES.find((value) => value === lifecycle) ?? "",
  };
}

// How long the page waits after the last change before it writes its state to
// the history entry. Writing on every keystroke would call
// history.replaceState too often, and browsers limit how often it can be
// called.
const SAVE_STATE_DELAY_MS = 300;

// The search text with all whitespace removed and in lower case, so that it
// can be compared with the "name-version" text that matchesSearch builds.
function searchTerm(search: string): string {
  return search.replace(/\s+/g, "").toLowerCase();
}

// The search term matches any of an update's products written as
// "name-version" (e.g. "wso2is-7.2.0.4.full"), ignoring case.
function matchesSearch(row: UmtUpdateSummary, term: string): boolean {
  if (term === "") return true;
  return (row.products ?? []).some((item) =>
    `${item.product?.name ?? ""}-${item.product?.version ?? ""}`.toLowerCase().includes(term),
  );
}

export default function UmtCreateReleaseChunkPage() {
  return (
    <UmtShell title="Create Release Chunk" backTo={umtPaths.releaseChunks}>
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
  const uatStagingUpdates = uatStaging.data?.data;
  const rows = useMemo(() => uatStagingUpdates ?? [], [uatStagingUpdates]);

  const location = useLocation();
  // The ticks and filters live in this page's history entry as well, so
  // leaving to read an update and coming back (by the back arrow or the
  // browser) finds them as they were.
  const [restored] = useState(() => restoredPageState(location.state));
  const [selectedIds, setSelectedIds] = useState(restored.selectedIds);
  const [search, setSearch] = useState(restored.search);
  const [lifecycle, setLifecycle] = useState(restored.lifecycle);

  // The URL parts are listed one by one, not as `location`: each save makes a
  // new `location`, which would start the save again.
  const { pathname, search: urlSearch, hash } = location;
  const savePageState = useCallback(() => {
    const state: UmtCreateReleaseChunkPageState = { selectedIds, search, lifecycle };
    void navigate({ pathname, search: urlSearch, hash }, { replace: true, state });
  }, [navigate, pathname, urlSearch, hash, selectedIds, search, lifecycle]);

  useEffect(() => {
    const timer = setTimeout(savePageState, SAVE_STATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [savePageState]);

  const [collisionProducts, setCollisionProducts] = useState<string[] | null>(null);

  // A new array only when the list or a filter changes. A new array on every
  // render would make the grid rebuild all its rows on every render.
  const visibleRows = useMemo(() => {
    const term = searchTerm(search);
    return rows.filter((row) => matchesSearch(row, term) && (lifecycle === "" || row.lifecycle === lifecycle));
  }, [rows, search, lifecycle]);

  // The ticks the grid shows: only updates that are in the UATStaging list. A
  // restored tick for an update that has left UATStaging is dropped here, so
  // the grid's "rows selected" count matches what Create submits. Ticks on
  // rows the filters hide are kept.
  const gridSelectionModel = useMemo(() => {
    const listedIds = new Set(rows.map((row) => row.id));
    return { type: "include" as const, ids: new Set<DataGrid.GridRowId>(selectedIds.filter((id) => listedIds.has(id))) };
  }, [rows, selectedIds]);

  // Creating is held until the UAT list is actually in hand. Without it the
  // collision check compares the selection against nothing, finds nothing,
  // and reports the selection clear — the same wrong answer it would give if
  // there really were no conflict. An absent list is not evidence of a clear
  // selection, so it blocks rather than passes.
  const uatUpdates = uat.data?.data;
  // The selection is restored from history, so it can name updates that are
  // no longer in UATStaging, or all of them while the list is still loading or
  // has failed to. Only ticked updates that are in the UATStaging list are
  // checked and submitted. That includes ticked updates the search or
  // lifecycle filter hides, so Create lists every one of them for
  // confirmation first.
  // A new array only when the list or the ticks change, since the
  // confirmation dialog's grid takes it as its rows.
  const selectedUpdates = useMemo(() => {
    const ids = new Set(selectedIds);
    return rows.filter((row) => ids.has(row.id));
  }, [rows, selectedIds]);
  const [busy, setBusy] = useState(false);
  const canCreate = selectedUpdates.length > 0 && uatUpdates !== undefined && !busy;
  const [confirmOpen, setConfirmOpen] = useState(false);

  // UAT as the backend has it now, or undefined if the fetch fails.
  async function fetchCurrentUatUpdates(): Promise<UmtUpdateSummary[] | undefined> {
    const requestedAt = Date.now();
    const result = await uat.refetch();
    return result.isSuccess && result.dataUpdatedAt >= requestedAt ? result.data.data : undefined;
  }

  async function submitCreate(updateIds: number[]) {
    try {
      await createChunk.mutateAsync(updateIds);
      showSuccess("Release chunk created successfully.");
      navigate(`${umtPaths.releaseChunks}?status=pending`);
    } catch (error) {
      showError(describeError(error));
    }
  }

  // Shows why the selection is refused, and returns true, when a selected
  // update collides with an update already in UAT.
  function refuseCollisions(uatList: UmtUpdateSummary[]): boolean {
    const collisions = umtReleaseChunkCollisionProducts(selectedUpdates, uatList);
    if (collisions.length === 0) return false;
    setCollisionProducts(collisions);
    return true;
  }

  // A selection that collides with an update already in UAT is refused before
  // the confirmation, so nobody confirms a chunk that cannot be created.
  async function handleCreateClick() {
    if (!canCreate) return;
    setBusy(true);
    try {
      const currentUatUpdates = await fetchCurrentUatUpdates();
      if (currentUatUpdates === undefined || refuseCollisions(currentUatUpdates)) return;
      setConfirmOpen(true);
    } finally {
      setBusy(false);
    }
  }

  // UAT can change while the confirmation is open, so check again. The page's
  // UAT error is hidden behind the dialog, so a failed fetch shows a banner.
  async function handleConfirmCreate() {
    if (!canCreate) return;
    setBusy(true);
    try {
      const currentUatUpdates = await fetchCurrentUatUpdates();
      if (currentUatUpdates === undefined) {
        showError("Couldn't check the updates already in UAT. Try again.");
        return;
      }
      if (refuseCollisions(currentUatUpdates)) {
        setConfirmOpen(false);
        return;
      }
      await submitCreate(selectedUpdates.map((row) => row.id));
    } finally {
      setBusy(false);
    }
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
                sx={{ mx: "auto" }}
                component={RouterLink}
                to={umtPaths.update(params.row.id)}
                // Leaving the page cancels a save still waiting on its timer,
                // so the browser's Back would find the state before the last
                // change. Saving here, before the link navigates, keeps it.
                onClick={savePageState}
                state={
                  {
                    backTo: umtPaths.newReleaseChunk,
                    backState: { selectedIds, search, lifecycle } satisfies UmtCreateReleaseChunkPageState,
                  } satisfies UmtBackLinkState
                }
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

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%" }}>
        <TextField
          size="small"
          placeholder="Search by product (e.g. wso2is-7.2.0.4.full)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            htmlInput: { "aria-label": "Search updates by product" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Lifecycle"
          value={lifecycle}
          onChange={(event) => setLifecycle(event.target.value)}
          sx={{ minWidth: { sm: 240 } }}
        >
          <MenuItem value="">All</MenuItem>
          {UMT_LIFECYCLES.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Paper variant="outlined" sx={UMT_GRID_PAPER_SX}>
        {uatStaging.isFetching && !uatStaging.isPending && (
          <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }} />
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGridComponent
            disableVirtualization
            checkboxSelection
            columnHeaderHeight={40}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            // The backend returns every UATStaging update in one response, so
            // the grid shows them all on one page.
            {...UMT_ALL_ROWS_GRID_PROPS}
            hideFooterPagination
            loading={uatStaging.isPending}
            rows={visibleRows}
            sx={GRID_SX}
            // The grid holds ticks on rows the filters hide. With these two
            // props it never drops them on its own, and select-all or
            // unselect-all only adds or removes the rows on screen.
            keepNonExistentRowsSelected
            disableRowSelectionExcludeModel
            rowSelectionModel={gridSelectionModel}
            // Locked while Create checks the selection, so it cannot change
            // under the check.
            isRowSelectable={() => !busy}
            onRowSelectionModelChange={(model) => setSelectedIds([...model.ids].map(Number))}
          />
        </Box>
      </Paper>

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disabled={!canCreate}
          loading={busy}
          onClick={() => void handleCreateClick()}
        >
          Create Release Chunk
        </Button>
      </Box>

      <UmtCollisionDialog
        open={collisionProducts !== null}
        products={collisionProducts ?? []}
        onClose={() => setCollisionProducts(null)}
      />

      <UmtConfirmCreateDialog
        open={confirmOpen}
        updates={selectedUpdates}
        columns={columns.filter((column) => column.field !== "action")}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmCreate()}
      />
    </Stack>
  );
}

// The last check before a chunk is created. Creating a chunk locks its updates
// out of further editing, and a filter can hide some of the ticked updates, so
// this lists every update that goes in. The list can be long: the dialog stays
// within the window, and its content scrolls between the fixed title and
// buttons. The grid holds every row on one page, so none are cut off.
function UmtConfirmCreateDialog({
  open,
  updates,
  columns,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  updates: UmtUpdateSummary[];
  columns: DataGrid.GridColDef<UmtUpdateSummary>[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>Create Release Chunk</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          The new release chunk will include the following updates.
        </DialogContentText>
        <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
          <DataGridComponent
            autoHeight
            {...UMT_ALL_ROWS_GRID_PROPS}
            aria-label="Updates to include in the release chunk"
            disableVirtualization
            columnHeaderHeight={40}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            hideFooter
            rows={updates}
            sx={GRID_SX}
          />
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" loading={busy} disabled={busy || updates.length === 0} onClick={onConfirm}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
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

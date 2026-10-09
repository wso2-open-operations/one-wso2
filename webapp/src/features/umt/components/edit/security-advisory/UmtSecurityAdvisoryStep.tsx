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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { AlertTriangle, CheckCircle, PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { HttpError } from "@api/http";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import type { UmtSecurityAdvisory, UmtUpdateSummary } from "../../../api/umtUpdates";
import { useUmtSaveSecurityAdvisories, useUmtValidateSecurityAdvisory } from "../../../api/useUmtSecurityAdvisory";
import { umtSecurityAdvisoryFormatValid } from "../../../lib/umtSecurityAdvisory";

const { DataGrid: DataGridComponent } = DataGrid;

// The backend reports APPROVED / PRE_PUBLISHED / PUBLISHED and treats all three
// as valid, but they are not equivalent: attaching an advisory that is already
// released is a decision the user has to make explicitly. The Java tool prompts
// and records the answer in `userConsentFlag`, so `userConsentFlag: false`
// means "not released, nothing to consent to" — it must not be sent for a
// released advisory the user never saw a prompt for.
const RELEASED_ADVISORY_STATES = new Set(["PRE_PUBLISHED", "PUBLISHED"]);

export default function UmtSecurityAdvisoryStep({
  id,
  update,
  onDirtyChange,
}: {
  id: string;
  update: UmtUpdateSummary;
  // Reports unsaved changes, so the wizard can hold Next until they're saved.
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { showSuccess, showError } = useNotifications();
  const saveMutation = useUmtSaveSecurityAdvisories(id);

  // ---- Draft rows, reset on a confirmed save or a different update, never
  // just because the backend list's array reference changed. `["umt-update"]`
  // is invalidated by many unrelated mutations elsewhere on this page (mark
  // as duplicate, testing saves, lifecycle transitions, ...), each of which
  // hands back a structurally-new (even if content-identical) advisories
  // array; reseeding on that alone would silently discard advisories the
  // user added/removed locally but hadn't saved yet. ----
  const initialRows = useMemo(() => update.securityAdvisories ?? [], [update.securityAdvisories]);
  const [rows, setRows] = useState<UmtSecurityAdvisory[]>(initialRows);
  const [isDirty, setIsDirty] = useState(false);
  const [lastInitialRows, setLastInitialRows] = useState(initialRows);
  const [lastId, setLastId] = useState(id);
  if (id !== lastId) {
    setLastId(id);
    setLastInitialRows(initialRows);
    setRows(initialRows);
    setIsDirty(false);
  } else if (!isDirty && initialRows !== lastInitialRows) {
    setLastInitialRows(initialRows);
    setRows(initialRows);
  }

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // ---- Add modal state ----
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [advisoryName, setAdvisoryName] = useState("");
  const trimmedName = advisoryName.trim();
  const debouncedName = useDebouncedValue(trimmedName, 500);
  const formatValid = umtSecurityAdvisoryFormatValid(debouncedName);
  const validation = useUmtValidateSecurityAdvisory(debouncedName, formatValid);
  // A failed check (other than not-found) says nothing about the advisory
  // itself, so it is offered again rather than left looking like a verdict.
  const canRetryValidation =
    formatValid &&
    trimmedName === debouncedName &&
    validation.isError &&
    !validation.isFetching &&
    !(validation.error instanceof HttpError && validation.error.status === 404);
  // Require the live input to still match what was validated — otherwise,
  // during the debounce window after further typing, Add stays enabled on a
  // stale validation and would insert the old debouncedName instead of what
  // the field currently shows.
  const isAdvisoryValid = formatValid && validation.data?.valid === true && trimmedName === debouncedName;

  const [pendingReleasedAdvisory, setPendingReleasedAdvisory] = useState<string | null>(null);

  function closeAddModal() {
    setIsAddModalOpen(false);
    setAdvisoryName("");
  }

  function addAdvisory(name: string, userConsentFlag: boolean) {
    setRows((prev) => [...prev, { securityAdvisoryName: name, userConsentFlag }]);
    setIsDirty(true);
    closeAddModal();
  }

  function handleAdd() {
    if (!isAdvisoryValid) return;
    if (rows.some((row) => row.securityAdvisoryName === debouncedName)) {
      closeAddModal();
      return;
    }
    if (RELEASED_ADVISORY_STATES.has(validation.data?.state ?? "")) {
      setPendingReleasedAdvisory(debouncedName);
      return;
    }
    addAdvisory(debouncedName, false);
  }

  async function handleSave() {
    try {
      await saveMutation.mutateAsync(rows);
      showSuccess("Security advisories saved.");
      setIsDirty(false);
    } catch (error) {
      showError(`Failed to save security advisories. ${describeError(error)}`);
    }
  }

  const columns: DataGrid.GridColDef[] = [
    {
      field: "securityAdvisoryName",
      headerName: "Security Advisory",
      flex: 1,
      sortable: false,
      renderCell: (params) => <CellCenter>{params.row.securityAdvisoryName ?? "N/A"}</CellCenter>,
    },
    {
      field: "delete",
      headerName: "",
      width: 52,
      sortable: false,
      renderCell: (params) => (
        <CellCenter>
          <IconButton
            aria-label="Delete row"
            size="small"
            onClick={() => {
              setRows((prev) => prev.filter((row) => row.securityAdvisoryName !== params.row.securityAdvisoryName));
              setIsDirty(true);
            }}
          >
            <TrashIcon size={16} />
          </IconButton>
        </CellCenter>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Security Advisory</Typography>

      <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          columns={columns}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          getRowId={(row: UmtSecurityAdvisory) => row.securityAdvisoryName ?? ""}
          hideFooter
          rows={rows}
          sx={{ border: 0 }}
        />
      </Paper>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Button variant="outlined" startIcon={<PlusIcon size={16} />} onClick={() => setIsAddModalOpen(true)}>
          Add Advisory
        </Button>
      </Stack>

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button variant="contained" disabled={!isDirty} loading={saveMutation.isPending} onClick={() => void handleSave()}>
          Save
        </Button>
      </Stack>

      <Dialog open={isAddModalOpen} onClose={closeAddModal} fullWidth maxWidth="sm">
        <DialogTitle>Add Security Advisory</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <TextField
              label="Security Advisory Name"
              placeholder="WSO2-YYYY-NNNN"
              value={advisoryName}
              onChange={(event) => setAdvisoryName(event.target.value)}
              fullWidth
              error={Boolean(debouncedName) && !isAdvisoryValid && !validation.isFetching}
              helperText={advisoryStatusMessage(
                debouncedName,
                formatValid,
                validation.isFetching,
                validation.data,
                validation.error,
              )}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {validation.isFetching ? (
                        <CircularProgress size={18} />
                      ) : isAdvisoryValid ? (
                        <CheckCircle size={18} color="green" />
                      ) : debouncedName ? (
                        <AlertTriangle size={18} color="orange" />
                      ) : null}
                    </InputAdornment>
                  ),
                },
              }}
            />
            {canRetryValidation && (
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button size="small" onClick={() => void validation.refetch()}>
                  Retry
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddModal}>Cancel</Button>
          <Button variant="contained" disabled={!isAdvisoryValid} onClick={handleAdd}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pendingReleasedAdvisory !== null}
        onClose={() => setPendingReleasedAdvisory(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>This security advisory is already released</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to proceed with {pendingReleasedAdvisory}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingReleasedAdvisory(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (pendingReleasedAdvisory) addAdvisory(pendingReleasedAdvisory, true);
              setPendingReleasedAdvisory(null);
            }}
          >
            Proceed
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function advisoryStatusMessage(
  debouncedName: string,
  formatValid: boolean,
  isFetching: boolean,
  data: { valid?: boolean; state?: string | null; message?: string | null } | undefined,
  error: Error | null,
): string {
  if (!debouncedName) return "Expected format: WSO2-YYYY-NNNN";
  if (!formatValid) return "Expected: WSO2-YYYY-NNNN";
  if (isFetching) return "Validating…";
  if (data?.valid === true) return `Valid: State is ${data.state ?? "Not Available"}`;
  if (data) return `Invalid: ${data.message ?? "Advisory not found"}`;
  // The backend answers an unknown advisory with a 404 rather than a result.
  if (error instanceof HttpError && error.status === 404) return "Invalid: Advisory not found";
  // The format is fine, but the check itself failed or could not run.
  return "Couldn't verify this advisory.";
}

function CellCenter({ children }: { children: ReactNode }) {
  return <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>{children}</Stack>;
}

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

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useState, type JSX } from "react";
import { useGetDeadlineDays } from "@features/security/grc/modules/audit/api/useGetDeadlineDays";
import { useUpdateDeadlineDays } from "@features/security/grc/modules/audit/api/useUpdateDeadlineDays";
import { useAuditPrivileges } from "@features/security/grc/modules/audit/hooks/useAuditPrivileges";
import { AuditPrivilege } from "@features/security/grc/modules/audit/privileges";
import type { DeadlineDayRow } from "@features/security/grc/modules/audit/types/audit";
import {
  DEADLINE_CYCLES,
  DEADLINE_HANDLERS,
  allowedDaysError,
  buildDeadlineDaysUpdate,
  deadlineCellKey,
  draftFromRows,
  validateDraft,
} from "@features/security/grc/modules/audit/utils/deadlineDays";
import { deadlineHandlerLabel } from "@features/security/grc/modules/audit/utils/deadlines";

// ── Form ─────────────────────────────────────────────────────────────────────

interface DeadlineDaysFormProps {
  rows: DeadlineDayRow[];
  isSaving: boolean;
  error: string | null;
  onSave: (rows: DeadlineDayRow[], draft: Record<string, string>) => void;
  onClose: () => void;
}

function DeadlineDaysForm({ rows, isSaving, error, onSave, onClose }: DeadlineDaysFormProps): JSX.Element {
  const [draft, setDraft] = useState(() => draftFromRows(rows));
  // Errors show once a cell has been touched, so a fresh form is not red.
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const errors = validateDraft(draft);
  const hasChanges = buildDeadlineDaysUpdate(rows, draft).days.length > 0;
  const canSave = !isSaving && hasChanges && Object.keys(errors).length === 0;

  return (
    <>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Days each group has to act on a control once it is handed to them. Changes only affect
          hand-offs that happen afterwards; deadlines already set are not recalculated.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }} />
              {DEADLINE_HANDLERS.map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600 }}>{deadlineHandlerLabel(h)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {DEADLINE_CYCLES.map(({ cycleType, label }) => (
              <TableRow key={cycleType}>
                <TableCell sx={{ fontWeight: 600 }}>{label}</TableCell>
                {DEADLINE_HANDLERS.map((h) => {
                  const key = deadlineCellKey(cycleType, h);
                  const row = rows.find((r) => r.cycleType === cycleType && r.handledBy === h);
                  const err = touched.has(key) ? allowedDaysError(draft[key] ?? "") : null;
                  return (
                    <TableCell key={h} sx={{ verticalAlign: "top" }}>
                      <TextField
                        size="small"
                        value={draft[key] ?? ""}
                        disabled={isSaving || !row}
                        error={err !== null}
                        helperText={err ?? undefined}
                        onChange={(e) => {
                          setDraft((d) => ({ ...d, [key]: e.target.value }));
                          setTouched((t) => new Set(t).add(key));
                        }}
                        slotProps={{
                          htmlInput: {
                            inputMode: "numeric",
                            "aria-label": `${label} days for ${deadlineHandlerLabel(h)}`,
                          },
                        }}
                        sx={{ width: 96 }}
                      />
                      {row?.isDefault && (
                        <Box sx={{ mt: 0.5 }}>
                          <Chip label="Default" size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                        </Box>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSaving} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() => onSave(rows, draft)}
          startIcon={isSaving ? <CircularProgress size={14} /> : undefined}
          sx={{ textTransform: "none" }}
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────────

interface DeadlineDaysDialogProps {
  auditId: number;
  open: boolean;
  onClose: () => void;
}

/** Allowed-days settings for an audit — for holders of the manage-controls privilege only. */
export default function DeadlineDaysDialog({ auditId, open, onClose }: DeadlineDaysDialogProps): JSX.Element | null {
  const { can } = useAuditPrivileges();
  const canManage = can(AuditPrivilege.ManageControls);

  const { data, isLoading, isError, error: loadError, refetch } = useGetDeadlineDays(auditId, open && canManage);
  const updateMutation = useUpdateDeadlineDays();
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!canManage) return null;

  function handleClose() {
    setSaveError(null);
    onClose();
  }

  function handleSave(rows: DeadlineDayRow[], draft: Record<string, string>) {
    setSaveError(null);
    updateMutation.mutate(
      { auditId, req: buildDeadlineDaysUpdate(rows, draft) },
      {
        onSuccess: handleClose,
        onError: (e) => setSaveError(e instanceof Error ? e.message : "Failed to update deadline days"),
      },
    );
  }

  return (
    <Dialog open={open} // A backdrop click or Escape must not dismiss the dialog mid-request.
      onClose={() => { if (!updateMutation.isPending) handleClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Deadline Days</DialogTitle>
      {isLoading ? (
        <DialogContent>
          <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />
        </DialogContent>
      ) : isError || !data ? (
        <>
          <DialogContent>
            <Alert severity="error">
              {loadError instanceof Error ? loadError.message : "Failed to load deadline days"}
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose} sx={{ textTransform: "none" }}>Close</Button>
            <Button variant="outlined" onClick={() => void refetch()} sx={{ textTransform: "none" }}>Retry</Button>
          </DialogActions>
        </>
      ) : (
        <DeadlineDaysForm
          // Re-seed the draft when the server's numbers change (after a save).
          key={data.days.map((r) => `${r.cycleType}:${r.handledBy}:${r.allowedDays}`).join("|")}
          rows={data.days}
          isSaving={updateMutation.isPending}
          error={saveError}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </Dialog>
  );
}

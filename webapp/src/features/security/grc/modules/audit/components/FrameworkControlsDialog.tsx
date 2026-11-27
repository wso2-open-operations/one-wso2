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

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Download, Plus, Search, Upload } from "@wso2/oxygen-ui-icons-react";
import { type ChangeEvent, type JSX, useRef, useState } from "react";
import { useGetFrameworkControls } from "@features/security/grc/modules/audit/api/useGetFrameworkControls";
import { useCreateFrameworkControl } from "@features/security/grc/modules/audit/api/useCreateFrameworkControl";
import { useBulkAddFrameworkControls } from "@features/security/grc/modules/audit/api/useBulkAddFrameworkControls";
import {
  FRAMEWORK_CONTROL_CSV_TEMPLATE,
  MAX_CSV_CONTROLS,
  parseFrameworkControlsCsv,
  type FrameworkControlCsvRow,
} from "@features/security/grc/modules/audit/utils/controlCsv";
import type {
  AuditFramework,
  ControlScope,
  ControlType,
  RequirementType,
} from "@features/security/grc/modules/audit/types/audit";

const SCOPE_LABELS: Record<ControlScope, string> = { COMMON: "Common", PRODUCT_SPECIFIC: "Product specific" };
const PREVIEW_ROWS = 5;
// A larger file is refused before it is read; the server caps a request at 500 rows anyway.
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Mode = "list" | "add" | "csv";

interface FrameworkControlsDialogProps {
  /** The framework whose controls are shown; null keeps the dialog closed. */
  framework: AuditFramework | null;
  /** Add / upload are offered only when the user may manage frameworks. */
  canManage: boolean;
  onClose: () => void;
  onNotify: (message: string) => void;
}

/** A framework's control library: browse it and, for managers, add controls one by one or from a CSV. */
export default function FrameworkControlsDialog({
  framework,
  canManage,
  onClose,
  onNotify,
}: FrameworkControlsDialogProps): JSX.Element {
  // Keyed so search text and the add / upload mode reset for each framework.
  return framework ? (
    <ControlsBody key={framework.id} framework={framework} canManage={canManage} onClose={onClose} onNotify={onNotify} />
  ) : (
    <></>
  );
}

function ControlsBody({
  framework,
  canManage,
  onClose,
  onNotify,
}: Omit<FrameworkControlsDialogProps, "framework"> & { framework: AuditFramework }): JSX.Element {
  const { data: controls, isLoading, isError, error } = useGetFrameworkControls(framework.id);
  const [mode, setMode] = useState<Mode>("list");
  const [search, setSearch] = useState("");

  const all = controls ?? [];
  const q = search.trim().toLowerCase();
  const shown = all.filter(
    (c) => !q || c.controlNumber.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  );
  const archived = framework.status === "ARCHIVED";

  const done = (message: string) => {
    setMode("list");
    onNotify(message);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <span>
          {framework.name}
          {!isLoading && !isError && ` - ${all.length} control${all.length === 1 ? "" : "s"}`}
        </span>
        {canManage && !archived && mode === "list" && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<Upload size={14} />} onClick={() => setMode("csv")} sx={{ textTransform: "none" }}>
              Upload CSV
            </Button>
            <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setMode("add")} sx={{ textTransform: "none" }}>
              Add control
            </Button>
          </Box>
        )}
      </DialogTitle>

      <DialogContent dividers>
        {mode === "add" && <AddControlForm frameworkId={framework.id} onCancel={() => setMode("list")} onDone={done} />}
        {mode === "csv" && (
          <CsvUpload frameworkId={framework.id} existingCount={all.length} onCancel={() => setMode("list")} onDone={done} />
        )}

        {mode === "list" && (
          <>
            <TextField
              size="small"
              placeholder="Search by control number or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 2, minWidth: 320 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {isLoading && <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />}
            {isError && <Alert severity="error">{error.message}</Alert>}
            {!isLoading && !isError && shown.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {q ? `No controls matching “${search.trim()}”.` : "This framework has no controls yet."}
              </Typography>
            )}
            {shown.length > 0 && (
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Control #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Scope</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shown.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{c.controlNumber}</TableCell>
                        <TableCell>{c.description}</TableCell>
                        <TableCell>
                          <Chip label={c.requirementType} size="small" />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{SCOPE_LABELS[c.scope] ?? c.scope}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

interface FormProps {
  frameworkId: number;
  onCancel: () => void;
  onDone: (message: string) => void;
}

function AddControlForm({ frameworkId, onCancel, onDone }: FormProps): JSX.Element {
  const create = useCreateFrameworkControl();
  const [controlNumber, setControlNumber] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [requirementType, setRequirementType] = useState<RequirementType>("DESIGN");
  const [controlType, setControlType] = useState<ControlType>("NON_CONFIG");
  const [scope, setScope] = useState<ControlScope>("COMMON");

  const number = controlNumber.trim();
  const canSave = number !== "" && description.trim() !== "" && !create.isPending;

  const save = () => {
    if (!canSave) return;
    create.mutate(
      {
        frameworkId,
        controlNumber: number,
        description: description.trim(),
        evidenceRequirement: evidence.trim() || null,
        requirementType,
        controlType,
        scope,
      },
      { onSuccess: () => onDone(`Control ${number} added.`) },
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Add control
      </Typography>
      <TextField size="small" label="Control number" value={controlNumber} onChange={(e) => setControlNumber(e.target.value)} disabled={create.isPending} autoFocus />
      <TextField size="small" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} disabled={create.isPending} />
      <TextField size="small" label="Evidence requirement (optional)" value={evidence} onChange={(e) => setEvidence(e.target.value)} multiline minRows={2} disabled={create.isPending} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
        <TextField select size="small" label="Requirement type" value={requirementType} onChange={(e) => setRequirementType(e.target.value as RequirementType)} disabled={create.isPending}>
          <MenuItem value="DESIGN">Design</MenuItem>
          <MenuItem value="OE">Operating effectiveness</MenuItem>
        </TextField>
        <TextField select size="small" label="Control type" value={controlType} onChange={(e) => setControlType(e.target.value as ControlType)} disabled={create.isPending}>
          <MenuItem value="NON_CONFIG">Non-config</MenuItem>
          <MenuItem value="CONFIG">Config</MenuItem>
        </TextField>
        <TextField select size="small" label="Scope" value={scope} onChange={(e) => setScope(e.target.value as ControlScope)} disabled={create.isPending}>
          <MenuItem value="COMMON">Common</MenuItem>
          <MenuItem value="PRODUCT_SPECIFIC">Product specific</MenuItem>
        </TextField>
      </Box>
      {create.isError && <Alert severity="error">{create.error.message}</Alert>}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onCancel} disabled={create.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>
          {create.isPending ? "Adding…" : "Add control"}
        </Button>
      </Box>
    </Box>
  );
}

function downloadTemplate(): void {
  const url = URL.createObjectURL(new Blob([FRAMEWORK_CONTROL_CSV_TEMPLATE], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "framework-controls-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function CsvUpload({ frameworkId, existingCount, onCancel, onDone }: FormProps & { existingCount: number }): JSX.Element {
  const bulk = useBulkAddFrameworkControls();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<FrameworkControlCsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again after a fix
    if (!file) return;
    bulk.reset();
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setRows([]);
      setErrors(["The file is larger than 2 MB."]);
      return;
    }
    const result = parseFrameworkControlsCsv(await file.text());
    setRows(result.ok ? result.rows : []);
    setErrors(result.ok ? [] : result.errors);
  };

  const confirm = () => {
    bulk.mutate(
      { frameworkId, controls: rows },
      { onSuccess: (data) => onDone(`${data.total} control${data.total === 1 ? "" : "s"} added from ${fileName}.`) },
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Upload controls from CSV
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Required columns: control_number, description. Optional: evidence_requirement, requirement_type (DESIGN or OE),
        control_type (CONFIG or NON_CONFIG), scope (COMMON or PRODUCT_SPECIFIC). Controls are added to the {existingCount}{" "}
        already in this framework, up to {MAX_CSV_CONTROLS} per file. A control number that already exists, or any invalid row,
        rejects the whole file.
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => void handleFile(e)} />
        <Button variant="outlined" size="small" startIcon={<Upload size={14} />} onClick={() => fileRef.current?.click()} disabled={bulk.isPending} sx={{ textTransform: "none" }}>
          Choose CSV file
        </Button>
        <Button size="small" startIcon={<Download size={14} />} onClick={downloadTemplate} sx={{ textTransform: "none" }}>
          Download template
        </Button>
        {fileName && <Typography variant="body2">{fileName}</Typography>}
      </Box>

      {errors.length > 0 && (
        <Alert severity="error">
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </Box>
        </Alert>
      )}
      {rows.length > 0 && (
        <>
          <Alert severity="success">
            {rows.length} control{rows.length === 1 ? "" : "s"} ready to add.
            {rows.length > PREVIEW_ROWS && ` Showing the first ${PREVIEW_ROWS}.`}
          </Alert>
          <TableContainer>
            <Table size="small">
              <TableBody>
                {rows.slice(0, PREVIEW_ROWS).map((r) => (
                  <TableRow key={r.controlNumber}>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.controlNumber}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell>{r.requirementType}</TableCell>
                    <TableCell>{SCOPE_LABELS[r.scope]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      {bulk.isError && <Alert severity="error">{bulk.error.message}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onCancel} disabled={bulk.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={confirm} disabled={rows.length === 0 || bulk.isPending}>
          {bulk.isPending ? "Adding…" : `Add ${rows.length || ""} control${rows.length === 1 ? "" : "s"}`.replace("  ", " ")}
        </Button>
      </Box>
    </Box>
  );
}

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

// Budget Pacing: MTD spend per campaign, updated weekly. Expected/Actual pace,
// variance and the OVERSPENDING/UNDERSPENDING flag are computed from
// monthlyBudget/mtdSpend/asOfDate exactly as the sheet's formulas did (see
// campaignTrackerTypes.ts).

import { useMemo, useRef, useState } from "react";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip, MenuItem, Button, Dialog, DialogActions, TextField } from "@wso2/oxygen-ui";
import { Plus, Trash2, Calculator } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  BudgetPacingRow,
  BusinessUnit,
  AdPlatform,
  PacingFlag,
  BUSINESS_UNITS,
  PACING_FLAGS,
  expectedPace,
  actualPace,
  pacingVariance,
  pacingVarianceDollars,
  pacingFlag,
  fmtPct,
  fmtMoney,
  parseLocalDate,
} from "../campaignTrackerTypes";
import type { ManualPacingEditableFields } from "../../../api/useCampaignTracker";
import { NUMERIC, ToneChip } from "./campaignTrackerPrimitives";
import { MultiSelectFilter, InlineDateRangeFilter, InlineNumberRangeFilter, ClearFiltersButton, RowCount } from "./FilterControls";

const FLAG_COLOR: Record<PacingFlag, string> = {
  "ON TRACK": "success.main",
  OVERSPENDING: "error.main",
  UNDERSPENDING: "warning.main",
};

// A calculated figure (Google's monthlyBudget is ALWAYS calculated — the
// vendor only reports a daily figure; LinkedIn's monthly/daily can go either
// way — see campaignTrackerTypes.ts) isn't a vendor-confirmed number the way
// a directly-set one is — the amber color + calculator icon flag that at a
// glance, not just on hover, so a marketer doesn't mistake a computed
// estimate for a figure the vendor actually has on file.
function BudgetValue({ value, isDerived, tooltip }: { value: string; isDerived: boolean; tooltip: string }) {
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, justifyContent: "flex-end" }}>
        {isDerived && (
          <Box component="span" sx={{ display: "inline-flex", color: "warning.main" }}>
            <Calculator size={13} />
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC, color: isDerived ? "warning.main" : "text.primary", fontWeight: isDerived ? 600 : 400 }}>{value}</Typography>
      </Box>
    </Tooltip>
  );
}

const fmtDate = (d: string) => {
  const parsed = parseLocalDate(d);
  return parsed ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
};

// Advanced filter: BU/Flag are multi-select (OR within the field); the As-of
// date range and Variance % range narrow further. Every field ANDs together.
export interface PacingFilters {
  bus: BusinessUnit[];
  flags: PacingFlag[];
  asOfFrom: string;
  asOfTo: string;
  varianceMinPct: string;
  varianceMaxPct: string;
}
export const EMPTY_PACING_FILTERS: PacingFilters = { bus: [], flags: [], asOfFrom: "", asOfTo: "", varianceMinPct: "", varianceMaxPct: "" };
function countActivePacing(f: PacingFilters): number {
  return f.bus.length + f.flags.length + (f.asOfFrom ? 1 : 0) + (f.asOfTo ? 1 : 0) + (f.varianceMinPct !== "" ? 1 : 0) + (f.varianceMaxPct !== "" ? 1 : 0);
}
function matchesPacingFilters(row: BudgetPacingRow, f: PacingFilters): boolean {
  if (f.bus.length && !f.bus.includes(row.bu)) return false;
  if (f.flags.length && !f.flags.includes(pacingFlag(row))) return false;
  if (f.asOfFrom && row.asOfDate < f.asOfFrom) return false;
  if (f.asOfTo && row.asOfDate > f.asOfTo) return false;
  const variancePct = pacingVariance(row) * 100;
  if (f.varianceMinPct !== "" && variancePct < Number(f.varianceMinPct)) return false;
  if (f.varianceMaxPct !== "" && variancePct > Number(f.varianceMaxPct)) return false;
  return true;
}

function diffManualFields(a: BudgetPacingRow, b: BudgetPacingRow): Partial<ManualPacingEditableFields> {
  const patch: Partial<ManualPacingEditableFields> = {};
  if (a.month !== b.month) patch.month = b.month;
  if (a.bu !== b.bu) patch.bu = b.bu;
  if (a.campaign !== b.campaign) patch.campaign = b.campaign;
  if (a.monthlyBudget !== b.monthlyBudget) patch.monthlyBudget = b.monthlyBudget;
  if (a.mtdSpend !== b.mtdSpend) patch.mtdSpend = b.mtdSpend;
  if (a.asOfDate !== b.asOfDate) patch.asOfDate = b.asOfDate;
  return patch;
}

export function BudgetPacingTable({
  rows,
  onChange,
  platform,
  filters,
  onAdd,
  onUpdate,
  onDelete,
}: {
  rows: BudgetPacingRow[];
  onChange: (rows: BudgetPacingRow[]) => void;
  platform: AdPlatform;
  filters: PacingFilters;
  // Persist a manual row. Editing a live vendor-derived row (isManual falsy)
  // stays local-only/ephemeral as before — there's nothing meaningful to
  // persist for a row the next fetch will just recompute from the vendor anyway.
  onAdd?: (row: Omit<BudgetPacingRow, "id" | "isManual" | "monthlyBudgetIsDerived" | "dailyBudget" | "dailyBudgetIsDerived">) => Promise<BudgetPacingRow>;
  onUpdate?: (id: string, patch: Partial<ManualPacingEditableFields>) => Promise<BudgetPacingRow>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<BudgetPacingRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // saveRow/deleteRow await a persistence call before touching state; reading
  // the `rows` prop straight from the closure at that point would apply the
  // change on top of whatever `rows` looked like when the async call started,
  // silently discarding any edit that landed in between. A ref always reads
  // the latest rows the parent has handed down.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const filtered = useMemo(() => rows.filter((r) => matchesPacingFilters(r, filters)), [rows, filters]);

  async function saveRow(row: BudgetPacingRow) {
    const existing = rowsRef.current.find((r) => r.id === row.id);
    setSaving(true);
    try {
      if (!existing) {
        const finalRow = onAdd ? await onAdd(row) : row;
        onChange([...rowsRef.current, finalRow]);
      } else if (row.isManual && onUpdate) {
        const patch = diffManualFields(existing, row);
        const finalRow = Object.keys(patch).length > 0 ? await onUpdate(row.id, patch) : row;
        onChange(rowsRef.current.map((r) => (r.id === row.id ? finalRow : r)));
      } else {
        onChange(rowsRef.current.map((r) => (r.id === row.id ? row : r)));
      }
      setEditing(null);
      setAdding(false);
      setSaveError(null);
    } catch (e) {
      // Persistence failed — leave the prior rows (and the open dialog) alone
      // rather than committing a row the server never actually saved.
      setSaveError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: BudgetPacingRow) {
    if (!onDelete) {
      onChange(rowsRef.current.filter((r) => r.id !== row.id));
      return;
    }
    try {
      await onDelete(row.id);
      onChange(rowsRef.current.filter((r) => r.id !== row.id));
      setSaveError(null);
    } catch (e) {
      setSaveError(describeError(e));
    }
  }

  return (
    <Box>
      {saveError && !editing && !adding && (
        <Typography sx={{ fontSize: "0.76rem", color: "error.main", mb: 1.5 }}>Couldn't save: {saveError}</Typography>
      )}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <RowCount shown={filtered.length} total={rows.length} singular="pacing row" />
        <Button size="small" variant="contained" startIcon={<Plus size={16} />} onClick={() => setAdding(true)} sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700 }}>
          Add pacing row
        </Button>
      </Box>

      {filtered.length === 0 ? (
        <Typography sx={{ fontSize: "0.76rem", color: "text.disabled", textAlign: "center", py: 3 }}>No pacing rows match these filters</Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
          <Box sx={{ overflow: "auto", maxHeight: 640 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1220 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Campaign</TableCell>
                  <TableCell>BU</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Daily budget</TableCell>
                  <TableCell align="right">MTD spend</TableCell>
                  <TableCell>As of</TableCell>
                  <TableCell align="right">Expected pace</TableCell>
                  <TableCell align="right">Actual pace</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell align="right">Variance ($)</TableCell>
                  <TableCell>Flag</TableCell>
                  <TableCell align="right" sx={{ width: 44 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((row) => {
                  const exp = expectedPace(row.asOfDate);
                  const act = actualPace(row.mtdSpend, row.monthlyBudget);
                  const variance = pacingVariance(row);
                  const varianceDollars = pacingVarianceDollars(row);
                  const flag = pacingFlag(row);
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => setEditing(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setEditing(row);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit pacing row for ${row.campaign}`}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography sx={{ fontSize: "0.74rem" }}>{row.month}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, letterSpacing: "-0.005em" }}>{row.campaign}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.74rem" }}>{row.bu}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <BudgetValue
                          value={fmtMoney(row.monthlyBudget)}
                          isDerived={!!row.monthlyBudgetIsDerived}
                          tooltip={row.monthlyBudgetIsDerived ? "Calculated: daily budget × days in month" : `Set directly by ${platform} as the campaign total budget`}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <BudgetValue
                          value={row.dailyBudget != null ? fmtMoney(row.dailyBudget) : "—"}
                          isDerived={!!row.dailyBudgetIsDerived}
                          tooltip={row.dailyBudgetIsDerived ? "Calculated: monthly budget ÷ days in month" : `Set directly by ${platform} as the campaign daily budget`}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{fmtMoney(row.mtdSpend)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.72rem", ...NUMERIC }}>{fmtDate(row.asOfDate)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{fmtPct(exp)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{fmtPct(act)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC, color: FLAG_COLOR[flag], fontWeight: 600 }}>
                          {variance >= 0 ? "+" : ""}
                          {fmtPct(variance)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC, color: FLAG_COLOR[flag], fontWeight: 600 }}>
                          {varianceDollars >= 0 ? "+" : "-"}
                          {fmtMoney(Math.abs(varianceDollars))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <ToneChip label={flag} color={FLAG_COLOR[flag]} />
                      </TableCell>
                      <TableCell align="right" sx={{ width: 44 }} onClick={(e) => e.stopPropagation()}>
                        {row.isManual && (
                          <Tooltip title="Delete this row" arrow placement="top">
                            <IconButton size="small" onClick={() => deleteRow(row)} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "error.main" } }}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {(editing || adding) && (
        <PacingFormDialog
          initial={editing}
          platform={platform}
          saving={saving}
          error={saveError}
          onCancel={() => {
            setEditing(null);
            setAdding(false);
            setSaveError(null);
          }}
          onSave={saveRow}
        />
      )}
    </Box>
  );
}

export function PacingFilterControls({ filters, onChange }: { filters: PacingFilters; onChange: (f: PacingFilters) => void }) {
  return (
    <>
      <MultiSelectFilter label="Business unit" options={BUSINESS_UNITS} selected={filters.bus} onChange={(bus) => onChange({ ...filters, bus })} />
      <MultiSelectFilter label="Flag" options={PACING_FLAGS} selected={filters.flags} width={150} onChange={(flags) => onChange({ ...filters, flags })} />
      <InlineDateRangeFilter
        label="As-of date range"
        from={filters.asOfFrom}
        to={filters.asOfTo}
        onFromChange={(v) => onChange({ ...filters, asOfFrom: v })}
        onToChange={(v) => onChange({ ...filters, asOfTo: v })}
      />
      <InlineNumberRangeFilter
        label="Variance % range"
        min={filters.varianceMinPct}
        max={filters.varianceMaxPct}
        onMinChange={(v) => onChange({ ...filters, varianceMinPct: v })}
        onMaxChange={(v) => onChange({ ...filters, varianceMaxPct: v })}
      />
      <ClearFiltersButton activeCount={countActivePacing(filters)} onClear={() => onChange(EMPTY_PACING_FILTERS)} />
    </>
  );
}

let draftSeq = 0;

function PacingFormDialog({
  initial,
  platform,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initial: BudgetPacingRow | null;
  platform: AdPlatform;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (row: BudgetPacingRow) => void;
}) {
  const [row, setRow] = useState<BudgetPacingRow>(
    initial ?? {
      id: `pace-draft-${++draftSeq}`,
      month: new Date().toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      bu: "IAM",
      platform,
      campaign: "",
      monthlyBudget: 0,
      monthlyBudgetIsDerived: null,
      dailyBudget: null,
      dailyBudgetIsDerived: null,
      mtdSpend: 0,
      asOfDate: new Date().toISOString().slice(0, 10),
      isManual: true,
    },
  );

  const set = <K extends keyof BudgetPacingRow>(k: K, v: BudgetPacingRow[K]) => setRow((r) => ({ ...r, [k]: v }));
  const canSave = row.campaign.trim().length > 0 && row.month.trim().length > 0;

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>{initial ? "Edit pacing row" : "Add pacing row"}</Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <TextField label="Campaign" size="small" fullWidth sx={{ gridColumn: "1 / -1" }} value={row.campaign} onChange={(e) => set("campaign", e.target.value)} />
        <TextField label="Month" size="small" fullWidth value={row.month} onChange={(e) => set("month", e.target.value)} />
        <TextField label="As-of date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={row.asOfDate} onChange={(e) => set("asOfDate", e.target.value)} />
        <LabeledSelect label="BU" value={row.bu} options={BUSINESS_UNITS} onChange={(v) => set("bu", v)} />
        <TextField label="Monthly budget ($)" type="number" size="small" fullWidth value={row.monthlyBudget} onChange={(e) => set("monthlyBudget", Number(e.target.value))} />
        <TextField label="MTD spend ($)" type="number" size="small" fullWidth value={row.mtdSpend} onChange={(e) => set("mtdSpend", Number(e.target.value))} />
      </Box>
      {error && (
        <Typography sx={{ fontSize: "0.74rem", color: "error.main", px: 3, pb: 1 }}>Couldn't save: {error}</Typography>
      )}
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} disabled={saving} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={() => onSave(row)} disabled={!canSave || saving} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add row"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LabeledSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <TextField select label={label} size="small" fullWidth value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          {o}
        </MenuItem>
      ))}
    </TextField>
  );
}

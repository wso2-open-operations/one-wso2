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

// The Campaign Register: master list of every live campaign. Rows are
// fetched live from the Google/LinkedIn Ads APIs (via the backend's
// campaign_tracker — see useCampaignTracker.ts): campaign name, objective,
// dates and budget are API-sourced, so there's no manual add or delete here —
// only editing the fields that stay manual regardless: BU, CPL figures,
// Status and Last Reviewed (Owner is shown but read-only, resolved from the
// BU Owners registry, not set per campaign). Those four fields persist
// server-side (ad_campaigns_register_overrides, via onSave — see
// CampaignTrackerPage.handleRegisterUpdate) once saved, surviving a refresh;
// everything else always reflects live vendor data. The Flag column is
// computed from status/end-date/last-reviewed exactly as the original
// sheet's formula did (see campaignTrackerTypes.ts). This is the direct
// answer to "what is quietly spending?"

import { useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from "@wso2/oxygen-ui";
import { CalendarCheck, Calculator } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  CampaignRegisterRow,
  BusinessUnit,
  AdPlatform,
  CampaignStatus,
  RegisterFlag,
  BUSINESS_UNITS,
  CAMPAIGN_STATUSES,
  daysSinceReview,
  registerFlag,
  fmtMoney,
  parseLocalDate,
} from "../campaignTrackerTypes";
import type { RegisterOverrideFields } from "../../../api/useCampaignTracker";
import { NUMERIC, ToneChip } from "./campaignTrackerPrimitives";
import { MultiSelectFilter, InlineDateRangeFilter, InlineNumberRangeFilter, ClearFiltersButton, RowCount } from "./FilterControls";

const STATUS_COLOR: Record<CampaignStatus, string> = {
  Active: "success.main",
  Watch: "warning.main",
  Paused: "text.secondary",
  Ended: "error.main",
};
const FLAG_COLOR: Record<RegisterFlag, string> = {
  OK: "success.main",
  "REVIEW OVERDUE": "error.main",
  "NEVER REVIEWED": "warning.main",
  "PAST END DATE": "error.main",
  "—": "text.secondary",
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
        <Typography
          sx={{
            fontSize: "0.74rem",
            ...NUMERIC,
            color: isDerived ? "warning.main" : "text.primary",
            fontWeight: isDerived ? 600 : 400,
          }}
        >
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string | null) => {
  const parsed = d ? parseLocalDate(d) : null;
  return parsed ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
};

// Actual CPL's hover explanation: the exact spend/conversions/window behind a
// live-calculated value — not just "calculated", but literally how.
// LinkedIn's "conversions" here is its externalWebsiteConversions metric,
// which doesn't count on-platform Lead Gen Form submissions (no landing
// page/UTM involved), so a low/blank LinkedIn figure gets a plain-language
// reason instead of reading as "this campaign got no leads."
function actualCplTooltip(row: CampaignRegisterRow, platform: AdPlatform): string {
  const calc = row.actualCplCalculation;
  if (!calc) return "";
  const base = `Calculated: ${fmtMoney(calc.spend)} spend ÷ ${calc.conversions.toLocaleString()} conversions, ${fmtDate(calc.windowStart)}–${fmtDate(calc.windowEnd)}.`;
  if (platform === "LinkedIn") {
    return `${base} LinkedIn "conversions" here means website conversions — on-platform Lead Gen Form submissions aren't counted, so this can read low or blank for Lead Gen Form campaigns.`;
  }
  return base;
}

// Advanced filter: every field is a "narrow if set" condition, ANDed together —
// but status/BU are each multi-select (OR within the field), so e.g. Active +
// Ended can be selected together while everything else stays excluded.
export interface RegisterFilters {
  statuses: CampaignStatus[];
  bus: BusinessUnit[];
  owners: string[];
  endDateFrom: string;
  endDateTo: string;
  reviewMinDays: string;
  reviewMaxDays: string;
}
export const EMPTY_REGISTER_FILTERS: RegisterFilters = {
  statuses: [],
  bus: [],
  owners: [],
  endDateFrom: "",
  endDateTo: "",
  reviewMinDays: "",
  reviewMaxDays: "",
};

function countActive(f: RegisterFilters): number {
  return (
    f.statuses.length +
    f.bus.length +
    f.owners.length +
    (f.endDateFrom ? 1 : 0) +
    (f.endDateTo ? 1 : 0) +
    (f.reviewMinDays !== "" ? 1 : 0) +
    (f.reviewMaxDays !== "" ? 1 : 0)
  );
}

function matchesFilters(row: CampaignRegisterRow, f: RegisterFilters): boolean {
  if (f.statuses.length && !f.statuses.includes(row.status)) return false;
  if (f.bus.length && !f.bus.includes(row.bu)) return false;
  if (f.owners.length && !f.owners.includes(row.owner)) return false;
  if (f.endDateFrom && (!row.endDate || row.endDate < f.endDateFrom)) return false;
  if (f.endDateTo && (!row.endDate || row.endDate > f.endDateTo)) return false;
  // A campaign never reviewed is treated as "infinitely overdue" — it should
  // surface under a minimum-days filter and never under a maximum-days one.
  const since = daysSinceReview(row.lastReviewed) ?? Infinity;
  if (f.reviewMinDays !== "" && since < Number(f.reviewMinDays)) return false;
  if (f.reviewMaxDays !== "" && since > Number(f.reviewMaxDays)) return false;
  return true;
}

function diffOverrideFields(a: CampaignRegisterRow, b: CampaignRegisterRow): Partial<RegisterOverrideFields> {
  const patch: Partial<RegisterOverrideFields> = {};
  if (a.bu !== b.bu) patch.bu = b.bu;
  if (a.status !== b.status) patch.status = b.status;
  if (a.lastReviewed !== b.lastReviewed) patch.lastReviewed = b.lastReviewed;
  if (a.actualCpl !== b.actualCpl) patch.actualCpl = b.actualCpl;
  if (a.targetCpl !== b.targetCpl) patch.targetCpl = b.targetCpl;
  return patch;
}

export function CampaignRegisterTable({
  rows,
  onChange,
  filters,
  platform,
  onSave,
}: {
  rows: CampaignRegisterRow[];
  onChange: (rows: CampaignRegisterRow[]) => void;
  filters: RegisterFilters;
  platform: AdPlatform;
  // Persists bu/status/lastReviewed/actualCpl/targetCpl. The local edit
  // always applies immediately via onChange regardless of whether this
  // resolves — a persistence failure just means it won't survive a refresh
  // yet, not that the edit is lost from the current view.
  onSave?: (campaignId: string, platform: AdPlatform, patch: Partial<RegisterOverrideFields>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CampaignRegisterRow | null>(null);
  // The edit always applies locally regardless of whether onSave resolves
  // (see the onSave prop note above) — this only surfaces a failure to
  // persist so it isn't silently lost, not a rollback of the local view.
  const [saveError, setSaveError] = useState<string | null>(null);

  const filtered = useMemo(() => rows.filter((r) => matchesFilters(r, filters)), [rows, filters]);

  function markReviewed(row: CampaignRegisterRow) {
    const updated = { ...row, lastReviewed: todayISO() };
    onChange(rows.map((r) => (r.id === row.id ? updated : r)));
    onSave?.(row.id, row.platform, { lastReviewed: updated.lastReviewed })
      .then(() => setSaveError(null))
      .catch((e) => setSaveError(describeError(e)));
  }

  function saveRow(row: CampaignRegisterRow) {
    const original = rows.find((r) => r.id === row.id);
    onChange(rows.map((r) => (r.id === row.id ? row : r)));
    setEditing(null);
    if (original) {
      const patch = diffOverrideFields(original, row);
      if (Object.keys(patch).length > 0) {
        onSave?.(row.id, row.platform, patch)
          .then(() => setSaveError(null))
          .catch((e) => setSaveError(describeError(e)));
      }
    }
  }

  return (
    <Box>
      {saveError && (
        <Typography sx={{ fontSize: "0.76rem", color: "error.main", mb: 1.5 }}>
          Couldn't save the last edit (it's still shown here, but won't survive a refresh): {saveError}
        </Typography>
      )}
      <Box sx={{ mb: 1.5 }}>
        <RowCount shown={filtered.length} total={rows.length} singular="campaign" />
      </Box>
      {filtered.length === 0 ? (
        <Typography sx={{ fontSize: "0.76rem", color: "text.disabled", textAlign: "center", py: 3 }}>
          No campaigns match these filters
        </Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
          <Box sx={{ overflow: "auto", maxHeight: 640 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1040 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Campaign</TableCell>
                  <TableCell>BU</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>End date</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Daily budget</TableCell>
                  <TableCell align="right">CPL (act/tgt)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Days since review</TableCell>
                  <TableCell>Flag</TableCell>
                  <TableCell align="right" sx={{ width: 44 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((row) => {
                  const flag = registerFlag(row);
                  const since = daysSinceReview(row.lastReviewed);
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
                      aria-label={`Edit ${row.campaignName}`}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "-0.005em" }}>
                          {row.campaignName}
                        </Typography>
                        <Typography sx={{ fontSize: "0.66rem", color: "text.secondary" }}>{row.objective}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.74rem" }}>{row.bu}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.74rem" }}>{row.owner}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: "0.72rem", ...NUMERIC }}>{fmtDate(row.endDate)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <BudgetValue
                          value={fmtMoney(row.monthlyBudget)}
                          isDerived={!!row.monthlyBudgetIsDerived}
                          tooltip={
                            row.monthlyBudgetIsDerived
                              ? "Calculated: daily budget × days in month"
                              : `Set directly by ${platform} as the campaign total budget`
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <BudgetValue
                          value={row.dailyBudget != null ? fmtMoney(row.dailyBudget) : "—"}
                          isDerived={!!row.dailyBudgetIsDerived}
                          tooltip={
                            row.dailyBudgetIsDerived
                              ? "Calculated: monthly budget ÷ days in month"
                              : `Set directly by ${platform} as the campaign daily budget`
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, justifyContent: "flex-end" }}>
                          {row.actualCplIsComputed && row.actualCpl != null ? (
                            <Tooltip title={actualCplTooltip(row, platform)} arrow placement="top">
                              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                                <Box component="span" sx={{ display: "inline-flex", color: "warning.main" }}>
                                  <Calculator size={13} />
                                </Box>
                                <Typography sx={{ fontSize: "0.74rem", ...NUMERIC, color: "warning.main", fontWeight: 600 }}>
                                  {fmtMoney(row.actualCpl)}
                                </Typography>
                              </Box>
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>
                              {row.actualCpl != null ? fmtMoney(row.actualCpl) : "—"}
                            </Typography>
                          )}
                          <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>
                            / {row.targetCpl != null ? fmtMoney(row.targetCpl) : "—"}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <ToneChip label={row.status} color={STATUS_COLOR[row.status]} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{since ?? "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <ToneChip label={flag} color={FLAG_COLOR[flag]} />
                      </TableCell>
                      <TableCell align="right" sx={{ width: 44 }} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Mark reviewed today" arrow placement="top">
                          <IconButton
                            size="small"
                            onClick={() => markReviewed(row)}
                            sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "primary.main" } }}
                          >
                            <CalendarCheck size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {editing && <RegisterFormDialog initial={editing} onCancel={() => setEditing(null)} onSave={saveRow} />}
    </Box>
  );
}

// Advanced filter — laid out inline in the shared controls row (next to the
// platform toggle) rather than tucked behind a button. Status/BU are each
// multi-select (OR within the field, e.g. "Active + Ended" together); the End
// date and Days-since-review ranges narrow further. Every field ANDs together.
export function RegisterFilterControls({
  filters,
  onChange,
  owners,
}: {
  filters: RegisterFilters;
  onChange: (f: RegisterFilters) => void;
  owners: string[];
}) {
  return (
    <>
      <MultiSelectFilter
        label="Status"
        options={CAMPAIGN_STATUSES}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
      />
      <MultiSelectFilter
        label="Business unit"
        options={BUSINESS_UNITS}
        selected={filters.bus}
        onChange={(bus) => onChange({ ...filters, bus })}
      />
      <MultiSelectFilter
        label="Owner"
        options={owners}
        selected={filters.owners}
        onChange={(owners) => onChange({ ...filters, owners })}
      />
      <InlineDateRangeFilter
        label="End date range"
        from={filters.endDateFrom}
        to={filters.endDateTo}
        onFromChange={(v) => onChange({ ...filters, endDateFrom: v })}
        onToChange={(v) => onChange({ ...filters, endDateTo: v })}
      />
      <InlineNumberRangeFilter
        label="Days since review"
        min={filters.reviewMinDays}
        max={filters.reviewMaxDays}
        onMinChange={(v) => onChange({ ...filters, reviewMinDays: v })}
        onMaxChange={(v) => onChange({ ...filters, reviewMaxDays: v })}
      />
      <ClearFiltersButton activeCount={countActive(filters)} onClear={() => onChange(EMPTY_REGISTER_FILTERS)} />
    </>
  );
}

// Campaign name, objective, dates and budget come from the Google/LinkedIn
// Ads APIs — shown here read-only, same as Owner (resolved from the BU
// registry, not set per campaign). Only BU, CPL figures, Status and Last
// Reviewed are actually editable.
function ReadOnlyField({ label, value, valueNode }: { label: string; value: string; valueNode?: ReactNode }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.66rem",
          fontWeight: 700,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          mb: 0.4,
        }}
      >
        {label}
      </Typography>
      {valueNode ?? <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>{value}</Typography>}
    </Box>
  );
}

// Same "calculated" flag as BudgetValue (amber + calculator icon), sized for
// the edit dialog's larger read-only field text instead of a table cell.
function DialogBudgetValue({ value, isDerived }: { value: string; isDerived: boolean }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      {isDerived && (
        <Box component="span" sx={{ display: "inline-flex", color: "warning.main" }}>
          <Calculator size={14} />
        </Box>
      )}
      <Typography sx={{ fontSize: "0.82rem", color: isDerived ? "warning.main" : "text.primary", fontWeight: isDerived ? 600 : 400 }}>
        {value}
      </Typography>
    </Box>
  );
}

function RegisterFormDialog({
  initial,
  onCancel,
  onSave,
}: {
  initial: CampaignRegisterRow;
  onCancel: () => void;
  onSave: (row: CampaignRegisterRow) => void;
}) {
  const [row, setRow] = useState<CampaignRegisterRow>(initial);
  const set = <K extends keyof CampaignRegisterRow>(k: K, v: CampaignRegisterRow[K]) =>
    setRow((r) => ({ ...r, [k]: v }));

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Edit campaign</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", mt: 0.25 }}>
          Campaign details come from {row.platform} — only the fields below are editable here.
        </Typography>
      </Box>
      <Box sx={{ px: 3, py: 1.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <ReadOnlyField label="Campaign name" value={row.campaignName} />
        <ReadOnlyField label="Objective" value={row.objective} />
        <ReadOnlyField label="Start date" value={fmtDate(row.startDate)} />
        <ReadOnlyField label="End date" value={fmtDate(row.endDate)} />
        <ReadOnlyField
          label="Monthly budget"
          value={fmtMoney(row.monthlyBudget)}
          valueNode={<DialogBudgetValue value={fmtMoney(row.monthlyBudget)} isDerived={!!row.monthlyBudgetIsDerived} />}
        />
        <ReadOnlyField
          label="Daily budget"
          value={row.dailyBudget != null ? fmtMoney(row.dailyBudget) : "—"}
          valueNode={
            <DialogBudgetValue
              value={row.dailyBudget != null ? fmtMoney(row.dailyBudget) : "—"}
              isDerived={!!row.dailyBudgetIsDerived}
            />
          }
        />
        <ReadOnlyField label="Owner" value={row.owner || "— unassigned —"} />

        <Box sx={{ gridColumn: "1 / -1", borderTop: 1, borderColor: "divider", pt: 1.5, mt: 0.5 }} />
        <Typography sx={{ gridColumn: "1 / -1", fontSize: "0.68rem", color: "text.secondary", mt: -1 }}>
          Owner follows the campaign's BU — change it from the BU Owners tab, not per campaign.
        </Typography>

        <LabeledSelect label="BU" value={row.bu} options={BUSINESS_UNITS} onChange={(v) => set("bu", v)} />
        <LabeledSelect label="Status" value={row.status} options={CAMPAIGN_STATUSES} onChange={(v) => set("status", v)} />
        <TextField
          label="Last reviewed"
          type="date"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={row.lastReviewed ?? ""}
          onChange={(e) => set("lastReviewed", e.target.value || null)}
        />
        <TextField
          label="Actual CPL ($)"
          type="number"
          size="small"
          fullWidth
          value={row.actualCpl ?? ""}
          onChange={(e) => set("actualCpl", e.target.value === "" ? null : Number(e.target.value))}
          helperText={row.actualCplIsComputed ? "Live calculated value — entering one here overrides it." : undefined}
        />
        <TextField
          label="Target CPL ($)"
          type="number"
          size="small"
          fullWidth
          value={row.targetCpl ?? ""}
          onChange={(e) => set("targetCpl", e.target.value === "" ? null : Number(e.target.value))}
        />
      </Box>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onCancel} sx={{ textTransform: "none", fontSize: "0.78rem", color: "text.secondary" }}>
          Cancel
        </Button>
        <Button onClick={() => onSave(row)} variant="contained" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem" }}>
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LabeledSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
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

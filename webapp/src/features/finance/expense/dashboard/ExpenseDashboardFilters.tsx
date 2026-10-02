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
  Autocomplete,
  Box,
  Button,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { EXPENSE_DASHBOARD_PERIODS, type ExpenseDashboardPeriod } from "../expenseTypes";
import { ALL_CATEGORIES, ALL_ENTITIES, ALL_REGIONS, ALL_STATUSES } from "./expenseDashboardUtils";

const FIELD_SX = { minWidth: 200, flex: 1 } as const;

/**
 * One single-select dropdown — Business Entity, Sales Region, Expense
 * Category or Status. Plain `Autocomplete` + `TextField`, the same shape
 * every other finance filter bar in this portal already uses
 * (`ExpenseTypeFilters.tsx`), not the source's own boxed, label-prefixed
 * `FilterBox` — one visual language across the portal is the whole point of
 * this migration, not a second one ported alongside it.
 */
function SingleFilter({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  /** The "All ..." sentinel this field's options list is prefixed with — not
   *  `null`, so an unset filter is still a real, displayable value. */
  allLabel: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  return (
    <Autocomplete
      size="small"
      sx={FIELD_SX}
      options={[allLabel, ...options]}
      value={value}
      disableClearable
      onChange={(_e, next) => onChange(next ?? allLabel)}
      // No visible label: the field's value is NEVER actually empty — it
      // starts at `allLabel` ("All entities", ...) and stays on a real
      // selection from there — so a label floating above the border would
      // only ever sit beside a value that already says what the field is.
      // `aria-label` keeps the field named for anyone using a screen reader.
      renderInput={(params) => (
        <TextField {...params} slotProps={{ htmlInput: { ...params.inputProps, "aria-label": label } }} />
      )}
    />
  );
}

export interface ExpenseDashboardDraftFilters {
  entity: string;
  region: string;
  category: string;
  status: string;
  /** Only read when the period preset is Custom; kept here so a half-typed
   *  range never triggers a request before Apply is pressed. */
  startDate: string;
  endDate: string;
}

export function ExpenseDashboardFilters({
  period,
  onPeriodChange,
  draft,
  onDraftChange,
  isDirty,
  isRangeInvalid,
  hasActiveFilters,
  entityOptions,
  regionOptions,
  categoryOptions,
  statusOptions,
  onApply,
  onClear,
}: {
  period: ExpenseDashboardPeriod;
  onPeriodChange: (next: ExpenseDashboardPeriod) => void;
  draft: ExpenseDashboardDraftFilters;
  onDraftChange: (next: ExpenseDashboardDraftFilters) => void;
  isDirty: boolean;
  isRangeInvalid: boolean;
  hasActiveFilters: boolean;
  entityOptions: readonly string[];
  regionOptions: readonly string[];
  categoryOptions: readonly string[];
  statusOptions: readonly string[];
  onApply: () => void;
  onClear: () => void;
}) {
  const set = <K extends keyof ExpenseDashboardDraftFilters>(key: K, value: string) =>
    onDraftChange({ ...draft, [key]: value });

  const isCustom = period === "Custom";

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        gap={1.5}
        sx={{ mb: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={period}
          onChange={(_e, value) => value && onPeriodChange(value as ExpenseDashboardPeriod)}
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
          {EXPENSE_DASHBOARD_PERIODS.map((preset) => (
            <ToggleButton key={preset} value={preset} sx={{ textTransform: "none", px: 2 }}>
              {preset}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" gap={1}>
          <Button variant="contained" size="small" onClick={onApply} disabled={!isDirty || isRangeInvalid}>
            Apply
          </Button>
          <Button variant="outlined" color="error" size="small" onClick={onClear} disabled={!hasActiveFilters}>
            Clear All
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.5}>
        <SingleFilter label="Business Entity" value={draft.entity} allLabel={ALL_ENTITIES} options={entityOptions} onChange={(v) => set("entity", v)} />
        <SingleFilter label="Sales Region" value={draft.region} allLabel={ALL_REGIONS} options={regionOptions} onChange={(v) => set("region", v)} />
        <SingleFilter label="Expense Category" value={draft.category} allLabel={ALL_CATEGORIES} options={categoryOptions} onChange={(v) => set("category", v)} />
        <SingleFilter label="Status" value={draft.status} allLabel={ALL_STATUSES} options={statusOptions} onChange={(v) => set("status", v)} />
        {isCustom && (
          <>
            {/* No visible label here either — same treatment as the
                dropdowns above, `aria-label` only. */}
            <TextField
              size="small"
              type="date"
              value={draft.startDate}
              slotProps={{ htmlInput: { max: draft.endDate || undefined, "aria-label": "From" } }}
              onChange={(e) => set("startDate", e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              value={draft.endDate}
              slotProps={{ htmlInput: { min: draft.startDate || undefined, "aria-label": "To" } }}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </>
        )}
      </Stack>

      {isRangeInvalid && (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: "error.main", mt: 1 }}>
          Pick a From date on or before the To date.
        </Typography>
      )}
      {isDirty && !isRangeInvalid && (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: "warning.main", mt: 1 }}>
          Filters changed — apply to refresh
        </Typography>
      )}
    </Box>
  );
}

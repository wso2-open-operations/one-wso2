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

import { useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { FilterIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import { EXPENSE_DASHBOARD_PERIODS, type ExpenseDashboardPeriod } from "../expenseTypes";
import { ALL_CATEGORIES, ALL_EMPLOYEES, ALL_ENTITIES, ALL_REGIONS, ALL_STATUSES } from "./expenseDashboardUtils";

export interface ExpenseDashboardDraftFilters {
  /** Part of the draft, not applied on selection: a period picked in the panel
   *  only takes effect once Apply is pressed, like every other filter. */
  period: ExpenseDashboardPeriod;
  entity: string;
  region: string;
  category: string;
  /** The selected employee's work email, or `ALL_EMPLOYEES`. */
  employee: string;
  status: string;
  /** Only read when the period is Custom; kept here so a half-typed range
   *  never triggers a request before Apply is pressed. */
  startDate: string;
  endDate: string;
}

/**
 * One labelled dropdown inside the Advanced Filter panel. Every option list
 * starts with its "All ..." sentinel, so an unset filter is a real, displayable
 * value rather than an empty field. `optionLabel` shows an option as something
 * other than its raw value, while the value itself stays what gets filtered on.
 */
function FilterSelect({
  label,
  value,
  options,
  optionLabel = (option) => option,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  optionLabel?: (option: string) => string;
  onChange: (next: string) => void;
}) {
  return (
    <TextField
      select
      fullWidth
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {optionLabel(option)}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * The Employee filter. An Autocomplete over work emails, labelled and searched
 * by display name, with `ALL_EMPLOYEES` as its first option.
 */
function EmployeeFilter({
  value,
  options,
  optionLabel,
  isLoading,
  isError,
  onChange,
}: {
  value: string;
  options: readonly string[];
  optionLabel: (email: string) => string;
  isLoading: boolean;
  isError: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <Autocomplete
      size="small"
      disableClearable
      value={value}
      options={[ALL_EMPLOYEES, ...options]}
      getOptionLabel={(option) => (option === ALL_EMPLOYEES ? option : optionLabel(option))}
      loading={isLoading}
      loadingText="Loading employees…"
      noOptionsText="No employees found"
      // The sentinel stays visible whatever is typed, so there is always a way
      // back to the unfiltered report without clearing the box by hand.
      filterOptions={(all, { inputValue }) => {
        const needle = inputValue.trim().toLowerCase();
        return all.filter(
          (option) =>
            option === ALL_EMPLOYEES ||
            optionLabel(option).toLowerCase().includes(needle) ||
            option.toLowerCase().includes(needle),
        );
      }}
      // The directory runs to several hundred people, and every match otherwise
      // mounts as a row in the DOM on each keystroke. `disableListWrap` belongs
      // with it: MUI's keyboard wrap-around assumes a fully mounted list.
      disableListWrap
      ListboxComponent={VirtualizedListbox}
      // Two lines per row, which is also the height the windowed listbox sizes
      // its rows to. The address is the value being filtered on, so it is shown
      // rather than left to the label alone.
      renderOption={(props, option) => {
        // React requires the key as a prop, not inside a spread.
        const { key, ...liProps } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...liProps} sx={{ display: "block", py: 0.75 }}>
            <Typography variant="body2" noWrap>
              {optionLabel(option)}
            </Typography>
            {option !== ALL_EMPLOYEES && (
              <Typography variant="caption" color="text.secondary" display="block" noWrap>
                {option}
              </Typography>
            )}
          </Box>
        );
      }}
      onChange={(_, next) => onChange(next ?? ALL_EMPLOYEES)}
      // A failed directory fetch is reported on the field rather than through
      // `noOptionsText`: the `ALL_EMPLOYEES` sentinel is never filtered out, so the
      // list is never empty and that text would never render. On the field it is
      // also readable without opening the dropdown.
      renderInput={(params) => (
        <TextField
          {...withLoadingAdornment(params, isLoading)}
          label="Filter by Employee"
          error={isError}
          helperText={isError ? "Couldn't load employees" : undefined}
        />
      )}
    />
  );
}

export function ExpenseDashboardFilters({
  draft,
  onDraftChange,
  isDirty,
  isRangeInvalid,
  hasActiveFilters,
  entityOptions,
  regionOptions,
  categoryOptions,
  employeeOptions,
  employeeLabel,
  employeesLoading,
  employeesError,
  statusOptions,
  statusLabel,
  onApply,
  onClear,
}: {
  draft: ExpenseDashboardDraftFilters;
  onDraftChange: (next: ExpenseDashboardDraftFilters) => void;
  isDirty: boolean;
  isRangeInvalid: boolean;
  hasActiveFilters: boolean;
  entityOptions: readonly string[];
  regionOptions: readonly string[];
  categoryOptions: readonly string[];
  employeeOptions: readonly string[];
  employeeLabel: (email: string) => string;
  employeesLoading: boolean;
  employeesError: boolean;
  statusOptions: readonly string[];
  statusLabel: (status: string) => string;
  onApply: () => void;
  onClear: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const set = <K extends keyof ExpenseDashboardDraftFilters>(key: K, value: ExpenseDashboardDraftFilters[K]) =>
    onDraftChange({ ...draft, [key]: value });

  const close = () => setAnchor(null);
  const applyAndClose = () => {
    onApply();
    close();
  };
  const resetAndClose = () => {
    onClear();
    close();
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="text"
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          onClick={(e) => setAnchor(e.currentTarget)}
          endIcon={<FilterIcon size={16} />}
          sx={{ textTransform: "none", fontSize: 15, fontWeight: 500 }}
        >
          Advanced Filter
        </Button>
      </Box>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 340, p: 2.5, mt: 1 } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Advanced Filter</Typography>
          <IconButton aria-label="Close filters" size="small" onClick={close}>
            <XIcon size={18} />
          </IconButton>
        </Stack>

        <Stack gap={2}>
          <FilterSelect
            label="Filter by Business Entity"
            value={draft.entity}
            options={[ALL_ENTITIES, ...entityOptions]}
            onChange={(v) => set("entity", v)}
          />
          <FilterSelect
            label="Filter by Sales Region"
            value={draft.region}
            options={[ALL_REGIONS, ...regionOptions]}
            onChange={(v) => set("region", v)}
          />
          <FilterSelect
            label="Filter by Expense Category"
            value={draft.category}
            options={[ALL_CATEGORIES, ...categoryOptions]}
            onChange={(v) => set("category", v)}
          />
          <EmployeeFilter
            value={draft.employee}
            options={employeeOptions}
            optionLabel={employeeLabel}
            isLoading={employeesLoading}
            isError={employeesError}
            onChange={(v) => set("employee", v)}
          />
          <FilterSelect
            label="Filter by Status"
            value={draft.status}
            options={[ALL_STATUSES, ...statusOptions]}
            optionLabel={(option) => (option === ALL_STATUSES ? option : statusLabel(option))}
            onChange={(v) => set("status", v)}
          />
          <FilterSelect
            label="Filter by Period"
            value={draft.period}
            options={EXPENSE_DASHBOARD_PERIODS}
            onChange={(v) => set("period", v as ExpenseDashboardPeriod)}
          />

          {draft.period === "Custom" && (
            <Stack direction="row" gap={1.5}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From"
                value={draft.startDate}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: draft.endDate || undefined } }}
                onChange={(e) => set("startDate", e.target.value)}
              />
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To"
                value={draft.endDate}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: draft.startDate || undefined } }}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </Stack>
          )}
        </Stack>

        {isRangeInvalid && (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "error.main", mt: 2 }}>
            Pick a From date on or before the To date.
          </Typography>
        )}

        <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 2.5 }}>
          <Button variant="outlined" color="error" size="small" onClick={resetAndClose} disabled={!hasActiveFilters}>
            Reset
          </Button>
          <Button variant="contained" size="small" onClick={applyAndClose} disabled={!isDirty || isRangeInvalid}>
            Apply
          </Button>
        </Stack>
      </Popover>

      {isDirty && !isRangeInvalid && (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: "warning.main", mt: 1, textAlign: "right" }}>
          Filters changed — apply to refresh
        </Typography>
      )}
    </Box>
  );
}

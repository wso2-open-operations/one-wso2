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

// Shared "advanced filter" controls for the three tracker tables — laid out
// inline in the shared controls row next to the platform toggle (same visual
// weight/pattern as Ad Campaigns' Analytics tab: a label above a compact
// control), not tucked behind a single "Filters" button. Each table composes
// these directly with its own fields/labels. Ported from Marketing Ops'
// campaign-tracker/components/FilterControls.tsx.

import type { ReactNode } from "react";
import { Box, Typography, Button, Select, MenuItem, Checkbox, ListItemText, TextField } from "@wso2/oxygen-ui";

export function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "0.56rem",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "text.secondary",
      }}
    >
      {children}
    </Typography>
  );
}

export function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  width = 170,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (values: T[]) => void;
  width?: number;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FilterLabel>{label}</FilterLabel>
      <Select
        multiple
        size="small"
        displayEmpty
        value={selected}
        onChange={(e) =>
          onChange((typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value) as T[])
        }
        renderValue={(vals) =>
          (vals as T[]).length === 0
            ? "All"
            : (vals as T[]).length <= 2
              ? (vals as T[]).join(", ")
              : `${(vals as T[]).length} selected`
        }
        sx={{
          minWidth: width,
          height: 34,
          fontSize: "0.78rem",
          bgcolor: "background.default",
          color: selected.length ? "primary.main" : "text.primary",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: selected.length ? "primary.main" : "divider" },
        }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
      >
        {options.map((o) => (
          <MenuItem key={o} value={o} dense sx={{ py: 0.25 }}>
            <Checkbox size="small" checked={selected.includes(o)} sx={{ p: 0.5, mr: 0.5 }} />
            <ListItemText primary={o} primaryTypographyProps={{ fontSize: "0.8rem" }} />
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

export function InlineDateRangeFilter({
  label,
  from,
  to,
  onFromChange,
  onToChange,
  width = 134,
}: {
  label: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  width?: number;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FilterLabel>{label}</FilterLabel>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <TextField
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": `${label} from` }}
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          sx={{ width, "& .MuiInputBase-input": { fontSize: "0.76rem" } }}
        />
        <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>→</Typography>
        <TextField
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": `${label} to` }}
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          sx={{ width, "& .MuiInputBase-input": { fontSize: "0.76rem" } }}
        />
      </Box>
    </Box>
  );
}

export function InlineNumberRangeFilter({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
  width = 68,
}: {
  label: string;
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  width?: number;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <FilterLabel>{label}</FilterLabel>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <TextField
          type="number"
          size="small"
          placeholder={minPlaceholder}
          inputProps={{ "aria-label": `${label} ${minPlaceholder}` }}
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          sx={{ width, "& .MuiInputBase-input": { fontSize: "0.76rem" } }}
        />
        <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>→</Typography>
        <TextField
          type="number"
          size="small"
          placeholder={maxPlaceholder}
          inputProps={{ "aria-label": `${label} ${maxPlaceholder}` }}
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          sx={{ width, "& .MuiInputBase-input": { fontSize: "0.76rem" } }}
        />
      </Box>
    </Box>
  );
}

// Raw row count shown above every tracker table — "N of M things" when a
// filter has narrowed the set, plain "N things" otherwise.
export function RowCount({
  shown,
  total,
  singular,
  plural = `${singular}s`,
}: {
  shown: number;
  total: number;
  singular: string;
  plural?: string;
}) {
  const label = shown === 1 ? singular : plural;
  return (
    <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", fontWeight: 600 }}>
      {shown === total ? `${shown} ${label}` : `${shown} of ${total} ${label}`}
    </Typography>
  );
}

export function ClearFiltersButton({ activeCount, onClear }: { activeCount: number; onClear: () => void }) {
  return (
    <Button
      onClick={onClear}
      disabled={!activeCount}
      sx={{
        textTransform: "none",
        fontSize: "0.74rem",
        fontWeight: 600,
        color: activeCount ? "primary.main" : "text.disabled",
        height: 34,
      }}
    >
      Clear filters{activeCount > 0 ? ` (${activeCount})` : ""}
    </Button>
  );
}

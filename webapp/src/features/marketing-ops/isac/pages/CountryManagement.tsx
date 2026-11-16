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

import { Public as PublicIcon } from "../icons";
import { Search as SearchIcon } from "../icons";
import { WarningAmber as WarningAmberIcon } from "../icons";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApiClient } from "../api/client";
import { C } from "../theme/pageTokens";
import { FS, FW, LABEL } from "../theme/typeScale";

// Header and rows share one column template + gap so labels sit over their cells.
const COUNTRY_COLS = { display: "grid", gridTemplateColumns: "2fr 1.5fr 100px 80px", columnGap: 2, px: 2, alignItems: "center" } as const;
// Width of the row's leading globe icon (14px) + Stack spacing (8px), so the
// "Country" label lines up with the country name rather than the icon.
const COUNTRY_ICON_INSET = "22px";

const WSO2_REGIONS = ["APAC", "Europe", "North America", "Latin America", "Africa", "Middle East"];

const REGION_COLOR: Record<string, string> = {
  "APAC":          "#3b82f6",
  "Europe":        "#8b5cf6",
  "North America": "#10b981",
  "Latin America": "#f59e0b",
  "Africa":        "#ef4444",
  get "Middle East"() { return C.orange; },
};

interface CountryRow {
  country: string;
  region: string | null;
  company_count: number;
  in_mapping: boolean;
}

/** Country-to-region mapping management — assign countries to sales regions for reporting. */
export default function CountryManagement() {
  const { get, request } = useApiClient();
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterMapped, setFilterMapped] = useState<"all" | "mapped" | "unmapped">("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    get<CountryRow[]>("/countries")
      .then(setRows)
      .finally(() => setLoading(false));
  }, [get]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.country.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRegion && r.region !== filterRegion) return false;
      if (filterMapped === "mapped"   && !r.region) return false;
      if (filterMapped === "unmapped" && r.region)  return false;
      return true;
    });
  }, [rows, search, filterRegion, filterMapped]);

  const unmappedCount = rows.filter((r) => !r.region).length;

  const handleRegionChange = async (country: string, region: string) => {
    setSaving(country);
    setSaveError(null);
    try {
      const updated = await request<CountryRow>("put", `/countries/${encodeURIComponent(country)}/region`, { region });
      setRows((prev) => prev.map((r) => r.country === country ? { ...r, region: updated.region } : r));
    } catch (e: unknown) {
      setSaveError(`Failed to update ${country}: ${(e as { message?: string })?.message ?? "unknown error"}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>

      {/* Summary bar */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          <strong>{rows.length}</strong> countries total
        </Typography>
        <Divider orientation="vertical" flexItem />
        {WSO2_REGIONS.map((r) => {
          const cnt = rows.filter((row) => row.region === r).length;
          return (
            <Chip
              key={r}
              label={`${r}: ${cnt}`}
              size="small"
              sx={{
                backgroundColor: `${REGION_COLOR[r]}22`,
                color: REGION_COLOR[r],
                border: `1px solid ${REGION_COLOR[r]}55`,
                fontWeight: FW.semibold,
                fontSize: FS.small,
              }}
            />
          );
        })}
        {unmappedCount > 0 && (
          <Chip
            icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
            label={`${unmappedCount} unmapped`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontSize: FS.small, fontWeight: FW.semibold }}
          />
        )}
      </Stack>

      {saveError && <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert>}

      {/* Filters */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
          sx={{ width: 220, "& .MuiInputBase-root": { fontSize: FS.body } }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ fontSize: FS.body }}>Region</InputLabel>
          <Select
            label="Region"
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            sx={{ fontSize: FS.body }}
          >
            <MenuItem value=""><em>All Regions</em></MenuItem>
            {WSO2_REGIONS.map((r) => <MenuItem key={r} value={r} sx={{ fontSize: FS.body }}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: FS.body }}>Mapping</InputLabel>
          <Select
            label="Mapping"
            value={filterMapped}
            onChange={(e) => setFilterMapped(e.target.value as "all" | "mapped" | "unmapped")}
            sx={{ fontSize: FS.body }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="mapped">Mapped</MenuItem>
            <MenuItem value="unmapped">Unmapped</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          {filtered.length} shown
        </Typography>
      </Stack>

      {/* Table */}
      <Paper variant="outlined" sx={{ flex: 1, overflow: "hidden", borderRadius: "4px", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <Box sx={{
          ...COUNTRY_COLS,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}>
          {["Country", "Region", "Companies", "Status"].map((h) => (
            <Typography key={h} color="text.secondary"
              sx={{
                ...LABEL,
                pl: h === "Country" ? COUNTRY_ICON_INSET : 0,
                textAlign: h === "Companies" ? "right" : "left",
              }}>
              {h}
            </Typography>
          ))}
        </Box>

        {/* Rows */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 5 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 5 }}>
              <Typography color="text.disabled" variant="body2">No countries match the current filters.</Typography>
            </Box>
          ) : (
            filtered.map((row) => (
              <Box
                key={row.country}
                sx={{
                  ...COUNTRY_COLS,
                  py: 0.75,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: "none" },
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {/* Country */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <PublicIcon sx={{ fontSize: 14, color: "text.disabled", flexShrink: 0 }} />
                  <Typography variant="body2" fontSize={FS.body}>{row.country}</Typography>
                </Stack>

                {/* Region selector */}
                <Box sx={{ pr: 2 }}>
                  {saving === row.country ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Select
                      size="small"
                      displayEmpty
                      value={row.region ?? ""}
                      onChange={(e) => handleRegionChange(row.country, e.target.value)}
                      sx={{
                        fontSize: FS.body,
                        minWidth: 160,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: !row.region ? "warning.main" : undefined,
                        },
                        color: row.region ? REGION_COLOR[row.region] : "warning.main",
                        fontWeight: row.region ? FW.semibold : FW.regular,
                      }}
                    >
                      <MenuItem value="" disabled><em>— assign region —</em></MenuItem>
                      {WSO2_REGIONS.map((r) => (
                        <MenuItem key={r} value={r} sx={{ fontSize: FS.body, color: REGION_COLOR[r], fontWeight: FW.semibold }}>
                          {r}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </Box>

                {/* Company count */}
                <Typography variant="body2" fontSize={FS.body} color="text.secondary" sx={{ textAlign: "right" }}>
                  {row.company_count.toLocaleString()}
                </Typography>

                {/* Status */}
                <Box>
                  {row.region ? (
                    <Tooltip title="Region assigned">
                      <Chip label="Mapped" size="small" color="success" variant="outlined"
                        sx={{ fontSize: FS.small, height: 18 }} />
                    </Tooltip>
                  ) : (
                    <Tooltip title="No region assigned — select one to map">
                      <Chip
                        icon={<WarningAmberIcon sx={{ fontSize: 12 }} />}
                        label="Unmapped"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: FS.small, height: 18 }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Paper>
    </Box>
  );
}

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
import { Box, MenuItem, Select } from "@wso2/oxygen-ui";
import { C } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

const WSO2_REGIONS = ["APAC", "Europe", "North America", "Latin America", "Africa", "Middle East"];

const F = "'Inter', system-ui, sans-serif";

interface RegionFilterProps {
  value: string;
  onChange: (region: string) => void;
  /** Region names to offer; defaults to the built-in WSO2 list. */
  options?: string[];
}

/** Dropdown filter for selecting a WSO2 geographic region (APAC, Europe, etc.). */
export default function RegionFilter({ value, onChange, options }: RegionFilterProps) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 0.6,
      px: 1.2, py: 0.4, borderRadius: "7px", height: 32,
      bgcolor: C.card, border: `1px solid ${C.border}`,
      transition: "border-color 0.15s",
      "&:hover": { borderColor: C.orange },
    }}>
      <PublicIcon sx={{ fontSize: 15, color: value ? C.orange : C.sub }} />
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        variant="standard"
        disableUnderline
        displayEmpty
        sx={{
          fontFamily: F,
          fontSize: FS.body,
          fontWeight: value ? FW.semibold : FW.regular,
          color: value ? C.text : C.sub,
          minWidth: 100,
          "& .MuiSelect-select": { py: 0, pr: "20px !important" },
          "& .MuiSelect-icon": { color: value ? C.orange : C.dim, fontSize: 16 },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              bgcolor: C.panel, color: C.text, fontFamily: F,
              borderRadius: "8px", border: `1px solid ${C.border}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            },
          },
        }}
        renderValue={(v) => v || "All Regions"}
      >
        <MenuItem value="" sx={{ fontFamily: F, fontSize: FS.body }}>All Regions</MenuItem>
        {(options ?? WSO2_REGIONS).map((r) => (
          <MenuItem key={r} value={r} sx={{ fontFamily: F, fontSize: FS.body }}>{r}</MenuItem>
        ))}
      </Select>
    </Box>
  );
}

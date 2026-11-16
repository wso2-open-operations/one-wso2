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

import { Box, Select } from "@wso2/oxygen-ui";
import React from "react";
import { C, F } from "../theme/pageTokens";
import { FS, FW } from "../theme/typeScale";

/** Boxed filter pill — matches the shared RegionFilter so filter bars read as one family. */
export function FilterPill({ icon: Icon, active, children }: { icon: React.ElementType; active: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 0.6, px: 1.2, height: 32,
      borderRadius: "7px", bgcolor: C.cardBg, border: `1px solid ${C.border}`,
      transition: "border-color 0.15s", "&:hover": { borderColor: C.orange },
    }}>
      <Icon sx={{ fontSize: 15, color: active ? C.orange : C.sub }} />
      {children}
    </Box>
  );
}

/** Underline-less Select used inside a FilterPill. `renderLabel` maps a stored
 * value to its display text (e.g. a sort key → "Intent"); defaults to the value. */
export function PillSelect({ value, onChange, placeholder, renderLabel, children }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  renderLabel?: (v: string) => string; children: React.ReactNode;
}) {
  return (
    <Select
      value={value} onChange={(e) => onChange(e.target.value)} variant="standard" disableUnderline displayEmpty
      renderValue={(v) => (v ? (renderLabel ? renderLabel(v as string) : (v as string)) : placeholder)}
      sx={{
        fontFamily: F, fontSize: FS.body, fontWeight: value ? FW.semibold : FW.regular,
        color: value ? C.text : C.sub, minWidth: 72,
        "& .MuiSelect-select": { py: 0, pr: "20px !important" },
        "& .MuiSelect-icon": { color: value ? C.orange : C.dim, fontSize: 16 },
      }}
      MenuProps={{ PaperProps: { sx: { bgcolor: C.panel, color: C.text, fontFamily: F, borderRadius: "8px", border: `1px solid ${C.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", maxHeight: 320 } } }}
    >
      {children}
    </Select>
  );
}

/** MenuItem styling shared by pill dropdown options. */
export const pillItemSx = { fontFamily: F, fontSize: FS.small } as const;

/** A facet dropdown option — a distinct data value with its row count. */
export interface FacetOption { value: string; count: number; }

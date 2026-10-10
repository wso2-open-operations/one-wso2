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

import type { ReactNode } from "react";
import { Box, Checkbox, FormControlLabel, Stack, Typography } from "@wso2/oxygen-ui";
import { MIS_SCALES, type MisScale } from "../util/misViewVocabulary";
import { amountUnitCaption } from "../util/misMoney";
import { brandText, gridCaptionSx, gridHeaderBarSx, gridTitleSx, slateText } from "./misLookTokens";

// The per-grid header — the Table title in brand text · the units caption
// ("All amounts in USD" / "… in USD '000") · Values in '000 · BU only / Totals
// only where the table offers them · Export ▾.
//
// The title sits HERE, under the tabs, because it survives a crop into a
// slide. The Scale lives beside the figures it rewrites rather than in the
// filter card, for the same reason: a figure that has left the screen it was
// set on has to carry its own units.
//
// This is the head of the grid card — one outlined Oxygen surface with the
// grid frame below as its body: a 20px/600 title in brand text, a 12px/500
// caption in the secondary tone, and primary checkboxes with 14px/500 slate
// labels for the Scale and the toggles.

export interface GridToggle {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function MisGridHeader({
  title,
  note,
  hint,
  scale,
  onScale,
  toggles = [],
  exportMenu,
}: {
  /** The Table's title — "All BU Build", "Software/Cloud Customers", … */
  title: string;
  /** An italic aside after the title, e.g. the Channel/Direct note. */
  note?: string;
  /**
   * A one-line hint under the caption, in brand text — the Customers table's
   * "Click on an account under a date range to view opportunity details."
   */
  hint?: string;
  scale: MisScale;
  onScale: (scale: MisScale) => void;
  /** BU only / Totals only, where the table offers them. */
  toggles?: readonly GridToggle[];
  exportMenu?: ReactNode;
}) {
  const thousands = scale === MIS_SCALES.THOUSANDS;
  const setThousands = (on: boolean) => onScale(on ? MIS_SCALES.THOUSANDS : MIS_SCALES.UNITS);

  return (
    <Box sx={[gridHeaderBarSx]}>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography component="h2" sx={[gridTitleSx]}>
            {title}
          </Typography>
          {note && (
            <Typography component="span" sx={{ fontSize: "0.8rem", fontStyle: "italic", color: "text.secondary" }}>
              {note}
            </Typography>
          )}
        </Stack>
        <Typography variant="caption" sx={gridCaptionSx}>
          {amountUnitCaption(scale)}
        </Typography>
        {hint && (
          <Typography
            component="p"
            sx={[{ m: 0, mt: 0.5, fontSize: "0.8125rem", fontWeight: 500, lineHeight: 1.5 }, brandText]}
          >
            {hint}
          </Typography>
        )}
      </Box>
      {/* The controls sit on the title's row: 14px/500 slate labels, primary
          checkboxes, the Export at the end. */}
      <Stack direction="row" sx={{ alignItems: "center", gap: 2, flexWrap: "wrap", pt: "4px" }}>
        {[{ label: "Values in '000", checked: thousands, onChange: setThousands }, ...toggles].map((toggle) => (
          <FormControlLabel
            key={toggle.label}
            sx={{ m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={toggle.checked}
                onChange={(event) => toggle.onChange(event.target.checked)}
                sx={{ p: 0.5, color: "primary.main", "&.Mui-checked": { color: "primary.main" } }}
              />
            }
            label={
              <Typography component="span" sx={[{ fontSize: "0.875rem", fontWeight: 500, ml: 0.5 }, slateText]}>
                {toggle.label}
              </Typography>
            }
          />
        ))}
        {exportMenu}
      </Stack>
    </Box>
  );
}

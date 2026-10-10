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

import { Box, Button, ButtonBase, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { RotateCcwIcon } from "@wso2/oxygen-ui-icons-react";
import { MIS_UNITS_BY_CATEGORY, formatUnitLabel, unitCategoryOf } from "../util/misUnits";
import { CUSTOM_UNIT } from "../util/misViewVocabulary";
import type { MisUnitSelection } from "./MisUnitTabs";
import { faithfulOutlinedSx, gradientCardSx, unitPillSx } from "./misLookTokens";

// The Unit pills under a Build tab. The category itself lives in the seven
// Table tabs above, so this row is only the units OF that category — or, under
// Custom Build, the two chip lists (Business Units / Product Units) and Reset,
// on the same gradient card the filters use.
//
// Drawn as 999px pills with a light border; a primary border, a 12% primary
// tint and weight 700 when selected. Like the tabs, a pill commits on click.

export default function MisUnitPills({
  selection,
  businessUnitOptions,
  productUnitOptions,
  onChange,
}: {
  selection: MisUnitSelection;
  businessUnitOptions: readonly string[];
  productUnitOptions: readonly string[];
  onChange: (next: MisUnitSelection) => void;
}) {
  const category = unitCategoryOf(selection.buProductSelection);

  const chooseUnit = (code: string) =>
    onChange({ buProductSelection: code, customBusinessUnits: [], customProductUnits: [] });

  const toggleCustom = (which: "customBusinessUnits" | "customProductUnits", code: string) => {
    const current = selection[which];
    const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
    onChange({
      buProductSelection: CUSTOM_UNIT,
      customBusinessUnits: which === "customBusinessUnits" ? next : [],
      customProductUnits: which === "customProductUnits" ? next : [],
    });
  };

  if (category === "Custom") {
    const reset = () =>
      onChange({ buProductSelection: CUSTOM_UNIT, customBusinessUnits: [], customProductUnits: [] });
    return (
      <Box sx={[{ mb: 1.5 }, gradientCardSx]}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Select a combination of either a set of Business Units or Product Units.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RotateCcwIcon size={14} />}
            onClick={reset}
            sx={faithfulOutlinedSx}
          >
            Reset
          </Button>
        </Stack>
        <CustomGroup label="Business Units" options={businessUnitOptions} selected={selection.customBusinessUnits} onToggle={(code) => toggleCustom("customBusinessUnits", code)} />
        <CustomGroup label="Product Units" options={productUnitOptions} selected={selection.customProductUnits} onToggle={(code) => toggleCustom("customProductUnits", code)} />
      </Box>
    );
  }

  const units = MIS_UNITS_BY_CATEGORY[category];

  return (
    <Box role="group" aria-label="Unit" sx={{ display: "flex", flexWrap: "wrap", gap: 1, py: 1, mb: 0.5 }}>
      {units.map((unit) => {
        const active = unit.code === selection.buProductSelection;
        return (
          <ButtonBase
            key={unit.code}
            aria-pressed={active}
            onClick={() => chooseUnit(unit.code)}
            sx={unitPillSx(active)}
          >
            {unit.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

function CustomGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (code: string) => void;
}) {
  return (
    <Box sx={{ mt: 1.25 }} role="group" aria-label={label}>
      <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: "0.1px" }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.75 }}>
        {options.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            None available.
          </Typography>
        )}
        {options.map((code) => {
          const on = selected.includes(code);
          return (
            <Chip
              key={code}
              clickable
              size="small"
              label={formatUnitLabel(code)}
              aria-pressed={on}
              variant={on ? "filled" : "outlined"}
              color={on ? "primary" : "default"}
              onClick={() => onToggle(code)}
              // The same pill shape as the unit row above.
              sx={{ borderRadius: 999, fontWeight: 700, letterSpacing: "0.2px" }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

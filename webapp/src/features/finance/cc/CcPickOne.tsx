/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { FormControl, InputLabel, MenuItem, Select } from "@wso2/oxygen-ui";

/** The value {@link CcPickOne} gives while it narrows nothing. */
export const CC_PICK_ALL = "all";

/** One "All / …" narrowing select, built from the values on screen. */
export function CcPickOne({
  label,
  value,
  onChange,
  options,
  optionLabel,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  /**
   * How to render an option whose stored value is not what a reader should
   * see — the approve stage filter holds `pending_lead` and shows
   * "Pending Lead" (FilterMenu.tsx:79-88). Defaults to the value itself,
   * which is what the user and card filters want.
   */
  optionLabel?: (value: string) => string;
  /**
   * What the "no narrowing" option is called. The source's approve popover says
   * **No Filter** (`FilterMenu.tsx`), which is clearer inside a Filter panel
   * than "All" — there it reads as a value rather than as the absence of one.
   * Defaults to "All", which is what History's inline selects still say.
   */
  emptyLabel?: string;
}) {
  // Spaces are not valid in an id, and the source's labels have them.
  const labelId = `cc-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FormControl size="small">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(e) => onChange(String(e.target.value))}
        sx={{ minWidth: 170 }}
      >
        <MenuItem value={CC_PICK_ALL}>{emptyLabel ?? "All"}</MenuItem>
        {options.map((o) => (
          <MenuItem key={o} value={o}>
            {optionLabel ? optionLabel(o) : o}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

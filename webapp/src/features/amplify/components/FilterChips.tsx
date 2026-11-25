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

import { Box, Chip } from "@wso2/oxygen-ui";

/** One chip: the value it selects, its label, and optionally how many items it would show. */
export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * A row of chips that picks one filter. The selected chip is filled and pressed (`aria-pressed`); a count, when
 * given, follows the label (accessible name "Priority 2").
 */
export default function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive technology, e.g. "Filter posts". */
  ariaLabel: string;
}) {
  return (
    <Box role="group" aria-label={ariaLabel} sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Chip
            key={option.value}
            clickable
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            label={
              option.count === undefined ? (
                option.label
              ) : (
                <>
                  {option.label}{" "}
                  <Box component="span" sx={{ opacity: selected ? 0.85 : 0.6 }}>
                    {option.count}
                  </Box>
                </>
              )
            }
          />
        );
      })}
    </Box>
  );
}

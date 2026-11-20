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

import { ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";

/**
 * Which of a list's scopes to show, as one segmented control. Controlled: `value` is the
 * chosen option and `onChange` is called with a new choice; choosing the one already
 * chosen changes nothing.
 */
export default function ScopeSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Names the group for assistive tech, e.g. "Whose opportunities to show". */
  label: string;
  disabled?: boolean;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      disabled={disabled}
      onChange={(_, next: T | null) => {
        // Clicking the selected one again returns null: the choice stays.
        if (next !== null) onChange(next);
      }}
      aria-label={label}
      sx={{
        bgcolor: "background.paper",
        flexShrink: 0,
        "& .MuiToggleButton-root": { px: 1.75, fontWeight: 600, fontSize: 13, textTransform: "none", whiteSpace: "nowrap" },
        "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": {
          bgcolor: "text.primary",
          color: "background.paper",
        },
      }}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

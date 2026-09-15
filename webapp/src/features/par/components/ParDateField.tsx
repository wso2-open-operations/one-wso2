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

import { useRef } from "react";
import type { SxProps, Theme } from "@wso2/oxygen-ui";
import { IconButton, InputAdornment, TextField } from "@wso2/oxygen-ui";
import { CalendarIcon } from "@wso2/oxygen-ui-icons-react";

// par-app's two F2F date fields both show an explicit calendar icon; a plain
// native `type="date"` doesn't reliably (the browser's own indicator is too
// faint/inconsistent). Hidden here and replaced with a real icon that opens
// the same native picker via HTMLInputElement.showPicker().
export default function ParDateField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  error = false,
  helperText,
  label,
  ariaLabel,
  fullWidth = false,
  sx,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
  ariaLabel: string;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <TextField
      type="date"
      label={label}
      size="small"
      fullWidth={fullWidth}
      value={value}
      disabled={disabled}
      error={error}
      helperText={helperText}
      onChange={(e) => {
        // min/max on a native date input only constrain the calendar widget
        // — typing a value directly bypasses them, and neither consumer's
        // backend re-validates the range. Reject rather than pass through.
        const v = e.target.value;
        if (v && ((min && v < min) || (max && v > max))) return;
        onChange(v);
      }}
      inputRef={inputRef}
      slotProps={{
        inputLabel: label ? { shrink: true } : undefined,
        htmlInput: { min, max, "aria-label": ariaLabel },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                disabled={disabled}
                aria-label="Open date picker"
                onClick={() =>
                  (inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.()
                }
              >
                <CalendarIcon size={16} />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      sx={{
        "& input[type='date']::-webkit-calendar-picker-indicator": { display: "none" },
        ...sx,
      }}
    />
  );
}

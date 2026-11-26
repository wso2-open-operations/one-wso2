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

import { Box, CircularProgress, InputAdornment, TextField, type TextFieldProps } from "@wso2/oxygen-ui";
import { CircleCheckIcon, OctagonXIcon } from "@wso2/oxygen-ui-icons-react";
import type { UrlCheck } from "../util/useUrlCheck";

const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

type Props = Omit<TextFieldProps, "onBlur" | "error" | "select"> & {
  /** From useUrlCheck: the check state for this field's value. */
  urlCheck: UrlCheck;
  /** Words for the screen reader and the icon label, e.g. "Image URL". */
  subject: string;
  /** Shown under the box while the value is not bad. */
  hint?: string;
  /** What the checker is given when it differs from the box text (e.g. the post type joined with the id). */
  checkValue?: string;
  /** A problem found elsewhere (e.g. at submit): red box and this text, without the stop sign. */
  errorText?: string;
  /** Words for the icons and the announcement; the defaults say the value "looks good" / "has a problem". */
  labels?: { ok?: string; bad?: string };
};

/**
 * A text box that checks its value when it loses focus. Good: a green check at the right
 * end. Bad: red text and a stop sign instead of the check, with the checker's reason under
 * the box. Empty (or not checked yet): nothing. The result is also announced politely.
 */
export default function UrlCheckField({
  urlCheck,
  subject,
  hint,
  checkValue,
  errorText,
  labels,
  value,
  slotProps,
  ...rest
}: Props) {
  const { state, message, check } = urlCheck;
  const bad = state === "bad";
  const okLabel = labels?.ok ?? `${subject} is good`;
  const badLabel = labels?.bad ?? `${subject} has a problem`;
  const red = bad || Boolean(errorText);
  const status =
    state === "ok"
      ? `${labels?.ok ?? `${subject} looks good`}.`
      : bad
        ? `${badLabel}. ${message ?? ""}`.trim()
        : state === "checking"
          ? `Checking ${subject}.`
          : "";

  return (
    <>
      <TextField
        {...rest}
        value={value}
        fullWidth
        error={red}
        onBlur={() => check(checkValue ?? String(value ?? ""))}
        helperText={bad && message ? message : (errorText ?? hint)}
        sx={{ ...(red ? { "& .MuiInputBase-input": { color: "error.main" } } : {}), ...rest.sx }}
        slotProps={{
          ...slotProps,
          input: {
            ...(slotProps?.input as object),
            endAdornment:
              state === "idle" ? undefined : (
                <InputAdornment position="end">
                  {state === "checking" && <CircularProgress size={18} aria-label={`Checking ${subject}`} />}
                  {state === "ok" && (
                    <Box component="span" sx={{ display: "inline-flex", color: "success.main" }}>
                      <CircleCheckIcon size={20} role="img" aria-label={okLabel} />
                    </Box>
                  )}
                  {bad && (
                    <Box component="span" sx={{ display: "inline-flex", color: "error.main" }}>
                      <OctagonXIcon size={20} role="img" aria-label={badLabel} />
                    </Box>
                  )}
                </InputAdornment>
              ),
          },
        }}
      />
      <span role="status" aria-live="polite" style={visuallyHidden}>
        {status}
      </span>
    </>
  );
}

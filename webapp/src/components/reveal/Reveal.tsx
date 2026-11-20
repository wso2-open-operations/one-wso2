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

import { useState, type ReactNode } from "react";
import { Box, ButtonBase, IconButton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { EyeIcon, EyeOffIcon } from "@wso2/oxygen-ui-icons-react";
import type { SxProps, Theme } from "@mui/material/styles";

export interface RevealProps {
  /** What is hidden, in lowercase ("groups"). Used in the button labels. */
  label: string;
  /**
   * Optional title row. When given, the hide button sits on its far right,
   * aligned with the title, instead of beside the revealed content.
   */
  header?: ReactNode;
  children: ReactNode;
  /** Start revealed. Ignored when `revealed` is passed. */
  defaultRevealed?: boolean;
  /** Controlled mode: pass with `onRevealedChange` to own the state. */
  revealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  sx?: SxProps<Theme>;
}

// Hides its children behind an eye-slash placeholder until the reader asks
// to see them. Children are not mounted while hidden, so nothing they render
// (or fetch) exists in the DOM until reveal — a screen share or a glance over
// the shoulder shows only the placeholder. Works uncontrolled by default;
// pass `revealed` + `onRevealedChange` to drive it from outside.
export default function Reveal({
  label,
  header,
  children,
  defaultRevealed = false,
  revealed: revealedProp,
  onRevealedChange,
  sx,
}: RevealProps) {
  const [revealedState, setRevealedState] = useState(defaultRevealed);
  const revealed = revealedProp ?? revealedState;
  const setRevealed = (next: boolean) => {
    if (revealedProp === undefined) setRevealedState(next);
    onRevealedChange?.(next);
  };

  // Negative margin so the button's padding doesn't push the row taller than
  // the title alone: the header keeps one height in both states.
  const hideButton = (
    <Tooltip title={`Hide ${label}`} placement="top">
      <IconButton size="small" aria-label={`Hide ${label}`} onClick={() => setRevealed(false)} sx={{ my: -0.75 }}>
        <EyeIcon size={16} />
      </IconButton>
    </Tooltip>
  );

  const placeholder = (
    <ButtonBase
      onClick={() => setRevealed(true)}
      aria-label={`Show ${label}`}
      sx={{
        width: "100%",
        py: 2,
        gap: 1,
        border: 1,
        borderStyle: "dashed",
        borderColor: "divider",
        borderRadius: 1,
        color: "text.secondary",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <EyeOffIcon size={16} aria-hidden />
      <Typography sx={{ fontSize: 12.5 }}>Hidden. Click to show {label}.</Typography>
    </ButtonBase>
  );

  if (header !== undefined) {
    return (
      <Box sx={sx}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{header}</Box>
          {revealed && hideButton}
        </Stack>
        {revealed ? children : placeholder}
      </Box>
    );
  }

  if (!revealed) return <Box sx={sx}>{placeholder}</Box>;

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={sx}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      {hideButton}
    </Stack>
  );
}

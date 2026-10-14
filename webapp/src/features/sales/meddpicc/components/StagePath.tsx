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

import { alpha, Box, ButtonBase, Stack, Typography } from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import type { GateSummary } from "../util/dealSections";

const NOTCH = 10;

/**
 * The deal's stages as a path, the way Salesforce shows an Opportunity's: one step per
 * stage, in order, with the current stage marked. Each step says what that stage still
 * needs (fields to review, fields missing) or that it is complete, so an earlier stage
 * left with a gap shows up without opening it. Picking a step shows that stage's fields.
 *
 * Scrolls sideways inside itself on a narrow screen rather than wrapping: a path that
 * breaks onto two lines stops reading as a path.
 */
export default function StagePath({
  stages,
  current,
  selected,
  onSelect,
}: {
  stages: readonly GateSummary[];
  current: string;
  /** null while a Letter, not a stage, is picked. */
  selected: string | null;
  onSelect: (gate: string) => void;
}) {
  const currentIndex = stages.findIndex((s) => s.gate === current);
  return (
    <Box sx={{ overflowX: "auto", pb: 0.5 }}>
      <Stack direction="row" role="group" aria-label="Stages" sx={{ minWidth: stages.length * 120 }}>
        {stages.map((s, i) => {
          const isSelected = s.gate === selected;
          const isCurrent = s.gate === current;
          const isPast = currentIndex >= 0 && i < currentIndex;
          const needs = [s.review && `${s.review} to review`, s.missing && `${s.missing} missing`].filter(Boolean).join(" · ");
          const status = s.complete ? "Complete" : needs;
          return (
            <ButtonBase
              key={s.gate}
              onClick={() => onSelect(s.gate)}
              aria-pressed={isSelected}
              aria-label={`${s.gate}${isCurrent ? ", current stage" : ""}: ${status}`}
              sx={{
                flex: 1,
                minWidth: 120,
                height: 48,
                ml: i === 0 ? 0 : `-${NOTCH - 2}px`,
                pl: i === 0 ? 1.5 : `${NOTCH + 10}px`,
                pr: `${NOTCH + 6}px`,
                justifyContent: "flex-start",
                textAlign: "left",
                clipPath:
                  i === 0
                    ? `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`
                    : `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%, ${NOTCH}px 50%)`,
                // Selected is solid; the current stage is a primary tint; stages behind it
                // are a shade darker than those ahead, as a path reads.
                bgcolor: (theme) =>
                  isSelected
                    ? theme.palette.primary.main
                    : isCurrent
                      ? alpha(theme.palette.primary.main, 0.16)
                      : s.complete || isPast
                        ? theme.palette.action.selected
                        : theme.palette.action.hover,
                color: isSelected ? "primary.contrastText" : "text.primary",
                transition: "background-color 120ms",
                "&:hover": { bgcolor: isSelected ? "primary.dark" : "action.focus" },
                "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.dark", outlineOffset: -2 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  {s.complete && <CheckIcon size={13} aria-hidden />}
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: isCurrent || isSelected ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {s.gate}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    opacity: isSelected ? 0.9 : 1,
                    color: isSelected ? "inherit" : s.review ? "warning.dark" : "text.secondary",
                    fontWeight: s.review && !isSelected ? 600 : 400,
                  }}
                >
                  {isCurrent ? `Current · ${status}` : status}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Stack>
    </Box>
  );
}

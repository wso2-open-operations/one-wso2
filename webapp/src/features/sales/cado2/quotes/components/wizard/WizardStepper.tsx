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

import type { JSX } from "react";
import { Box, ButtonBase, Paper, Typography } from "@wso2/oxygen-ui";
import { CheckIcon, LockIcon } from "@wso2/oxygen-ui-icons-react";
import { STEPS } from "@features/sales/cado2/quotes/form/draftForm";
import { STEP_HINTS } from "./stepText";


interface WizardStepperProps {
  readonly active: number;
  /** The furthest step the AM may open (steps are filled in order). */
  readonly reachable: number;
  /** A read-only version can be browsed freely. */
  readonly readOnly: boolean;
  readonly onSelect: (step: number) => void;
}

type State = "done" | "current" | "open" | "locked";

/**
 * The wizard's steps on one connected track (F5 feedback, 2026-09-25): done
 * steps show a tick, the current one is highlighted, and steps beyond the
 * furthest reachable one are locked, so a quote is filled in order. Each
 * button's accessible name is the step's name.
 */
export default function WizardStepper({ active, reachable, readOnly, onSelect }: WizardStepperProps): JSX.Element {
  const stateOf = (i: number): State =>
    i === active ? "current" : readOnly ? "open" : i > reachable ? "locked" : i < reachable ? "done" : "open";
  return (
    <Paper variant="outlined" sx={{ px: { xs: 1.5, sm: 3 }, py: 2.5, borderRadius: 2 }}>
      {/* One column per step, however many there are (five since the Legal step). */}
      <Box component="nav" aria-label="Quote steps" sx={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, minmax(0,1fr))` }}>
        {STEPS.map((label, i) => {
          const state = stateOf(i);
          const status = readOnly
            ? STEP_HINTS[i]
            : state === "current"
              ? "In progress"
              : state === "done"
                ? "Done"
                : state === "locked"
                  ? "Locked"
                  : "Up next";
          const filled = state === "current" || state === "done";
          return (
            <Box key={label} sx={{ position: "relative", minWidth: 0 }}>
              {/* The track to the next step, coloured once this step is done. */}
              {i < STEPS.length - 1 ? (
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    top: 17,
                    left: "calc(50% + 22px)",
                    right: "calc(-50% + 22px)",
                    height: 3,
                    borderRadius: 2,
                    bgcolor: !readOnly && i < reachable ? "primary.main" : "divider",
                  }}
                />
              ) : null}
              <ButtonBase
                onClick={() => onSelect(i)}
                disabled={state === "locked"}
                aria-label={label}
                aria-current={state === "current" ? "step" : undefined}
                sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", borderRadius: 2, py: 0.5, textAlign: "center" }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 15,
                    position: "relative",
                    zIndex: 1,
                    border: 2,
                    borderColor: state === "locked" ? "divider" : "primary.main",
                    bgcolor: filled ? "primary.main" : "background.paper",
                    color: filled ? "primary.contrastText" : state === "locked" ? "text.disabled" : "primary.main",
                    boxShadow: state === "current" ? 4 : 0,
                    transition: "all .2s",
                  }}
                >
                  {state === "done" ? <CheckIcon size={18} /> : state === "locked" ? <LockIcon size={14} /> : i + 1}
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{ mt: 1, fontWeight: state === "current" ? 700 : 600, color: state === "locked" ? "text.disabled" : "text.primary", display: { xs: "none", sm: "block" } }}
                  noWrap
                >
                  {label}
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ display: { xs: "none", sm: "block" }, color: state === "current" ? "primary.main" : "text.secondary" }}
                >
                  {status}
                </Typography>
              </ButtonBase>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

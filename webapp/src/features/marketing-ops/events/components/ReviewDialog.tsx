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

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from "@wso2/oxygen-ui";
import { Circle, CircleCheck, CircleMinus, CircleX, CloudUpload } from "@wso2/oxygen-ui-icons-react";
import type { CampaignInfo } from "../eventsTypes";
import { primaryBtn, quietBtn } from "./eventsStyles";

// Automatic review, shown as it happens.
//
// Pressing Review used to be one click and one verdict. Each check now appears as a step
// that runs, then passes or fails, so the person sees what is being looked at rather than
// waiting on a spinner — and when something fails, it is named under the step that found
// it. Only a list that passes is offered "Add to Salesforce", behind a warning, because
// that is the one step that can't be taken back.

export type StepState = "waiting" | "running" | "passed" | "failed" | "skipped";

export interface ReviewStep {
  key: string;
  label: string;
  state: StepState;
  /** What failed, one line each, already worded for the person. */
  problems?: string[];
}

export interface ReviewState {
  phase: "running" | "passed" | "failed";
  steps: ReviewStep[];
  canEscalate: boolean;
  campaign?: CampaignInfo | null;
  rowCount: number;
  /** The grid's own checks failed — "Show me where" can open the detailed report. */
  localReport: boolean;
}

const SHOWN_PER_STEP = 6;

function StepIcon({ state }: { state: StepState }) {
  const box = { width: 18, height: 18, display: "grid", placeItems: "center", flexShrink: 0, mt: "1px" };
  if (state === "running") return <Box sx={box}><CircularProgress size={14} thickness={5} /></Box>;
  if (state === "passed") return <Box sx={{ ...box, color: "success.main" }}><CircleCheck size={18} /></Box>;
  if (state === "failed") return <Box sx={{ ...box, color: "error.main" }}><CircleX size={18} /></Box>;
  if (state === "skipped") return <Box sx={{ ...box, color: "text.disabled" }}><CircleMinus size={18} /></Box>;
  return <Box sx={{ ...box, color: "text.disabled" }}><Circle size={18} /></Box>;
}

export default function ReviewDialog({
  review,
  submitting,
  onClose,
  onAdd,
  onEscalate,
  onShowWhere,
}: {
  review: ReviewState;
  submitting: boolean;
  onClose: () => void;
  onAdd: () => void;
  onEscalate: () => void;
  onShowWhere: () => void;
}) {
  const { phase, steps, campaign } = review;
  const done = steps.filter((s) => s.state !== "waiting" && s.state !== "running").length;
  const running = phase === "running";

  return (
    <Dialog open onClose={() => !running && !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, pb: 1 }}>
        {running ? "Reviewing your list…" : phase === "passed" ? "Ready for Salesforce" : "Not ready yet"}
      </DialogTitle>
      <DialogContent>
        <LinearProgress
          variant="determinate"
          value={running ? Math.max(4, (done / steps.length) * 100) : 100}
          color={phase === "failed" ? "error" : phase === "passed" ? "success" : "primary"}
          sx={{ height: 6, borderRadius: 3, mb: 2 }}
          aria-label="Review progress"
        />

        <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }} aria-live="polite">
          {steps.map((step) => (
            <Box component="li" key={step.key} sx={{ display: "flex", gap: 1.25, py: 0.9 }}>
              <StepIcon state={step.state} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: 13.5,
                    fontWeight: step.state === "running" || step.state === "failed" ? 700 : 500,
                    color: step.state === "waiting" || step.state === "skipped" ? "text.disabled" : "text.primary",
                  }}
                >
                  {step.label}
                </Typography>
                {step.state === "failed" && step.problems && step.problems.length > 0 && (
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                    {step.problems.slice(0, SHOWN_PER_STEP).map((p, i) => (
                      <Typography component="li" key={i} sx={{ fontSize: 12.5, color: "text.secondary" }}>
                        {p}
                      </Typography>
                    ))}
                    {step.problems.length > SHOWN_PER_STEP && (
                      <Typography component="li" sx={{ fontSize: 12.5, color: "text.secondary" }}>
                        and {step.problems.length - SHOWN_PER_STEP} more
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>

        {phase === "passed" && (
          <>
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.25, bgcolor: "action.hover" }}>
              <Typography sx={{ fontSize: 13 }}>
                <b>{review.rowCount.toLocaleString()}</b> {review.rowCount === 1 ? "lead" : "leads"} for{" "}
                <b>{campaign?.name ?? campaign?.id ?? "the campaign"}</b>
                {campaign?.status ? ` · ${campaign.status}` : ""}
                {campaign && !campaign.isActive ? " · inactive" : ""}
              </Typography>
            </Box>
            <Alert severity="warning" sx={{ mt: 1.5, fontSize: 13 }}>
              Adding to Salesforce locks this list — you won't be able to edit it afterwards. Check the
              campaign above is the right one.
            </Alert>
          </>
        )}

        {phase === "failed" && (
          <Typography sx={{ mt: 1.5, fontSize: 12.5, color: "text.secondary" }}>
            {review.canEscalate
              ? "Fix these in the list and review again. If you're sure the list is right as it is, send it to an admin with a note."
              : "Fix these in the list and review again."}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {phase === "passed" && (
          <>
            <Button onClick={onClose} disabled={submitting} sx={quietBtn}>
              Not yet
            </Button>
            <Button
              variant="contained"
              sx={primaryBtn}
              disabled={submitting}
              onClick={onAdd}
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CloudUpload size={16} />}
            >
              {submitting ? "Adding…" : "Add to Salesforce"}
            </Button>
          </>
        )}
        {phase === "failed" && (
          <>
            {review.canEscalate && (
              <Button onClick={onEscalate} sx={{ ...quietBtn, mr: "auto" }}>
                Send to admin
              </Button>
            )}
            {review.localReport && (
              <Button onClick={onShowWhere} sx={quietBtn}>
                Show me where
              </Button>
            )}
            <Button variant="contained" sx={primaryBtn} onClick={onClose}>
              Back to the list
            </Button>
          </>
        )}
        {running && (
          <Button disabled sx={quietBtn}>
            Reviewing…
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

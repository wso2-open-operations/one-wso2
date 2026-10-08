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

import { useCallback, useState } from "react";
import { toDateOnlyString } from "@features/security/grc/utils/dateTime";
import {
  AdapterDateFns,
  Alert,
  Box,
  Button,
  CircularProgress,
  DatePickers,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { CreateAssessmentPayload, RiskDetail, RiskScore, RiskScoreInfo } from "../../api/riskApi";
import { suggestLikelihood } from "../../api/riskApi";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { dialogPaperSx } from "../cardStyles";
import RiskScoreGrid from "./RiskScoreGrid";

const { DatePicker, LocalizationProvider } = DatePickers;

interface ReassessmentDialogProps {
  open: boolean;
  riskCode: string;
  riskScores: RiskScore[];
  // The risk's residual score before this assessment — RiskDetail.effective_score,
  // i.e. the latest reassessment if one exists, else the gross score. Null only
  // when the caller has no detail loaded yet.
  previousScore: RiskScoreInfo | null;
  // True when previousScore is actually the gross score (no reassessment has
  // ever been recorded) — worded "Initial" rather than "Previous" since it
  // isn't a residual assessment at all.
  previousIsInitial: boolean;
  // Full risk detail, source for "Suggest Likelihood"'s six inputs (Title,
  // Description, Impact Description, Compliance References, Category, Source
  // Register) — all already loaded by the caller to render the drawer this
  // dialog opens from, so nothing new is fetched here.
  riskDetail: RiskDetail;
  onClose: () => void;
  onSubmit: (payload: CreateAssessmentPayload) => Promise<void>;
}

export default function ReassessmentDialog({
  open,
  riskCode,
  riskScores,
  previousScore,
  previousIsInitial,
  riskDetail,
  onClose,
  onSubmit,
}: ReassessmentDialogProps): JSX.Element {
  const authFetch = useAuthApiClient();
  const [likelihood, setLikelihood] = useState(0);
  const [impact, setImpact] = useState(0);
  const [progress, setProgress] = useState("");
  const [reassessmentDate, setReassessmentDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  // ── Suggest Likelihood ─────────────────────────────────────────────────
  // Explicit button only — same reasoning as every other "Suggest" button in
  // this feature (Category, the Add Risk flow's Likelihood suggestion).
  const [suggestion, setSuggestion] = useState<{
    score: number;
    reason: string;
    confidence: "high" | "medium" | "low";
  } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // A risk whose category was later archived/deleted has an empty
  // risk_categories array — suggestLikelihood needs a real category id, so
  // the button stays disabled rather than silently sending category_id: 0.
  const canSuggestLikelihood = riskDetail.risk_categories.length > 0;

  const handleSuggestLikelihood = useCallback(async () => {
    const categoryId = riskDetail.risk_categories[0]?.id;
    if (categoryId == null) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestLikelihood(
        authFetch,
        riskDetail.risk_title,
        riskDetail.risk_description,
        riskDetail.impact_description ?? "",
        riskDetail.compliance_references.map((r) => r.id),
        categoryId,
        riskDetail.source_register_id,
      );
      setSuggestion(result);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : undefined;
      setSuggestError(
        status === 404
          ? "AI likelihood suggestions aren't enabled yet."
          : `Couldn't get a suggestion${message ? `: ${message}` : ""} — please pick a score manually.`,
      );
    } finally {
      setSuggesting(false);
    }
  }, [authFetch, riskDetail]);

  const handleClose = () => {
    if (submitting) return;
    setLikelihood(0);
    setImpact(0);
    setProgress("");
    setReassessmentDate(null);
    setErrors({});
    setApiError("");
    setSuggestion(null);
    setSuggestError(null);
    onClose();
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!likelihood || !impact) e.grid = "Please select a residual risk score from the grid.";
    if (!progress.trim()) e.progress = "Progress is required.";
    if (!reassessmentDate) {
      e.reassessmentDate = "Reassessment date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (reassessmentDate < today) e.reassessmentDate = "Reassessment date cannot be in the past.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      await onSubmit({
        likelihood,
        impact,
        progress: progress.trim(),
        reassessment_date: toDateOnlyString(reassessmentDate)!,
        ai_likelihood_suggestion: suggestion ?? undefined,
      });
      handleClose();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle>
        <Typography component="span" variant="h6" fontWeight={700} display="block">
          Reassess Risk
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" display="block">
          {riskCode} : Record a residual risk assessment
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack gap={3} sx={{ pt: 1 }}>
          {apiError && <Alert severity="error">{apiError}</Alert>}

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
              <Typography variant="body2" fontWeight={600}>
                Residual Risk Score <span style={{ color: "red" }}>*</span>
              </Typography>
              <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                {previousScore && (
                  <Typography variant="caption" color="text.secondary">
                    {previousIsInitial ? "Initial" : "Previous"}:{" "}
                    <strong>{previousScore.risk_level}</strong> · Score {previousScore.risk_rating}
                  </Typography>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSuggestLikelihood}
                  disabled={suggesting || submitting || !canSuggestLikelihood}
                  startIcon={suggesting ? <CircularProgress size={14} /> : undefined}
                >
                  {suggesting ? "Suggesting…" : "Suggest Likelihood"}
                </Button>
              </Stack>
            </Stack>

            {suggestError && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                {suggestError}
              </Alert>
            )}
            {!suggestError && suggestion && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                <Typography variant="body2">
                  <strong>Suggested Likelihood: {suggestion.score}</strong> ({suggestion.confidence}{" "}
                  confidence): {suggestion.reason}. The highlighted row below is the suggestion — pick
                  the cell in that row matching this risk's Impact.
                </Typography>
              </Alert>
            )}

            <RiskScoreGrid
              riskScores={riskScores}
              likelihood={likelihood}
              impact={impact}
              onChange={(l, i) => {
                setLikelihood(l);
                setImpact(i);
                if (errors.grid) setErrors((prev) => ({ ...prev, grid: "" }));
              }}
              error={errors.grid}
              suggestedLikelihood={suggestion?.score}
              previousLikelihood={previousScore?.likelihood}
              previousImpact={previousScore?.impact}
            />
          </Box>

          <Divider />

          <TextField
            label="Progress"
            multiline
            rows={3}
            fullWidth
            required
            value={progress}
            onChange={(e) => {
              setProgress(e.target.value);
              if (errors.progress) setErrors((prev) => ({ ...prev, progress: "" }));
            }}
            error={!!errors.progress}
            helperText={errors.progress}
            placeholder="Describe the current remediation progress..."
            disabled={submitting}
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Reassessment Date *"
              value={reassessmentDate}
              onChange={(d) => {
                setReassessmentDate(d);
                if (errors.reassessmentDate) setErrors((prev) => ({ ...prev, reassessmentDate: "" }));
              }}
              disablePast
              slotProps={{
                desktopPaper: {
                  sx: {
                    backdropFilter: "none",
                    backgroundColor: "var(--oxygen-palette-background-default)",
                  },
                },
                textField: {
                  fullWidth: true,
                  error: !!errors.reassessmentDate,
                  helperText: errors.reassessmentDate,
                  disabled: submitting,
                },
              }}
            />
          </LocalizationProvider>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant="contained"
        >
          {submitting ? "Saving..." : "Save Assessment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  AdapterDateFns,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  DatePickers,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Info } from "@wso2/oxygen-ui-icons-react";
import type { JSX, ReactNode } from "react";
import type { AddRiskFormValues, ImpactLevel, LikelihoodLevel } from "./types";
import type { RiskScore } from "../../api/riskApi";
import { suggestLikelihood } from "../../api/riskApi";
import RiskScoreGrid from "../risk-registers/RiskScoreGrid";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";

const { DatePicker, LocalizationProvider } = DatePickers;

// `required` renders the asterisk convention users expect on a form: the field
// must be filled before the step will submit. It mirrors the `rules.required`
// on the same Controller — keep the two in step, or the form will either
// promise something it doesn't enforce or enforce something it didn't warn about.
function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }): JSX.Element {
  return (
    <Typography
      variant="body2"
      fontWeight={500}
      color="text.primary"
      sx={{ display: "block", mb: 1 }}
    >
      {children}
      {required && (
        // Inherits the label's colour rather than fixing one: the form sits on a
        // dark card in dark mode and a light one otherwise, so a hard-coded
        // colour would be invisible in one of them.
        <Box component="span" aria-hidden="true" sx={{ color: "inherit", ml: 0.4 }}>
          *
        </Box>
      )}
    </Typography>
  );
}

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} color="text.primary">
        {title}
      </Typography>
      <Divider sx={{ mt: 1 }} />
    </Box>
  );
}

interface RiskAssessmentStepProps {
  riskScores: RiskScore[];
}

export default function RiskAssessmentStep({ riskScores }: RiskAssessmentStepProps): JSX.Element {
  const { control, setValue, clearErrors } = useFormContext<AddRiskFormValues>();
  const authFetch = useAuthApiClient();

  const likelihood = useWatch({ control, name: "likelihood" });
  const impact     = useWatch({ control, name: "impact" });

  const findScore = (l: LikelihoodLevel, i: ImpactLevel): RiskScore | undefined =>
    riskScores.find(s => s.likelihood === l && s.impact === i);

  const selectedScore =
    likelihood != null && impact != null ? findScore(likelihood, impact) : null;

  const handleCellClick = (l: LikelihoodLevel, i: ImpactLevel): void => {
    setValue("likelihood", l, { shouldValidate: true, shouldDirty: true });
    setValue("impact",     i, { shouldValidate: true, shouldDirty: true });
    clearErrors("likelihood");
  };

  // ── Suggest Likelihood ───────────────────────────────────────────────────
  // Explicit button only — same reasoning as Category's button (avoids
  // burning AI Gateway usage on abandoned/half-finished forms). All six
  // inputs the suggestion needs span both this step and Basic Information;
  // react-hook-form's shared context (useFormContext) means they're all
  // already here regardless of which step is currently showing.
  const riskTitle = useWatch({ control, name: "riskTitle" });
  const riskDescription = useWatch({ control, name: "riskDescription" });
  const impactDescription = useWatch({ control, name: "impactDescription" });
  const complianceReferences = useWatch({ control, name: "complianceReferences" });
  const riskCategory = useWatch({ control, name: "riskCategory" });
  const sourceRegister = useWatch({ control, name: "sourceRegister" });
  const aiLikelihoodSuggestion = useWatch({ control, name: "aiLikelihoodSuggestion" });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const canSuggestLikelihood =
    !!riskTitle && !!riskDescription && !!impactDescription && riskCategory !== "" && sourceRegister !== "";

  const handleSuggestLikelihood = useCallback(async () => {
    if (riskCategory === "" || sourceRegister === "") return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestLikelihood(
        authFetch,
        riskTitle,
        riskDescription,
        impactDescription,
        complianceReferences ?? [],
        riskCategory,
        sourceRegister,
      );
      setValue("aiLikelihoodSuggestion", {
        score: result.score,
        reason: result.reason,
        confidence: result.confidence,
      });
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
  }, [authFetch, riskTitle, riskDescription, impactDescription, complianceReferences, riskCategory, sourceRegister, setValue]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Stack gap={4}>

        {/* ── Assessment Guide ─────────────────────────────────────────────── */}
        <Stack gap={3}>
          <SectionHeader title="Assessment Guide" />

          <Paper
            variant="outlined"
            sx={{ p: 2.5, borderRadius: 2, borderColor: "info.light" }}
          >
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2.5 }}>
              <Info size={16} />
              <Typography variant="body2" fontWeight={600}>
                How to rate likelihood and impact
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 4,
                alignItems: "flex-start",
              }}
            >
              {/* Likelihood guide */}
              <Stack gap={1.5}>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Typography variant="body2" fontWeight={600}>
                    Likelihood:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    how often could this occur?
                  </Typography>
                </Stack>

                {[
                  { badge: "1 - Low",    desc: "The event could occur annually" },
                  { badge: "2 - Medium", desc: "The event may occur quarterly" },
                  { badge: "3 - High",   desc: "The event is expected to occur monthly" },
                ].map(({ badge, desc }) => (
                  <Stack key={badge} direction="row" gap={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        minWidth: 80,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        textAlign: "center",
                        bgcolor: "action.hover",
                        border: "1px solid",
                        borderColor: "divider",
                        flexShrink: 0,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        {badge}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ pt: 0.3 }}>
                      {desc}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              {/* Impact guide */}
              <Stack gap={1.5}>
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Typography variant="body2" fontWeight={600}>
                    Impact:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    how severe are the consequences?
                  </Typography>
                </Stack>

                {[
                  {
                    badge: "1 - Minor",
                    line1: "Materializing the risk will not impact on any or some systems.",
                    line2: "There will be no instances where WSO2 critical information will be disclosed to an outside party.",
                  },
                  {
                    badge: "2 - Moderate",
                    line1: "Materializing the risk will impact all business systems excluding WSO2 offerings/Products.",
                    line2: "WSO2 internal information leakage.",
                  },
                  {
                    badge: "3 - Major",
                    line1: "Materializing the risk will create serious financial and reputational impact.",
                    line2: "Customer information, WSO2 critical information and sensitive information leakage.",
                  },
                ].map(({ badge, line1, line2 }) => (
                  <Stack key={badge} direction="row" gap={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        minWidth: 90,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        textAlign: "center",
                        bgcolor: "action.hover",
                        border: "1px solid",
                        borderColor: "divider",
                        flexShrink: 0,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        {badge}
                      </Typography>
                    </Box>
                    <Stack gap={0.25} sx={{ pt: 0.3 }}>
                      <Typography variant="caption" color="text.secondary">{line1}</Typography>
                      <Typography variant="caption" color="text.secondary">{line2}</Typography>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Stack>

        {/* ── Gross Risk Score Matrix ───────────────────────────────────────── */}
        <Stack gap={3}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: "wrap", gap: 1 }}>
            <SectionHeader title="Gross Risk Score" />
            <Button
              size="small"
              variant="outlined"
              onClick={handleSuggestLikelihood}
              disabled={suggesting || !canSuggestLikelihood}
              startIcon={suggesting ? <CircularProgress size={14} /> : undefined}
            >
              {suggesting ? "Suggesting…" : "Suggest Likelihood"}
            </Button>
          </Stack>

          {/* Impact Description — moved above the chart: it's one of the
              "Suggest Likelihood" button's required inputs, so it needs to be
              filled in before that button does anything useful. */}
          <Controller
            name="impactDescription"
            control={control}
            rules={{ required: "Impact description is required" }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  if (e.target.value) clearErrors("impactDescription");
                }}
                label="Impact Description"
                required
                fullWidth
                multiline
                rows={3}
                placeholder="Describe the specific consequences this risk could have on systems, data, or operations…"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Typography variant="body2" color="text.secondary">
            Click the cell that best represents the likelihood and impact of this risk.
            The score equals <strong>Likelihood × Impact</strong>. Only Likelihood can be
            AI-suggested — Impact is always your own judgement call.
          </Typography>

          {suggestError && <Alert severity="warning">{suggestError}</Alert>}
          {!suggestError && aiLikelihoodSuggestion && (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Suggested Likelihood: {aiLikelihoodSuggestion.score}</strong>{" "}
                ({aiLikelihoodSuggestion.confidence} confidence): {aiLikelihoodSuggestion.reason}.
                The highlighted row below is the suggestion — pick the cell in that row matching
                this risk's Impact.
              </Typography>
            </Alert>
          )}

          {/* Grid + row-highlight + validation — shared with the Reassess
              dialog's matrix (RiskScoreGrid.tsx) rather than duplicated here;
              this step keeps its own richer Chip-based selected-score summary
              below instead of the grid's built-in one. */}
          <Controller
            name="likelihood"
            control={control}
            rules={{
              validate: (val) =>
                val != null ? true : "Please select a cell in the risk matrix to continue",
            }}
            render={({ fieldState }) => (
              <RiskScoreGrid
                riskScores={riskScores}
                likelihood={likelihood ?? 0}
                impact={impact ?? 0}
                onChange={(l, i) => handleCellClick(l as LikelihoodLevel, i as ImpactLevel)}
                error={fieldState.error?.message}
                suggestedLikelihood={aiLikelihoodSuggestion?.score}
                showSelectedSummary={false}
              />
            )}
          />

          {/* Risk level chip — shown when a cell is selected */}
          {selectedScore && (
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Gross Risk Score:
              </Typography>
              <Chip
                label={`${selectedScore.risk_rating} : ${selectedScore.risk_level} RISK`}
                size="medium"
                sx={{
                  bgcolor: selectedScore.color_code,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  px: 0.5,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                (Likelihood {likelihood} × Impact {impact})
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <Stack gap={3}>
          <SectionHeader title="Timeline" />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              alignItems: "flex-start",
            }}
          >
            {/* Implementation Date */}
            <Controller
              name="implementationDate"
              control={control}
              rules={{ required: "Implementation date is required" }}
              render={({ field, fieldState }) => (
                <Box>
                  <FieldLabel required>Implementation Date</FieldLabel>
                  <DatePicker
                    value={field.value}
                    onChange={(newValue) => {
                      field.onChange(newValue);
                      if (newValue) clearErrors("implementationDate");
                    }}
                    disablePast
                    sx={{ width: "100%" }}
                    slotProps={{
                      desktopPaper: {
                        sx: {
                          backdropFilter: "none",
                          backgroundColor: "var(--oxygen-palette-background-default)",
                        },
                      },
                      textField: {
                        fullWidth: true,
                        // No label prop is set on this slot — FieldLabel above
                        // renders it separately — so `required` here only sets
                        // aria-required on the input; it cannot produce a
                        // second, MUI-rendered asterisk to duplicate FieldLabel's.
                        required: true,
                        error: !!fieldState.error,
                        helperText:
                          fieldState.error?.message ??
                          "Target completion date for risk treatment.",
                        onBlur: field.onBlur,
                      },
                    }}
                  />
                </Box>
              )}
            />

            {/* Reassessment Date */}
            <Controller
              name="reassessmentDate"
              control={control}
              rules={{ required: "Reassessment date is required" }}
              render={({ field, fieldState }) => (
                <Box>
                  <FieldLabel required>Reassessment Date</FieldLabel>
                  <DatePicker
                    value={field.value}
                    onChange={(newValue) => {
                      field.onChange(newValue);
                      if (newValue) clearErrors("reassessmentDate");
                    }}
                    disablePast
                    sx={{ width: "100%" }}
                    slotProps={{
                      desktopPaper: {
                        sx: {
                          backdropFilter: "none",
                          backgroundColor: "var(--oxygen-palette-background-default)",
                        },
                      },
                      textField: {
                        fullWidth: true,
                        // Same rationale as Implementation Date above: no
                        // label prop on this slot, so `required` only sets
                        // aria-required — no duplicate visible asterisk.
                        required: true,
                        error: !!fieldState.error,
                        helperText:
                          fieldState.error?.message ??
                          "Date for the next scheduled risk reassessment.",
                        onBlur: field.onBlur,
                      },
                    }}
                  />
                </Box>
              )}
            />
          </Box>
        </Stack>

      </Stack>
    </LocalizationProvider>
  );
}

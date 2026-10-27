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

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useSaveLeadership360Draft, useSubmitLeadership360Feedback } from "../api/useLeadership360";
import type {
  FormAnswers,
  FormQuestion,
  FormScale,
  Leadership360CurrentSurvey,
  Leadership360Draft,
  Leadership360Leader,
} from "../api/leadership360Types";
import { cleanAnswers, headerSections, missingRequired, sectionProgress, stepSections } from "../util/leadership360Form";
import { formatShortDate } from "../util/parDate";

const AUTOSAVE_DELAY_MS = 5000;
const DEFAULT_TEXT_MAX_LENGTH = 5000;

// Feedback on one member of the leadership group: the relationship question,
// then one step per template section, saved as a draft as you go and
// submitted once — anonymously by default.
export default function Leadership360FeedbackDialog({
  open,
  onClose,
  survey,
  leader,
  draft,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  survey: Leadership360CurrentSurvey;
  leader: Leadership360Leader;
  draft?: Leadership360Draft;
  onSubmitted: (leader: Leadership360Leader) => void;
}) {
  const { definition } = survey.template;
  const headers = headerSections(definition);
  const steps = stepSections(definition);

  const [answers, setAnswers] = useState<FormAnswers>(draft?.answers ?? {});
  const [anonymous, setAnonymous] = useState(draft?.anonymous ?? true);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);

  const saveDraft = useSaveLeadership360Draft(survey.survey.surveyId);
  const submit = useSubmitLeadership360Feedback(survey.survey.surveyId);
  const latest = useRef({ answers, anonymous });
  latest.current = { answers, anonymous };

  const save = () => {
    setDirty(false);
    saveDraft.mutate({
      leaderEmail: leader.workEmail,
      answers: cleanAnswers(latest.current.answers),
      anonymous: latest.current.anonymous,
    });
  };

  // Autosave a few seconds after the last change, so nothing is lost.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads the latest values through the ref
  }, [dirty, answers, anonymous]);

  const setAnswer = (questionId: string, value: number | string | null) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setDirty(true);
    setMissingCount(0);
  };

  const close = () => {
    if (dirty) save();
    onClose();
  };

  const trySubmit = () => {
    const missing = missingRequired(definition, answers);
    if (missing.length > 0) {
      setMissingCount(missing.length);
      const firstStep = steps.findIndex((s) => s.questions.some((q) => q.id === missing[0].id));
      if (firstStep >= 0) setStep(firstStep);
      return;
    }
    setConfirmation({
      title: `Submit feedback on ${leader.employeeName}?`,
      text: anonymous
        ? "Your name isn't stored with this response, so it can't be edited or withdrawn after you submit."
        : `People Ops and ${leader.employeeName}'s manager will see your name. It can't be edited after you submit.`,
      confirmLabel: anonymous ? "Submit anonymously" : "Submit with my name",
      confirmColor: "primary",
      confirmAction: () =>
        submit.mutate(
          { leaderEmail: leader.workEmail, answers: cleanAnswers(answers), anonymous },
          {
            onSuccess: () => {
              setDirty(false);
              onSubmitted(leader);
              onClose();
            },
          },
        ),
    });
  };

  const isLastStep = step === steps.length - 1;
  const section = steps[step];

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>
        Feedback on {leader.employeeName}
        <Typography variant="body2" color="text.secondary">
          {[leader.jobRole, `${survey.survey.surveyName}, closes ${formatShortDate(survey.survey.endDate)}`]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {headers.flatMap((s) => s.questions).map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              scale={q.scale ? definition.scales[q.scale] : undefined}
              value={answers[q.id]}
              onChange={(value) => setAnswer(q.id, value)}
            />
          ))}

          <Stepper activeStep={step} alternativeLabel>
            {steps.map((s) => {
              const { answered, total } = sectionProgress(s, answers);
              return (
                <Step key={s.id}>
                  <StepLabel
                    optional={
                      <Typography variant="caption" color="text.secondary">
                        {total > 0 ? `${answered} of ${total} answered` : "Written comments"}
                      </Typography>
                    }
                  >
                    {s.title}
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {section && (
            <Box>
              <Typography variant="h6" component="h2">
                {section.title}
              </Typography>
              {section.hint && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {section.hint}
                </Typography>
              )}
              <Stack spacing={2.5}>
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    scale={q.scale ? definition.scales[q.scale] : undefined}
                    value={answers[q.id]}
                    onChange={(value) => setAnswer(q.id, value)}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={anonymous}
                  onChange={(e) => {
                    setAnonymous(e.target.checked);
                    setDirty(true);
                  }}
                />
              }
              label={anonymous ? "Submit anonymously" : "Submit with my name"}
            />
            <Typography variant="body2" color="text.secondary">
              {anonymous
                ? "Your name isn't stored with this response. Nobody — not the leader, their manager or People Ops — can see who you are."
                : `People Ops and ${leader.employeeName}'s manager will see your name with this response.`}{" "}
              {leader.employeeName} sees only a summary, after the survey closes and only if 3 or more people
              responded.
            </Typography>
          </Box>

          {missingCount > 0 && (
            <Alert severity="warning">
              {missingCount === 1
                ? "1 required question still needs an answer."
                : `${missingCount} required questions still need an answer.`}
            </Alert>
          )}
          {submit.isError && <ErrorNotice error={submit.error}>Couldn't submit your feedback.</ErrorNotice>}
          {saveDraft.isError && <ErrorNotice error={saveDraft.error}>Couldn't save your draft.</ErrorNotice>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: "auto" }}>
          {saveDraft.isPending ? "Saving draft…" : saveDraft.isSuccess && !dirty ? "Draft saved" : ""}
        </Typography>
        <Button size="small" onClick={close}>
          Close
        </Button>
        <Button size="small" onClick={save} disabled={!dirty || saveDraft.isPending}>
          Save draft
        </Button>
        <Button size="small" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        {isLastStep ? (
          <Button size="small" variant="contained" onClick={trySubmit} disabled={submit.isPending}>
            {anonymous ? "Submit anonymously" : "Submit with my name"}
          </Button>
        ) : (
          <Button size="small" variant="contained" onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        )}
      </DialogActions>
      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </Dialog>
  );
}

function QuestionField({
  question,
  scale,
  value,
  onChange,
}: {
  question: FormQuestion;
  scale?: FormScale;
  value: number | string | null | undefined;
  onChange: (value: number | string | null) => void;
}) {
  const label = (
    <Typography variant="body1" sx={{ fontWeight: 500 }}>
      {question.text}
      {question.required ? (
        <Box component="span" aria-hidden sx={{ color: "error.main", ml: 0.5 }}>
          *
        </Box>
      ) : (
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          Optional
        </Typography>
      )}
    </Typography>
  );

  if (question.type === "RATING" && scale) {
    const ratings = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
    return (
      <Box>
        {label}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={typeof value === "number" ? value : null}
          onChange={(_, next: number | null) => onChange(next)}
          aria-label={question.text}
          sx={{ mt: 1 }}
        >
          {ratings.map((r) => (
            <ToggleButton key={r} value={r} aria-label={`${r} of ${scale.max}`} sx={{ minWidth: 48 }}>
              {r}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {(scale.minLabel || scale.maxLabel) && (
          <Box sx={{ display: "flex", justifyContent: "space-between", maxWidth: 48 * ratings.length, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {scale.minLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {scale.maxLabel}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  if (question.type === "CHOICE") {
    return (
      <Box>
        {label}
        <RadioGroup
          row
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={question.text}
        >
          {(question.options ?? []).map((o) => (
            <FormControlLabel key={o.value} value={o.value} control={<Radio size="small" />} label={o.label} />
          ))}
        </RadioGroup>
      </Box>
    );
  }

  const maxLength = question.maxLength ?? DEFAULT_TEXT_MAX_LENGTH;
  const text = typeof value === "string" ? value : "";
  return (
    <Box>
      {label}
      <TextField
        multiline
        minRows={4}
        fullWidth
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A specific situation, what they did, and the effect it had"
        helperText={`${text.length} / ${maxLength}`}
        slotProps={{ htmlInput: { maxLength, "aria-label": question.text } }}
        sx={{ mt: 1 }}
      />
    </Box>
  );
}

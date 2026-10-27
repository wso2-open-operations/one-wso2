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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeadership360Summary, useLeadership360SurveyWithTemplate } from "../api/useLeadership360";
import type {
  FormDefinition,
  Leadership360Leader,
  Leadership360Summary,
  Leadership360View,
} from "../api/leadership360Types";
import { allQuestions, stepSections } from "../util/leadership360Form";

// One leader's results in one survey. What it contains depends on the view
// it's opened from — the backend decides: the leader (SELF) gets averages and
// comments only; their manager (REPORTS) and PAR admins (ALL) also get named
// responses; admins also get the relationship breakdown.
export default function Leadership360SummaryDialog({
  open,
  onClose,
  surveyId,
  view,
  leader,
}: {
  open: boolean;
  onClose: () => void;
  surveyId: number;
  view: Leadership360View;
  leader: Leadership360Leader;
}) {
  const survey = useLeadership360SurveyWithTemplate(surveyId);
  const summary = useLeadership360Summary(surveyId, view, leader.workEmail);
  const definition = survey.data?.template.definition;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Leadership 360° results: {leader.employeeName}
        {survey.data && (
          <Typography variant="body2" color="text.secondary">
            {survey.data.survey.surveyName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {survey.isLoading || summary.isLoading ? (
          <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1 }} />
        ) : survey.isError || summary.isError ? (
          <ErrorNotice
            error={summary.error ?? survey.error}
            onRetry={() => {
              void survey.refetch();
              void summary.refetch();
            }}
          >
            Couldn't load the results.
          </ErrorNotice>
        ) : summary.data && definition ? (
          <SummaryContent summary={summary.data} definition={definition} />
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SummaryContent({ summary, definition }: { summary: Leadership360Summary; definition: FormDefinition }) {
  if (!summary.available) {
    return (
      <Alert severity="info">
        {summary.reason}
        {/* Only PAR admins get a count while the survey is open. */}
        {summary.responseCount !== undefined &&
          ` ${summary.responseCount} ${summary.responseCount === 1 ? "person has" : "people have"} responded so far.`}
      </Alert>
    );
  }

  const averages = new Map(summary.questionAverages.map((a) => [a.questionId, a]));
  const questionText = new Map(allQuestions(definition).map((q) => [q.id, q.text]));
  const max = Math.max(...Object.values(definition.scales).map((s) => s.max), 5);
  const choiceLabels = new Map(
    allQuestions(definition).flatMap((q) => (q.options ?? []).map((o) => [o.value, o.label] as const)),
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="p">
          {summary.overallAverage?.toFixed(2) ?? "—"}
          <Typography component="span" variant="body1" color="text.secondary">
            {" "}
            / {max} overall, from {summary.responseCount} responses
          </Typography>
        </Typography>
      </Box>

      {stepSections(definition)
        .filter((s) => s.questions.some((q) => q.type === "RATING"))
        .map((section) => (
          <Box key={section.id}>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              {section.title}
            </Typography>
            <Stack spacing={1.25}>
              {section.questions
                .filter((q) => q.type === "RATING")
                .map((q) => {
                  const average = averages.get(q.id);
                  return (
                    <Box key={q.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                        <Typography variant="body2">{q.text}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                          {average ? average.average.toFixed(2) : "—"}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={average ? (average.average / max) * 100 : 0}
                        aria-label={q.text}
                        sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                      />
                    </Box>
                  );
                })}
            </Stack>
          </Box>
        ))}

      <Box>
        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          Comments
        </Typography>
        {summary.comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No written comments.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {summary.comments.map((comment, i) => (
              <Typography key={i} variant="body2" sx={{ whiteSpace: "pre-wrap", pl: 1.5, borderLeft: 3, borderColor: "divider" }}>
                {comment}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>

      {summary.relationshipCounts && (
        <Box>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            How respondents work with them
          </Typography>
          {Object.entries(summary.relationshipCounts).map(([value, count]) => (
            <Typography key={value} variant="body2">
              {choiceLabels.get(value) ?? value}: {count}
            </Typography>
          ))}
        </Box>
      )}

      {summary.namedResponses && (
        <Box>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            Named responses ({summary.namedResponses.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Only respondents who chose to submit with their name. The leader never sees these.
          </Typography>
          {summary.namedResponses.map((response) => (
            <Accordion key={response.respondentEmail} disableGutters>
              <AccordionSummary>{response.respondentEmail}</AccordionSummary>
              <AccordionDetails>
                <Stack spacing={0.5}>
                  {Object.entries(response.answers).map(([questionId, answer]) => (
                    <Typography key={questionId} variant="body2">
                      <strong>{questionText.get(questionId) ?? questionId}:</strong> {String(answer)}
                    </Typography>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Stack>
  );
}

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

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  resultsSurveys,
  useCurrentLeadership360Survey,
  useLeadership360Leaders,
  useLeadership360Results,
  useLeadership360Surveys,
  useMyLeadership360Feedback,
} from "../api/useLeadership360";
import type { Leadership360CurrentSurvey, Leadership360Leader } from "../api/leadership360Types";
import Leadership360FeedbackDialog from "../components/Leadership360FeedbackDialog";
import Leadership360SummaryDialog from "../components/Leadership360SummaryDialog";
import { formatShortDate } from "../util/parDate";

// Me → Performance → Leadership 360°: give feedback on members of the
// leadership group while a survey is open, and — for leaders — read your own
// results once a survey has closed.
export default function ParLeadership360Tab() {
  return (
    <Stack spacing={3}>
      <GiveFeedbackSection />
      <MyResultsSection />
    </Stack>
  );
}

function GiveFeedbackSection() {
  const current = useCurrentLeadership360Survey();

  if (current.isLoading) return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  if (current.isError) {
    return (
      <ErrorNotice error={current.error} onRetry={() => current.refetch()} retrying={current.isFetching}>
        Couldn't check for an open Leadership 360° survey.
      </ErrorNotice>
    );
  }
  if (!current.data) {
    return <Alert severity="info">No Leadership 360° survey is open right now.</Alert>;
  }
  return <OpenSurvey current={current.data} />;
}

function OpenSurvey({ current }: { current: Leadership360CurrentSurvey }) {
  const surveyId = current.survey.surveyId;
  const leaders = useLeadership360Leaders();
  const mine = useMyLeadership360Feedback(surveyId);
  const [selected, setSelected] = useState<Leadership360Leader | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const leaderByEmail = useMemo(
    () => new Map((leaders.data ?? []).map((l) => [l.workEmail.toLowerCase(), l])),
    [leaders.data],
  );
  const submitted = new Set((mine.data?.submittedLeaderEmails ?? []).map((e) => e.toLowerCase()));
  const drafts = new Map((mine.data?.drafts ?? []).map((d) => [d.leaderEmail.toLowerCase(), d]));
  const available = (leaders.data ?? []).filter((l) => !submitted.has(l.workEmail.toLowerCase()));

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2">
          Give leadership feedback
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {current.survey.surveyName} is open until {formatShortDate(current.survey.endDate)}. Anyone who has worked
          with a member of the leadership group can give feedback, one form per leader. Responses are anonymous unless
          you choose otherwise, and leaders see only a summary after the survey closes.
        </Typography>

        {submittedName && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSubmittedName(null)}>
            Your feedback on {submittedName} was submitted.
          </Alert>
        )}

        {leaders.isError || mine.isError ? (
          <ErrorNotice
            error={leaders.error ?? mine.error}
            onRetry={() => {
              void leaders.refetch();
              void mine.refetch();
            }}
          >
            Couldn't load the leaders.
          </ErrorNotice>
        ) : (
          <Autocomplete
            options={available}
            loading={leaders.isLoading || mine.isLoading}
            getOptionLabel={(l) => l.employeeName}
            renderOption={(props, l) => (
              <li {...props} key={l.workEmail}>
                <Box>
                  <Typography variant="body2">{l.employeeName}</Typography>
                  {l.jobRole && (
                    <Typography variant="caption" color="text.secondary">
                      {l.jobRole}
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            value={null}
            onChange={(_, leader) => setSelected(leader)}
            renderInput={(params) => <TextField {...params} label="Choose a leader" />}
            sx={{ maxWidth: 480 }}
          />
        )}

        {(drafts.size > 0 || submitted.size > 0) && (
          <Stack spacing={1} sx={{ mt: 2.5 }}>
            <Typography variant="subtitle2">Your feedback</Typography>
            {[...drafts.values()].map((d) => {
              const leader = leaderByEmail.get(d.leaderEmail.toLowerCase());
              return (
                <Box key={d.leaderEmail} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography variant="body2">{leader?.employeeName ?? d.leaderEmail}</Typography>
                  <Chip label="Draft" size="small" />
                  {leader && (
                    <Button size="small" onClick={() => setSelected(leader)}>
                      Continue
                    </Button>
                  )}
                </Box>
              );
            })}
            {[...submitted].map((email) => (
              <Box key={email} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography variant="body2">{leaderByEmail.get(email)?.employeeName ?? email}</Typography>
                <Chip label="Submitted" size="small" color="success" variant="outlined" />
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>

      {selected && (
        <Leadership360FeedbackDialog
          key={selected.workEmail}
          open
          onClose={() => setSelected(null)}
          survey={current}
          leader={selected}
          draft={drafts.get(selected.workEmail.toLowerCase())}
          onSubmitted={(leader) => setSubmittedName(leader.employeeName)}
        />
      )}
    </Card>
  );
}

// Your own results, for members of the leadership group. Other leaders'
// results never show under Me: managers read their reports' in the Lead
// View, PAR admins everyone's in the Admin View.
function MyResultsSection() {
  const surveys = useLeadership360Surveys();
  const { started, defaultSurveyId } = resultsSurveys(surveys.data);
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const surveyId = chosen ?? defaultSurveyId;
  const results = useLeadership360Results(surveyId, "SELF");
  const [viewing, setViewing] = useState(false);
  const mine = results.data?.[0];

  // Most people aren't in the leadership group: nothing to show, so no section.
  if (!mine || surveyId === undefined) return null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1 }}>
          <Typography variant="h6" component="h2">
            Your Leadership 360° results
          </Typography>
          {started.length > 1 && (
            <Select size="small" value={surveyId} onChange={(e) => setChosen(Number(e.target.value))}>
              {started.map((s) => (
                <MenuItem key={s.surveyId} value={s.surveyId}>
                  {s.surveyName}
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Your results appear after the survey closes, and only when 3 or more people have responded.
        </Typography>
        {mine.available ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2">{mine.responseCount} responses</Typography>
            <Button size="small" variant="outlined" onClick={() => setViewing(true)}>
              View results
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Not available yet
          </Typography>
        )}
      </CardContent>
      {viewing && (
        <Leadership360SummaryDialog
          open
          onClose={() => setViewing(false)}
          surveyId={surveyId}
          view="SELF"
          leader={mine.leader}
        />
      )}
    </Card>
  );
}

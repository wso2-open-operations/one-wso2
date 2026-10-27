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

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { resultsSurveys, useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import type { Leadership360Leader } from "../api/leadership360Types";
import Leadership360SummaryDialog from "../components/Leadership360SummaryDialog";

// Lead View → Leadership 360°: results for the members of the leadership
// group who report to you. As their manager you also see named responses;
// anonymous ones only ever count towards the averages.
export default function ParLeadLeadership360Tab() {
  const surveys = useLeadership360Surveys();
  const { started, defaultSurveyId } = resultsSurveys(surveys.data);
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const surveyId = chosen ?? defaultSurveyId;
  const results = useLeadership360Results(surveyId, "REPORTS");
  const [viewing, setViewing] = useState<Leadership360Leader | null>(null);

  if (surveys.isLoading || results.isLoading) {
    return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  }
  if (surveys.isError || results.isError) {
    return (
      <ErrorNotice
        error={surveys.error ?? results.error}
        onRetry={() => {
          void surveys.refetch();
          void results.refetch();
        }}
      >
        Couldn't load Leadership 360° results.
      </ErrorNotice>
    );
  }
  if (surveyId === undefined) {
    return <Alert severity="info">No Leadership 360° survey has started yet.</Alert>;
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1 }}>
          <Typography variant="h6" component="h2">
            Leaders who report to you
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
          Results appear after the survey closes, and only for leaders with 3 or more responses.
        </Typography>
        {(results.data ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            None of the leadership group report to you.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Leader</TableCell>
                <TableCell align="right">Responses</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(results.data ?? []).map((entry) => (
                <TableRow key={entry.leader.workEmail}>
                  <TableCell>{entry.leader.employeeName}</TableCell>
                  {/* No count while the survey is open (see Leadership360ResultsEntry). */}
                  <TableCell align="right">{entry.responseCount ?? "—"}</TableCell>
                  <TableCell align="right">
                    {entry.available ? (
                      <Button size="small" onClick={() => setViewing(entry.leader)}>
                        View results
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not available yet
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {viewing && (
        <Leadership360SummaryDialog
          open
          onClose={() => setViewing(null)}
          surveyId={surveyId}
          view="REPORTS"
          leader={viewing}
        />
      )}
    </Card>
  );
}

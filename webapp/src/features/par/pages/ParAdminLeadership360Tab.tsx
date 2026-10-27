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
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeadership360Results, useLeadership360Surveys, useSaveLeadership360Survey } from "../api/useLeadership360";
import type { Leadership360Leader, Leadership360Survey, Leadership360SurveyStatus } from "../api/leadership360Types";
import Leadership360SummaryDialog from "../components/Leadership360SummaryDialog";
import { formatShortDate } from "../util/parDate";

const STATUS_CHIP: Record<Leadership360SurveyStatus, { label: string; color: "default" | "success" | "info" }> = {
  UPCOMING: { label: "Upcoming", color: "info" },
  OPEN: { label: "Open", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
};

// PAR Admin View → Leadership 360°: run the survey windows and read every
// leader's results, including named responses and the relationship breakdown.
export default function ParAdminLeadership360Tab() {
  const surveys = useLeadership360Surveys();
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState<Leadership360Survey | "new" | null>(null);

  const list = surveys.data ?? [];
  const surveyId = chosen ?? (list.find((s) => s.status === "OPEN") ?? list[0])?.surveyId;

  if (surveys.isLoading) return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  if (surveys.isError) {
    return (
      <ErrorNotice error={surveys.error} onRetry={() => surveys.refetch()} retrying={surveys.isFetching}>
        Couldn't load the Leadership 360° surveys.
      </ErrorNotice>
    );
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" component="h2">
              Surveys
            </Typography>
            <Button size="small" variant="contained" onClick={() => setEditing("new")}>
              New survey
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            While a survey is open, anyone can give feedback on members of the leadership group. Leaders see a summary
            after it closes, and only with 3 or more responses.
          </Typography>
          {list.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No surveys yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.surveyId} selected={s.surveyId === surveyId} hover onClick={() => setChosen(s.surveyId)}>
                    <TableCell>{s.surveyName}</TableCell>
                    <TableCell>
                      {formatShortDate(s.startDate)} – {formatShortDate(s.endDate)}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_CHIP[s.status].label} color={STATUS_CHIP[s.status].color} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(s);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {surveyId !== undefined && <SurveyResponses surveyId={surveyId} />}

      {editing && (
        <SurveyDialog survey={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </Stack>
  );
}

function SurveyResponses({ surveyId }: { surveyId: number }) {
  const results = useLeadership360Results(surveyId, "ALL");
  const [viewing, setViewing] = useState<Leadership360Leader | null>(null);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Responses by leader
        </Typography>
        {results.isLoading ? (
          <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1 }} />
        ) : results.isError ? (
          <ErrorNotice error={results.error} onRetry={() => results.refetch()} retrying={results.isFetching}>
            Couldn't load the responses.
          </ErrorNotice>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Leader</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Responses</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(results.data ?? []).map((entry) => (
                <TableRow key={entry.leader.workEmail}>
                  <TableCell>{entry.leader.employeeName}</TableCell>
                  <TableCell>{entry.leader.jobRole ?? "—"}</TableCell>
                  <TableCell align="right">{entry.responseCount}</TableCell>
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
          view="ALL"
          leader={viewing}
        />
      )}
    </Card>
  );
}

function SurveyDialog({ survey, onClose }: { survey?: Leadership360Survey; onClose: () => void }) {
  const save = useSaveLeadership360Survey(survey?.surveyId);
  const [surveyName, setSurveyName] = useState(survey?.surveyName ?? "");
  const [startDate, setStartDate] = useState(survey?.startDate ?? "");
  const [endDate, setEndDate] = useState(survey?.endDate ?? "");
  const canSave = surveyName.trim() !== "" && startDate !== "" && endDate !== "" && startDate <= endDate;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{survey ? "Edit survey" : "New survey"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={surveyName} onChange={(e) => setSurveyName(e.target.value)} fullWidth />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Opens"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Closes"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            The survey uses the newest Leadership 360° form. Survey dates can't overlap.
          </Typography>
          {save.isError && <ErrorNotice error={save.error}>Couldn't save the survey.</ErrorNotice>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!canSave || save.isPending}
          onClick={() => save.mutate({ surveyName: surveyName.trim(), startDate, endDate }, { onSuccess: onClose })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

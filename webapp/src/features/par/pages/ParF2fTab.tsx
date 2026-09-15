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
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatDate } from "@features/my/api/derive";
import { useActiveParCycle, useParRating } from "../api/useParData";
import { useSaveParRating } from "../api/useParMutations";
import { isDeadlinePassed } from "../util/parDeadline";
import ParScheduleF2fDialog from "../components/ParScheduleF2fDialog";
import ParDateField from "../components/ParDateField";

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// People Ops → Performance → F2F: par-app's F2fPanel.tsx, employee view
// (isEmployeeView=true — the lead-facing render of the same component
// belongs with the Lead Portal work, not here). Only shown to employees
// who have a lead (OngoingCycleView.tsx's leadless branch has no F2F tab
// at all) — see ParGroupPage.tsx.
export default function ParF2fTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const rating = useParRating(cycle?.parCycleId, workEmail);
  const save = useSaveParRating(cycle?.parCycleId, workEmail);
  const { showSuccess, showError } = useNotifications();

  const [completedDate, setCompletedDate] = useState("");
  const [dateTouched, setDateTouched] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  if (activeCycles.isLoading || profile.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  }
  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load your PAR record for this cycle.
      </ErrorNotice>
    );
  }
  if (!rating.data) {
    return <Alert severity="info">Your record for this cycle isn't ready yet — check back shortly.</Alert>;
  }

  const parRating = rating.data;
  const deadlinePassed = isDeadlinePassed(cycle.parF2FDeadline);
  const leadShared = parRating.parLeadStatus === "SHARED";
  const status = parRating.parF2fStatus;
  const completed = status === "COMPLETED";
  const showForm = !completed && !deadlinePassed;

  const handleMarkCompleted = () => {
    if (!completedDate) {
      setDateTouched(true);
      return;
    }
    save.mutate(
      { parRatingId: parRating.parRatingId, parF2fStatus: "COMPLETED", parF2fDate: completedDate },
      {
        onSuccess: () => showSuccess("Successfully updated the F2F status"),
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Box sx={{ pt: 0.5 }}>
      <Stack spacing={1.75} sx={{ maxWidth: 1100 }}>
        {/* F2fPanel.tsx's five alerts — independent conditions, not an
            if/else chain, so more than one can show at once (e.g. SCHEDULED
            and not-yet-lead-shared both render together). Matches source. */}
        {!deadlinePassed && status === "SCHEDULED" && (
          <Alert severity="success">F2F meeting is scheduled</Alert>
        )}
        {deadlinePassed && !completed && (
          <Alert severity="error">
            The deadline for updating the F2F has passed on {formatDate(cycle.parF2FDeadline)}.
          </Alert>
        )}
        {!deadlinePassed && !completed && (
          <Alert severity="info">
            Please complete your F2F meeting before the deadline: {formatDate(cycle.parF2FDeadline)}.
          </Alert>
        )}
        {!leadShared && !deadlinePassed && (
          <Alert severity="info">Lead's feedback must be completed to update F2F status</Alert>
        )}
        {completed && parRating.parF2fDate && (
          <Alert severity="success">F2F completed on {formatDate(parRating.parF2fDate)}</Alert>
        )}

        {showForm && (
          <>
            {/* F2fPanel.tsx's own renderF2fDatePicker: label at width:"20%",
                the field itself fullWidth — it fills the rest of the row,
                not a small fixed box. */}
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: 2 }}>
              <Typography sx={{ fontWeight: 500, width: { sm: "20%" } }}>F2F Completed Date:</Typography>
              <ParDateField
                value={completedDate}
                min={cycle.parCycleStartDate}
                max={todayDateOnly()}
                disabled={!leadShared}
                error={dateTouched && !completedDate}
                helperText={dateTouched && !completedDate ? "Required" : undefined}
                ariaLabel="F2F completed date"
                fullWidth
                onChange={(v) => {
                  setCompletedDate(v);
                  setDateTouched(false);
                }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
              {status === "PENDING" && (
                <Button variant="outlined" disabled={!leadShared} onClick={() => setScheduleOpen(true)}>
                  Schedule Google Meet
                </Button>
              )}
              <Button
                variant="contained"
                disabled={!leadShared || save.isPending}
                onClick={handleMarkCompleted}
              >
                {save.isPending ? "Saving…" : "Mark as completed"}
              </Button>
            </Box>
          </>
        )}
      </Stack>

      <ParScheduleF2fDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        parCycleId={cycle.parCycleId}
        parRatingId={parRating.parRatingId}
        workEmail={workEmail}
      />
    </Box>
  );
}

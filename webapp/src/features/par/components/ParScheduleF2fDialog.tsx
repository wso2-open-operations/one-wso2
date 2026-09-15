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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ParDateField from "./ParDateField";
import { useCalendarBusyTimes, useScheduleF2fMeeting } from "../api/useParCalendar";
import { generateAvailableTimeSlots } from "../util/parF2fSlots";

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// par-app's ScheduleF2F.tsx (MeetingSchedulerPage): pick a date, check the
// caller's and their lead's Google Calendar availability, pick a free
// half-hour slot, fill a title/description, create the event. Source closes
// the dialog immediately on success and relies on a snackbar toast for
// confirmation — its in-dialog Meet-link panel never actually gets seen
// (and couldn't populate anyway; the backend returns no body). Ported the
// same way: toast, then close.
export default function ParScheduleF2fDialog({
  open,
  onClose,
  parCycleId,
  parRatingId,
  workEmail,
}: {
  open: boolean;
  onClose: () => void;
  parCycleId: number | undefined;
  parRatingId: number;
  workEmail: string | undefined;
}) {
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState("");
  const { showSuccess } = useNotifications();

  const busyTimes = useCalendarBusyTimes(date || undefined);
  const schedule = useScheduleF2fMeeting(parCycleId, workEmail);

  const slots = busyTimes.data ? generateAvailableTimeSlots(date, busyTimes.data) : [];

  const handleClose = () => {
    setDate("");
    setSelectedSlot("");
    setTitle("");
    setDescription("");
    setValidationError("");
    onClose();
  };

  const handleDateChange = (v: string) => {
    setDate(v);
    setSelectedSlot("");
  };

  const handleSchedule = () => {
    if (!title.trim()) {
      setValidationError("Please enter a meeting title");
      return;
    }
    if (!selectedSlot) {
      setValidationError("Please select a time slot");
      return;
    }
    setValidationError("");
    const [startTime, endTime] = selectedSlot.split("|");
    schedule.mutate(
      { parRatingId, title, description, startTime, endTime, date },
      {
        // ScheduleF2F.tsx's own useEffect on RequestState.SUCCEEDED — closes
        // immediately, same tick, rather than holding a confirmation screen.
        onSuccess: () => {
          showSuccess("F2F scheduled successfully");
          handleClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 2 }}>Schedule a Google Meet</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {/* ScheduleF2F.tsx's own DatePicker: a real floating "Select Date"
              label on the field itself, not a caption above it. */}
          <ParDateField
            label="Select date"
            fullWidth
            value={date}
            min={todayDateOnly()}
            ariaLabel="Select date"
            onChange={handleDateChange}
          />

          {busyTimes.isLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Checking availability…
              </Typography>
            </Box>
          )}
          {busyTimes.isError && (
            <Alert severity="error">Failed to check calendar availability. Please try again.</Alert>
          )}

          {date && !busyTimes.isLoading && !busyTimes.isError && slots.length === 0 && (
            <Alert severity="info">
              No available time slots found. Both participants might be busy on this date.
            </Alert>
          )}

          {slots.length > 0 && (
            <TextField
              select
              label="Select a time slot"
              size="small"
              fullWidth
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
            >
              {slots.map((slot) => (
                <MenuItem key={slot.start} value={`${slot.start}|${slot.end}`}>
                  {slot.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          {selectedSlot && (
            <>
              <TextField
                label="Meeting title"
                size="small"
                fullWidth
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <TextField
                label="Description"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </>
          )}

          {validationError && <Alert severity="error">{validationError}</Alert>}
          {schedule.isError && <Alert severity="error">{describeError(schedule.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selectedSlot || !title.trim() || schedule.isPending}
          onClick={handleSchedule}
        >
          {schedule.isPending ? "Scheduling…" : "Schedule Meeting"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

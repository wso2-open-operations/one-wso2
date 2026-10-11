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

import { useMemo } from "react";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ListPlusIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParticipants, useOfferToReview } from "../api/usePar360";
import type { ParParticipant } from "../api/types";

// "Voluntary Feedback" — offering a review to a colleague who didn't ask for
// one. par-app's OfferFeedbackView.tsx: pick anyone in the org (minus
// yourself and anyone who's already asked you), confirm, then the same
// POST .../reviewers endpoint Request 360° Feedback uses, just with the
// picker's target and your own email as the sole reviewer.
//
// Split into a bare picker (no Dialog chrome — ParProvideFeedbackTab.tsx
// renders it inline instead of behind a Fab) and the confirmation step,
// which stays a Dialog: it's a genuine "are you sure, this can't be undone"
// prompt, not the add-flow the FAB was replaced for.
export function Par360OfferPicker({
  open,
  parCycleId,
  selfEmail,
  excludeEmails,
  onSelect,
}: {
  /** Gates `useParticipants` the same way the Dialog's own `open` did. */
  open: boolean;
  parCycleId: number;
  selfEmail: string | undefined;
  /** Already asked you (or you're already offering to) — excluded from the picker. */
  excludeEmails: string[];
  onSelect: (participant: ParParticipant) => void;
}) {
  const participants = useParticipants(parCycleId, open);

  const options = useMemo(
    () =>
      (participants.data ?? []).filter(
        (e) => e.workEmail !== selfEmail && !excludeEmails.includes(e.workEmail),
      ),
    [participants.data, selfEmail, excludeEmails],
  );

  return (
    <Autocomplete
      options={options}
      value={null}
      blurOnSelect
      getOptionLabel={(o) => `${o.employeeName} (${o.workEmail})`}
      loading={participants.isLoading}
      onChange={(_e, v) => {
        if (v) onSelect(v);
      }}
      // OfferFeedbackView.tsx's own row: an avatar, name over email,
      // and a "Provide Feedback" icon-button at the end.
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
          <Avatar sx={{ height: "2.2rem", width: "2.2rem" }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1">{option.employeeName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {option.workEmail}
            </Typography>
          </Box>
          <Tooltip title="Provide Feedback" arrow>
            <IconButton
              size="small"
              sx={{ ml: "auto", color: "primary.main", "&:hover": { bgcolor: "primary.main", color: "white" } }}
            >
              <ListPlusIcon size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          autoFocus
          label="Add subordinates to offer feedback"
          placeholder="Search by name or email"
        />
      )}
      noOptionsText={participants.isError ? "Couldn't load colleagues" : "No colleagues found"}
    />
  );
}

// OfferFeedbackView.tsx's ConfirmationDialog — title "Provide Feedback" (not
// a question), and "would like" rather than a contraction.
export function Par360OfferConfirmDialog({
  open,
  employee,
  parCycleId,
  selfEmail,
  onClose,
  onOffered,
}: {
  open: boolean;
  employee: ParParticipant | undefined;
  parCycleId: number;
  selfEmail: string | undefined;
  onClose: () => void;
  /** Called with the employee's email once the offer is recorded. */
  onOffered: (employeeEmail: string) => void;
}) {
  const offer = useOfferToReview(parCycleId, selfEmail);
  const { showError } = useNotifications();

  const handleClose = () => {
    offer.reset();
    onClose();
  };

  const handleConfirm = () => {
    if (!employee) return;
    offer.mutate(employee.workEmail, {
      onSuccess: () => {
        const email = employee.workEmail;
        onClose();
        onOffered(email);
      },
      onError: (err) => {
        showError(describeError(err));
        handleClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md">
      <DialogTitle>Provide Feedback</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Are you sure you would like to provide feedback to {employee?.workEmail}? This action
          cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={offer.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={offer.isPending}>
          {offer.isPending ? "Offering…" : "Yes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

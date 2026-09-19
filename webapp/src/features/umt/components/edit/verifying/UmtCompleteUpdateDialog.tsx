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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtUpdateSummary } from "../../../api/umtUpdates";
import { useUmtCompleteUpdate } from "../../../api/useUmtVerifying";
import { isCompleteUpdateValid } from "../../../lib/umtVerifying";

// Existing public PRs are shown disabled, new ones can be appended, and the
// update completes with either at least one non-blank PR or a reason to
// skip one — never both. This is the only way an update ever reaches
// Completed.
export default function UmtCompleteUpdateDialog({
  id,
  update,
  open,
  onClose,
}: {
  id: string;
  update: UmtUpdateSummary;
  open: boolean;
  onClose: () => void;
}) {
  const { showSuccess, showError } = useNotifications();
  const completeUpdate = useUmtCompleteUpdate(id);
  const existingPullRequests = update.publicPullRequests ?? [];
  const [newPullRequests, setNewPullRequests] = useState<string[]>([""]);
  const [reason, setReason] = useState("");

  function resetAndClose() {
    setNewPullRequests([""]);
    setReason("");
    onClose();
  }

  const allPullRequests = [...existingPullRequests, ...newPullRequests];
  const trimmedPullRequests = allPullRequests.map((pr) => pr.trim()).filter((pr) => pr !== "");
  const isValid = isCompleteUpdateValid({ publicPullRequests: allPullRequests, reason });

  async function handleSubmit() {
    try {
      await completeUpdate.mutateAsync({
        publicPullRequests: trimmedPullRequests,
        reason: reason.trim(),
      });
      showSuccess(`Update ${id} completed.`);
      resetAndClose();
    } catch (error) {
      showError(`Failed to complete update. ${describeError(error)}`);
    }
  }

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="sm">
      <DialogTitle>Complete Update</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Provide a public pull request for this update, or a reason to complete it without one — not
            both.
          </Typography>

          {existingPullRequests.map((pr, index) => (
            <TextField key={`existing-${index}`} label="Public Pull Request" value={pr} disabled fullWidth />
          ))}

          {newPullRequests.map((pr, index) => (
            <Stack key={`new-${index}`} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <TextField
                label="Public Pull Request"
                value={pr}
                onChange={(event) =>
                  setNewPullRequests((prev) =>
                    prev.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
                fullWidth
              />
              {newPullRequests.length > 1 && (
                <IconButton
                  aria-label="Remove pull request"
                  size="small"
                  onClick={() => setNewPullRequests((prev) => prev.filter((_, i) => i !== index))}
                >
                  <TrashIcon size={16} />
                </IconButton>
              )}
            </Stack>
          ))}

          <Button
            variant="outlined"
            size="small"
            startIcon={<PlusIcon size={16} />}
            sx={{ alignSelf: "flex-start" }}
            onClick={() => setNewPullRequests((prev) => [...prev, ""])}
          >
            Add Another Pull Request
          </Button>

          <TextField
            label="Reason to Skip"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!isValid}
          loading={completeUpdate.isPending}
          onClick={() => void handleSubmit()}
        >
          Save and Complete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

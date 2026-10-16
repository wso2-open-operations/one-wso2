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

import { useRef, useState } from "react";
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

interface NewPullRequestRow {
  id: string;
  value: string;
}
import { isCompleteUpdateValid } from "../../../lib/umtVerifying";

// Existing public PRs are shown disabled, new ones can be appended, and the
// update completes with either at least one non-blank PR or a reason to
// skip one — never both, so typing into one side disables the other. This
// is the only way an update ever reaches Completed.
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
  // Rows carry a stable id so removing one from the middle doesn't reassign the
  // React keys of the rows below it, which would move focus and caret position
  // onto a different row's input. Counter ref rather than crypto.randomUUID()
  // to match nextBundleEntryId in UmtAddManualFilesSection and avoid the
  // secure-context dependency for what is only a key.
  const nextRowId = useRef(1);
  const [newPullRequests, setNewPullRequests] = useState<NewPullRequestRow[]>([
    { id: "new-0", value: "" },
  ]);
  const [reason, setReason] = useState("");

  function resetAndClose() {
    nextRowId.current = 1;
    setNewPullRequests([{ id: "new-0", value: "" }]);
    setReason("");
    onClose();
  }

  const allPullRequests = [...existingPullRequests, ...newPullRequests.map((row) => row.value)];
  const trimmedPullRequests = allPullRequests.map((pr) => pr.trim()).filter((pr) => pr !== "");
  const isValid = isCompleteUpdateValid({ publicPullRequests: allPullRequests, reason });
  const hasPullRequestText = trimmedPullRequests.length > 0;
  const hasReasonText = reason.trim() !== "";

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

          {newPullRequests.map((row) => (
            <Stack key={row.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <TextField
                label="Public Pull Request"
                value={row.value}
                onChange={(event) =>
                  setNewPullRequests((prev) =>
                    prev.map((current) =>
                      current.id === row.id ? { ...current, value: event.target.value } : current,
                    ),
                  )
                }
                disabled={hasReasonText}
                fullWidth
              />
              {newPullRequests.length > 1 && (
                <IconButton
                  aria-label="Remove pull request"
                  size="small"
                  disabled={hasReasonText}
                  onClick={() =>
                    setNewPullRequests((prev) => prev.filter((current) => current.id !== row.id))
                  }
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
            disabled={hasReasonText}
            onClick={() =>
              setNewPullRequests((prev) => [
                ...prev,
                { id: `new-${nextRowId.current++}`, value: "" },
              ])
            }
          >
            Add Another Pull Request
          </Button>

          <TextField
            label="Reason to Skip"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={hasPullRequestText}
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

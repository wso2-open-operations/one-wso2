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
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { ExternalShare } from "../api/amplifyTypes";
import { useDeclineExternalShare } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";
import {
  DECLINE_REASONS,
  declineMessageMaxLength,
  declineReasonText,
  type DeclineReason,
} from "../util/ownPosts";

/**
 * Declines a waiting own post. A reason chip is required; the optional message follows it after " — " in the
 * reason amplify-api stores, which the employee sees.
 */
export default function DeclineOwnPostDialog({
  share,
  submitterName,
  onClose,
  onDeclined,
}: {
  share: ExternalShare;
  /** Who sent the post, for the title. */
  submitterName: string;
  /** Closes the dialog: after Cancel, and after a decline went through. */
  onClose: () => void;
  /** Called once the decline went through, before `onClose`. */
  onDeclined?: () => void;
}) {
  const decline = useDeclineExternalShare();
  const { showError, showSuccess } = useNotifications();
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [message, setMessage] = useState("");
  const busy = decline.isPending;
  const messageMax = declineMessageMaxLength(reason ?? DECLINE_REASONS[0]);

  const confirm = () => {
    if (!reason || busy) return;
    decline.mutate(
      { id: share.id, reason: declineReasonText(reason, message.slice(0, messageMax)) },
      {
        onSuccess: () => {
          showSuccess("Post declined.");
          onDeclined?.();
          onClose();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Decline {submitterName}&apos;s post</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box role="radiogroup" aria-label="Reason" aria-required="true">
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Reason
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {DECLINE_REASONS.map((r) => (
                <Chip
                  key={r}
                  role="radio"
                  aria-checked={reason === r}
                  label={r}
                  color={reason === r ? "primary" : "default"}
                  variant={reason === r ? "filled" : "outlined"}
                  onClick={() => setReason(r)}
                  disabled={busy}
                />
              ))}
            </Box>
          </Box>
          <TextField
            label="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            disabled={busy}
            helperText={`The person sees the reason and your message. ${message.length} / ${messageMax}`}
            slotProps={{ htmlInput: { maxLength: messageMax } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={!reason || busy}>
          {busy ? "Declining…" : "Decline"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

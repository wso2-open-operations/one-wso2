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
import { Box, Button, FormControlLabel, Radio, RadioGroup, TextField, Typography } from "@wso2/oxygen-ui";
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
import { AMPLIFY_RADIUS } from "../util/radius";

/**
 * "Decline this post", inside the post's card: a reason is required; the optional message to the person follows it
 * after " — " in the reason amplify-api stores, which the employee sees.
 */
export default function DeclineOwnPostForm({
  share,
  firstName,
  onClose,
  onDeclined,
}: {
  share: ExternalShare;
  /** The sender's first name, for "Message to Ayesha". Null when unknown. */
  firstName: string | null;
  /** Closes the form: after Cancel, and after a decline went through. */
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
  const messageId = `decline-message-${share.id}`;

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
    <Box
      component="fieldset"
      disabled={busy}
      sx={{ border: "1px solid", borderColor: "error.light", borderRadius: AMPLIFY_RADIUS, px: 2.5, pt: 1, pb: 2.5, m: 0, mt: 2, minWidth: 0 }}
    >
      <Typography component="legend" sx={{ px: 0.75, color: "error.main", fontWeight: 700, fontSize: 15 }}>
        Decline this post
      </Typography>
      <RadioGroup
        row
        aria-label="Reason"
        value={reason ?? ""}
        onChange={(e) => setReason(e.target.value as DeclineReason)}
        sx={{ gap: 1, mb: 1.5 }}
      >
        {DECLINE_REASONS.map((r) => (
          <FormControlLabel
            key={r}
            value={r}
            label={r}
            control={<Radio size="small" />}
            sx={{
              m: 0,
              pr: 1.5,
              border: "1px solid",
              borderColor: reason === r ? "primary.main" : "divider",
              borderRadius: 999,
            }}
          />
        ))}
      </RadioGroup>
      <Typography component="label" htmlFor={messageId} variant="body2" sx={{ display: "block", mb: 0.75 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          {firstName ? `Message to ${firstName}` : "Message"}
        </Box>{" "}
        <Box component="span" sx={{ color: "text.secondary" }}>
          (optional)
        </Box>
      </Typography>
      <TextField
        id={messageId}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        fullWidth
        disabled={busy}
        slotProps={{ htmlInput: { maxLength: messageMax } }}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={!reason || busy}>
          {busy ? "Declining…" : "Decline with reason"}
        </Button>
      </Box>
    </Box>
  );
}

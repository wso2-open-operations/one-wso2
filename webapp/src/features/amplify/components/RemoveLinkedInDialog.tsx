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

import { Box, Button, Dialog, DialogContent, Typography } from "@wso2/oxygen-ui";
import { LinkedinIcon } from "@wso2/oxygen-ui-icons-react";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useRemoveLinkedInConnection } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";

/**
 * "Remove LinkedIn connection" confirmation (Settings > My Connections).
 *
 * Amplify revokes the token at LinkedIn and then deletes its saved link, so it can't post for the employee any
 * more. If LinkedIn can't confirm, amplify-api keeps the link and answers 503 (shown as an error here). Posts
 * already shared stay on LinkedIn. Linking again is one click from the same card.
 */
export default function RemoveLinkedInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const remove = useRemoveLinkedInConnection();
  const { showError, showSuccess } = useNotifications();

  const confirm = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        showSuccess("Your LinkedIn connection was removed.");
        onClose();
      },
      onError: (err) => showError(describeAmplifyError(err)),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={remove.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { ...dialogPaperSx, borderColor: "primary.main" } } }}
      aria-labelledby="amplify-remove-title"
    >
      <DialogContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
          <Box sx={{ color: "primary.main", display: "flex" }}>
            <LinkedinIcon size={22} aria-hidden />
          </Box>
          <Typography id="amplify-remove-title" component="h2" sx={{ fontWeight: 700 }}>
            Remove LinkedIn connection
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Amplify will end its access to your LinkedIn account and delete its saved link and the token it uses to post
          for you. Posts you already shared stay on LinkedIn. You can link your account again at any time.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          If LinkedIn can&apos;t be reached, nothing is removed and you can try again.
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="contained" color="error" onClick={confirm} disabled={remove.isPending}>
            {remove.isPending ? "Removing…" : "Remove connection"}
          </Button>
          <Button onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

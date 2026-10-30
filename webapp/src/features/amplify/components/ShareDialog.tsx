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

import { useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, TextField } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Campaign } from "../api/amplifyTypes";
import { useAmplifyCategories } from "../api/useAmplifyData";
import { useRequestShare } from "../api/useAmplifyMutations";
import PostCard, { CategoryChip, PriorityChip } from "./PostCard";
import { describeAmplifyError } from "../util/amplifyError";

// Matches the API cap (COMMENTARY_MAX_LENGTH). LinkedIn states no limit of its own; too long returns 400.
export const COMMENTARY_MAX_LENGTH = 3000;

/**
 * "Amplify, share this for me." A repost of WSO2's post on the employee's
 * LinkedIn. Text in "Add your thoughts" makes it a REPOST_COMMENTARY; empty
 * stays a plain REPOST. The repost is queued; the next Amplify run publishes it.
 */
export default function ShareDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const share = useRequestShare();
  const { showError, showSuccess } = useNotifications();
  const categories = useAmplifyCategories();
  const [thoughts, setThoughts] = useState("");

  const categoryLabel = useMemo(() => {
    const labels = new Map((categories.data ?? []).map((c) => [c.code, c.label]));
    return (code: string) => labels.get(code) ?? code;
  }, [categories.data]);

  const close = () => {
    setThoughts("");
    onClose();
  };

  const submit = () => {
    if (!campaign) return;
    const commentary = thoughts.trim();
    share.mutate(
      commentary ? { campaignId: campaign.id, kind: "REPOST_COMMENTARY", commentary } : { campaignId: campaign.id, kind: "REPOST" },
      {
        onSuccess: () => {
          showSuccess("Queued. It goes out on your LinkedIn with the next Amplify run.");
          close();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog
      open={campaign !== null}
      onClose={share.isPending ? undefined : close}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Amplify this post</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {campaign && (
            <PostCard
              campaign={campaign}
              chips={
                <>
                  {campaign.isPriority && <PriorityChip />}
                  <CategoryChip label={categoryLabel(campaign.categoryCode)} />
                </>
              }
            />
          )}
          <Divider />
          <TextField
            label="Add your thoughts (optional)"
            placeholder="Say why this matters to you. It shows above the repost on your LinkedIn."
            value={thoughts}
            onChange={(e) => setThoughts(e.target.value)}
            multiline
            minRows={3}
            maxRows={8}
            fullWidth
            disabled={share.isPending}
            helperText={`${thoughts.length} / ${COMMENTARY_MAX_LENGTH}`}
            slotProps={{ htmlInput: { maxLength: COMMENTARY_MAX_LENGTH } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button onClick={close} disabled={share.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={share.isPending}>
          {share.isPending ? "Sharing…" : "Amplify"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

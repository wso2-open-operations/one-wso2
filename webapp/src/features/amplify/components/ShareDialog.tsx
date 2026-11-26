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
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Campaign } from "../api/amplifyTypes";
import { useAmplifyCategories } from "../api/useAmplifyData";
import { useRequestShare } from "../api/useAmplifyMutations";
import PostCard, { CategoryChip, PriorityChip } from "./PostCard";
import CommentaryEditor from "./CommentaryEditor";
import { describeAmplifyError, needsLinkedInReconnect } from "../util/amplifyError";
import {
  COMMENTARY_MAX_LENGTH,
  MAX_MENTIONS,
  activeMentions,
  buildCommentary,
  linkedInLength,
  type TrackedMention,
} from "../util/linkedinMarkdown";

interface ShareDialogProps {
  campaign: Campaign | null;
  onClose: () => void;
  /** POST /shares said the LinkedIn link is broken: the page takes the employee to link it again. */
  onNeedsReconnect?: (campaign: Campaign) => void;
  "data-componentid"?: string;
}

// Amplify posts each person's shares one at a time, a few minutes apart (amplify-jobs pacing), so a share
// queued after others can take a while to appear on LinkedIn.
export const SHARE_QUEUED_MESSAGE =
  "Queued. Amplify posts your shares on LinkedIn one at a time, a few minutes apart, so this one may take a while.";

/**
 * "Amplify, share this for me." A repost of Choreo Labs' post on the employee's
 * LinkedIn. Text in "Add your thoughts" makes it a REPOST_COMMENTARY; empty
 * stays a plain REPOST. The repost is queued; the next Amplify run publishes it.
 *
 * The thoughts are markdown with `@` mentions; on send they become LinkedIn
 * text with mention tokens (`buildCommentary`). The text is never logged.
 */
export default function ShareDialog({
  campaign,
  onClose,
  onNeedsReconnect,
  "data-componentid": componentId = "amplify-share-dialog",
}: ShareDialogProps) {
  const share = useRequestShare();
  const { showError, showSuccess } = useNotifications();
  const categories = useAmplifyCategories();
  const [thoughts, setThoughts] = useState("");
  const [mentions, setMentions] = useState<TrackedMention[]>([]);

  const categoryLabel = useMemo(() => {
    const labels = new Map((categories.data ?? []).map((c) => [c.code, c.label]));
    return (code: string) => labels.get(code) ?? code;
  }, [categories.data]);

  const commentary = useMemo(() => buildCommentary(thoughts, mentions), [thoughts, mentions]);
  const tooLong = linkedInLength(commentary) > COMMENTARY_MAX_LENGTH;
  const tooManyMentions = activeMentions(thoughts, mentions).length > MAX_MENTIONS;

  const close = () => {
    setThoughts("");
    setMentions([]);
    onClose();
  };

  const submit = () => {
    if (!campaign || tooLong || tooManyMentions) return;
    share.mutate(
      commentary ? { campaignId: campaign.id, kind: "REPOST_COMMENTARY", commentary } : { campaignId: campaign.id, kind: "REPOST" },
      {
        onSuccess: () => {
          showSuccess(SHARE_QUEUED_MESSAGE);
          close();
        },
        onError: (err) => {
          if (needsLinkedInReconnect(err) && onNeedsReconnect) {
            close();
            onNeedsReconnect(campaign);
            return;
          }
          showError(describeAmplifyError(err));
        },
      },
    );
  };

  return (
    <Dialog
      open={campaign !== null}
      onClose={share.isPending ? undefined : close}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
      data-componentid={componentId}
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
          <CommentaryEditor
            value={thoughts}
            onChange={setThoughts}
            mentions={mentions}
            onMentionsChange={setMentions}
            disabled={share.isPending}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button onClick={close} disabled={share.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={share.isPending || tooLong || tooManyMentions}>
          {share.isPending ? "Sharing…" : "Amplify"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

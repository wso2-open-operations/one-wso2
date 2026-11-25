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

import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Campaign } from "../api/amplifyTypes";
import { usePointValues } from "../api/useAmplifyData";
import { useRequestShare } from "../api/useAmplifyMutations";
import { PostImage, postDate } from "./PostCard";
import { describeAmplifyError } from "../util/amplifyError";
import { OWN_WORDS_THRESHOLD, countOwnWords, ownWordsText } from "../util/ownWords";

export const COMMENTARY_MAX_LENGTH = 3000;

/** Points a repost with the employee's own thoughts earns at the default rule, until GET /point-values answers. */
export const WITH_THOUGHTS_POINTS = 5;

export const SHARE_QUEUED_MESSAGE =
  "Queued. Amplify posts your shares on LinkedIn one at a time, a few minutes apart, so this one may take a while.";

/** A dialog title with a close button on the right. */
export function ClosableDialogTitle({
  children,
  onClose,
  disabled,
}: {
  children: ReactNode;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <DialogTitle sx={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}>
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        {children}
      </Box>
      <IconButton aria-label="Close" onClick={onClose} disabled={disabled} size="small">
        <XIcon size={18} />
      </IconButton>
    </DialogTitle>
  );
}

/**
 * "Amplify this post": the post, then "Let Amplify post it for you", a repost of Choreo Labs' post on the employee's
 * LinkedIn. Text in "Add your thoughts" makes it a REPOST_COMMENTARY; empty stays a plain REPOST. Under the box a
 * counter shows how many of the employee's own words it holds toward the with-your-thoughts points. The repost is
 * queued; the next Amplify run publishes it.
 */
export default function ShareDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const share = useRequestShare();
  const { showError, showSuccess } = useNotifications();
  const values = usePointValues();
  const [thoughts, setThoughts] = useState("");
  const busy = share.isPending;
  const withThoughts = values.data?.REPOST_COMMENTARY ?? WITH_THOUGHTS_POINTS;
  const ownWords = campaign ? countOwnWords(thoughts, campaign) : 0;
  const enough = ownWords >= OWN_WORDS_THRESHOLD;

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
          showSuccess(SHARE_QUEUED_MESSAGE);
          close();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog
      open={campaign !== null}
      onClose={busy ? undefined : close}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <ClosableDialogTitle onClose={close} disabled={busy}>
        Amplify this post
      </ClosableDialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {campaign && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Box sx={{ width: 96, height: 54, flexShrink: 0, borderRadius: 1, overflow: "hidden", bgcolor: "common.black" }}>
                <PostImage url={campaign.imageUrl} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{campaign.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choreo Labs on LinkedIn · {postDate(campaign.opensAt)}
                </Typography>
              </Box>
            </Box>
          )}

          <Box
            component="section"
            aria-label="Let Amplify post it for you"
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}
          >
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16, mb: 0.75 }}>
              Let Amplify post it for you
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Amplify reposts it from your account. Posts are spaced out so LinkedIn sees a natural pace, so yours may
              take a little while to appear.
            </Typography>
            <Typography component="label" htmlFor="amplify-thoughts" variant="body2" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
              Add your thoughts (optional)
            </Typography>
            <TextField
              id="amplify-thoughts"
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              multiline
              minRows={3}
              maxRows={8}
              fullWidth
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: COMMENTARY_MAX_LENGTH, "aria-describedby": "amplify-thoughts-help amplify-own-words" } }}
            />
            <Typography id="amplify-thoughts-help" variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
              Say why it matters to you, in your own words. It shows above the repost.
            </Typography>
            <Typography
              id="amplify-own-words"
              role="status"
              variant="body2"
              sx={{ fontWeight: 700, mt: 1, color: enough ? "success.main" : "warning.dark" }}
            >
              {ownWordsText(ownWords, withThoughts)}
            </Typography>
            <Button variant="outlined" onClick={submit} disabled={busy || !campaign} sx={{ mt: 1.5 }}>
              {busy ? "Sharing…" : "Amplify, share this for me"}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={busy} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

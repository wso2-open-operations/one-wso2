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
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useClaimOwnPost } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";
import { isLinkedInShortLink, ownPostEvidenceUrl } from "../util/linkedinPost";
import { OWN_POST_APPROVED_POINTS, OWN_POST_FEATURE_TOP_UP, OWN_POST_NOTE_MAX_LENGTH } from "../util/ownPosts";

/** The toast after a post is sent for review. */
export const OWN_POST_SUBMITTED_MESSAGE = "Thanks! Your post is waiting for review.";

/** The line under the form on what happens after sending. */
export const OWN_POST_NEXT_STEPS =
  `It shows as Waiting for review until the PO team decides. Approved posts earn +${OWN_POST_APPROVED_POINTS} ` +
  `points, and +${OWN_POST_FEATURE_TOP_UP} more if featured.`;

const CERTIFY_LABEL = "I wrote this post myself, and it's about Choreo Labs.";

// Why a typed link can't be sent, or null when it can (or nothing is typed yet).
function linkProblem(link: string): string | null {
  const value = link.trim();
  if (!value || ownPostEvidenceUrl(value)) return null;
  if (isLinkedInShortLink(value)) return "Short lnkd.in links can't be checked. Open the post and copy its full link.";
  return "Paste the link to your LinkedIn post, like https://www.linkedin.com/posts/…";
}

/**
 * "Submit your own post": an employee sends the link to a LinkedIn post they wrote about Choreo Labs, with an
 * optional note for the reviewer, for the PO team to review (POST /external-shares).
 */
export default function SubmitOwnPostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const claim = useClaimOwnPost();
  const { showError, showSuccess } = useNotifications();
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [certified, setCertified] = useState(false);
  const [linkTouched, setLinkTouched] = useState(false);

  const evidenceUrl = ownPostEvidenceUrl(link);
  const problem = linkTouched ? linkProblem(link) : null;
  const busy = claim.isPending;
  const canSubmit = evidenceUrl !== null && certified && !busy;

  const close = () => {
    setLink("");
    setNote("");
    setCertified(false);
    setLinkTouched(false);
    onClose();
  };

  const submit = () => {
    if (!evidenceUrl || !certified) return;
    const reviewerNote = note.trim();
    claim.mutate(
      reviewerNote ? { evidenceUrl, certified: true, note: reviewerNote } : { evidenceUrl, certified: true },
      {
        onSuccess: () => {
          showSuccess(OWN_POST_SUBMITTED_MESSAGE);
          close();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : close}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Submit your own post</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="LinkedIn post link"
            placeholder="https://www.linkedin.com/posts/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => setLinkTouched(true)}
            required
            fullWidth
            disabled={busy}
            error={problem !== null}
            helperText={problem ?? "Open your post on LinkedIn and copy its link."}
            slotProps={{ htmlInput: { inputMode: "url", autoComplete: "off" } }}
          />
          <TextField
            label="Note for the reviewer (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            disabled={busy}
            helperText={`${note.length} / ${OWN_POST_NOTE_MAX_LENGTH}`}
            slotProps={{ htmlInput: { maxLength: OWN_POST_NOTE_MAX_LENGTH } }}
          />
          <FormControlLabel
            control={
              <Checkbox checked={certified} onChange={(e) => setCertified(e.target.checked)} disabled={busy} required />
            }
            label={CERTIFY_LABEL}
          />
          <Typography variant="body2" color="text.secondary">
            {OWN_POST_NEXT_STEPS}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {busy ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
